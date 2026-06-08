# Guia de troubleshooting

## O agente rodou mas não recebi e-mail

1. Verifique os logs no GitHub Actions — pode ser que não havia vagas novas (dedup)
2. Confirme que `JOB_EMAIL_FROM` está verificado no painel do Resend
3. Cheque a pasta de spam

## Erro: "APIFY_TOKEN não definido"

O secret não foi configurado corretamente. Vá em Settings → Secrets → Actions e confirme que o nome está exatamente como `APIFY_TOKEN` (case-sensitive).

## Apify retorna 0 resultados

O LinkedIn pode estar bloqueando. Adicione proxy residencial no input do actor:

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

Edite a configuração em `src/job-hunter/scrapers/linkedin.js`.

## Erro de parse no retorno do Claude

O Claude ocasionalmente retorna JSON com markdown. O sistema já trata isso, mas se persistir, abra uma issue com o log completo.

## Como testar sem gastar créditos

Passe um array pequeno de vagas mockadas diretamente para `analyzeItems` no terminal local. O arquivo `src/shared/analyzer.js` pode ser importado e testado isoladamente.

## GitHub Actions: "Resource not accessible by integration"

O Actions precisa de permissão de escrita para cache. Vá em Settings → Actions → General → Workflow permissions → selecione "Read and write permissions".
