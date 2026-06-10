# 🎯 career-hunter

Monorepo com dois agentes autônomos que buscam oportunidades de trabalho e projetos freelance, analisam com LLMs **gratuitos** via OpenRouter e enviam e-mails formatados diariamente.

**Custo total: R$ 0/mês.** Sem Apify, sem API paga — scraping direto + modelos free.

```
┌─────────────────────────────────────────────────────────┐
│                     career-hunter                       │
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │     job-hunter      │  │    freelance-hunter     │   │
│  │  (diário 11h UTC)   │  │   (diário 12h UTC)      │   │
│  └────────┬────────────┘  └────────┬────────────────┘   │
│           │                        │                    │
│  ┌────────▼────────┐      ┌────────▼────────────┐       │
│  │ LinkedIn guest  │      │ Workana (scraping) +│       │
│  │ API (scraping)  │      │ Freelancer.com API  │       │
│  └────────┬────────┘      └────────┬────────────┘       │
│           │                        │                    │
│  ┌────────▼────────────────────────▼─────────────────┐  │
│  │                    shared/                        │  │
│  │  dedup → pré-filtro → analyzer (OpenRouter free)  │  │
│  │            → cover letters → email                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## O que faz

| Agente | Fonte | Horário | O que entrega |
|--------|-------|---------|---------------|
| **job-hunter** | LinkedIn (endpoint público de guest, sem login) | 8h dias úteis | Vagas analisadas e rankeadas |
| **freelance-hunter** | Workana (scraping direto) + Freelancer.com (API nativa) | 9h dias úteis | Projetos freelance + propostas PT/EN |

> ⚠️ **Upwork está desativado temporariamente** (exigia actor pago do Apify e tem proteção Cloudflare). O arquivo `src/freelance-hunter/scrapers/upwork.js` foi mantido para reativação futura.

```
Scraping direto (LinkedIn guest / Workana / Freelancer.com)
        │  falha de uma fonte não interrompe as demais
        ▼
  Normalizer (schema único) + Dedup (histórico + cross-platform Jaccard > 0.8)
        │
        ▼
  Pré-filtro local SEM IA (src/shared/prefilter.js)
        │  descarta por keywords obrigatórias/proibidas/senioridade
        ▼
  Analyzer — OpenRouter modelos free, lotes de 10, fallback entre modelos
  ┌─────┴───────┐
CANDIDATAR/   AVALIAR   (IGNORAR → descartado)
ACEITAR
  │
  ▼
Top 5 por win_probability → Cover letter / proposta PT + EN
  │
  ▼
