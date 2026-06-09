/**
 * @module cover-letter
 * @description Geração de cover letters e propostas freelance via Claude API.
 * Gera versões em português e inglês para cada item relevante.
 */

import Anthropic from '@anthropic-ai/sdk'
import { COVER_LETTER_PROMPT } from './profile.js'
import { sleep, withRetry } from './utils.js'

// Pausa entre cada geração para respeitar rate limits da API
const ITEM_DELAY_MS = 1500

/**
 * Remove blocos de markdown antes do JSON.parse (Claude pode retornar ```json).
 * @param {string} str - String bruta da API.
 * @returns {string} JSON limpo.
 */
function cleanJsonString(str) {
  return str.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
}

/**
 * Monta o prompt de usuário para geração de cover letter de vaga de emprego.
 * @param {Object} item - Vaga analisada com campos title, company, location, match_points, differentials.
 * @returns {string} Prompt formatado para o Claude.
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
 * @returns {string} Prompt formatado para o Claude.
 */
function buildFreelancePrompt(item) {
  return `Gere proposta para este projeto freelance.
Título: ${item.title} | Cliente: ${item.client} | Plataforma: ${item.platform}
Orçamento: ${item.budget} | Match: ${item.tech_match?.join(', ')}
Ângulo sugerido: ${item.proposal_angle}
Retorne apenas JSON: {"pt": "...", "en": "..."}`
}

/**
 * Gera cover letters ou propostas freelance para um array de itens.
 * Processa um item por vez para garantir personalização máxima.
 *
 * @param {Object[]} items - Vagas (CANDIDATAR) ou projetos (ACEITAR) já analisados.
 * @param {'job'|'freelance'} type - Tipo de conteúdo a gerar.
 * @returns {Promise<{results: Array<{id: string, cover_letter_pt: string, cover_letter_en: string}>, usage: Object}>}
 */
export async function generateCoverLetters(items, type) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    console.log(`  ✍️  Cover letter ${i + 1}/${items.length}: ${item.title}`)

    try {
      // Seleciona o builder de prompt conforme o tipo
      const userContent = type === 'job' ? buildJobPrompt(item) : buildFreelancePrompt(item)

      const message = await withRetry(() =>
        client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1500,
          system: COVER_LETTER_PROMPT,
          messages: [{ role: 'user', content: userContent }]
        })
      )

      totalInputTokens += message.usage?.input_tokens ?? 0
      totalOutputTokens += message.usage?.output_tokens ?? 0

      const raw = message.content[0].text
      const cleaned = cleanJsonString(raw)
      const parsed = JSON.parse(cleaned)

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

    // Pausa entre itens (exceto no último)
    if (i < items.length - 1) {
      await sleep(ITEM_DELAY_MS)
    }
  }

  // Custo estimado (preços claude-haiku-4-5 em Jun/2025)
  return {
    results,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd: parseFloat(
        (totalInputTokens * 0.000001 + totalOutputTokens * 0.000005).toFixed(4)
      )
    }
  }
}
