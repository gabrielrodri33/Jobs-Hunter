/**
 * @module job-hunter/scrapers/linkedin
 * @description Scraper de vagas do LinkedIn via Apify (actor: curious_coder/linkedin-jobs-scraper).
 * Inicia um run, aguarda conclusão com polling e retorna os itens do dataset.
 *
 * Para personalizar as buscas, edite SEARCH_URLS abaixo.
 * Formato de URL: linkedin.com/jobs/search/?keywords=...&location=...&f_WT=2 (remoto)
 */

import { withRetry } from '../../shared/utils.js'

const APIFY_BASE = 'https://api.apify.com/v2'

// Actor do LinkedIn — não altere sem testar compatibilidade do schema de saída
const ACTOR_ID = 'curious_coder~linkedin-jobs-scraper'

// Intervalo de polling para verificar status do run (15s)
const POLL_INTERVAL_MS = 15000

// Timeout máximo aguardando o run (10 minutos)
const TIMEOUT_MS = 10 * 60 * 1000

/**
 * URLs de busca do LinkedIn.
 * Edite para adicionar/remover termos de busca, localizações ou filtros.
 * Parâmetros úteis:
 *   f_WT=2  → apenas remoto
 *   f_TPR=r604800 → últimos 7 dias
 *   f_TPR=r2592000 → último mês
 *   f_LF=f_AL → Easy Apply
 */
export const SEARCH_URLS = [
  'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+.NET&location=United+States&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Desenvolvedor+Full+Stack+.NET&location=Brazil&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+.NET&location=Portugal&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Blue+Team+Analyst&location=Brazil&f_WT=2&f_TPR=r2592000&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=.NET+Developer+Remote&location=United+States&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+.NET&location=United+Kingdom&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0',
  'https://www.linkedin.com/jobs/search/?keywords=Desenvolvedor+.NET&location=Brazil&f_WT=2&f_TPR=r604800&f_LF=f_AL&position=1&pageNum=0'
]

/**
 * Consulta o custo em USD de um run Apify já finalizado.
 * @param {string} runId - ID do run Apify.
 * @param {string} token - Token de autenticação Apify.
 * @returns {Promise<number>} Custo em USD (0 em caso de erro).
 */
async function getRunCost(runId, token) {
  try {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    const data = await res.json()
    return data.data?.usageUsd ?? 0
  } catch {
    return 0
  }
}

/**
 * Aguarda um run Apify terminar com polling periódico.
 * @param {string} runId - ID do run a monitorar.
 * @param {string} token - Token de autenticação Apify.
 * @returns {Promise<string>} ID do dataset padrão do run.
 * @throws {Error} Se o run falhar, for abortado ou atingir timeout.
 */
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

/**
 * Executa o scraper do LinkedIn via Apify e retorna as vagas coletadas.
 * @returns {Promise<{jobs: Object[], apifyCostUsd: number}>}
 */
export async function runLinkedinScraper() {
  const token = process.env.APIFY_TOKEN

  // Inicia o run Apify com as URLs de busca configuradas
  const runData = await withRetry(() =>
    fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: 50,           // máximo de vagas por URL
        scrapeCompany: true, // coleta dados da empresa
        splitByLocation: false,
        urls: SEARCH_URLS
      })
    }).then(r => r.json())
  )

  const runId = runData.data?.id
  if (!runId) throw new Error(`Falha ao iniciar LinkedIn scraper: ${JSON.stringify(runData)}`)

  console.log(`  ⏳ Run iniciado: ${runId}`)

  // Aguarda conclusão e obtém ID do dataset
  const datasetId = await pollRunUntilFinished(runId, token)
  const apifyCostUsd = await getRunCost(runId, token)

  // Baixa todos os itens do dataset
  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=1000`)
  const items = await itemsRes.json()

  return {
    jobs: Array.isArray(items) ? items : [],
    apifyCostUsd
  }
}
