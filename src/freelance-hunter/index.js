import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { generateCoverLetters } from '../shared/cover-letter.js'
import { sendFreelanceEmail, sendErrorEmail } from '../shared/email.js'
// import { scrapeUpwork } from './scrapers/upwork.js'    // desabilitado temporariamente
// import { scrapeWorkana } from './scrapers/workana.js'  // desabilitado temporariamente
import { scrapeFreelancer } from './scrapers/freelancer.js'
import { normalizeProject } from './normalizer.js'

const SEEN_FILE = 'data/seen-projects.json'

const EMPTY_USAGE = { inputTokens: 0, outputTokens: 0, costUsd: 0 }

let currentStep = 'inicialização'

// Similaridade Jaccard baseada em conjuntos de palavras
function titleSimilarity(a, b) {
  const words = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean))
  const wa = words(a)
  const wb = words(b)
  if (wa.size === 0 && wb.size === 0) return 1
  if (wa.size === 0 || wb.size === 0) return 0
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return intersection / union
}

function dedupCrossplatform(projects) {
  const result = []
  for (const project of projects) {
    const isDuplicate = result.some(
      existing =>
        existing.id !== project.id &&
        titleSimilarity(existing.title, project.title) > 0.8
    )
    if (!isDuplicate) result.push(project)
  }
  return result
}

async function main() {
  console.log(`💼 Freelance Hunter iniciado — ${new Date().toISOString()}`)

  const seenIds = loadSeen(SEEN_FILE)
  console.log(`📋 ${seenIds.length} projetos já vistos no cache`)

  // Valores zerados para scrapers desativados
  const upworkCost = 0
  const upworkProjects = []
  // const workanaCost = 0   // descomente quando ativar
  // const workanaProjects = []

  currentStep = 'scraping Freelancer.com'
  console.log('🔍 Buscando projetos no Freelancer.com...')
  const [freelancerResult] = await Promise.allSettled([
    scrapeFreelancer()
    // scrapeUpwork()   — desabilitado
    // scrapeWorkana()  — desabilitado
  ])

  const platformProjects = { Upwork: upworkProjects, Workana: [], 'Freelancer.com': [] }
  let freelancerCost = 0

  if (freelancerResult.status === 'fulfilled') {
    const { projects, apifyCostUsd } = freelancerResult.value
    console.log(`  ✅ Freelancer.com: ${projects.length} projetos`)
    platformProjects['Freelancer.com'] = projects
    freelancerCost = apifyCostUsd
  } else {
    console.error(`  ❌ Freelancer.com falhou: ${freelancerResult.reason?.message}`)
  }

  const rawProjects = [
    ...platformProjects['Freelancer.com'].map(p => normalizeProject(p, 'Freelancer.com'))
  ]

  console.log(`📦 ${rawProjects.length} projetos — Freelancer.com: ${platformProjects['Freelancer.com'].length}`)

  const deduped = dedupCrossplatform(rawProjects)
  const newProjects = filterNew(deduped, seenIds)
  console.log(`🆕 ${newProjects.length} novos após dedup`)

  if (newProjects.length === 0) {
    console.log('ℹ️  Nenhum projeto novo encontrado. Encerrando.')
    process.exit(0)
  }

  currentStep = 'análise com Claude'
  console.log('🤖 Analisando com Claude...')
  const { results: analyzed, usage: analyzerUsage } = await analyzeItems(newProjects, 'freelance')

  let aceitar = analyzed.filter(p => p.score === 'ACEITAR')
  const avaliar = analyzed.filter(p => p.score === 'AVALIAR')
  const ignorar = analyzed.filter(p => p.score === 'IGNORAR')

  console.log(`✅ ${aceitar.length} aceitar | 🟡 ${avaliar.length} avaliar | 🔴 ${ignorar.length} ignorados`)

  if (aceitar.length + avaliar.length === 0) {
    console.log('ℹ️  Nenhum projeto relevante após análise. Encerrando.')
    saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(p => p.id)])
    process.exit(0)
  }

  // Ordena por win_probability descrescente
  aceitar = aceitar.sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))

  currentStep = 'geração de propostas'
  let clUsage = EMPTY_USAGE
  let coverLetters = []
  if (aceitar.length > 0) {
    console.log(`✍️  Gerando propostas para ${aceitar.length} projetos...`)
    const clResult = await generateCoverLetters(aceitar, 'freelance')
    coverLetters = clResult.results
    clUsage = clResult.usage
  }

  const totalScraperCost = upworkCost + freelancerCost
  const usageSummary = {
    scrapers: [
      { name: 'Upwork (Apify)', costUsd: upworkCost, items: upworkProjects.length },
      { name: 'Workana (Apify)', costUsd: 0, items: platformProjects['Workana'].length },
      { name: 'Freelancer.com (API nativa)', costUsd: freelancerCost, items: platformProjects['Freelancer.com'].length }
    ],
    anthropic: {
      analysis: {
        inputTokens: analyzerUsage.inputTokens,
        outputTokens: analyzerUsage.outputTokens,
        items: newProjects.length,
        costUsd: analyzerUsage.costUsd
      },
      coverLetters: {
        inputTokens: clUsage.inputTokens,
        outputTokens: clUsage.outputTokens,
        items: aceitar.length,
        costUsd: clUsage.costUsd
      }
    },
    totalCostUsd: parseFloat(
      (totalScraperCost + analyzerUsage.costUsd + clUsage.costUsd).toFixed(4)
    ),
    estimatedMonthlyCostUsd: parseFloat(
      ((totalScraperCost + analyzerUsage.costUsd + clUsage.costUsd) * 22).toFixed(2)
    )
  }

  currentStep = 'envio de e-mail'
  console.log('📧 Enviando e-mail...')
  await sendFreelanceEmail(aceitar, avaliar, coverLetters, usageSummary)

  saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(p => p.id)])
  console.log(`✅ Freelance Hunter concluído! Custo total: $${usageSummary.totalCostUsd}`)
}

main().catch(async err => {
  console.error('💥 Erro fatal:', err)
  try {
    await sendErrorEmail({
      agent: 'freelance-hunter',
      error: err.stack ?? err.message,
      step: currentStep,
      timestamp: new Date().toISOString()
    })
  } catch (emailErr) {
    console.error('❌ Falha ao enviar e-mail de erro:', emailErr.message)
  }
  process.exit(1)
})
