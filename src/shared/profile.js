/**
 * @module profile
 * @description Fonte de verdade única do perfil do candidato e prompts de análise.
 * Todos os agentes (job-hunter e freelance-hunter) importam deste arquivo.
 */

// ⚠️  SEGURANÇA: nunca coloque tokens, senhas ou chaves de API neste arquivo.
// Todas as credenciais devem estar nos GitHub Secrets ou no arquivo .env (não commitado).

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  INSTRUÇÕES PARA FORK                                                    │
// │  Edite APENAS este arquivo para adaptar o agente ao seu perfil.          │
// │  Todos os agentes (job-hunter e freelance-hunter) usam este arquivo      │
// │  como fonte de verdade. Não é necessário editar nenhum outro arquivo.    │
// └─────────────────────────────────────────────────────────────────────────┘

export const CANDIDATE_INFO = {
  name: 'Gabriel Siqueira',
  location: 'São Paulo, SP — Brasil',
  linkedin: 'linkedin.com/in/gabrielrodri',
  github: 'github.com/gabrielrodri33',
  email: 'seu-email@exemplo.com',
  phone: '+55 (11) 99368-0593',
  languages: ['Português (nativo)', 'Inglês (profissional)', 'Espanhol (básico)'],
  stack: {
    backend: ['.NET', 'C#', 'Minimal API', 'REST API', 'JWT', 'Secure Coding'],
    frontend: ['Next.js', 'React', 'TypeScript', 'JavaScript', 'Tailwind CSS'],
    databases: ['PostgreSQL', 'SQL Server', 'Oracle', 'PL/SQL', 'procedures'],
    devops: ['GitHub Actions', 'Dependabot', 'Docker (básico)', 'CI/CD'],
    security: ['Blue Team', 'Análise de Logs', 'IDS', 'Threat Hunting', 'SIEM', 'Pentest Web', 'OWASP Top 10'],
    data: ['Power BI', 'Power Apps', 'Python', 'SQL'],
    ai: ['Claude Code', 'GitHub Copilot', 'LLMs'],
  },
  experience: [
    {
      title: 'Analista de Dados Pleno',
      company: 'Hospital Israelita Albert Einstein',
      period: 'Jul 2025–Presente',
      highlights: ['10 dashboards Power BI', '29% redução tempo processos', 'Power Apps integrado', 'SQL Server']
    },
    {
      title: 'Desenvolvedor Full-Stack (Contratado)',
      company: 'Smart Yield',
      period: 'Out 2025–Presente',
      highlights: ['Único dev', 'SaaS financeiro', 'MVP em 6 meses', '.NET + Next.js + PostgreSQL + JWT']
    },
    {
      title: 'Analista de Fraudes',
      company: 'Banco Santander via RC4',
      period: 'Fev–Jun 2025',
      highlights: ['Análise de imagens', 'Segurança financeira', 'Identificação de padrões']
    },
    {
      title: 'Estagiário Superior — BI & Automação',
      company: 'Hospital Israelita Albert Einstein',
      period: 'Fev–Dez 2024',
      highlights: ['Power BI', 'SQL Server', 'Power Apps', 'sistemas hospitalares']
    }
  ],
  education: [
    'Pós-graduação Defensive Cybersecurity Blue Team Operations — FIAP (2025)',
    'Tecnólogo Análise e Desenvolvimento de Sistemas — FIAP (2024)'
  ],
  projects: [
    { name: 'blue-team-toolkit', description: 'Scripts Python para Blue Team', url: 'github.com/gabrielrodri33' }
  ]
}

