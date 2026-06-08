import Anthropic from '@anthropic-ai/sdk'
import { JOB_ANALYZER_PROMPT, FREELANCE_ANALYZER_PROMPT } from './profile.js'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 2000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Remove markdown/backticks antes de JSON.parse
function cleanJsonString(str) {
  return str.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
}

export async function analyzeItems(items, type) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const systemPrompt = type === 'job' ? JOB_ANALYZER_PROMPT : FREELANCE_ANALYZER_PROMPT
  const results = []

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(items.length / BATCH_SIZE)

    console.log(`  📊 Batch ${batchNum}/${totalBatches} — ${batch.length} itens`)

    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 5000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analise os seguintes ${batch.length} itens e retorne um array JSON:\n\n${JSON.stringify(batch, null, 2)}`
          }
        ]
      })

      const raw = message.content[0].text
      const cleaned = cleanJsonString(raw)
      const parsed = JSON.parse(cleaned)
      results.push(...parsed)
    } catch (err) {
      console.error(`  ❌ Erro no batch ${batchNum}: ${err.message}`)
    }

    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return results
}
