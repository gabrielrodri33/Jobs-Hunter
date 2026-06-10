/**
 * @module freelance-hunter/normalizer
 * @description Normaliza dados brutos de qualquer plataforma para schema único cross-platform.
 * Cada plataforma tem campos diferentes; este módulo os unifica em um objeto consistente.
 */

import { createHash } from 'crypto'

/**
 * Gera um ID estável e único baseado no título e link do projeto.
 * Usado quando a plataforma não fornece um ID numérico confiável.
 * @param {string} prefix - Prefixo da plataforma (ex: 'upwork', 'fl').
 * @param {string} title - Título do projeto.
 * @param {string} link - URL do projeto.
 * @returns {string} ID no formato `prefix-hash12chars`.
 */
function stableId(prefix, title, link) {
  const hash = createHash('md5').update(`${title}|${link}`).digest('hex').slice(0, 12)
  return `${prefix}-${hash}`
}

/**
 * Formata o orçamento como string legível.
 * @param {number|null} min - Valor mínimo do orçamento.
 * @param {number|null} max - Valor máximo do orçamento.
 * @param {string} [currency='USD'] - Código da moeda.
 * @returns {string} Orçamento formatado ou 'Não informado'.
 */
function formatBudget(min, max, currency = 'USD') {
  if (!min && !max) return 'Não informado'
  if (min && max && min !== max) return `${currency} ${min} – ${max}`
  return `${currency} ${min ?? max}`
}

/**
 * Infere o tipo de orçamento (hora/fixo) a partir dos dados brutos da plataforma.
 * @param {*} raw - Dados brutos do projeto.
 * @returns {'hourly'|'fixed'|'unknown'} Tipo de orçamento inferido.
 */
function guessBudgetType(raw) {
  const s = JSON.stringify(raw ?? '').toLowerCase()
  if (s.includes('hour') || s.includes('/h') || s.includes('hora')) return 'hourly'
  if (s.includes('fixed') || s.includes('fixo') || s.includes('fix')) return 'fixed'
  return 'unknown'
}

/**
 * Normaliza um projeto bruto do Upwork (via Apify jupri/upwork).
 * @param {Object} raw - Objeto bruto retornado pelo scraper.
 * @returns {Object} Projeto normalizado no schema cross-platform.
 */
function normalizeUpwork(raw) {
  return {
    id: raw.id ?? raw.jobId ? `upwork-${raw.id ?? raw.jobId}` : stableId('upwork', raw.title ?? raw.jobTitle ?? '', raw.url ?? raw.jobUrl ?? ''),
    title: raw.title ?? raw.jobTitle ?? 'Sem título',
    description: raw.description ?? raw.jobDescription ?? '',
    client: raw.clientInfo?.companyName ?? raw.client ?? 'Não informado',
    budget: formatBudget(raw.budget?.min, raw.budget?.max, raw.budget?.currencyCode ?? 'USD'),
    budget_type: raw.contractorTier === 'Expert' ? 'hourly' : guessBudgetType(raw.budget),
    skills: (raw.skills ?? []).map(s => s.prefLabel ?? s.name ?? s),
    proposals_count: raw.proposalsTier ?? null,
    posted_at: raw.publishedOn ?? raw.postedOn ?? null,
    link: raw.url ?? raw.jobUrl ?? '',
    platform: 'Upwork'
  }
}

/**
 * Normaliza um projeto bruto do Workana (via scraping direto da busca pública).
 * @param {Object} raw - Objeto bruto retornado pelo scraper.
 * @returns {Object} Projeto normalizado no schema cross-platform.
 */
function normalizeWorkana(raw) {
  return {
    id: raw.id ?? raw.slug ? `workana-${raw.id ?? raw.slug}` : stableId('workana', raw.title ?? raw.name ?? '', raw.url ?? raw.permalink ?? ''),
    title: raw.title ?? raw.name ?? 'Sem título',
    description: raw.description ?? raw.body ?? '',
    client: raw.client?.name ?? raw.client ?? 'Não informado',
    // Scraping direto já entrega string com moeda (ex: "USD 50 – 100"); número vem sem moeda
    budget: typeof raw.budget === 'string' && raw.budget
      ? raw.budget
      : raw.budget ? `BRL ${raw.budget}` : 'Não informado',
    budget_type: guessBudgetType(raw),
    skills: (raw.skills ?? raw.tags ?? []).map(s => s.name ?? s),
    proposals_count: raw.proposals ?? null,
    posted_at: raw.published_at ?? raw.created_at ?? null,
    link: raw.url ?? raw.permalink ?? '',
    platform: 'Workana'
  }
}

/**
 * Normaliza um projeto bruto da API nativa do Freelancer.com.
 * @param {Object} raw - Objeto bruto retornado pela API REST do Freelancer.com.
 * @returns {Object} Projeto normalizado no schema cross-platform.
 */
function normalizeFreelancer(raw) {
  const jobs = raw.jobs ? Object.values(raw.jobs).map(j => j.name) : []
  const budget = raw.budget ?? {}

  return {
    id: raw.id ? `fl-${raw.id}` : stableId('fl', raw.title ?? '', raw.seo_url ?? ''),
    title: raw.title ?? 'Sem título',
    description: raw.description ?? raw.preview_description ?? '',
    client: raw.owner_id ? `User #${raw.owner_id}` : 'Não informado',
    budget: formatBudget(budget.minimum, budget.maximum, budget.currency?.code ?? 'USD'),
    budget_type: (raw.type ?? '').toUpperCase() === 'FIXED' ? 'fixed' : (raw.type ?? '').toUpperCase() === 'HOURLY' ? 'hourly' : 'unknown',
    skills: jobs,
    proposals_count: raw.bid_stats?.bid_count ?? null,
    posted_at: raw.time_updated ? new Date(raw.time_updated * 1000).toISOString() : null,
    link: raw.seo_url ? `https://www.freelancer.com/projects/${raw.seo_url}` : '',
    platform: 'Freelancer.com'
  }
}

/**
 * Ponto de entrada público do normalizador.
 * Roteia para a função específica de cada plataforma.
 * @param {Object} raw - Dados brutos do projeto.
 * @param {'Upwork'|'Workana'|'Freelancer.com'} platform - Plataforma de origem.
 * @returns {Object} Projeto normalizado no schema cross-platform.
 * @throws {Error} Se a plataforma não for reconhecida.
 */
export function normalizeProject(raw, platform) {
  switch (platform) {
    case 'Upwork': return normalizeUpwork(raw)
    case 'Workana': return normalizeWorkana(raw)
    case 'Freelancer.com': return normalizeFreelancer(raw)
    default: throw new Error(`Plataforma desconhecida: ${platform}`)
  }
}
