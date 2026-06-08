# career-hunter

Monorepo com dois agentes autônomos que buscam oportunidades de trabalho e projetos freelance, analisam com Claude AI e enviam e-mails formatados com cover letters prontas.

```
┌─────────────────────────────────────────────────────────┐
│                     career-hunter                       │
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │     job-hunter      │  │    freelance-hunter      │  │
│  │  (diário 11h UTC)   │  │   (diário 12h UTC)       │  │
│  └────────┬────────────┘  └────────┬────────────────┘  │
│           │                        │                    │
│  ┌────────▼────────┐      ┌────────▼────────────┐      │
│  │ LinkedIn Scraper│      │ Upwork + Workana +   │      │
│  │   (Apify)       │      │ Freelancer.com API   │      │
│  └────────┬────────┘      └────────┬────────────┘      │
│           │                        │                    │
│  ┌────────▼────────────────────────▼────────────────┐  │
│  │              shared/                              │  │
│  │  dedup → analyzer (Claude) → cover-letter → email │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo Job Hunter

```
LinkedIn Scraper (Apify)
        │
        ▼
  Dedup (seen-jobs.json)
        │
        ▼
  Analyzer Claude AI
  ┌─────┴───────┐
  │             │
CANDIDATAR   AVALIAR   (IGNORAR → descartado)
  │
  ▼
Cover Letter PT + EN
  │
  ▼
E-mail HTML → seu-email@exemplo.com
```

## Fluxo Freelance Hunter

```
Upwork + Workana + Freelancer.com (paralelo)
        │
        ▼
  Normalizer (schema único)
        │
        ▼
  Dedup cross-platform (id + similaridade de título)
        │
        ▼
  Analyzer Claude AI
  ┌─────┴───────┐
  │             │
ACEITAR      AVALIAR   (IGNORAR → descartado)
  │
  ▼
Ordenar por win_probability
  │
  ▼
Proposta PT + EN
  │
  ▼
E-mail HTML → seu-email@exemplo.com
```

---

## Estrutura de arquivos

```
career-hunter/
├── .github/
│   └── workflows/
│       ├── job-hunter.yml          # Roda seg–sex às 11h UTC
│       └── freelance-hunter.yml    # Roda seg–sex às 12h UTC
├── src/
│   ├── shared/
│   │   ├── profile.js              # ← EDITE AQUI: perfil, prompts
│   │   ├── analyzer.js             # Claude AI: analisa vagas/projetos
│   │   ├── cover-letter.js         # Claude AI: gera cover letters
│   │   ├── email.js                # Resend: monta e envia HTML
│   │   └── dedup.js                # Evita reprocessar o que já foi visto
│   ├── job-hunter/
│   │   ├── index.js                # Orquestrador do Job Hunter
│   │   └── scrapers/
│   │       └── linkedin.js         # Apify: curious_coder/linkedin-jobs-scraper
│   └── freelance-hunter/
│       ├── index.js                # Orquestrador do Freelance Hunter
│       ├── normalizer.js           # Converte dados das 3 plataformas
│       └── scrapers/
│           ├── upwork.js           # Apify: jupri/upwork
│           ├── workana.js          # Apify: getdataforme/workana-job-scraper
│           └── freelancer.js       # API nativa Freelancer.com
├── data/
│   ├── seen-jobs.json              # Cache de IDs (gerenciado por GitHub Actions)
│   └── seen-projects.json          # Cache de IDs (gerenciado por GitHub Actions)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Pré-requisitos

