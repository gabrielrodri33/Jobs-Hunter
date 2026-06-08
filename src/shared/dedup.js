/**
 * @module dedup
 * @description Controle de duplicatas entre execuções do GitHub Actions.
 * Persiste IDs já processados em arquivo JSON gerenciado via Actions cache.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// Limite máximo de IDs armazenados — evita crescimento ilimitado do arquivo
const MAX_IDS = 500

/**
 * Carrega a lista de IDs já vistos de um arquivo JSON.
 * Retorna array vazio se o arquivo não existir (primeira execução).
 * @param {string} filepath - Caminho para o arquivo JSON de dedup.
 * @returns {string[]} Array de IDs já processados.
 */
export function loadSeen(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

/**
 * Persiste a lista atualizada de IDs vistos no arquivo JSON.
 * Mantém apenas os MAX_IDS mais recentes para controlar o tamanho do arquivo.
 * @param {string} filepath - Caminho para o arquivo JSON de dedup.
 * @param {string[]} ids - Array completo de IDs (antigos + novos).
 */
export function saveSeen(filepath, ids) {
  const deduped = [...new Set(ids)]
  // Mantém apenas os IDs mais recentes para evitar arquivo muito grande
  const trimmed = deduped.slice(-MAX_IDS)
  mkdirSync(dirname(filepath), { recursive: true })
  writeFileSync(filepath, JSON.stringify(trimmed, null, 2), 'utf-8')
}

/**
 * Filtra itens retornando apenas os que ainda não foram processados.
 * @param {Array<{id: string}>} items - Itens coletados pelo scraper.
 * @param {string[]} seenIds - IDs já vistos em execuções anteriores.
 * @returns {Array<{id: string}>} Apenas itens novos.
 */
export function filterNew(items, seenIds) {
  const seenSet = new Set(seenIds)
  return items.filter(item => !seenSet.has(item.id))
}
