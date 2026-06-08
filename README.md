# 🎯 career-hunter

> Agente autônomo que busca vagas de emprego e projetos freelance, analisa compatibilidade com seu perfil usando Claude AI e envia um e-mail diário com as melhores oportunidades — incluindo cover letters prontas em PT e EN.

[![Job Hunter](https://img.shields.io/github/actions/workflow/status/gabrielrodri33/Jobs-Hunter/job-hunter.yml?label=job-hunter&style=flat-square)](https://github.com/gabrielrodri33/Jobs-Hunter/actions)
[![Freelance Hunter](https://img.shields.io/github/actions/workflow/status/gabrielrodri33/Jobs-Hunter/freelance-hunter.yml?label=freelance-hunter&style=flat-square)](https://github.com/gabrielrodri33/Jobs-Hunter/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js)](https://nodejs.org)

---

## O que faz

Dois agentes autônomos rodando via GitHub Actions (de graça):

| Agente | Fonte | Horário | O que entrega |
|--------|-------|---------|---------------|
| **job-hunter** | LinkedIn (Apify) | 8h dias úteis | Vagas analisadas + cover letters PT/EN |
| **freelance-hunter** | Freelancer.com (API nativa) + Upwork + Workana (Apify) | 9h dias úteis | Projetos freelance + propostas PT/EN |

Para cada oportunidade você recebe:

- ✅ Score de compatibilidade (CANDIDATAR / AVALIAR / IGNORAR)
- ✅ Match técnico detalhado
- ✅ Gaps identificados
- ✅ Seu diferencial para aquela vaga específica
- ✅ Cover letter personalizada em português e inglês
- ✅ Custo da execução (Apify + Anthropic) no rodapé do e-mail

---

## Como funciona

```
GitHub Actions (cron)
       ↓
Apify / Freelancer.com API  →  coleta vagas/projetos
       ↓
Claude API (Sonnet)  →  analisa compatibilidade + gera cover letters
       ↓
Resend  →  e-mail formatado com tudo
```

---

## Pré-requisitos

- Conta [Apify](https://apify.com) (plano gratuito tem créditos iniciais)
- Conta [Anthropic](https://console.anthropic.com) (mínimo $5 em créditos)
- Conta [Resend](https://resend.com) (gratuito até 3.000 e-mails/mês)
- Conta [Freelancer.com Developers](https://developers.freelancer.com) (gratuito)
- Repositório no GitHub (Actions gratuito para repos públicos)

**Custo estimado: ~$8–14/mês** (Apify ~$5–9 + Anthropic ~$3–5 + o resto gratuito)

---

## Configuração — passo a passo

### 1. Fork e clone

```bash
git clone https://github.com/gabrielrodri33/Jobs-Hunter.git career-hunter
cd career-hunter
npm install
```

### 2. Obtenha os tokens

<details>
<summary><strong>🔑 Apify Token</strong></summary>

1. Acesse [console.apify.com](https://console.apify.com)
2. Clique no seu avatar → **Settings** → **Integrations**
3. Copie o **Personal API token**

</details>

<details>
<summary><strong>🤖 Anthropic API Key</strong></summary>

1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Menu lateral → **API Keys** → **Create Key**
3. Nomeie como `career-hunter` e copie a chave (começa com `sk-ant-`)
4. Vá em **Billing** → adicione no mínimo $5 em créditos

</details>

<details>
<summary><strong>📧 Resend API Key</strong></summary>

1. Acesse [resend.com](https://resend.com) e crie uma conta
2. **API Keys** → **Create API Key**
3. Para o campo `from`, você pode usar um domínio próprio ou o domínio sandbox do Resend para testes

</details>

<details>
<summary><strong>💼 Freelancer.com OAuth Token</strong></summary>

1. Acesse [developers.freelancer.com](https://developers.freelancer.com)
2. **My Apps** → **Create App**
3. Na aba **OAuth 2.0**, gere um token pessoal com escopos: `basic` e `projects`

</details>

### 3. Configure o seu perfil

Edite **apenas** o arquivo `src/shared/profile.js` com seus dados:

```javascript
// src/shared/profile.js
export const CANDIDATE_INFO = {
  name: 'Seu Nome',
  location: 'Sua Cidade, País',
  // ... preencha com sua stack, experiência e formação
}
```

> Este é o único arquivo que você precisa editar. Todos os agentes usam esse perfil como fonte de verdade.

### 4. Configure os GitHub Secrets

No seu repositório: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Onde obter |
|--------|-----------|
| `APIFY_TOKEN` | Apify Console → Settings → Integrations |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `RESEND_API_KEY` | resend.com → API Keys |
| `FREELANCER_TOKEN` | developers.freelancer.com → OAuth 2.0 |
| `JOB_EMAIL_FROM` | Ex: `vagas@seudominio.com` |
| `JOB_EMAIL_TO` | Seu e-mail para receber as vagas |
| `FREELANCE_EMAIL_FROM` | Ex: `freelance@seudominio.com` |
| `FREELANCE_EMAIL_TO` | Seu e-mail para receber os projetos |

### 5. Personalize as buscas (opcional)

- **Vagas LinkedIn:** edite `SEARCH_URLS` em `src/job-hunter/scrapers/linkedin.js`
- **Freelancer.com:** edite `FREELANCER_KEYWORDS` em `src/freelance-hunter/scrapers/freelancer.js`
- **Upwork:** edite `UPWORK_KEYWORDS` em `src/freelance-hunter/scrapers/upwork.js`
- **Workana:** edite `WORKANA_KEYWORDS` em `src/freelance-hunter/scrapers/workana.js`

### 6. Primeiro teste local

```bash
# Crie o .env baseado no exemplo
cp .env.example .env
# Preencha o .env com seus tokens

# Testar job hunter
npm run dev:jobs

# Testar freelance hunter
npm run dev:freelance
```

### 7. Deploy

```bash
git add .
git commit -m "chore: configure profile and search preferences"
git push origin main
```

Após o push, vá em **Actions** → selecione o workflow → **Run workflow** para testar manualmente antes do primeiro cron.

---

## Estrutura do projeto

```
career-hunter/
├── .github/workflows/
│   ├── job-hunter.yml          # Roda dias úteis às 8h (horário Brasília)
│   └── freelance-hunter.yml    # Roda dias úteis às 9h (horário Brasília)
├── src/
│   ├── shared/                 # Módulos compartilhados entre os agentes
│   │   ├── profile.js          # ← EDITE ESTE com seu perfil
│   │   ├── analyzer.js         # Análise de compatibilidade via Claude API
│   │   ├── cover-letter.js     # Geração de cover letters via Claude API
│   │   ├── email.js            # Templates HTML + envio via Resend
│   │   ├── dedup.js            # Controle de duplicatas entre execuções
│   │   └── utils.js            # Retry com backoff, sleep
│   ├── job-hunter/
│   │   ├── index.js            # Orquestrador do job hunter
│   │   └── scrapers/
│   │       └── linkedin.js     # Apify: curious_coder/linkedin-jobs-scraper
│   └── freelance-hunter/
│       ├── index.js            # Orquestrador do freelance hunter
│       ├── normalizer.js       # Normaliza dados cross-platform
│       └── scrapers/
│           ├── freelancer.js   # API nativa Freelancer.com (gratuita)
│           ├── upwork.js       # Apify: jupri/upwork
│           └── workana.js      # Apify: getdataforme/workana-job-scraper
├── data/                       # Gerenciado automaticamente pelo GitHub Actions cache
│   ├── seen-jobs.json          # IDs de vagas já enviadas
│   └── seen-projects.json      # IDs de projetos já enviados
├── .env.example
└── package.json
```

---

## Custo estimado mensal

| Serviço | Uso | Custo |
|---------|-----|-------|
| GitHub Actions | 44 execuções (~5–8 min cada) | **Grátis** |
| Resend | ~40 e-mails/mês | **Grátis** |
| Freelancer.com API | ~198 chamadas/mês | **Grátis** |
| Apify (LinkedIn + Upwork + Workana) | ~7.000 resultados/mês | **~$5–9/mês** |
| Anthropic API (Sonnet) | ~990 análises + ~143 cover letters | **~$3–5/mês** |
| **Total** | | **~$8–14/mês** |

> 💡 O custo real cai após a primeira semana porque o sistema de deduplicação evita reprocessar vagas já vistas.

---

## Adaptar para outra stack ou idioma

Edite `src/shared/profile.js` — especificamente os campos `stack`, `experience` e os prompts `JOB_ANALYZER_PROMPT` e `FREELANCE_ANALYZER_PROMPT`. Todos os agentes usam esse arquivo como fonte de verdade.

---

## Contribuindo

Contribuições são bem-vindas! Veja [CONTRIBUTING.md](CONTRIBUTING.md).

Ideias para contribuição:
- Novos scrapers (Indeed, Remote.com, Glassdoor)
- Suporte a outros idiomas no perfil
- Dashboard web para visualizar histórico de vagas
- Integração com Telegram ou WhatsApp

---

## Licença

MIT — veja [LICENSE](LICENSE) para detalhes.

---

<p align="center">Feito com ☕ e Claude AI</p>
