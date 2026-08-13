import { config } from "../config.js";
import { appointmentsNeedingReminder, markReminderSent, logWorkerEvent } from "../db/db.js";
import { sendWhatsapp } from "../channels/evolution.js";

// ============================================================
// v3 — Lembrete automático X horas antes da consulta.
// Mensagem transacional (o paciente TEM uma consulta marcada), então
// enviamos independente do AGENT_MODE. Idempotente: cada appointment
// recebe no máximo 1 lembrete (reminder_sent_at).
// ============================================================
function buildReminderText(appt) {
  const when = new Date(appt.scheduled_at).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const nome = appt.patient_name?.split(" ")[0] || "";
  return (
    `Oi${nome ? " " + nome : ""}! 👋 Passando pra lembrar da sua ${appt.service} ` +
    `na ${config.clinic.name}, ${when}.\n\n` +
    `📍 ${config.clinic.address || ""}\n\n` +
    `Consegue comparecer? Responda *SIM* pra confirmar ou *REMARCAR* que a gente ajeita um novo horário. 😊`
  );
}

export async function runReminderWorker() {
  const due = appointmentsNeedingReminder({ hoursBefore: config.workers.reminderHoursBefore });
  if (!due.length) return { checked: 0, sent: 0 };

  let sent = 0;
  for (const appt of due) {
    try {
      const text = buildReminderText(appt);
      await sendWhatsapp(appt.chat_id, text);
      markReminderSent(appt.id);
      logWorkerEvent({ kind: "reminder", chatId: appt.chat_id, appointmentId: appt.id, status: "sent" });
      sent++;
    } catch (err) {
      logWorkerEvent({
        kind: "reminder",
        chatId: appt.chat_id,
        appointmentId: appt.id,
        status: "failed",
        payload: { error: err.message },
      });
      console.warn(`[reminder] falha appt ${appt.id}:`, err.message);
    }
  }
  console.log(`[reminder] ${sent}/${due.length} lembretes enviados`);
  return { checked: due.length, sent };
}
