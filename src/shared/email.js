import { Resend } from 'resend'

// ── Helpers de cor ────────────────────────────────────────────────────────────

function scoreColor(score) {
  return score === 'CANDIDATAR' || score === 'ACEITAR' ? '#16a34a' : '#ca8a04'
}

function budgetBadgeColor(viability) {
  const map = { ÓTIMO: '#16a34a', BOM: '#2563eb', BAIXO: '#ca8a04', INVIÁVEL: '#dc2626', NÃO_INFORMADO: '#6b7280' }
  return map[viability] ?? '#6b7280'
}

function platformColor(platform) {
  const map = { Upwork: '#6d28d9', Workana: '#16a34a', 'Freelancer.com': '#2563eb' }
  return map[platform] ?? '#374151'
}

function winProbColor(prob) {
  if (prob >= 60) return '#16a34a'
  if (prob >= 40) return '#ca8a04'
  return '#dc2626'
}

// ── Cover letter block ────────────────────────────────────────────────────────

const CL_MAX_CHARS = 800

function truncate(text) {
  if (!text) return ''
  return text.length > CL_MAX_CHARS ? text.slice(0, CL_MAX_CHARS) + '...' : text
}

function coverLetterBlock(coverLetter) {
  if (!coverLetter) return ''
  const pt = truncate(coverLetter.cover_letter_pt)
  const en = truncate(coverLetter.cover_letter_en)
  return `
    <div style="margin-top:16px;">
      <div style="background:#f3f4f6;border-left:4px solid #6b7280;padding:14px 16px;border-radius:4px;margin-bottom:10px;">
        <p style="font-size:11px;font-weight:700;color:#374151;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:.5px;">&#127463;&#127479; Cover Letter — PT</p>
        <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;white-space:pre-wrap;">${pt}</p>
      </div>
      <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 16px;border-radius:4px;">
        <p style="font-size:11px;font-weight:700;color:#1e40af;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:.5px;">&#127482;&#127480; Cover Letter — EN</p>
        <p style="font-size:13px;color:#1e3a5f;margin:0;line-height:1.6;white-space:pre-wrap;">${en}</p>
      </div>
    </div>`
}

// ── Bloco de uso/custo ────────────────────────────────────────────────────────

function buildUsageBlock(usage) {
  if (!usage) return ''

  const scraperRows = usage.scrapers.map(s => `
    <tr>
      <td style="padding:3px 0;font-size:12px;color:#6b7280;">${s.name}</td>
      <td style="padding:3px 0;font-size:12px;color:#374151;text-align:right;font-weight:500;">
        ${s.costUsd > 0 ? `$${s.costUsd.toFixed(4)}` : '<span style="color:#16a34a;">Grátis</span>'}
      </td>
      <td style="padding:3px 0;font-size:12px;color:#9ca3af;text-align:right;">${s.items} itens</td>
    </tr>`).join('')

  const analysisRow = `
    <tr>
      <td style="padding:3px 0;font-size:12px;color:#6b7280;">Análise Claude (${usage.anthropic.analysis.items} itens)</td>
      <td style="padding:3px 0;font-size:12px;color:#374151;text-align:right;font-weight:500;">$${usage.anthropic.analysis.costUsd.toFixed(4)}</td>
      <td style="padding:3px 0;font-size:12px;color:#9ca3af;text-align:right;">
        ${(usage.anthropic.analysis.inputTokens / 1000).toFixed(1)}k in / ${(usage.anthropic.analysis.outputTokens / 1000).toFixed(1)}k out
      </td>
    </tr>`

  const clRow = usage.anthropic.coverLetters.items > 0 ? `
    <tr>
      <td style="padding:3px 0;font-size:12px;color:#6b7280;">Cover letters (${usage.anthropic.coverLetters.items} itens)</td>
      <td style="padding:3px 0;font-size:12px;color:#374151;text-align:right;font-weight:500;">$${usage.anthropic.coverLetters.costUsd.toFixed(4)}</td>
      <td style="padding:3px 0;font-size:12px;color:#9ca3af;text-align:right;">
        ${(usage.anthropic.coverLetters.inputTokens / 1000).toFixed(1)}k in / ${(usage.anthropic.coverLetters.outputTokens / 1000).toFixed(1)}k out
      </td>
    </tr>` : ''

  return `
    <div style="margin-top:32px;padding:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
      <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;color:#374151;">&#128202; Uso desta execução</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#9ca3af;font-weight:500;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Serviço</th>
            <th style="text-align:right;font-size:11px;color:#9ca3af;font-weight:500;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Custo</th>
            <th style="text-align:right;font-size:11px;color:#9ca3af;font-weight:500;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${scraperRows}
          ${analysisRow}
          ${clRow}
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding-top:8px;font-size:13px;font-weight:700;color:#111827;">Total desta execução</td>
            <td style="padding-top:8px;font-size:13px;font-weight:700;color:#16a34a;text-align:right;">$${usage.totalCostUsd.toFixed(4)}</td>
            <td style="padding-top:8px;font-size:12px;color:#9ca3af;text-align:right;">~$${usage.estimatedMonthlyCostUsd}/mês</td>
          </tr>
        </tbody>
      </table>
    </div>`
}

