/**
 * @module job-hunter/index
 * @description Orquestrador do Job Hunter.
 * Fluxo: scraping LinkedIn → dedup → análise LLM (OpenRouter) → e-mail.
 */

import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { sendJobsEmail, sendErrorEmail } from '../shared/email.js'
import { runLinkedinScraper } from './scrapers/linkedin.js'

// Caminho do arquivo de dedup — gerenciado via GitHub Actions cache
const SEEN_FILE = 'data/seen-jobs.json'

// Rastreia a etapa atual para incluir no e-mail de erro em caso de falha
let currentStep = 'inicialização'

async function main() {
  console.log(`🎯 Job Hunter iniciado — ${new Date().toISOString()}`)

  // ── 1. Carrega histórico de dedup ──────────────────────────────────────────
  const seenIds = loadSeen(SEEN_FILE)
  console.log(`📋 ${seenIds.length} vagas já vistas no cache`)

  // ── 2. Scraping LinkedIn (endpoint guest) ─────────────────────────────────────
  currentStep = 'scraping LinkedIn'
  console.log('🔍 Buscando vagas no LinkedIn...')
  const { jobs: rawJobs, apifyCostUsd: linkedinCost } = await runLinkedinScraper()
  console.log(`📦 ${rawJobs.length} vagas coletadas`)

  // Filtra apenas vagas não vistas em execuções anteriores
  const newJobs = filterNew(rawJobs, seenIds)
  console.log(`🆕 ${newJobs.length} novas após dedup`)

  if (newJobs.length === 0) {
    console.log('ℹ️  Nenhuma vaga nova encontrada. Encerrando.')
    process.exit(0)
  }

  // ── 3. Análise de compatibilidade com Claude ───────────────────────────────
  currentStep = 'análise com LLM'
  console.log('🤖 Analisando com LLM (OpenRouter)...')
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

  // ── 4. Monta resumo de custos da execução ──────────────────────────────────
  const usageSummary = {
    scrapers: [
      { name: 'LinkedIn (scraping direto)', costUsd: linkedinCost, items: rawJobs.length }
    ],
    anthropic: {
      analysis: {
        inputTokens: analyzerUsage.inputTokens,
        outputTokens: analyzerUsage.outputTokens,
        items: newJobs.length,
        costUsd: analyzerUsage.costUsd
      }
    },
    totalCostUsd: parseFloat(
      (linkedinCost + analyzerUsage.costUsd).toFixed(4)
    ),
    estimatedMonthlyCostUsd: parseFloat(
      ((linkedinCost + analyzerUsage.costUsd) * 22).toFixed(2)
    )
  }

  // ── 5. Envio do e-mail ─────────────────────────────────────────────────────
  currentStep = 'envio de e-mail'
  console.log('📧 Enviando e-mail...')
  await sendJobsEmail(candidatar, avaliar, [], usageSummary)

  // Persiste IDs analisados para dedup na próxima execução
  saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(j => j.id)])
  console.log(`✅ Job Hunter concluído! Custo total: $${usageSummary.totalCostUsd}`)
}

// Tratamento de erro fatal — tenta enviar e-mail de notificação antes de sair
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
