import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const MAX_IDS = 500

export function loadSeen(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

export function saveSeen(filepath, ids) {
  const deduped = [...new Set(ids)]
  const trimmed = deduped.slice(-MAX_IDS)
  mkdirSync(dirname(filepath), { recursive: true })
  writeFileSync(filepath, JSON.stringify(trimmed, null, 2), 'utf-8')
}

export function filterNew(items, seenIds) {
  const seenSet = new Set(seenIds)
  return items.filter(item => !seenSet.has(item.id))
}
