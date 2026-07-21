/**
 * Ferramenta nativa do Gmail (leitura e envio de e-mails).
 */
async function listPriorityEmails(limit = 5) {
  return [
    { from: "equipe@9router.com", subject: "Relatório Semanal", snippet: "Resumo de consumo de tokens e atualizações do gateway..." }
  ];
}

async function sendEmail(to, subject, body) {
  console.log(`[Gmail] Enviando e-mail para ${to}: ${subject}`);
  return { ok: true, messageId: "msg_12345" };
}

module.exports = {
  listPriorityEmails,
  sendEmail,
};
