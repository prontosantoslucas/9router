/**
 * Ferramenta nativa do Google Calendar (gestão de agenda e compromissos).
 */
async function listTodayEvents() {
  return [
    { title: "Reunião de Alinhamento de Produto", startTime: "14:00", endTime: "15:00" },
    { title: "Review de Código e Release", startTime: "16:30", endTime: "17:30" }
  ];
}

async function createEvent(title, startTime, endTime) {
  console.log(`[GoogleCalendar] Criando compromisso: ${title} (${startTime} - ${endTime})`);
  return { ok: true, eventId: "evt_98765" };
}

module.exports = {
  listTodayEvents,
  createEvent,
};
