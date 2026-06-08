import Anthropic from '@anthropic-ai/sdk'
import { COVER_LETTER_PROMPT } from './profile.js'

const ITEM_DELAY_MS = 1500

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function cleanJsonString(str) {
  return str.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
}

function buildJobPrompt(item) {
  return `Gere cover letter para esta vaga.
Título: ${item.title} | Empresa: ${item.company} | Local: ${item.location}
Match técnico: ${item.match_points?.join(', ')}
Diferencial: ${item.differentials}
Retorne apenas JSON: {"pt": "...", "en": "..."}`
}

function buildFreelancePrompt(item) {
  return `Gere proposta para este projeto freelance.
Título: ${item.title} | Cliente: ${item.client} | Plataforma: ${item.platform}
Orçamento: ${item.budget} | Match: ${item.tech_match?.join(', ')}
Ângulo sugerido: ${item.proposal_angle}
Retorne apenas JSON: {"pt": "...", "en": "..."}`
}

export async function generateCoverLetters(items, type) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    console.log(`  ✍️  Cover letter ${i + 1}/${items.length}: ${item.title}`)

    try {
      const userContent = type === 'job' ? buildJobPrompt(item) : buildFreelancePrompt(item)

      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: COVER_LETTER_PROMPT,
        messages: [{ role: 'user', content: userContent }]
      })

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
      results.push({
        id: item.id,
        cover_letter_pt: '[Erro ao gerar]',
        cover_letter_en: '[Generation error]'
      })
    }

    if (i < items.length - 1) {
      await sleep(ITEM_DELAY_MS)
    }
  }

  return results
}
