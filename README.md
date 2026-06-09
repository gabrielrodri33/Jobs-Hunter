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
│           ├── upwork.js       # Apify: jupri/upwork (desabilitado por padrão)
│           └── workana.js      # Apify: getdataforme/workana-job-scraper (desabilitado por padrão)
├── data/                       # Gerenciado automaticamente pelo GitHub Actions cache
│   ├── seen-jobs.json          # IDs de vagas já enviadas
│   └── seen-projects.json      # IDs de projetos já enviados
├── .env.example
├── SETUP.md                    # Guia de troubleshooting
├── CONTRIBUTING.md             # Guia de contribuição
└── package.json
```

---

## Custo estimado mensal

| Serviço | Uso | Custo |
|---------|-----|-------|
| GitHub Actions | 44 execuções (~5–8 min cada) | **Grátis** |
| Resend | ~44 e-mails/mês | **Grátis** |
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