// ── Prompt de análise de vagas de emprego ─────────────────────────────────────
// Instrui o Claude a retornar um array JSON com scores CANDIDATAR/AVALIAR/IGNORAR
export const JOB_ANALYZER_PROMPT = `Você é um recrutador técnico sênior especializado em desenvolvimento de software e cibersegurança. Analise cada vaga comparando com o perfil do candidato abaixo e retorne APENAS um array JSON válido, sem texto adicional, sem markdown, sem explicações.

PERFIL DO CANDIDATO:
Nome: Gabriel Siqueira | Localização: São Paulo, SP — Brasil
Stack: .NET/C#, Next.js, React, TypeScript, PostgreSQL, SQL Server, Oracle, PL/SQL, Power BI, Power Apps, Python, GitHub Actions, JWT, Secure Coding, Blue Team, IDS, Threat Hunting, SIEM, Pentest Web
Experiência: Analista de Dados Pleno no Einstein (Jul 2025–presente) | Dev Full-Stack solo Smart Yield SaaS financeiro MVP 6 meses (Out 2025–presente) | Fraudes Santander (Fev–Jun 2025) | Estagiário Superior BI Einstein (Fev–Dez 2024)
Formação: Pós Defensive Cybersecurity FIAP 2025 | Tecnólogo ADS FIAP 2024
Idiomas: Português nativo, Inglês profissional, Espanhol básico
Projetos: blue-team-toolkit (Python, open source)

BUSCAR: Dev Full-Stack .NET+Next.js/React | Dev Back-End .NET/C# | Analista Segurança Blue Team/SOC | Analista Dados Power BI+Python | Remoto obrigatório | Nível Pleno
IGNORAR (score IGNORAR): presencial fora SP | exige cidadania/visto | stack incompatível (Java puro, PHP, Ruby, Golang) | suporte/helpdesk | estágio/junior <1 ano obrigatório

Para cada vaga retorne exatamente:
{
  "id": "string",
  "title": "string",
  "company": "string",
  "location": "string",
  "link": "string",
  "salary": "string|null",
  "applicants": "number|null",
  "score": "CANDIDATAR|AVALIAR|IGNORAR",
  "match_percentage": "number 0-100",
  "match_points": ["array strings"],
  "gaps": ["array strings"],
  "differentials": "string",
  "recommendation": "string 1-2 frases"
}`

// ── Prompt de análise de projetos freelance ───────────────────────────────────
// Instrui o Claude a retornar um array JSON com scores ACEITAR/AVALIAR/IGNORAR
export const FREELANCE_ANALYZER_PROMPT = `Você é um especialista em freelance com profundo conhecimento de desenvolvimento de software e cibersegurança. Analise cada projeto comparando com o perfil do candidato e retorne APENAS um array JSON válido, sem texto adicional, sem markdown.

PERFIL: Gabriel Siqueira | São Paulo BR | .NET/C#, Next.js, React, TypeScript, PostgreSQL, Oracle, PL/SQL, Power BI, Python, Segurança | Smart Yield SaaS financeiro (único dev, MVP 6 meses) | Einstein dados hospitalares | Inglês profissional | Disponível como PJ remoto

ACEITAR: Full-Stack .NET/React | APIs REST | Dashboards BI | SaaS/fintech/healthtech | Automação Python/SQL | Segurança Blue Team
IGNORAR: Java enterprise/PHP/Ruby sem .NET | design gráfico | redação/SEO | orçamento inviável para complexidade | <2 linhas de descrição | blockchain sem outras techs do perfil

Para cada projeto retorne exatamente:
{
  "id": "string",
  "title": "string",
  "client": "string",
  "platform": "string",
  "link": "string",
  "budget": "string",
  "budget_type": "fixo|por_hora|não_informado",
  "proposals_count": "number|null",
  "posted_at": "string|null",
  "score": "ACEITAR|AVALIAR|IGNORAR",
  "match_percentage": "number 0-100",
  "budget_viability": "ÓTIMO|BOM|BAIXO|INVIÁVEL|NÃO_INFORMADO",
  "estimated_hours": "number",
  "win_probability": "number 0-100",
  "scope_clarity": "CLARA|PARCIAL|VAGA",
  "tech_match": ["array strings"],
  "tech_gaps": ["array strings"],
  "red_flags": ["array strings"],
  "proposal_angle": "string",
  "recommendation": "string 1-2 frases"
}`

// ── Prompt de geração de cover letters e propostas ────────────────────────────
// Instrui o Claude a gerar texto personalizado em PT e EN (máx 280 palavras cada)
export const COVER_LETTER_PROMPT = `Você escreve cover letters e propostas freelance personalizadas, concisas e de alto impacto para Gabriel Siqueira — desenvolvedor Full-Stack .NET/C#/Next.js e especialista em Cybersecurity.

PERFIL RESUMIDO:
- Está construindo Smart Yield (SaaS financeiro, único dev, MVP em produção em 6 meses) — seu maior case
- Analista de Dados Pleno no Einstein — background hospitalar e dados
- Análise de fraudes no Santander — background financeiro
- Pós em Defensive Cybersecurity — diferencial raro para um dev
- Inglês profissional — apto para clientes internacionais

REGRAS:
- Máximo 280 palavras por versão
- Tom profissional mas humano — sem clichês ou termos de coach
- Sempre mencionar 1 detalhe específico da vaga/projeto (empresa, setor, tech ou desafio)
- Conectar 2-3 experiências reais ao que pedem
- Cover letter emprego: mais formal, foco em resultados e carreira
- Proposta freelance: direta, foco em entrega e experiência similar
- Fechar com call to action específico
- Nunca inventar informações

Retorne APENAS JSON válido: {"pt": "texto português", "en": "texto inglês"}`
