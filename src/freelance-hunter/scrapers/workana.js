/**
 * @module freelance-hunter/scrapers/workana
 * @description Scraper de projetos do Workana via busca pública — sem Apify.
 * Tenta primeiro extrair dados de JSON embutido na página; se não houver,
 * parseia o HTML com cheerio.
 *
 * Para personalizar as buscas, edite WORKANA_KEYWORDS abaixo.
 */

import * as cheerio from 'cheerio'
import { sleep } from '../../shared/utils.js'

const SEARCH_URL = 'https://www.workana.com/jobs'

// Tentativas por request em 429/5xx, com backoff exponencial
const MAX_RETRIES = 3

// Headers de browser real
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

export const WORKANA_KEYWORDS = [
  '.NET',
  'segurança da informação',
]

/** Delay aleatório entre 2 e 5 segundos entre requests. */
function randomDelay() {
  return sleep(2000 + Math.floor(Math.random() * 3000))
}

/**
 * Faz fetch da página de busca com retry exponencial em 429/5xx.
 * @param {string} url - URL completa.
 * @returns {Promise<string>} HTML da página.
 */
async function fetchPage(url) {
  let lastErr
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (res.ok) return await res.text()
      const err = new Error(`HTTP ${res.status}`)
      err.retryable = res.status === 429 || res.status >= 500
      throw err
    } catch (err) {
      lastErr = err
      if (err.retryable === false) throw err
      if (attempt < MAX_RETRIES - 1) {
        const delay = 2000 * Math.pow(2, attempt)
        console.warn(`    ⚠️  ${err.message} — retry em ${delay}ms`)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}

/**
 * Tenta extrair projetos de JSON embutido na página (__NEXT_DATA__ ou estado inicial).
 * @param {string} html - HTML da página de busca.
 * @returns {Object[]|null} Projetos brutos ou null se não houver JSON embutido reconhecível.
 */
function tryParseEmbeddedJson(html) {
  const patterns = [
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/,
    /window\.preloadedData\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/
  ]

  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (!m) continue
    try {
      const data = JSON.parse(m[1])
      // Procura um array de projetos em caminhos conhecidos
      const candidates = [
        data?.props?.pageProps?.projects,
        data?.props?.pageProps?.results,
        data?.projects?.items,
        data?.projects,
        data?.results
      ]
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) return c
      }
    } catch {
      // JSON embutido ilegível — cai para o parse de HTML
    }
  }
  return null
}

/**
 * Parseia os cards de projeto do HTML da busca com cheerio.
 * @param {string} html - HTML da página de busca.
 * @returns {Object[]} Projetos no formato esperado por normalizeWorkana.
 */
function parseHtmlProjects(html) {
  const $ = cheerio.load(html)
  const projects = []

  $('.project-item, [class*="project-item"]').each((_, el) => {
    const $card = $(el)
    const $link = $card.find('h2 a, .project-title a, a[href*="/job/"]').first()
    const title = $link.text().trim()
    if (!title) return

    let url = $link.attr('href') ?? ''
    if (url && !url.startsWith('http')) url = `https://www.workana.com${url}`

    // Slug da URL serve como ID estável
    const slug = url.split('/').filter(Boolean).pop()?.split('?')[0]

    projects.push({
      id: slug,
      slug,
      title,
      description: $card.find('.project-details, .html-desc, p').first().text().trim(),
      budget: $card.find('.budget, .values, [class*="budget"]').first().text().replace(/\s+/g, ' ').trim() || null,
      skills: $card.find('.skills a, [class*="skill"] a').map((_, s) => $(s).text().trim()).get(),
      proposals: parseInt($card.find('.bids, [class*="bids"]').first().text().replace(/\D/g, ''), 10) || null,
      published_at: $card.find('time').attr('datetime') ?? null,
      url
    })
  })

  return projects
}

/**
 * Busca projetos no Workana para cada keyword configurada, sem Apify.
 * Falha em uma keyword (após retries) não interrompe as demais.
 *
 * @returns {Promise<{projects: Object[], apifyCostUsd: number}>}
 *   - projects: array de projetos brutos (normalizar com normalizeProject)
 *   - apifyCostUsd: sempre 0 (scraping direto, sem custo)
 */
export async function scrapeWorkana() {
  const allProjects = []

  for (const keyword of WORKANA_KEYWORDS) {
    try {
      console.log(`  🔎 Workana: "${keyword}"`)

      const params = new URLSearchParams({ query: keyword, language: 'pt,en' })
      const html = await fetchPage(`${SEARCH_URL}?${params}`)

      // Preferência: JSON embutido; fallback: parse do HTML
      const embedded = tryParseEmbeddedJson(html)
      const projects = embedded ?? parseHtmlProjects(html)

      console.log(`    📦 ${projects.length} projetos (${embedded ? 'JSON embutido' : 'HTML'})`)
      allProjects.push(...projects)
    } catch (err) {
      console.warn(`  ⚠️  Workana erro "${keyword}": ${err.message} — continuando`)
    }

    await randomDelay()
  }

  return {
    projects: allProjects,
    apifyCostUsd: 0
  }
}
