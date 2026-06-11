/**
 * @module freelance-hunter/index
 * @description Orquestrador do Freelance Hunter.
 * Fluxo: scraping Workana + Freelancer.com (falhas individuais não interrompem) →
 *        normalização → dedup cross-platform → análise LLM (OpenRouter) → propostas → e-mail.
 */

import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { generateCoverLetters } from '../shared/cover-letter.js'
import { sendFreelanceEmail, sendErrorEmail } from '../shared/email.js'
// DESATIVADO temporariamente (custo Apify + Cloudflare). Reativar avaliando alternativas.
// import { scrapeUpwork } from './scrapers/upwork.js'
import { scrapeWorkana } from './scrapers/workana.js'
import { scrapeFreelancer } from './scrapers/freelancer.js'
import { normalizeProject } from './normalizer.js'
import { checkEnv } from '../shared/check-env.js'

// Caminho do arquivo de dedup — gerenciado via GitHub Actions cache
const SEEN_FILE = 'data/seen-projects.json'

// Objeto de uso vazio para scrapers/cover letters desativados
const EMPTY_USAGE = { inputTokens: 0, outputTokens: 0, costUsd: 0 }

// Rastreia a etapa atual para incluir no e-mail de erro em caso de falha
let currentStep = 'inicialização'

/**
 * Calcula similaridade Jaccard entre dois títulos baseada em conjuntos de palavras.
 * Usado para deduplicar projetos semelhantes entre plataformas diferentes.
 * @param {string} a - Primeiro título.
 * @param {string} b - Segundo título.
 * @returns {number} Score de similaridade entre 0 e 1.
 */
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

/**
 * Remove projetos duplicados entre plataformas usando similaridade de título (Jaccard > 0.8).
 * Mantém o primeiro encontrado em caso de duplicata.
 * @param {Object[]} projects - Projetos normalizados de todas as plataformas.
 * @returns {Object[]} Projetos sem duplicatas cross-platform.
 */
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

  // ── 0. Valida configuração (falha rápido se faltar secret) ────────────────
  checkEnv('freelance-hunter')

  // ── 1. Carrega histórico de dedup ──────────────────────────────────────────
  const seenIds = loadSeen(SEEN_FILE)
  console.log(`📋 ${seenIds.length} projetos já vistos no cache`)

  // ── 2. Scraping das plataformas ────────────────────────────────────────────
  currentStep = 'scraping plataformas'
  console.log('🔍 Buscando projetos nas plataformas...')
  const [workanaResult, freelancerResult] = await Promise.allSettled([
    scrapeWorkana(),
    scrapeFreelancer()
    // scrapeUpwork() — DESATIVADO temporariamente (custo Apify + Cloudflare)
  ])

  const platformProjects = { Workana: [], 'Freelancer.com': [] }

  if (workanaResult.status === 'fulfilled') {
    const { projects } = workanaResult.value
    console.log(`  ✅ Workana: ${projects.length} projetos`)
    platformProjects['Workana'] = projects
  } else {
    console.warn(`  ⚠️  Workana falhou (continuando): ${workanaResult.reason?.message}`)
  }

  if (freelancerResult.status === 'fulfilled') {
    const { projects } = freelancerResult.value
    console.log(`  ✅ Freelancer.com: ${projects.length} projetos`)
    platformProjects['Freelancer.com'] = projects
  } else {
    console.warn(`  ⚠️  Freelancer.com falhou (continuando): ${freelancerResult.reason?.message}`)
  }

  // ── 3. Normalização e dedup ────────────────────────────────────────────────
  const rawProjects = [
    ...platformProjects['Workana'].map(p => normalizeProject(p, 'Workana')),
    ...platformProjects['Freelancer.com'].map(p => normalizeProject(p, 'Freelancer.com'))
  ]

  console.log(`📦 ${rawProjects.length} projetos — Workana: ${platformProjects['Workana'].length} | Freelancer.com: ${platformProjects['Freelancer.com'].length}`)

  // Dedup cross-platform (remove similares entre plataformas) + dedup histórico
  const deduped = dedupCrossplatform(rawProjects)
  const newProjects = filterNew(deduped, seenIds)
  console.log(`🆕 ${newProjects.length} novos após dedup`)

  if (newProjects.length === 0) {
    console.log('ℹ️  Nenhum projeto novo encontrado. Encerrando.')
    process.exit(0)
  }

  // ── 4. Análise de compatibilidade com LLM ──────────────────────────────────
  currentStep = 'análise com LLM'
  console.log('🤖 Analisando com LLM (OpenRouter)...')
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

  // Ordena por win_probability descrescente para priorizar melhores oportunidades
  aceitar = aceitar.sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))

  // ── 5. Geração de propostas (apenas para ACEITAR) ──────────────────────────
  currentStep = 'geração de propostas'
  let clUsage = EMPTY_USAGE
  let coverLetters = []
  if (aceitar.length > 0) {
    console.log(`✍️  Gerando propostas para ${aceitar.length} projetos...`)
    const clResult = await generateCoverLetters(aceitar, 'freelance')
    coverLetters = clResult.results
    clUsage = clResult.usage
  }

  // ── 6. Monta resumo de custos da execução (tudo gratuito — custo zero) ─────
  const usageSummary = {
    scrapers: [
      { name: 'Workana (scraping direto)', costUsd: 0, items: platformProjects['Workana'].length },
      { name: 'Freelancer.com (API nativa)', costUsd: 0, items: platformProjects['Freelancer.com'].length }
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
    totalCostUsd: 0,
    estimatedMonthlyCostUsd: 0
  }

  // ── 7. Envio do e-mail ─────────────────────────────────────────────────────
  currentStep = 'envio de e-mail'
  console.log('📧 Enviando e-mail...')
  await sendFreelanceEmail(aceitar, avaliar, coverLetters, usageSummary)

  // Persiste IDs analisados para dedup na próxima execução
  saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(p => p.id)])
  console.log(`✅ Freelance Hunter concluído! Custo total: $${usageSummary.totalCostUsd}`)
}

// Tratamento de erro fatal — tenta enviar e-mail de notificação antes de sair
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
