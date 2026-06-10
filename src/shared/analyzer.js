/**
 * @module analyzer
 * @description Análise de compatibilidade de vagas e projetos via OpenRouter (modelos gratuitos).
 * Aplica pré-filtro local sem IA antes de chamar o LLM e processa em lotes de 10.
 */

import { JOB_ANALYZER_PROMPT, FREELANCE_ANALYZER_PROMPT } from './profile.js'
import { callLlm, getModelChain, cleanJsonString } from './llm.js'
import { prefilterItems } from './prefilter.js'
import { sleep } from './utils.js'

// Número de itens por chamada ao LLM — balanceia contexto e número de requests
const BATCH_SIZE = 10

// Pausa adicional entre lotes (o llm.js já aplica throttle de 3s por chamada)
const BATCH_DELAY_MS = 1000

/**
 * Chama o LLM e faz parse do JSON com 1 retry no mesmo modelo em caso de JSON inválido,
 * antes de cair para o próximo modelo da cadeia de fallback.
 * @param {string[]} models - Cadeia de modelos.
 * @param {string} system - System prompt.
 * @param {string} user - Mensagem do usuário.
 * @returns {Promise<Object[]>} Array JSON parseado.
 */
async function callAndParse(models, system, user) {
  for (let i = 0; i < models.length; i++) {
    // Até 2 tentativas no mesmo modelo para JSON inválido
    for (let attempt = 0; attempt < 2; attempt++) {
      const { text, model } = await callLlm({ models: [models[i]], system, user })
      try {
        const parsed = JSON.parse(cleanJsonString(text))
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        console.warn(`  ⚠️  JSON inválido de ${model} (tentativa ${attempt + 1}/2)`)
      }
    }
    if (i < models.length - 1) {
      console.warn(`  ⚠️  Caindo para o próximo modelo: ${models[i + 1]}`)
    }
  }
  throw new Error('Nenhum modelo retornou JSON válido')
}

/**
 * Analisa um array de vagas ou projetos e retorna scores de compatibilidade.
 * Aplica pré-filtro local antes do LLM e processa em lotes de BATCH_SIZE itens.
 *
 * @param {Object[]} items - Vagas (job) ou projetos (freelance) a analisar.
 * @param {'job'|'freelance'} type - Tipo de análise — define o system prompt usado.
 * @returns {Promise<{results: Object[], usage: {inputTokens: number, outputTokens: number, costUsd: number, prefilteredOut: number, analyzedCount: number}}>}
 */
export async function analyzeItems(items, type) {
  const systemPrompt = type === 'job' ? JOB_ANALYZER_PROMPT : FREELANCE_ANALYZER_PROMPT
  const models = getModelChain('analyzer')

  // ── 1. Pré-filtro local sem IA ─────────────────────────────────────────────
  const { kept, removed } = prefilterItems(items, type)

  const results = []

  // ── 2. Processa em lotes ───────────────────────────────────────────────────
  for (let i = 0; i < kept.length; i += BATCH_SIZE) {
    const batch = kept.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(kept.length / BATCH_SIZE)

    console.log(`  📊 Batch ${batchNum}/${totalBatches} — ${batch.length} itens`)

    try {
      const parsed = await callAndParse(
        models,
        systemPrompt,
        `Analise os seguintes ${batch.length} itens e responda APENAS com um array JSON válido, sem markdown:\n\n${JSON.stringify(batch, null, 2)}`
      )
      results.push(...parsed)
    } catch (err) {
      console.error(`  ❌ Erro no batch ${batchNum}: ${err.message}`)
    }

    if (i + BATCH_SIZE < kept.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  // Modelos free do OpenRouter — custo zero; campos de token mantidos por compatibilidade
  return {
    results,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      prefilteredOut: removed,
      analyzedCount: kept.length
    }
  }
}
