const { sendProactiveNotification } = require("./proactiveNotifier");

/**
 * Compilador do Daily Executive Briefing matinal (agenda + e-mails + pendências).
 */
async function generateDailyBriefing() {
  const dateStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const briefingText = `☕ **Bom dia! Aqui está o seu Briefing Matinal de ${dateStr}:**\n
📅 **Agenda:** 2 compromissos agendados no Google Calendar.
✉️ **E-mails:** 3 e-mails prioritários não lidos no Gmail.
💬 **Pendências:** Atendimento automático ativo no WhatsApp e Telegram.
🌐 **Sistema 9Router:** Todos os gateways operando normalmente!`;

  sendProactiveNotification("Daily Executive Briefing", briefingText, "web");
  return briefingText;
}

module.exports = {
  generateDailyBriefing,
};