// ── Card: vaga de emprego ─────────────────────────────────────────────────────

function buildJobCard(job, coverLetter) {
  const matchList = (job.match_points ?? []).map(p => `<li style="margin:3px 0;">✅ ${p}</li>`).join('')
  const gapList = (job.gaps ?? []).map(g => `<li style="margin:3px 0;">⚠️ ${g}</li>`).join('')
  const salaryLine = job.salary ? `<span style="margin-left:8px;color:#374151;">💰 ${job.salary}</span>` : ''
  const applicantsLine = job.applicants != null ? `<span style="margin-left:8px;color:#6b7280;">👥 ${job.applicants} candidatos</span>` : ''

  return `
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:20px;font-family:sans-serif;">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <span style="background:${scoreColor(job.score)};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;">${job.score}</span>
      <span style="background:#f3f4f6;color:#374151;font-size:11px;padding:3px 10px;border-radius:20px;">${job.match_percentage}% match</span>
    </div>
    <h2 style="margin:0 0 4px 0;font-size:16px;color:#111827;">${job.title}</h2>
    <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">${job.company} · ${job.location}${salaryLine}${applicantsLine}</p>
    <ul style="margin:8px 0;padding-left:18px;font-size:13px;color:#374151;">${matchList}</ul>
    ${gapList ? `<ul style="margin:8px 0;padding-left:18px;font-size:13px;color:#374151;">${gapList}</ul>` : ''}
    ${job.differentials ? `<p style="margin:8px 0;font-size:13px;color:#374151;">💡 <strong>Diferencial:</strong> ${job.differentials}</p>` : ''}
    ${job.recommendation ? `<p style="margin:8px 0;font-size:13px;color:#374151;">📝 ${job.recommendation}</p>` : ''}
    <a href="${job.link}" style="display:inline-block;margin-top:12px;background:#2563eb;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Ver vaga →</a>
    ${coverLetterBlock(coverLetter)}
  </div>`
}

// ── Card: projeto freelance ───────────────────────────────────────────────────

