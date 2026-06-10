/**
 * @module job-hunter/scrapers/linkedin
 * @description Scraper de vagas do LinkedIn via endpoint público de guest — sem Apify,
 * sem login, sem cookie. Parseia o HTML retornado com cheerio.
 *
 * Endpoint: /jobs-guest/jobs/api/seeMoreJobPostings/search
 * Params:   keywords, location, f_TPR (recência), f_WT=2 (remoto), start (paginação 25 em 25)
 *
 * Para personalizar as buscas, edite o array SEARCHES abaixo.
 */

import * as cheerio from 'cheerio'
import { sleep } from '../../shared/utils.js'

const GUEST_API = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'

// Máximo de páginas por busca (25 vagas por página)
const MAX_PAGES = 2

// Tentativas por request em 429/5xx, com backoff exponencial
const MAX_RETRIES = 3

// Headers de browser real — o endpoint guest rejeita user agents óbvios de bot
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

// Buscas — preserva as queries usadas anteriormente
export const SEARCHES = [
  { keywords: 'Full Stack Developer .NET', location: 'Brazil', remote: true },
  { keywords: 'Desenvolvedor Full Stack .NET', location: 'Brazil', remote: true },
  { keywords: 'Desenvolvedor .NET', location: 'Brazil', remote: true },
  { keywords: '.NET Developer Remote', location: 'Brazil', remote: true },
  { keywords: 'Blue Team Analyst', location: 'Brazil', remote: true },
]

/** Delay aleatório entre 2 e 5 segundos para não sobrecarregar o endpoint. */
function randomDelay() {
  return sleep(2000 + Math.floor(Math.random() * 3000))
}

/**
 * Faz fetch de uma página do endpoint guest com retry exponencial em 429/5xx.
 * @param {string} url - URL completa com query params.
 * @returns {Promise<string>} HTML da página de resultados.
 */
async function fetchPage(url) {
  let lastErr
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (res.ok) return await res.text()
      const err = new Error(`HTTP ${res.status}`)
      // Apenas 429 e 5xx são transitórios — outros 4xx falham direto
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
 * Extrai o job ID do atributo data-entity-urn ou da URL da vaga.
 * @param {Object} $card - Elemento cheerio do card da vaga.
 * @param {string} link - URL da vaga.
 * @returns {string|null} Job ID numérico ou null.
 */
function extractJobId($card, link) {
  const urn = $card.attr('data-entity-urn') ?? $card.find('[data-entity-urn]').attr('data-entity-urn')
  if (urn) {
    const m = urn.match(/(\d+)$/)
    if (m) return m[1]
  }
  const m = link?.match(/-(\d+)(?:\?|$)/) ?? link?.match(/\/view\/(\d+)/)
  return m ? m[1] : null
}

/**
 * Parseia o HTML do endpoint guest e extrai os cards de vaga.
 * @param {string} html - HTML retornado pelo endpoint.
 * @returns {Object[]} Vagas extraídas (id, title, company, location, link, posted_at).
 */
function parseJobs(html) {
  const $ = cheerio.load(html)
  const jobs = []

  $('li').each((_, el) => {
    const $card = $(el)
    const title = $card.find('.base-search-card__title').text().trim()
    if (!title) return

    const link = ($card.find('a.base-card__full-link').attr('href') ??
      $card.find('a').first().attr('href') ?? '').split('?')[0]
    const jobId = extractJobId($card, link)

    jobs.push({
      id: jobId ? `linkedin-${jobId}` : `linkedin-${Buffer.from(link).toString('base64').slice(0, 16)}`,
      title,
      company: $card.find('.base-search-card__subtitle').text().trim() || 'Não informado',
      location: $card.find('.job-search-card__location').text().trim() || 'Não informado',
      link,
      posted_at: $card.find('time').attr('datetime') ?? null,
      description: '',
      platform: 'LinkedIn'
    })
  })

  return jobs
}

/**
 * Busca vagas no LinkedIn para todas as buscas configuradas em SEARCHES.
 * Falha em uma busca (após retries) não interrompe as demais.
 *
 * @returns {Promise<{jobs: Object[], apifyCostUsd: number}>}
 *   - jobs: vagas coletadas e deduplicadas por id
 *   - apifyCostUsd: sempre 0 (scraping direto, sem custo)
 */
export async function runLinkedinScraper() {
  const datePosted = process.env.LINKEDIN_DATE_POSTED ?? 'r86400'
  const byId = new Map()

  for (const search of SEARCHES) {
    console.log(`  🔎 LinkedIn: "${search.keywords}" (${search.location})`)

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        keywords: search.keywords,
        location: search.location,
        f_TPR: datePosted,
        start: String(page * 25)
      })
      if (search.remote) params.set('f_WT', '2')

      try {
        const html = await fetchPage(`${GUEST_API}?${params}`)
        const jobs = parseJobs(html)

        for (const job of jobs) {
          if (!byId.has(job.id)) byId.set(job.id, job)
        }

        // Página vazia = fim dos resultados desta busca
        if (jobs.length === 0) break
      } catch (err) {
        console.warn(`    ⚠️  Busca "${search.keywords}" página ${page + 1} falhou: ${err.message} — continuando`)
        break
      }

      await randomDelay()
    }

    await randomDelay()
  }

  return {
    jobs: [...byId.values()],
    apifyCostUsd: 0
  }
}
