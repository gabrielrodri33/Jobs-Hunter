/**
 * @module utils
 * @description Utilitários compartilhados: sleep e retry com backoff exponencial.
 */

/**
 * Pausa a execução por um número de milissegundos.
 * @param {number} ms - Tempo de espera em milissegundos.
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Executa uma função assíncrona com retry automático e backoff exponencial.
 * Útil para chamadas à API Apify e Anthropic que podem falhar transitoriamente.
 * @param {Function} fn - Função assíncrona a executar.
 * @param {number} [retries=3] - Número máximo de tentativas.
 * @param {number} [baseDelayMs=2000] - Atraso base em ms (dobra a cada tentativa).
 * @returns {Promise<*>} Resultado da função.
 * @throws {Error} Lança erro após esgotar todas as tentativas.
 */
export async function withRetry(fn, retries = 3, baseDelayMs = 2000) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < retries - 1) {
        // Backoff exponencial: 2s, 4s, 8s...
        const delay = baseDelayMs * Math.pow(2, i)
        console.warn(`⚠️ Tentativa ${i + 1}/${retries} falhou: ${err.message}. Retentando em ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  throw new Error(`Falhou após ${retries} tentativas: ${lastErr.message}`)
}
