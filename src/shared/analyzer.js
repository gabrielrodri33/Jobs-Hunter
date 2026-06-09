/**
 * @module analyzer
 * @description Análise de compatibilidade de vagas e projetos via Claude API.
 * Processa itens em lotes para respeitar limites de tokens e rate limits.
 */

import Anthropic from '@anthropic-ai/sdk'
import { JOB_ANALYZER_PROMPT, FREELANCE_ANALYZER_PROMPT } from './profile.js'
import { sleep, withRetry } from './utils.js'

// Número de itens por chamada à API — balanceia custo de tokens e número de requests
const BATCH_SIZE = 10

// Pausa entre lotes para evitar rate limiting na API Anthropic
const BATCH_DELAY_MS = 2000

/**
 * Remove blocos de markdown (```json ... ```) que o Claude pode incluir na resposta,
 * antes de fazer o JSON.parse.
 * @param {string} str - String bruta retornada pelo Claude.
 * @returns {string} JSON limpo, pronto para parse.
 */
function cleanJsonString(str) {
  return str.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
}

/**
 * Analisa um array de vagas ou projetos usando Claude API e retorna scores de compatibilidade.
 * Processa em lotes de BATCH_SIZE itens para controlar uso de tokens.
 *
 * @param {Object[]} items - Vagas (job) ou projetos (freelance) a analisar.
 * @param {'job'|'freelance'} type - Tipo de análise — define o system prompt usado.
 * @returns {Promise<{results: Object[], usage: {inputTokens: number, outputTokens: number, costUsd: number}}>}
 */
export async function analyzeItems(items, type) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Seleciona o prompt baseado no tipo de análise
  const systemPrompt = type === 'job' ? JOB_ANALYZER_PROMPT : FREELANCE_ANALYZER_PROMPT
  const results = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // ── 1. Processa em lotes ───────────────────────────────────────────────────
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(items.length / BATCH_SIZE)

    console.log(`  📊 Batch ${batchNum}/${totalBatches} — ${batch.length} itens`)

    try {
      const message = await withRetry(() =>
        client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 5000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Analise os seguintes ${batch.length} itens e retorne um array JSON:\n\n${JSON.stringify(batch, null, 2)}`
            }
          ]
        })
      )

      // ── 2. Acumula uso de tokens para cálculo de custo ────────────────────
      totalInputTokens += message.usage?.input_tokens ?? 0
      totalOutputTokens += message.usage?.output_tokens ?? 0

      const raw = message.content[0].text
      const cleaned = cleanJsonString(raw)
      const parsed = JSON.parse(cleaned)
      results.push(...parsed)
    } catch (err) {
      console.error(`  ❌ Erro no batch ${batchNum}: ${err.message}`)
    }

    // Pausa entre lotes (exceto no último)
    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  // ── 3. Calcula custo estimado (preços claude-haiku-4-5 em Jun/2025) ────────
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