| Serviço | Finalidade | Custo |
|---|---|---|
| [Apify](https://apify.com) | Scrapers LinkedIn, Upwork, Workana | ~$2–7/mês |
| [Anthropic](https://console.anthropic.com) | Análise com Claude AI | ~$1–5/mês |
| [Resend](https://resend.com) | Envio de e-mails | Grátis (3k emails/mês) |
| [Freelancer.com Developers](https://developers.freelancer.com) | API de projetos | Grátis |

---

## Configuração

### 1. Clonar e instalar

```bash
git clone https://github.com/gabrielrodri33/jobs-hunter.git career-hunter
cd career-hunter
npm install
```

### 2. Criar `.env` baseado no exemplo

```bash
cp .env.example .env
```

### 3. Obter tokens

**Apify token**
1. Acesse [apify.com](https://apify.com) → Sign Up (plano gratuito tem $5 de crédito)
2. Settings → Integrations → API token
3. Copie o token para `APIFY_TOKEN`

**Anthropic API key**
1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key
3. Copie para `ANTHROPIC_API_KEY`

**Resend API key**
1. Acesse [resend.com](https://resend.com) → Sign Up
2. API Keys → Create API Key
3. Verifique seu domínio em Domains (ou use `onboarding@resend.dev` para testes)
4. Copie para `RESEND_API_KEY`

**Freelancer.com token (opcional)**
1. Acesse [developers.freelancer.com](https://developers.freelancer.com)
2. My Apps → Create new app
3. OAuth 2.0 → Generate personal access token
4. Escopos necessários: `basic` e `projects`
5. Copie para `FREELANCER_TOKEN`

---

## GitHub Secrets necessários

Configure em: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Descrição |
|---|---|
| `APIFY_TOKEN` | Token da conta Apify |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic |
| `RESEND_API_KEY` | Chave da API Resend |
| `FREELANCER_TOKEN` | Token OAuth Freelancer.com (opcional) |
| `JOB_EMAIL_FROM` | Ex: `vagas@seudominio.com` |
| `JOB_EMAIL_TO` | Ex: `seu-email@exemplo.com` |
| `FREELANCE_EMAIL_FROM` | Ex: `freelance@seudominio.com` |
| `FREELANCE_EMAIL_TO` | Ex: `seu-email@exemplo.com` |

> Você pode usar o mesmo endereço em `FROM` e `TO` se preferir.

---

## Teste local

```bash
# Testar Job Hunter
npm run dev:jobs

# Testar Freelance Hunter
npm run dev:freelance
```

> Requer Node 20+. O `--env-file=.env` carrega as variáveis automaticamente.

---

## Primeiro deploy

```bash
# 1. Faça push para main
git push origin main

# 2. Acesse GitHub → Actions → Job Hunter → Run workflow
# (ou aguarde o próximo dia útil às 11h UTC)
```

---

## Custo estimado mensal

| Serviço | Custo estimado |
|---|---|
| Apify (scrapers) | $2 – $7 |
| Anthropic (Claude) | $1 – $5 |
| Resend (e-mails) | Grátis |
| Freelancer.com API | Grátis |
| **Total** | **~$3 – $12/mês** |

---

## Como personalizar

### Adicionar URLs de busca (LinkedIn)
Edite `src/job-hunter/scrapers/linkedin.js` → array `SEARCH_URLS`.

### Adicionar keywords (Upwork/Workana/Freelancer)
Edite `src/freelance-hunter/scrapers/upwork.js` → `UPWORK_KEYWORDS`
Edite `src/freelance-hunter/scrapers/workana.js` → `WORKANA_KEYWORDS`
Edite `src/freelance-hunter/scrapers/freelancer.js` → `FREELANCER_KEYWORDS`

### Atualizar perfil
Edite **apenas** `src/shared/profile.js` — todos os prompts e dados do candidato vivem lá.

---

## Troubleshooting

### Upwork ou Workana retornam vazio
Adicione proxy residencial ao input dos actors no scraper correspondente:

```javascript
body: JSON.stringify({
  searchQuery: keyword,
  maxItems: 20,
  type: 'jobs',
  proxyConfiguration: {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL']
  }
})
```

### E-mail não chega
- Verifique se o domínio está verificado no Resend
- Para testes use `onboarding@resend.dev` como `FROM` (envia apenas para o e-mail da conta Resend)

### GitHub Actions falha
- Confirme que os 7 secrets estão configurados
- Veja os logs em Actions → selecione o run → clique no step com erro
