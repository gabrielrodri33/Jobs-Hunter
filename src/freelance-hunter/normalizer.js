// Normaliza dados brutos de qualquer plataforma para schema único cross-platform

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
    id: `upwork-${raw.id ?? raw.jobId ?? Math.random().toString(36).slice(2)}`,
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
    id: `workana-${raw.id ?? raw.slug ?? Math.random().toString(36).slice(2)}`,
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
    id: `fl-${raw.id ?? Math.random().toString(36).slice(2)}`,
    title: raw.title ?? 'Sem título',
    description: raw.description ?? raw.preview_description ?? '',
    client: raw.owner_id ? `User #${raw.owner_id}` : 'Não informado',
    budget: formatBudget(budget.minimum, budget.maximum, budget.currency?.code ?? 'USD'),
    budget_type: raw.type === 'FIXED' ? 'fixed' : raw.type === 'HOURLY' ? 'hourly' : 'unknown',
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