E-mail HTML via Gmail SMTP (ou Resend)
```

---

## Estrutura do projeto

```
career-hunter/
├── .github/
│   └── workflows/
│       ├── job-hunter.yml          # Roda seg–sex às 11h UTC
│       └── freelance-hunter.yml    # Roda seg–sex às 12h UTC
├── src/
│   ├── shared/
│   │   ├── profile.js              # ← EDITE AQUI: perfil, prompts, regras do pré-filtro
│   │   ├── llm.js                  # Cliente OpenRouter com fallback entre modelos
│   │   ├── prefilter.js            # Pré-filtro local sem IA
│   │   ├── analyzer.js             # Análise em lotes de 10 via LLM
│   │   ├── cover-letter.js         # Propostas PT/EN (top 5 por win_probability)
│   │   ├── email.js                # Gmail SMTP (default) ou Resend
│   │   ├── dedup.js                # Evita reprocessar o que já foi visto
│   │   └── utils.js                # sleep + retry com backoff
│   ├── job-hunter/
│   │   ├── index.js                # Orquestrador do Job Hunter
│   │   └── scrapers/
│   │       └── linkedin.js         # Endpoint guest do LinkedIn + cheerio
│   └── freelance-hunter/
│       ├── index.js                # Orquestrador do Freelance Hunter
│       ├── normalizer.js           # Converte dados das plataformas
│       └── scrapers/
│           ├── workana.js          # Scraping direto da busca pública
│           ├── freelancer.js       # API nativa Freelancer.com (grátis)
│           └── upwork.js           # DESATIVADO (Apify + Cloudflare)
├── data/
│   ├── seen-jobs.json              # Cache de IDs (gerenciado por GitHub Actions)
│   └── seen-projects.json          # Cache de IDs (gerenciado por GitHub Actions)
├── .env.example
└── package.json
```

---

## Pré-requisitos e custos

| Serviço | Finalidade | Custo |
|---|---|---|
| [OpenRouter](https://openrouter.ai) | Análise e cover letters com modelos free | **Grátis** |
| Gmail (senha de app) | Envio de e-mails (default) | Grátis |
| [Resend](https://resend.com) | Envio de e-mails (alternativa, requer domínio) | Grátis (3k emails/mês) |
| [Freelancer.com Developers](https://developers.freelancer.com) | API de projetos freelance (opcional) | Grátis |
| LinkedIn / Workana | Scraping direto de páginas públicas | Grátis |
| **Total** | | **R$ 0/mês** |

---

## Configuração — passo a passo

### 1. Fork e clone

```bash
git clone https://github.com/gabrielrodri33/Jobs-Hunter.git career-hunter
cd career-hunter
npm install
```

### 2. Configure o seu perfil

Edite **apenas** o arquivo `src/shared/profile.js` com seus dados:

```javascript
export const CANDIDATE_INFO = {
  name: 'Seu Nome',
  location: 'Sua Cidade, País',
  // ... preencha com sua stack, experiência e formação
}
```

No mesmo arquivo, ajuste `PREFILTER_RULES` — as keywords obrigatórias/proibidas que eliminam itens irrelevantes **antes** de gastar chamadas de LLM.

### 3. Crie a chave do OpenRouter

1. Acesse [openrouter.ai](https://openrouter.ai) e crie uma conta (login com Google/GitHub)
2. Vá em **Keys** → **Create Key** → nomeie como `career-hunter`
3. Copie a chave (começa com `sk-or-`)
4. Crie o secret `OPENROUTER_API_KEY` com esse valor

> **Modelos:** o sistema usa modelos `:free` (custo zero) com fallback automático entre eles. Os IDs free mudam com frequência — confira a lista atual em [openrouter.ai/models](https://openrouter.ai/models) (filtro **Free**) e, se quiser, sobrescreva via secrets `OPENROUTER_MODELS_ANALYZER` e `OPENROUTER_MODELS_WRITER` (IDs separados por vírgula).

### 4. Configurar e-mail (Gmail)

O provider padrão é o **Gmail SMTP** — não precisa de domínio nem de serviço externo:

1. Ative a **verificação em duas etapas** na sua conta Google: [myaccount.google.com/security](https://myaccount.google.com/security)
2. Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Crie uma senha de app com o nome `career-hunter` e copie os 16 caracteres gerados
4. Crie os secrets `GMAIL_USER` (seu e-mail Gmail) e `GMAIL_APP_PASSWORD` (a senha de app)

> No Gmail o remetente é sempre `GMAIL_USER` — o Gmail ignora remetente forjado, então `JOB_EMAIL_FROM`/`FREELANCE_EMAIL_FROM` não são necessários.

#### Alternativa: Resend (para quem tem domínio próprio)

1. Crie conta em [resend.com](https://resend.com), verifique seu domínio em **Domains** e crie uma **API Key**
2. Configure os secrets `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `JOB_EMAIL_FROM` e `FREELANCE_EMAIL_FROM`

### 5. (Opcional) Token do Freelancer.com

