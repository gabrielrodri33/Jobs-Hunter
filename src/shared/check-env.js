/**
 * @module check-env
 * @description Valida as variáveis de ambiente obrigatórias no início do run.
 * Falha imediatamente com mensagem clara em vez de mascarar erros de configuração
 * como falhas de análise ou de envio de e-mail.
 *
 * Nunca imprime valores — apenas presença/ausência (secrets não devem vazar em logs).
 */

/**
 * Verifica presença das variáveis obrigatórias e loga um resumo seguro.
 * @param {string} agent - Nome do agente ('job-hunter' | 'freelance-hunter') para mensagens.
 * @throws {Error} Se alguma variável obrigatória estiver ausente ou vazia.
 */
export function checkEnv(agent) {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase()

  const required = ['OPENROUTER_API_KEY']
  if (provider === 'gmail') {
    required.push('GMAIL_USER', 'GMAIL_APP_PASSWORD')
  } else if (provider === 'resend') {
    required.push('RESEND_API_KEY')
  }
  required.push(agent === 'freelance-hunter' ? 'FREELANCE_EMAIL_TO' : 'JOB_EMAIL_TO')

  const optional = ['OPENROUTER_MODELS_ANALYZER', 'OPENROUTER_MODELS_WRITER']

  console.log('🔐 Verificando configuração:')
  for (const name of [...required, ...optional]) {
    const present = Boolean(process.env[name]?.trim())
    const tag = required.includes(name) ? '' : ' (opcional)'
    console.log(`   ${present ? '✅' : '❌'} ${name}${tag}`)
  }

  const missing = required.filter(name => !process.env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes ou vazias: ${missing.join(', ')}. ` +
      'Configure em GitHub → Settings → Secrets and variables → Actions → Repository secrets ' +
      '(ou no arquivo .env para execução local).'
    )
  }
}
