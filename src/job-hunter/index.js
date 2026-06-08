import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { generateCoverLetters } from '../shared/cover-letter.js'
import { sendJobsEmail, sendErrorEmail } from '../shared/email.js'
import { runLinkedinScraper } from './scrapers/linkedin.js'

const SEEN_FILE = 'data/seen-jobs.json'

const EMPTY_USAGE = { inputTokens: 0, outputTokens: 0, costUsd: 0 }

let currentStep = 'inicialização'

async function main() {
  console.log(`🎯 Job Hunter iniciado — ${new Date().toISOString()}`)

  const seenIds = loadSeen(SEEN_FILE)
  console.log(`📋 ${seenIds.length} vagas já vistas no cache`)

  currentStep = 'scraping LinkedIn'
  console.log('🔍 Buscando vagas no LinkedIn...')
  const { jobs: rawJobs, apifyCostUsd: linkedinCost } = await runLinkedinScraper()
  console.log(`📦 ${rawJobs.length} vagas coletadas`)

  const newJobs = filterNew(rawJobs, seenIds)
  console.log(`🆕 ${newJobs.length} novas após dedup`)

  if (newJobs.length === 0) {
    console.log('ℹ️  Nenhuma vaga nova encontrada. Encerrando.')
    process.exit(0)
  }

  currentStep = 'análise com Claude'
  console.log('🤖 Analisando com Claude...')
  const { results: analyzed, usage: analyzerUsage } = await analyzeItems(newJobs, 'job')

  const candidatar = analyzed.filter(j => j.score === 'CANDIDATAR')
  const avaliar = analyzed.filter(j => j.score === 'AVALIAR')
  const ignorar = analyzed.filter(j => j.score === 'IGNORAR')

  console.log(`✅ ${candidatar.length} candidatar | 🟡 ${avaliar.length} avaliar | 🔴 ${ignorar.length} ignoradas`)

  if (candidatar.length + avaliar.length === 0) {
    console.log('ℹ️  Nenhuma vaga relevante após análise. Encerrando.')
    saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(j => j.id)])
    process.exit(0)
  }

  currentStep = 'geração de cover letters'
  let clUsage = EMPTY_USAGE
  let coverLetters = []
  if (candidatar.length > 0) {
    console.log(`✍️  Gerando cover letters para ${candidatar.length} vagas...`)
    const clResult = await generateCoverLetters(candidatar, 'job')
    coverLetters = clResult.results
    clUsage = clResult.usage
  }

  const usageSummary = {
    scrapers: [
      { name: 'LinkedIn (Apify)', costUsd: linkedinCost, items: rawJobs.length }
    ],
    anthropic: {
      analysis: {
        inputTokens: analyzerUsage.inputTokens,
        outputTokens: analyzerUsage.outputTokens,
        items: newJobs.length,
        costUsd: analyzerUsage.costUsd
      },
      coverLetters: {
        inputTokens: clUsage.inputTokens,
        outputTokens: clUsage.outputTokens,
        items: candidatar.length,
        costUsd: clUsage.costUsd
      }
    },
    totalCostUsd: parseFloat(
      (linkedinCost + analyzerUsage.costUsd + clUsage.costUsd).toFixed(4)
    ),
    estimatedMonthlyCostUsd: parseFloat(
      ((linkedinCost + analyzerUsage.costUsd + clUsage.costUsd) * 22).toFixed(2)
    )
  }

  currentStep = 'envio de e-mail'
  console.log('📧 Enviando e-mail...')
  await sendJobsEmail(candidatar, avaliar, coverLetters, usageSummary)

  saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(j => j.id)])
  console.log(`✅ Job Hunter concluído! Custo total: $${usageSummary.totalCostUsd}`)
}

main().catch(async err => {
  console.error('💥 Erro fatal:', err)
  try {
    await sendErrorEmail({
      agent: 'job-hunter',
      error: err.stack ?? err.message,
      step: currentStep,
      timestamp: new Date().toISOString()
    })
  } catch (emailErr) {
    console.error('❌ Falha ao enviar e-mail de erro:', emailErr.message)
  }
  process.exit(1)
})
