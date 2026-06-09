# Guia de troubleshooting

## O agente rodou mas não recebi e-mail

1. Verifique os logs no GitHub Actions — pode ser que não havia vagas novas (dedup filtrou tudo)
2. Confirme que o domínio em `JOB_EMAIL_FROM` está com status **Verified** ✅ no painel do Resend (**Domains**)
3. Se estiver usando `onboarding@resend.dev`, o e-mail só chega no endereço cadastrado na sua conta Resend
4. Cheque a pasta de spam

---

## Erro: secret não definido (APIFY_TOKEN, ANTHROPIC_API_KEY, etc.)

Os secrets são **case-sensitive**. Confirme que o nome está exatamente igual à tabela do README.

Caminho: **Settings → Secrets and variables → Actions**

Se o secret aparecer na lista mas o erro persistir, delete e recrie — às vezes o valor é salvo com espaço acidental no início ou fim.

---

## Resend: como configurar o domínio

1. No painel do Resend → **Domains** → **Add Domain**
2. Digite seu domínio (ex: `flowmachine.com.br`) e clique em **Add**
3. O Resend vai exibir registros do tipo **MX**, **TXT** e **DKIM**
4. Acesse o painel do seu provedor de domínio e adicione cada registro:

| Provedor | Onde adicionar DNS |
|---|---|
| Registro.br | Painel → seu domínio → Editar zona DNS |
| GoDaddy | My Products → DNS → Add Record |
| Namecheap | Domain List → Manage → Advanced DNS |
| Hostgator / Locaweb | Painel de controle → Zona DNS |

5. Após adicionar, volte ao Resend e clique em **Verify DNS Records**
6. A propagação pode levar de 1 a 30 minutos

> **Não tem domínio?** Use `onboarding@resend.dev` como `JOB_EMAIL_FROM` e `FREELANCE_EMAIL_FROM`. O e-mail chegará apenas no endereço com o qual você criou a conta no Resend.

---

## Apify retorna 0 resultados (LinkedIn / Upwork / Workana)

A plataforma pode estar bloqueando o scraper. Adicione proxy residencial no input do actor correspondente:

**LinkedIn** (`src/job-hunter/scrapers/linkedin.js`):
```javascript
body: JSON.stringify({
  count: 50,
  scrapeCompany: true,
  splitByLocation: false,
  urls: SEARCH_URLS,
  proxyConfiguration: {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL']
  }
})
```

**Upwork / Workana** — mesmo padrão no `body` do respectivo scraper.

---

## Erro de parse no retorno do Claude

O sistema já remove blocos de markdown antes do `JSON.parse`, mas em casos raros o Claude pode retornar um formato inesperado. Se persistir:

1. Abra a issue com o log completo do GitHub Actions (sem tokens/chaves)
2. Inclua a mensagem de erro exata

---

## Freelancer.com: como obter o token OAuth

1. Acesse [freelancer.com](https://www.freelancer.com) e crie/entre na sua conta
2. Acesse [developers.freelancer.com](https://developers.freelancer.com)
3. Clique em **Create New App**
4. Preencha nome (ex: `career-hunter`) e clique em **Create App**
5. Dentro do app → aba **OAuth 2.0** → role até **Personal Access Tokens**
6. Clique em **Generate Token**
7. Marque os escopos: ✅ **basic** e ✅ **projects**
8. Copie o token e salve no secret `FREELANCER_TOKEN`

> O `FREELANCER_TOKEN` é opcional. Se não configurado, o agente pula o Freelancer.com silenciosamente sem erros.

---

## Como testar sem gastar créditos

Você pode passar um array mockado diretamente para `analyzeItems` e testar o módulo isoladamente:

```javascript
import { analyzeItems } from './src/shared/analyzer.js'

const mockJobs = [
  { id: 'test-1', title: 'Full Stack .NET Developer', company: 'Acme', location: 'Remote', description: '...' }
]

const { results, usage } = await analyzeItems(mockJobs, 'job')
console.log(results, usage)
```

---

## GitHub Actions: "Resource not accessible by integration"

O Actions precisa de permissão de escrita para o cache funcionar.

Caminho: **Settings → Actions → General → Workflow permissions → Read and write permissions**

---

## Como disparar manualmente (sem esperar o cron)

**Actions → Job Hunter → Run workflow → Run workflow** (botão verde)

Útil para testar após configurar os secrets pela primeira vez.