1. Acesse [developers.freelancer.com](https://developers.freelancer.com) → **Create New App**
2. Aba **OAuth 2.0** → **Personal Access Tokens** → **Generate Token** (escopos: `basic` e `projects`)
3. Sem esse token, o agente simplesmente pula a plataforma sem erro.

### 6. GitHub Secrets

Configure em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `OPENROUTER_API_KEY` | ✅ Sim | Chave do OpenRouter |
| `GMAIL_USER` | ✅ Sim | Seu e-mail Gmail (remetente) |
| `GMAIL_APP_PASSWORD` | ✅ Sim | Senha de app do Gmail (16 caracteres) |
| `JOB_EMAIL_TO` | ✅ Sim | Destinatário das vagas |
| `FREELANCE_EMAIL_TO` | ✅ Sim | Destinatário dos projetos |
| `FREELANCER_TOKEN` | ⚡ Opcional | Token Freelancer.com (pula plataforma se ausente) |
| `OPENROUTER_MODELS_ANALYZER` | ⚡ Opcional | Cadeia de modelos para análise |
| `OPENROUTER_MODELS_WRITER` | ⚡ Opcional | Cadeia de modelos para cover letters |
| `EMAIL_PROVIDER` | ⚡ Opcional | `gmail` (default) ou `resend` |
| `RESEND_API_KEY` | ⚡ Opcional | Apenas com `EMAIL_PROVIDER=resend` |
| `JOB_EMAIL_FROM` | ⚡ Opcional | Remetente das vagas (apenas Resend) |
| `FREELANCE_EMAIL_FROM` | ⚡ Opcional | Remetente dos projetos (apenas Resend) |

### 7. Personalize as buscas (opcional)

- **LinkedIn:** edite `SEARCHES` em `src/job-hunter/scrapers/linkedin.js`
- **Workana:** edite `WORKANA_KEYWORDS` em `src/freelance-hunter/scrapers/workana.js`
- **Freelancer.com:** edite `FREELANCER_KEYWORDS` em `src/freelance-hunter/scrapers/freelancer.js`
- **Máximo de cover letters por execução:** env `MAX_COVER_LETTERS` (default 5)

### 8. Primeiro teste

**Actions → Job Hunter → Run workflow** (pode escolher o filtro de recência). Em erro, você recebe um e-mail indicando o passo que falhou.

Teste local:

```bash
cp .env.example .env
# Preencha o .env (só OPENROUTER_API_KEY, GMAIL_USER e GMAIL_APP_PASSWORD são necessários)
npm run dev:jobs       # testa o job hunter
npm run dev:freelance  # testa o freelance hunter
```

> Requer Node 20+. O `--env-file=.env` carrega as variáveis automaticamente.

---

## Como o custo zero é mantido

1. **Scraping direto** — LinkedIn via endpoint público de guest (sem login), Workana via busca pública, Freelancer.com via API gratuita. Delays aleatórios de 2–5s e retry com backoff respeitam os servidores.
2. **Pré-filtro local sem IA** — regras de keywords em `profile.js` eliminam itens irrelevantes antes de qualquer chamada de LLM. Os logs mostram quantos foram descartados.
3. **Modelos free do OpenRouter** — análise em lotes de 10 itens por chamada, com throttle de 3s (rate limit free de ~20 req/min) e fallback automático entre modelos em caso de 429/5xx.
4. **Cover letters limitadas** — apenas o top 5 por `win_probability` (configurável via `MAX_COVER_LETTERS`).

---

## Troubleshooting

### LinkedIn retorna vazio ou 429
O endpoint guest tem rate limiting agressivo. O scraper já usa delays e retries; se persistir, reduza o número de buscas em `SEARCHES` ou aumente os delays.

### Workana retorna 0 projetos
O layout da página pode ter mudado. O scraper tenta JSON embutido e depois HTML — confira os seletores em `parseHtmlProjects()` (`src/freelance-hunter/scrapers/workana.js`).

### LLM retorna erro em todos os modelos
- Confirme que `OPENROUTER_API_KEY` está correto
- Os IDs `:free` mudam — atualize `OPENROUTER_MODELS_ANALYZER`/`WRITER` com modelos atuais de [openrouter.ai/models](https://openrouter.ai/models)

### GitHub Actions falha
- Confirme que todos os secrets obrigatórios estão configurados (nomes são case-sensitive)
- Veja os logs em **Actions → selecione o run → clique no step com erro**
