import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { generateCoverLetters } from '../shared/cover-letter.js'
import { sendFreelanceEmail } from '../shared/email.js'
// import { scrapeUpwork } from './scrapers/upwork.js'    // desabilitado temporariamente
// import { scrapeWorkana } from './scrapers/workana.js'  // desabilitado temporariamente
import { scrapeFreelancer } from './scrapers/freelancer.js'
import { normalizeProject } from './normalizer.js'

const SEEN_FILE = 'data/seen-projects.json'

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

  console.log('🔍 Buscando projetos no Freelancer.com...')
  const [freelancerResult] = await Promise.allSettled([
    scrapeFreelancer()
    // scrapeUpwork()   — desabilitado
    // scrapeWorkana()  — desabilitado
  ])

  const platformProjects = { 'Freelancer.com': [] }

  if (freelancerResult.status === 'fulfilled') {
    console.log(`  ✅ Freelancer.com: ${freelancerResult.value.length} projetos`)
    platformProjects['Freelancer.com'] = freelancerResult.value
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

  console.log('🤖 Analisando com Claude...')
  const analyzed = await analyzeItems(newProjects, 'freelance')

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

  let coverLetters = []
  if (aceitar.length > 0) {
    console.log(`✍️  Gerando propostas para ${aceitar.length} projetos...`)
    coverLetters = await generateCoverLetters(aceitar, 'freelance')
  }

  console.log('📧 Enviando e-mail...')
  await sendFreelanceEmail(aceitar, avaliar, coverLetters)

  saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(p => p.id)])
  console.log('✅ Freelance Hunter concluído!')
}

main().catch(err => {
  console.error('💥 Erro fatal:', err)
  process.exit(1)
})
