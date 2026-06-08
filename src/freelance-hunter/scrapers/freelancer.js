// Documentação: https://developers.freelancer.com
// Token: developers.freelancer.com → criar app → OAuth 2.0 → gerar token pessoal (scopo: basic + projects)

import { withRetry } from '../../shared/utils.js'

const FREELANCER_API = 'https://www.freelancer.com/api/projects/0.1/projects/'
const KEYWORD_DELAY_MS = 1500

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

      const params = new URLSearchParams({
        query: keyword,
        job_details: 'true',
        full_description: 'true',
        limit: '20',
        offset: '0',
        active_only: 'true',
        sort_field: 'time_updated'
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

    await new Promise(r => setTimeout(r, KEYWORD_DELAY_MS))
  }

  return {
    projects: allProjects,
    apifyCostUsd: 0, // API gratuita
    apiCallsCount: FREELANCER_KEYWORDS.length
  }
}