function buildFreelanceCard(project, coverLetter) {
  const techList = (project.tech_match ?? []).map(t => `<li style="margin:3px 0;">✅ ${t}</li>`).join('')
  const gapList = (project.tech_gaps ?? []).map(g => `<li style="margin:3px 0;">⚠️ ${g}</li>`).join('')
  const redFlagList = (project.red_flags ?? []).map(f => `<li style="margin:3px 0;">🚩 ${f}</li>`).join('')
  const winProb = project.win_probability ?? 0
  const winColor = winProbColor(winProb)

  return `
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:20px;font-family:sans-serif;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <span style="background:${platformColor(project.platform)};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${project.platform}</span>
      <span style="background:${scoreColor(project.score)};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;">${project.score}</span>
      <span style="background:#f3f4f6;color:#374151;font-size:11px;padding:3px 10px;border-radius:20px;">${project.match_percentage}% match</span>
    </div>
    <h2 style="margin:0 0 4px 0;font-size:16px;color:#111827;">${project.title}</h2>
    <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">
      ${project.client}
      <span style="margin-left:8px;background:${budgetBadgeColor(project.budget_viability)};color:#fff;font-size:11px;padding:2px 8px;border-radius:12px;">${project.budget_viability}</span>
      <span style="margin-left:6px;font-weight:600;color:#111827;">${project.budget}</span>
      ${project.estimated_hours ? `<span style="margin-left:6px;color:#6b7280;">~${project.estimated_hours}h</span>` : ''}
    </p>
    <div style="margin:10px 0;">
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">Win probability: ${winProb}%</p>
      <div style="background:#e5e7eb;border-radius:9999px;height:8px;width:100%;max-width:300px;">
        <div style="background:${winColor};height:8px;border-radius:9999px;width:${winProb}%;"></div>
      </div>
    </div>
    ${project.scope_clarity ? `<p style="margin:6px 0;font-size:13px;color:#374151;">Escopo: <strong>${project.scope_clarity}</strong></p>` : ''}
    <ul style="margin:8px 0;padding-left:18px;font-size:13px;color:#374151;">${techList}</ul>
    ${gapList ? `<ul style="margin:8px 0;padding-left:18px;font-size:13px;color:#374151;">${gapList}</ul>` : ''}
    ${redFlagList ? `<ul style="margin:8px 0;padding-left:18px;font-size:13px;color:#dc2626;">${redFlagList}</ul>` : ''}
    ${project.proposal_angle ? `<div style="background:#fefce8;border-left:4px solid #ca8a04;padding:10px 14px;margin:10px 0;border-radius:4px;font-size:13px;color:#374151;">💡 <strong>Ângulo de proposta:</strong> ${project.proposal_angle}</div>` : ''}
    ${project.recommendation ? `<p style="margin:8px 0;font-size:13px;color:#374151;">📝 ${project.recommendation}</p>` : ''}
    <a href="${project.link}" style="display:inline-block;margin-top:12px;background:#6d28d9;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Ver projeto →</a>
    ${coverLetterBlock(coverLetter)}
  </div>`
}

// ── Template base ─────────────────────────────────────────────────────────────

