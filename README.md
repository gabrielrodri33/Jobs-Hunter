# 🎯 career-hunter

Monorepo com dois agentes autônomos que buscam oportunidades de trabalho e projetos freelance, analisam com Claude AI e enviam e-mails formatados diariamente.

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
│  │ (actor próprio) │      │ Freelancer.com API   │      │
│  └────────┬────────┘      └────────┬────────────┘      │
│           │                        │                    │
│  ┌────────▼────────────────────────▼────────────────┐  │
│  │              shared/                              │  │
│  │        dedup → analyzer (Claude) → email          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## O que faz

```
LinkedIn Easy Apply Scraper (actor próprio no Apify)
        │  verifica botão Easy Apply em cada vaga
        ▼
  Dedup (seen-jobs.json)
        │
        ▼
  Analyzer Claude AI (claude-haiku-4-5)
  ┌─────┴───────┐
  │             │
CANDIDATAR   AVALIAR   (IGNORAR → descartado)
  │
  ▼
E-mail HTML com vagas rankeadas
```

| Agente | Fonte | Horário | O que entrega |
|--------|-------|---------|---------------|
| **job-hunter** | LinkedIn (Apify) | 8h dias úteis | Vagas analisadas + cover letters PT/EN |
| **freelance-hunter** | Freelancer.com (API nativa) + Upwork + Workana (Apify) | 9h dias úteis | Projetos freelance + propostas PT/EN |

```
Upwork + Workana + Freelancer.com (paralelo, falhas não interrompem)
        │
        ▼
  Normalizer (schema único)
        │
        ▼
  Dedup cross-platform (id + similaridade de título Jaccard > 0.8)
        │
        ▼
  Analyzer Claude AI (claude-haiku-4-5)
  ┌─────┴───────┐
  │             │
ACEITAR      AVALIAR   (IGNORAR → descartado)
  │
  ▼
Ordenar por win_probability
  │
  ▼
Proposta PT + EN (cover-letter)
  │
  ▼
E-mail HTML com projetos e propostas
```

---

## Como funciona

