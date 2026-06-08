import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { generateCoverLetters } from '../shared/cover-letter.js'
import { sendFreelanceEmail } from '../shared/email.js'
import { scrapeUpwork } from './scrapers/upwork.js'
import { scrapeWorkana } from './scrapers/workana.js'
import { scrapeFreelancer } from './scrapers/freelancer.js'
import { normalizeProject } from './normalizer.js'

const SEEN_FILE = 'data/seen-projects.json'

// Dedup cross-platform por similaridade de título (>80% chars em comum)
function titleSimilarity(a, b) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  const longer = na.length > nb.length ? na : nb
  const shorter = na.length > nb.length ? nb : na
  let matches = 0
  for (const ch of shorter) {
    if (longer.includes(ch)) matches++
  }
  return matches / longer.length
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

  console.log('🔍 Iniciando scrapers em paralelo...')
  const [upworkResult, workanaResult, freelancerResult] = await Promise.allSettled([
    scrapeUpwork(),
    scrapeWorkana(),
    scrapeFreelancer()
  ])

  const scraperStatus = [
    { name: 'Upwork', result: upworkResult },
    { name: 'Workana', result: workanaResult },
    { name: 'Freelancer.com', result: freelancerResult }
  ]

  const platformProjects = { Upwork: [], Workana: [], 'Freelancer.com': [] }

  for (const { name, result } of scraperStatus) {
    if (result.status === 'fulfilled') {
      console.log(`  ✅ ${name}: ${result.value.length} projetos`)
      platformProjects[name] = result.value
    } else {
      console.error(`  ❌ ${name} falhou: ${result.reason?.message}`)
    }
  }

  const rawProjects = [
    ...platformProjects['Upwork'].map(p => normalizeProject(p, 'Upwork')),
    ...platformProjects['Workana'].map(p => normalizeProject(p, 'Workana')),
    ...platformProjects['Freelancer.com'].map(p => normalizeProject(p, 'Freelancer.com'))
  ]

  console.log(
    `📦 ${rawProjects.length} projetos — ` +
    `Upwork: ${platformProjects['Upwork'].length} | ` +
    `Workana: ${platformProjects['Workana'].length} | ` +
    `Freelancer.com: ${platformProjects['Freelancer.com'].length}`
  )

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
