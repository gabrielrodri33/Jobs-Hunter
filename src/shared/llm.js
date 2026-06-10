/**
 * @module llm
 * @description Cliente único de LLM via OpenRouter (modelos gratuitos).
 * Usado por analyzer.js e cover-letter.js.
 *
 * Configuração via variáveis de ambiente:
 *   OPENROUTER_API_KEY        → chave da API (openrouter.ai/keys)
 *   OPENROUTER_MODELS_ANALYZER → lista de modelos (vírgula) para análise
 *   OPENROUTER_MODELS_WRITER   → lista de modelos (vírgula) para cover letters
 *
 * Os IDs ":free" mudam com frequência — confira em openrouter.ai/models (filtro Free).
 */

import { sleep } from './utils.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Throttle mínimo entre chamadas consecutivas — tier free permite ~20 req/min
const MIN_INTERVAL_MS = 3000

// Backoff base ao trocar de modelo após 429/5xx
const FALLBACK_DELAY_MS = 5000

const DEFAULT_MODELS = 'deepseek/deepseek-chat:free,meta-llama/llama-3.3-70b-instruct:free'

let lastCallAt = 0

/**
 * Retorna a cadeia de modelos configurada para um propósito.
 * @param {'analyzer'|'writer'} purpose
 * @returns {string[]} Lista de IDs de modelo em ordem de preferência.
 */
export function getModelChain(purpose) {
  const envVar = purpose === 'writer'
    ? process.env.OPENROUTER_MODELS_WRITER
    : process.env.OPENROUTER_MODELS_ANALYZER
  return (envVar ?? DEFAULT_MODELS).split(',').map(m => m.trim()).filter(Boolean)
}

/**
 * Chama o OpenRouter com cadeia de fallback entre modelos.
 * Em 429/5xx tenta o próximo modelo da lista após backoff; só falha se todos falharem.
 *
 * @param {Object} opts
 * @param {string[]} opts.models - Cadeia de modelos em ordem de preferência.
 * @param {string} opts.system - System prompt.
 * @param {string} opts.user - Mensagem do usuário.
 * @param {number} [opts.temperature=0.3]
 * @param {number} [opts.maxTokens=8000] - Limite de tokens de saída (evita JSON truncado).
 * @returns {Promise<{text: string, model: string}>} Texto da resposta e modelo usado.
 * @throws {Error} Se todos os modelos da cadeia falharem.
 */
export async function callLlm({ models, system, user, temperature = 0.3, maxTokens = 8000 }) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY não configurado')
  }

  const errors = []

  for (let i = 0; i < models.length; i++) {
    const model = models[i]

    // Throttle global entre chamadas consecutivas
    const elapsed = Date.now() - lastCallAt
    if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed)
    lastCallAt = Date.now()

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/gabrielrodri33/Jobs-Hunter',
          'X-Title': 'career-hunter'
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      })

      if (res.status === 429 || res.status >= 500) {
        errors.push(`${model}: HTTP ${res.status}`)
        console.warn(`  ⚠️  ${model} retornou ${res.status} — tentando próximo modelo...`)
        await sleep(FALLBACK_DELAY_MS * (i + 1))
        continue
      }

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
      }

      const data = await res.json()

      // OpenRouter pode retornar 200 com erro no corpo (ex: modelo inexistente)
      if (data.error) {
        errors.push(`${model}: ${data.error.message ?? JSON.stringify(data.error)}`)
        console.warn(`  ⚠️  ${model} erro da API: ${data.error.message ?? JSON.stringify(data.error).slice(0, 200)}`)
        await sleep(FALLBACK_DELAY_MS * (i + 1))
        continue
      }

      const choice = data.choices?.[0]
      const text = choice?.message?.content
      if (!text) {
        errors.push(`${model}: resposta vazia`)
        console.warn(`  ⚠️  ${model} retornou resposta vazia — tentando próximo modelo...`)
        continue
      }

      // Resposta cortada por limite de tokens gera JSON truncado — avisa para diagnóstico
      if (choice.finish_reason === 'length') {
        console.warn(`  ⚠️  ${model} truncou a resposta (finish_reason=length) — JSON pode estar incompleto`)
      }

      return { text, model }
    } catch (err) {
      errors.push(`${model}: ${err.message}`)
      console.warn(`  ⚠️  ${model} falhou: ${err.message}`)
      if (i < models.length - 1) await sleep(FALLBACK_DELAY_MS * (i + 1))
    }
  }

  throw new Error(`Todos os modelos falharam: ${errors.join(' | ')}`)
}

/**
 * Remove cercas de markdown (```json ... ```) e extrai o JSON da resposta.
 * @param {string} str - Texto bruto retornado pelo LLM.
 * @returns {string} JSON limpo, pronto para parse.
 */
export function cleanJsonString(str) {
  let s = str.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  // Alguns modelos adicionam texto antes/depois — extrai do primeiro [ ou { ao último ] ou }
  const firstBracket = Math.min(...['[', '{'].map(c => {
    const idx = s.indexOf(c)
    return idx === -1 ? Infinity : idx
  }))
  const lastBracket = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'))
  if (firstBracket !== Infinity && lastBracket > firstBracket) {
    s = s.slice(firstBracket, lastBracket + 1)
  }
  return s
}
