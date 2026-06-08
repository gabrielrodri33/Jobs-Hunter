import { createHash } from 'crypto'

// Normaliza dados brutos de qualquer plataforma para schema único cross-platform

function stableId(prefix, title, link) {
  const hash = createHash('md5').update(`${title}|${link}`).digest('hex').slice(0, 12)
  return `${prefix}-${hash}`
}

function formatBudget(min, max, currency = 'USD') {
  if (!min && !max) return 'Não informado'
  if (min && max && min !== max) return `${currency} ${min} – ${max}`
  return `${currency} ${min ?? max}`
}

function guessBudgetType(raw) {
  const s = JSON.stringify(raw ?? '').toLowerCase()
  if (s.includes('hour') || s.includes('/h') || s.includes('hora')) return 'hourly'
  if (s.includes('fixed') || s.includes('fixo') || s.includes('fix')) return 'fixed'
  return 'unknown'
}

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

function normalizeWorkana(raw) {
  return {
    id: raw.id ?? raw.slug ? `workana-${raw.id ?? raw.slug}` : stableId('workana', raw.title ?? raw.name ?? '', raw.url ?? raw.permalink ?? ''),
    title: raw.title ?? raw.name ?? 'Sem título',
    description: raw.description ?? raw.body ?? '',
    client: raw.client?.name ?? raw.client ?? 'Não informado',
    budget: raw.budget ? `BRL ${raw.budget}` : 'Não informado',
    budget_type: guessBudgetType(raw),
    skills: (raw.skills ?? raw.tags ?? []).map(s => s.name ?? s),
    proposals_count: raw.proposals ?? null,
    posted_at: raw.published_at ?? raw.created_at ?? null,
    link: raw.url ?? raw.permalink ?? '',
    platform: 'Workana'
  }
}

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

export function normalizeProject(raw, platform) {
  switch (platform) {
    case 'Upwork': return normalizeUpwork(raw)
    case 'Workana': return normalizeWorkana(raw)
    case 'Freelancer.com': return normalizeFreelancer(raw)
    default: throw new Error(`Plataforma desconhecida: ${platform}`)
  }
}
