import { loadSeen, saveSeen, filterNew } from '../shared/dedup.js'
import { analyzeItems } from '../shared/analyzer.js'
import { generateCoverLetters } from '../shared/cover-letter.js'
import { sendJobsEmail } from '../shared/email.js'
import { runLinkedinScraper } from './scrapers/linkedin.js'

const SEEN_FILE = 'data/seen-jobs.json'

async function main() {
  console.log(`🎯 Job Hunter iniciado — ${new Date().toISOString()}`)

  const seenIds = loadSeen(SEEN_FILE)
  console.log(`📋 ${seenIds.length} vagas já vistas no cache`)

  console.log('🔍 Buscando vagas no LinkedIn...')
  const rawJobs = await runLinkedinScraper()
  console.log(`📦 ${rawJobs.length} vagas coletadas`)

  const newJobs = filterNew(rawJobs, seenIds)
  console.log(`🆕 ${newJobs.length} novas após dedup`)

  if (newJobs.length === 0) {
    console.log('ℹ️  Nenhuma vaga nova encontrada. Encerrando.')
    process.exit(0)
  }

  console.log('🤖 Analisando com Claude...')
  const analyzed = await analyzeItems(newJobs, 'job')

  const candidatar = analyzed.filter(j => j.score === 'CANDIDATAR')
  const avaliar = analyzed.filter(j => j.score === 'AVALIAR')
  const ignorar = analyzed.filter(j => j.score === 'IGNORAR')

  console.log(`✅ ${candidatar.length} candidatar | 🟡 ${avaliar.length} avaliar | 🔴 ${ignorar.length} ignoradas`)

  if (candidatar.length + avaliar.length === 0) {
    console.log('ℹ️  Nenhuma vaga relevante após análise. Encerrando.')
    saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(j => j.id)])
    process.exit(0)
  }

  let coverLetters = []
  if (candidatar.length > 0) {
    console.log(`✍️  Gerando cover letters para ${candidatar.length} vagas...`)
    coverLetters = await generateCoverLetters(candidatar, 'job')
  }

  console.log('📧 Enviando e-mail...')
  await sendJobsEmail(candidatar, avaliar, coverLetters)

  saveSeen(SEEN_FILE, [...seenIds, ...analyzed.map(j => j.id)])
  console.log('✅ Job Hunter concluído!')
}

main().catch(err => {
  console.error('💥 Erro fatal:', err)
  process.exit(1)
})