```
career-hunter/
├── .github/
│   └── workflows/
│       ├── job-hunter.yml          # Roda seg–sex às 11h UTC
│       └── freelance-hunter.yml    # Roda seg–sex às 12h UTC
├── actors/
│   └── linkedin-easy-apply/        # Actor Apify customizado
│       ├── .actor/
│       │   ├── actor.json
│       │   └── input_schema.json
│       ├── src/
│       │   └── main.js             # Playwright: busca + verifica Easy Apply
│       ├── Dockerfile
│       ├── package.json
│       └── README.md
├── src/
│   ├── shared/
│   │   ├── profile.js              # ← EDITE AQUI: perfil, prompts
│   │   ├── analyzer.js             # Claude AI: analisa vagas/projetos
│   │   ├── cover-letter.js         # Claude AI: gera propostas freelance
│   │   ├── email.js                # Resend: monta e envia HTML
│   │   └── dedup.js                # Evita reprocessar o que já foi visto
│   ├── job-hunter/
│   │   ├── index.js                # Orquestrador do Job Hunter
│   │   └── scrapers/
│   │       └── linkedin.js         # Chama o actor via API Apify
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
| [Apify](https://apify.com) | Hospeda e roda o actor de LinkedIn | Pay-per-use |
| [Anthropic](https://console.anthropic.com) | Análise com Claude AI (Haiku 4.5) | ~$0.10–0.30/mês |
| [Resend](https://resend.com) | Envio de e-mails | Grátis (3k emails/mês) |
| [Freelancer.com Developers](https://developers.freelancer.com) | API de projetos freelance | Grátis |

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

> Este é o único arquivo que você precisa editar. Todos os agentes usam esse perfil como fonte de verdade.

### 3. Obtenha os tokens e configure os GitHub Secrets

Acesse seu repositório no GitHub: **Settings → Secrets and variables → Actions → New repository secret**

> ⚠️ Os nomes dos secrets são **case-sensitive** — escreva exatamente como nas instruções abaixo.

---

#### 🔑 APIFY_TOKEN

1. Acesse [apify.com](https://apify.com) e crie uma conta (plano gratuito tem $5 de crédito inicial)
2. No canto superior direito, clique no seu avatar → **Settings**
3. Aba **Integrations** → copie o **Personal API token**
4. Crie o secret `APIFY_TOKEN` com esse valor

---

#### 🤖 ANTHROPIC_API_KEY

1. Acesse [console.anthropic.com](https://console.anthropic.com) e crie uma conta
2. No menu lateral → **API Keys** → **Create Key**
3. Nomeie como `career-hunter` e copie a chave (começa com `sk-ant-`)
4. Vá em **Billing** e adicione no mínimo $5 em créditos (obrigatório para usar a API)
5. Crie o secret `ANTHROPIC_API_KEY` com esse valor

---

#### 📧 RESEND_API_KEY + configuração de e-mail

O Resend é usado para enviar os e-mails diários. O destinatário (`TO`) pode ser qualquer e-mail — inclusive Gmail. O remetente (`FROM`) precisa de um domínio verificado.

**Passo 1 — Criar conta**
1. Acesse [resend.com](https://resend.com) e crie uma conta com seu e-mail

**Passo 2 — Verificar seu domínio** *(se não tiver domínio, veja a seção abaixo)*
1. No painel do Resend → **Domains** → **Add Domain**
2. Digite seu domínio (ex: `flowmachine.com.br`) e clique em **Add**
3. O Resend vai exibir registros DNS — adicione-os no painel do seu provedor de domínio (Registro.br, GoDaddy, Namecheap, etc.)
4. Clique em **Verify DNS Records** e aguarde até aparecer o status **Verified** ✅

> **Não tem domínio?** Use `onboarding@resend.dev` como remetente. Limitação: o e-mail só chega no endereço que você cadastrou no Resend.

**Passo 3 — Criar API Key**
1. **API Keys** → **Create API Key**
2. Nome: `career-hunter`, Permission: **Sending access**
3. Selecione o domínio verificado e clique em **Create**
4. Copie a chave gerada (começa com `re_`) — ela **só aparece uma vez**

**Passo 4 — Criar os 5 secrets de e-mail**

| Secret | Valor | Exemplo |
|--------|-------|---------|
| `RESEND_API_KEY` | Chave gerada no passo anterior | `re_xxxxxxxxxxxx` |
| `JOB_EMAIL_FROM` | Remetente das vagas de emprego | `vagas@seudominio.com` |
| `JOB_EMAIL_TO` | Destinatário das vagas (pode ser Gmail) | `voce@gmail.com` |
| `FREELANCE_EMAIL_FROM` | Remetente dos projetos freelance | `freelance@seudominio.com` |
| `FREELANCE_EMAIL_TO` | Destinatário dos projetos (pode ser Gmail) | `voce@gmail.com` |

> Você pode usar o mesmo endereço `FROM` e o mesmo endereço `TO` para os dois agentes se preferir.

---

#### 💼 FREELANCER_TOKEN

A API do Freelancer.com é gratuita. O token é **opcional** — se não configurado, o agente simplesmente pula essa plataforma sem erros.

1. Acesse [freelancer.com](https://www.freelancer.com) e crie uma conta (gratuita)
2. Acesse [developers.freelancer.com](https://developers.freelancer.com) e faça login
3. Clique em **Create New App**
4. Preencha qualquer nome (ex: `career-hunter`) e clique em **Create App**
5. Dentro do app criado → aba **OAuth 2.0** → role até **Personal Access Tokens**
6. Clique em **Generate Token** e marque os escopos: **basic** e **projects**
7. Copie o token gerado
8. Crie o secret `FREELANCER_TOKEN` com esse valor

---

### 4. Resumo dos 8 secrets

Ao final, você deve ter todos estes secrets configurados em **Settings → Secrets and variables → Actions**:

| Secret | Obrigatório |
|--------|-------------|
| `APIFY_TOKEN` | ✅ Sim |
| `ANTHROPIC_API_KEY` | ✅ Sim |
| `RESEND_API_KEY` | ✅ Sim |
| `JOB_EMAIL_FROM` | ✅ Sim |
| `JOB_EMAIL_TO` | ✅ Sim |
| `FREELANCE_EMAIL_FROM` | ✅ Sim |
| `FREELANCE_EMAIL_TO` | ✅ Sim |
| `FREELANCER_TOKEN` | ⚡ Opcional |

### 5. Personalize as buscas (opcional)

- **Vagas LinkedIn:** edite `SEARCH_URLS` em `src/job-hunter/scrapers/linkedin.js`
- **Freelancer.com:** edite `FREELANCER_KEYWORDS` em `src/freelance-hunter/scrapers/freelancer.js`
- **Upwork:** edite `UPWORK_KEYWORDS` em `src/freelance-hunter/scrapers/upwork.js`
- **Workana:** edite `WORKANA_KEYWORDS` em `src/freelance-hunter/scrapers/workana.js`

### 6. Primeiro teste

Após configurar todos os secrets, dispare uma execução manual:

**Actions → Job Hunter → Run workflow → Run workflow** (botão verde)

Os logs aparecem em tempo real. Em caso de erro, você também receberá um e-mail vermelho indicando exatamente qual passo falhou.

Para teste local:

```bash
cp .env.example .env
# Preencha o .env com seus tokens
npm run dev:jobs       # testa o job hunter
npm run dev:freelance  # testa o freelance hunter
```

### 3. Publicar o actor no Apify

O Job Hunter usa um **actor próprio** (`actors/linkedin-easy-apply/`) que precisa estar publicado na sua conta Apify antes de rodar.

1. Acesse [apify.com](https://apify.com) → **Actors** → **Create new actor**
2. Conecte ao repositório GitHub, aponte para `actors/linkedin-easy-apply/`
3. Faça o build — a imagem Docker já tem Playwright instalado
4. Após o build, copie o **Actor ID** (formato: `usuario~linkedin-easy-apply-scraper`)
5. Adicione como secret `APIFY_ACTOR_ID_LINKEDIN`

### 4. Obter tokens

**Apify token**
1. Settings → Integrations → API token
2. Copie para `APIFY_TOKEN`

**Anthropic API key**
1. Acesse [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Copie para `ANTHROPIC_API_KEY`

**Resend API key**
1. Acesse [resend.com](https://resend.com) → API Keys → Create API Key
2. Verifique seu domínio em Domains
3. Copie para `RESEND_API_KEY`

**Freelancer.com token (opcional)**
1. Acesse [developers.freelancer.com](https://developers.freelancer.com) → My Apps → Create new app
2. OAuth 2.0 → Generate personal access token (escopos: `basic` e `projects`)
3. Copie para `FREELANCER_TOKEN`

---

## Estrutura do projeto

Configure em: **Settings → Secrets and variables → Actions → New repository secret**

### Obrigatórios

| Secret | Descrição |
|---|---|
| `APIFY_TOKEN` | Token da conta Apify |
| `APIFY_ACTOR_ID_LINKEDIN` | ID do actor no Apify (ex: `usuario~linkedin-easy-apply-scraper`) |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic |
| `RESEND_API_KEY` | Chave da API Resend |
| `JOB_EMAIL_FROM` | Remetente do e-mail de vagas (ex: `vagas@seudominio.com`) |
| `JOB_EMAIL_TO` | Destinatário do e-mail de vagas |
| `FREELANCE_EMAIL_FROM` | Remetente do e-mail de freelance |
| `FREELANCE_EMAIL_TO` | Destinatário do e-mail de freelance |

### Opcionais — configuração de busca do Job Hunter

Se não configurados, os valores padrão do código são usados. Podem ser sobrescritos a cada execução manual via workflow_dispatch.

| Secret | Padrão | Descrição |
|---|---|---|
| `LINKEDIN_QUERIES` | queries embutidas no código | Queries separadas por vírgula |
| `LINKEDIN_LOCATION` | `Brazil` | País, cidade ou região |
| `LINKEDIN_REMOTE` | `true` | `true` para apenas vagas remotas |
| `LINKEDIN_EASY_APPLY_ONLY` | `true` | `true` para apenas candidatura simplificada |
| `LINKEDIN_MAX_PER_QUERY` | `25` | Máximo de vagas por query |
| `LINKEDIN_DATE_POSTED` | `r604800` | `r86400` (24h) / `r604800` (semana) / `r2592000` (mês) |
| `FREELANCER_TOKEN` | — | Token Freelancer.com (desativa plataforma se ausente) |

---

## Execução manual com parâmetros

O Job Hunter suporta configuração via **workflow_dispatch** — sem precisar alterar código ou secrets:

1. Acesse **GitHub → Actions → Job Hunter → Run workflow**
2. Preencha os campos desejados (queries, localização, filtros)
3. Clique em **Run workflow**

Os valores preenchidos têm prioridade sobre os secrets.

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

## Custo estimado mensal

| Serviço | Custo estimado |
|---|---|
| Apify (actor LinkedIn) | $1 – $3 |
| Anthropic (Claude Haiku 4.5) | $0.10 – $0.30 |
| Resend (e-mails) | Grátis |
| Freelancer.com API | Grátis |
| **Total** | **~$1 – $4/mês** |

---

## Adaptar para outra stack ou idioma

### Buscas do LinkedIn
Configure via GitHub Secrets (`LINKEDIN_QUERIES`, `LINKEDIN_LOCATION`, etc.) ou diretamente nos inputs ao rodar manualmente. Os defaults estão em `src/job-hunter/scrapers/linkedin.js` → função `getActorInput()`.

### Buscas do Freelance Hunter
Edite os arquivos de scraper correspondentes:
- `src/freelance-hunter/scrapers/upwork.js` → `UPWORK_KEYWORDS`
- `src/freelance-hunter/scrapers/workana.js` → `WORKANA_KEYWORDS`
- `src/freelance-hunter/scrapers/freelancer.js` → `FREELANCER_KEYWORDS`

### Perfil e critérios de análise
Edite **apenas** `src/shared/profile.js` — todos os prompts, stack técnica e critérios de avaliação vivem lá.

---

## Contribuindo

### Actor LinkedIn não inicia
- Confirme que `APIFY_ACTOR_ID_LINKEDIN` está configurado com o ID correto
- Verifique se o actor foi buildado com sucesso no Apify (aba **Builds**)

### Vagas sem Easy Apply chegando no e-mail
- Confirme que `LINKEDIN_EASY_APPLY_ONLY=true` nos secrets
- O actor verifica o botão em cada página individualmente — pode haver falsos negativos se o LinkedIn redirecionar para login

### Upwork ou Workana retornam vazio
As plataformas às vezes bloqueiam sem proxy residencial. Adicione ao scraper correspondente:

```javascript
proxyConfiguration: {
  useApifyProxy: true,
  apifyProxyGroups: ['RESIDENTIAL']
}
```

---

### GitHub Actions falha
- Confirme que todos os secrets obrigatórios estão configurados
- Veja os logs em **Actions → selecione o run → clique no step com erro**
