import { withRetry } from '../../shared/utils.js'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'curious_coder~linkedin-jobs-scraper'
const POLL_INTERVAL_MS = 15000
const TIMEOUT_MS = 10 * 60 * 1000

export const SEARCH_URLS = [
  'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+.NET&location=United+States&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Desenvolvedor+Full+Stack+.NET&location=Brazil&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+.NET&location=Portugal&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Blue+Team+Analyst&location=Brazil&f_WT=2&f_TPR=r2592000&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=.NET+Developer+Remote&location=United+States&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+.NET&location=United+Kingdom&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Desenvolvedor+.NET&location=Brazil&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0'
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

  const runData = await withRetry(() =>
    fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: 50,
        scrapeCompany: true,
        splitByLocation: false,
        urls: SEARCH_URLS
      })
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
    apifyCostUsd
  }
}