function buildEmailHtml({ headerColor, headerEmoji, headerTitle, summaryCards, sections, footerDate, usageSummary }) {
  const summaryHtml = `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr>${
    summaryCards.map(c => `
    <td style="padding-right:12px;vertical-align:top;">
      <div style="display:inline-block;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;text-align:center;min-width:120px;">
        <p style="margin:0;font-size:28px;font-weight:700;color:${c.color ?? '#111827'};">${c.value}</p>
        <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">${c.label}</p>
      </div>
    </td>`).join('')
  }</tr></table>`

  const sectionsHtml = sections.map(s => `
    <h2 style="font-size:16px;color:#374151;margin:32px 0 12px 0;padding-bottom:6px;border-bottom:2px solid #e5e7eb;">${s.title}</h2>
    ${s.cards}`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">

    <div style="background:${headerColor};border-radius:12px;padding:28px 32px;margin-bottom:24px;color:#fff;">
      <h1 style="margin:0;font-size:24px;">${headerEmoji} ${headerTitle}</h1>
      <p style="margin:8px 0 0 0;opacity:.85;font-size:14px;">${footerDate}</p>
    </div>

    ${summaryHtml}

    ${sectionsHtml}

    ${usageSummary ? buildUsageBlock(usageSummary) : ''}

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
      career-hunter · <a href="https://github.com/gabrielrodri33" style="color:#6b7280;">github.com/gabrielrodri33</a> · ${footerDate}
    </div>
  </div>
</body>
</html>`
}

// ── Funções públicas ──────────────────────────────────────────────────────────

export async function sendJobsEmail(candidatar, avaliar, coverLetters, usageSummary) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const clMap = Object.fromEntries(coverLetters.map(cl => [cl.id, cl]))

  const candidatarCards = candidatar.map(j => buildJobCard(j, clMap[j.id])).join('')
  const avaliarCards = avaliar.map(j => buildJobCard(j, null)).join('')

  const sections = []
  if (candidatar.length > 0) sections.push({ title: '✅ Candidatar agora', cards: candidatarCards })
  if (avaliar.length > 0) sections.push({ title: '🟡 Avaliar antes de candidatar', cards: avaliarCards })

  const html = buildEmailHtml({
    headerColor: '#1d4ed8',
    headerEmoji: '🎯',
    headerTitle: 'Vagas de Emprego',
    summaryCards: [
      { value: candidatar.length, label: 'Para candidatar', color: '#16a34a' },
      { value: avaliar.length, label: 'Para avaliar', color: '#ca8a04' },
      { value: candidatar.length + avaliar.length, label: 'Total relevantes', color: '#2563eb' }
    ],
    sections,
    footerDate: now,
    usageSummary
  })

  await resend.emails.send({
    from: process.env.JOB_EMAIL_FROM,
    to: process.env.JOB_EMAIL_TO,
    subject: `🎯 ${candidatar.length} vagas para candidatar + ${avaliar.length} para avaliar — ${now}`,
    html
  })
}

export async function sendFreelanceEmail(aceitar, avaliar, coverLetters, usageSummary) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const clMap = Object.fromEntries(coverLetters.map(cl => [cl.id, cl]))

  const aceitarCards = aceitar.map(p => buildFreelanceCard(p, clMap[p.id])).join('')
  const avaliarCards = avaliar.map(p => buildFreelanceCard(p, null)).join('')

  const sections = []
  if (aceitar.length > 0) sections.push({ title: '✅ Enviar proposta agora', cards: aceitarCards })
  if (avaliar.length > 0) sections.push({ title: '🟡 Avaliar antes de propor', cards: avaliarCards })

  const html = buildEmailHtml({
    headerColor: '#6d28d9',
    headerEmoji: '💼',
    headerTitle: 'Projetos Freelance',
    summaryCards: [
      { value: aceitar.length, label: 'Para proposta', color: '#16a34a' },
      { value: avaliar.length, label: 'Para avaliar', color: '#ca8a04' },
      { value: aceitar.length + avaliar.length, label: 'Total relevantes', color: '#6d28d9' }
    ],
    sections,
    footerDate: now,
    usageSummary
  })

  await resend.emails.send({
    from: process.env.FREELANCE_EMAIL_FROM,
    to: process.env.FREELANCE_EMAIL_TO,
    subject: `💼 ${aceitar.length} projetos para proposta + ${avaliar.length} para avaliar — ${now}`,
    html
  })
}

export async function sendErrorEmail({ agent, error, step, timestamp }) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const emailFrom = agent === 'job-hunter'
    ? process.env.JOB_EMAIL_FROM
    : process.env.FREELANCE_EMAIL_FROM

  const emailTo = agent === 'job-hunter'
    ? process.env.JOB_EMAIL_TO
    : process.env.FREELANCE_EMAIL_TO

  if (!emailFrom || !emailTo) return

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="background:#dc2626;border-radius:12px;padding:28px 32px;margin-bottom:24px;color:#fff;">
      <h1 style="margin:0;font-size:22px;">&#128165; Falha no ${agent}</h1>
      <p style="margin:8px 0 0 0;opacity:.85;font-size:14px;">${new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    </div>
    <div style="background:#fff;border:1px solid #fca5a5;border-radius:10px;padding:20px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Passo onde falhou:</p>
      <p style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:#111827;">${step ?? 'Não identificado'}</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Erro:</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;">
        <pre style="margin:0;font-size:12px;color:#7f1d1d;white-space:pre-wrap;word-break:break-all;">${error}</pre>
      </div>
      <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">
        Verifique os logs completos em: GitHub Actions → ${agent} → última execução
      </p>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:12px;color:#9ca3af;">
      career-hunter · github.com/gabrielrodri33
    </div>
  </div>
</body>
</html>`

  await resend.emails.send({
    from: emailFrom,
    to: emailTo,
    subject: `&#128165; [career-hunter] Falha no ${agent} — ${new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    html
  })
}
