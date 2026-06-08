# Contribuindo com o career-hunter

Obrigado pelo interesse! Toda contribuição é bem-vinda.

## Como contribuir

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/nome-da-melhoria`
3. Faça suas alterações
4. Teste localmente: `npm run dev:jobs` ou `npm run dev:freelance`
5. Commit: `git commit -m "feat: descrição da melhoria"`
6. Push: `git push origin feature/nome-da-melhoria`
7. Abra um Pull Request

## Padrões de código

- Módulos ES (import/export) — sem CommonJS
- `fetch` nativo do Node 20 — sem axios ou node-fetch
- Comentários em português, variáveis e funções em inglês
- Logs com emoji para facilitar debug no GitHub Actions

## Adicionando um novo scraper

1. Crie `src/freelance-hunter/scrapers/nome-plataforma.js`
2. Exporte `scrapeNomePlataforma()` retornando `{ projects, apifyCostUsd }`
3. Adicione a normalização em `src/freelance-hunter/normalizer.js`
4. Integre em `src/freelance-hunter/index.js`
5. Documente as keywords e o actor/API usado no arquivo do scraper

## Reportando bugs

Abra uma issue com:
- Descrição do problema
- Log completo do GitHub Actions (sem tokens/chaves)
- Sistema operacional e versão do Node.js
