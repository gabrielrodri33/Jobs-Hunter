/**
 * @module freelance-hunter/scrapers/workana
 * @description Scraper de projetos do Workana via Apify (actor: getdataforme/workana-job-scraper).
 * Atualmente desabilitado no orquestrador — descomente as importações em index.js para ativar.
 *
 * Para personalizar as buscas, edite WORKANA_KEYWORDS abaixo.
 */

import { withRetry } from '../../shared/utils.js'

const APIFY_BASE = 'https://api.apify.com/v2'

// Actor do Workana no Apify — não altere sem testar compatibilidade do schema de saída
const ACTOR_ID = 'getdataforme~workana-job-scraper'

// Intervalo de polling para verificar status do run (10s)
const POLL_INTERVAL_MS = 10000

// Timeout máximo aguardando o run (8 minutos)
const TIMEOUT_MS = 8 * 60 * 1000

// Pausa entre keywords para evitar múltiplos runs simultâneos
const KEYWORD_DELAY_MS = 3000

/**
 * Keywords de busca para o Workana.
 * Edite para adicionar/remover termos conforme sua stack e área de atuação.
 */
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

/**
 * Busca projetos no Workana para cada keyword configurada via Apify.
 * Executa um run separado por keyword para melhor controle de resultados.
 *
 * @returns {Promise<{projects: Object[], apifyCostUsd: number}>}
 *   - projects: array de projetos brutos (normalizar com normalizeProject)
 *   - apifyCostUsd: custo total dos runs Apify desta execução
 */
export async function scrapeWorkana() {
  const token = process.env.APIFY_TOKEN
  const allProjects = []
  let totalCost = 0

  for (const keyword of WORKANA_KEYWORDS) {
    try {
      console.log(`  🔎 Workana: "${keyword}"`)

      // Inicia um run Apify para a keyword
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

    // Pausa entre keywords para evitar rate limiting
    await new Promise(r => setTimeout(r, KEYWORD_DELAY_MS))
  }

  return {
    projects: allProjects,
    apifyCostUsd: totalCost
  }
}
