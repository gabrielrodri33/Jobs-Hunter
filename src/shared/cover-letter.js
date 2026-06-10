/**
 * @module cover-letter
 * @description Geração de cover letters e propostas freelance via OpenRouter (modelos gratuitos).
 * Gera versões em português e inglês apenas para os top N itens (default 5),
 * ordenados por win_probability/match_percentage.
 */

import { COVER_LETTER_PROMPT } from './profile.js'
import { callLlm, getModelChain, cleanJsonString } from './llm.js'
import { sleep } from './utils.js'

// Pausa entre cada geração (além do throttle global do llm.js)
const ITEM_DELAY_MS = 1000

// Máximo de cover letters por execução — configurável via MAX_COVER_LETTERS
function getMaxCoverLetters() {
  return parseInt(process.env.MAX_COVER_LETTERS ?? '5', 10)
}

/**
 * Monta o prompt de usuário para geração de cover letter de vaga de emprego.
 * @param {Object} item - Vaga analisada com campos title, company, location, match_points, differentials.
 * @returns {string} Prompt formatado.
 */
function buildJobPrompt(item) {
  return `Gere cover letter para esta vaga.
Título: ${item.title} | Empresa: ${item.company} | Local: ${item.location}
Match técnico: ${item.match_points?.join(', ')}
Diferencial: ${item.differentials}
Retorne apenas JSON: {"pt": "...", "en": "..."}`
}

/**
 * Monta o prompt de usuário para geração de proposta de projeto freelance.
 * @param {Object} item - Projeto analisado com campos title, client, platform, budget, tech_match, proposal_angle.
 * @returns {string} Prompt formatado.
 */
function buildFreelancePrompt(item) {
  return `Gere proposta para este projeto freelance.
Título: ${item.title} | Cliente: ${item.client} | Plataforma: ${item.platform}
Orçamento: ${item.budget} | Match: ${item.tech_match?.join(', ')}
Ângulo sugerido: ${item.proposal_angle}
Retorne apenas JSON: {"pt": "...", "en": "..."}`
}

/**
 * Gera cover letters ou propostas freelance para os melhores itens do array.
 * Limita ao top MAX_COVER_LETTERS (default 5) ordenado por win_probability
 * (freelance) ou match_percentage (vagas).
 *
 * @param {Object[]} items - Vagas (CANDIDATAR) ou projetos (ACEITAR) já analisados.
 * @param {'job'|'freelance'} type - Tipo de conteúdo a gerar.
 * @returns {Promise<{results: Array<{id: string, cover_letter_pt: string, cover_letter_en: string}>, usage: Object}>}
 */
export async function generateCoverLetters(items, type) {
  const models = getModelChain('writer')
  const maxItems = getMaxCoverLetters()

  // Ordena por probabilidade de sucesso e limita ao top N
  const sorted = [...items].sort((a, b) =>
    (b.win_probability ?? b.match_percentage ?? 0) - (a.win_probability ?? a.match_percentage ?? 0)
  )
  const selected = sorted.slice(0, maxItems)

  if (items.length > selected.length) {
    console.log(`  ✂️  Limitando a ${selected.length} de ${items.length} itens (MAX_COVER_LETTERS=${maxItems})`)
  }

  const results = []

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i]
    console.log(`  ✍️  Cover letter ${i + 1}/${selected.length}: ${item.title}`)

    try {
      const userContent = type === 'job' ? buildJobPrompt(item) : buildFreelancePrompt(item)
      const { text } = await callLlm({
        models,
        system: COVER_LETTER_PROMPT,
        user: userContent,
        temperature: 0.7
      })

      const parsed = JSON.parse(cleanJsonString(text))

      results.push({
        id: item.id,
        cover_letter_pt: parsed.pt,
        cover_letter_en: parsed.en
      })
    } catch (err) {
      console.error(`  ❌ Erro cover letter "${item.title}": ${err.message}`)
      // Inclui placeholder para não quebrar o template de e-mail
      results.push({
        id: item.id,
        cover_letter_pt: '[Erro ao gerar]',
        cover_letter_en: '[Generation error]'
      })
    }

    if (i < selected.length - 1) {
      await sleep(ITEM_DELAY_MS)
    }
  }

  // Modelos free do OpenRouter — custo zero; campos mantidos por compatibilidade
  return {
    results,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  }
}
