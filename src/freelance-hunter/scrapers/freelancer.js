/**
 * @module freelance-hunter/scrapers/freelancer
 * @description Scraper de projetos via API REST nativa do Freelancer.com (gratuita).
 * Documentação: https://developers.freelancer.com
 *
 * Token: developers.freelancer.com → My Apps → Create App → OAuth 2.0 →
 *        gerar token pessoal com escopos: basic + projects
 *
 * Para personalizar as buscas, edite FREELANCER_KEYWORDS abaixo.
 */

import { withRetry } from '../../shared/utils.js'

// Endpoint base da API de projetos do Freelancer.com
const FREELANCER_API = 'https://www.freelancer.com/api/projects/0.1/projects/'

// Pausa entre keywords para respeitar rate limits da API
const KEYWORD_DELAY_MS = 1500

/**
 * Keywords de busca para o Freelancer.com.
 * Edite para adicionar/remover termos conforme sua stack e área de atuação.
 */
export const FREELANCER_KEYWORDS = [
  '.NET developer',
  'C# development',
  'Full Stack React',
  'Next.js developer',
  'Power BI dashboard',
  'Python automation',
  'cybersecurity consultant',
  'SaaS development',
  'API integration'
]

/**
 * Busca projetos ativos no Freelancer.com para cada keyword configurada.
 * A API é gratuita — não gera custo Apify (apifyCostUsd sempre retorna 0).
 *
 * @returns {Promise<{projects: Object[], apifyCostUsd: number, apiCallsCount: number}>}
 *   - projects: array de projetos brutos da API (normalizar com normalizeProject)
 *   - apifyCostUsd: sempre 0 (API nativa gratuita)
 *   - apiCallsCount: número de chamadas realizadas (= número de keywords)
 */
export async function scrapeFreelancer() {
  const token = process.env.FREELANCER_TOKEN

  if (!token) {
    console.warn('  ⚠️  FREELANCER_TOKEN não definido — pulando Freelancer.com')
    return { projects: [], apifyCostUsd: 0, apiCallsCount: 0 }
  }

  const allProjects = []

  for (const keyword of FREELANCER_KEYWORDS) {
    try {
      console.log(`  🔎 Freelancer.com: "${keyword}"`)

      // Parâmetros da busca — retorna até 20 projetos ativos por keyword
      const params = new URLSearchParams({
        query: keyword,
        job_details: 'true',
        full_description: 'true',
        limit: '20',
        offset: '0',
        active_only: 'true',
        sort_field: 'time_updated'  // mais recentes primeiro
      })

      const data = await withRetry(() =>
        fetch(`${FREELANCER_API}?${params}`, {
          headers: { 'freelancer-oauth-v1': token }
        }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
      )

      const projects = data?.result?.projects ?? []
      allProjects.push(...projects)
    } catch (err) {
      console.error(`  ❌ Freelancer.com erro "${keyword}": ${err.message}`)
    }

    // Pausa entre keywords para respeitar rate limits
    await new Promise(r => setTimeout(r, KEYWORD_DELAY_MS))
  }

  return {
    projects: allProjects,
    apifyCostUsd: 0, // API gratuita — sem custo
    apiCallsCount: FREELANCER_KEYWORDS.length
  }
}
