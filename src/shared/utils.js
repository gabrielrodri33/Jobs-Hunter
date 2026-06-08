export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function withRetry(fn, retries = 3, baseDelayMs = 2000) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < retries - 1) {
        const delay = baseDelayMs * Math.pow(2, i)
        console.warn(`⚠️ Tentativa ${i + 1}/${retries} falhou: ${err.message}. Retentando em ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  throw new Error(`Falhou após ${retries} tentativas: ${lastErr.message}`)
}
