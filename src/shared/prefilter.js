/**
 * @module prefilter
 * @description Pré-filtro local sem IA aplicado antes da análise por LLM.
 * Descarta itens por regras configuráveis em profile.js (PREFILTER_RULES):
 *   - requiredKeywords: pelo menos uma deve aparecer no título+descrição+skills
 *   - forbiddenKeywords: nenhuma pode aparecer no título
 *   - forbiddenSeniority: termos de senioridade incompatível no título
 */

import { PREFILTER_RULES } from './profile.js'

function normalize(s) {
  return (s ?? '').toString().toLowerCase()
}

function itemText(item) {
  return normalize(
    [item.title, item.description, (item.skills ?? []).join(' ')].join(' ')
  )
}

/**
 * Aplica o pré-filtro a um array de vagas/projetos.
 * @param {Object[]} items - Itens normalizados (com title, description, skills).
 * @param {'job'|'freelance'} type - Seleciona o conjunto de regras.
 * @returns {{kept: Object[], removed: number}} Itens aprovados e contagem de descartados.
 */
export function prefilterItems(items, type) {
  const rules = PREFILTER_RULES[type] ?? {}
  const required = (rules.requiredKeywords ?? []).map(normalize)
  const forbidden = (rules.forbiddenKeywords ?? []).map(normalize)
  const seniority = (rules.forbiddenSeniority ?? []).map(normalize)

  const kept = items.filter(item => {
    const text = itemText(item)
    const title = normalize(item.title)

    if (required.length > 0 && !required.some(k => text.includes(k))) return false
    if (forbidden.some(k => title.includes(k))) return false
    if (seniority.some(k => title.includes(k))) return false
    return true
  })

  const removed = items.length - kept.length
  if (removed > 0) {
    console.log(`  🧹 Pré-filtro eliminou ${removed} de ${items.length} itens (sem custo de IA)`)
  }
  return { kept, removed }
}
