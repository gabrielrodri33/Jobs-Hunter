import { withRetry } from '../../shared/utils.js'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'getdataforme~workana-job-scraper'
const POLL_INTERVAL_MS = 10000
const TIMEOUT_MS = 8 * 60 * 1000
const KEYWORD_DELAY_MS = 3000

export const WORKANA_KEYWORDS = [
  '.NET',
  'Full Stack',
  'React Next.js',
  'Power BI',
  'Python automação',
  'C# desenvolvedor',
  'segurança da informação',
  'desenvolvimento web'
]

async function getRunCost(runId, token) {
  try {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    const data = await res.json()
    return data.data?.usageUsd ?? 0
  } catch {
    return 0
  }
}

async function pollRun(runId, token) {
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    const data = await res.json()
    const status = data.data?.status

    if (status === 'SUCCEEDED') return data.data.defaultDatasetId
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Workana run ${status}`)
    }
  }
  throw new Error('Workana scraper timeout')
}

export async function scrapeWorkana() {
  const token = process.env.APIFY_TOKEN
  const allProjects = []
  let totalCost = 0

  for (const keyword of WORKANA_KEYWORDS) {
    try {
      console.log(`  🔎 Workana: "${keyword}"`)

      const runData = await withRetry(() =>
        fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: keyword, maxItems: 15 })
        }).then(r => r.json())
      )

      const runId = runData.data?.id
      if (!runId) throw new Error(`Falha ao iniciar: ${JSON.stringify(runData)}`)

      const datasetId = await pollRun(runId, token)
      totalCost += await getRunCost(runId, token)

      const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=100`)
      const items = await itemsRes.json()

      if (Array.isArray(items)) allProjects.push(...items)
    } catch (err) {
      console.error(`  ❌ Workana erro "${keyword}": ${err.message}`)
    }

    await new Promise(r => setTimeout(r, KEYWORD_DELAY_MS))
  }

  return {
    projects: allProjects,
    apifyCostUsd: totalCost
  }
}
