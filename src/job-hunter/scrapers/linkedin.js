/**
 * @module job-hunter/scrapers/linkedin
 * @description Scraper de vagas do LinkedIn via actor customizado no Apify.
 * Usa o actor linkedin-easy-apply-scraper que verifica Easy Apply em cada vaga.
 *
 * Configuração via variáveis de ambiente:
 *   APIFY_ACTOR_ID_LINKEDIN  → ID do actor no Apify (ex: usuario~linkedin-easy-apply-scraper)
 *   LINKEDIN_QUERIES         → queries separadas por vírgula
 *   LINKEDIN_LOCATION        → localização (padrão: Brazil)
 *   LINKEDIN_REMOTE          → "true"/"false" (padrão: true)
 *   LINKEDIN_EASY_APPLY_ONLY → "true"/"false" (padrão: true)
 *   LINKEDIN_MAX_PER_QUERY   → inteiro (padrão: 25)
 *   LINKEDIN_DATE_POSTED     → r86400 | r604800 | r2592000 (padrão: r604800)
 */

import { withRetry } from '../../shared/utils.js'

const APIFY_BASE = 'https://api.apify.com/v2'
const POLL_INTERVAL_MS = 15000
const TIMEOUT_MS = 20 * 60 * 1000  // 20 min — actor otimizado roda em ~5 min

function getActorInput() {
  const queries = process.env.LINKEDIN_QUERIES
    ? process.env.LINKEDIN_QUERIES.split(',').map(q => q.trim()).filter(Boolean)
    : [
        'Full Stack Developer .NET',
        'Desenvolvedor Full Stack .NET',
        'Desenvolvedor .NET',
        '.NET Developer Remote',
        'Blue Team Analyst',
      ]

  return {
    searchQueries: queries,
    location: process.env.LINKEDIN_LOCATION ?? 'Brazil',
    remote: (process.env.LINKEDIN_REMOTE ?? 'true') === 'true',
    easyApplyOnly: (process.env.LINKEDIN_EASY_APPLY_ONLY ?? 'true') === 'true',
    datePosted: process.env.LINKEDIN_DATE_POSTED ?? 'r604800',
    maxResultsPerQuery: parseInt(process.env.LINKEDIN_MAX_PER_QUERY ?? '25', 10),
  }
}

async function getRunCost(runId, token) {
  try {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    const data = await res.json()
    return data.data?.usageUsd ?? 0
  } catch {
    return 0
  }
}

async function pollRunUntilFinished(runId, token) {
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    const data = await res.json()
    const status = data.data?.status

    if (status === 'SUCCEEDED') return data.data.defaultDatasetId
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`LinkedIn scraper run ${status}`)
    }
  }

  throw new Error('LinkedIn scraper timeout')
}

export async function runLinkedinScraper() {
  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_ACTOR_ID_LINKEDIN

  if (!actorId) throw new Error('APIFY_ACTOR_ID_LINKEDIN não configurado')

  const actorInput = getActorInput()
  console.log(`  ⚙️  Queries: ${actorInput.searchQueries.join(' | ')}`)
  console.log(`  ⚙️  Location: ${actorInput.location} | Remote: ${actorInput.remote} | EasyApply: ${actorInput.easyApplyOnly}`)

  const runData = await withRetry(() =>
    fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
    }).then(r => r.json())
  )

  const runId = runData.data?.id
  if (!runId) throw new Error(`Falha ao iniciar LinkedIn scraper: ${JSON.stringify(runData)}`)

  console.log(`  ⏳ Run iniciado: ${runId}`)

  const datasetId = await pollRunUntilFinished(runId, token)
  const apifyCostUsd = await getRunCost(runId, token)

  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=1000`)
  const items = await itemsRes.json()

  return {
    jobs: Array.isArray(items) ? items : [],
    apifyCostUsd,
  }
}
