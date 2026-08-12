import { addNote, saveAppointment, updateConversationStatus } from "../db/db.js";
import { createCalendarEvent, listBusySlots } from "../integrations/googleCalendar.js";

// ============================================================
// Tools declarations (OpenAI-compatible function calling)
// O gateway 9router entende esse formato.
// ============================================================
export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Retorna slots livres na agenda entre startISO e endISO. Use para propor horários.",
      parameters: {
        type: "object",
        properties: {
          startISO: { type: "string", description: "início (ISO datetime, ex 2026-08-15T09:00:00-03:00)" },
          endISO:   { type: "string", description: "fim (ISO datetime)" },
          durationMinutes: { type: "number", description: "duração do slot desejado (default 30)" },
        },
        required: ["startISO", "endISO"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_appointment",
      description: "Cria evento no Google Calendar e salva no DB. Só usa depois de confirmar horário e coletar nome+contato do paciente.",
      parameters: {
        type: "object",
        properties: {
          patientName:      { type: "string" },
          patientPhone:     { type: "string" },
          service:          { type: "string", description: "descrição do serviço (ex: 'Avaliação clareamento')" },
          scheduledAt:      { type: "string", description: "ISO datetime da consulta" },
          durationMinutes:  { type: "number", description: "default 30" },
          notes:            { type: "string", description: "info que o profissional precisa saber antes" },
        },
        required: ["patientName", "service", "scheduledAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description: "Salva uma info importante deste paciente para o profissional ver e/ou próximas conversas lembrarem. Use quando o paciente mencionar restrição médica, preferência, indicação, etc.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["clinical", "preference", "restriction", "general"] },
          content:  { type: "string", description: "a nota, curta e específica" },
        },
        required: ["category", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description: "Marca a conversa como pending_human — para o dono/secretária assumir. Use quando você não sabe responder com confiança, ou o caso é fora do seu escopo.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "por que está escalando (ex: 'reclamação', 'dúvida clínica complexa')" },
        },
        required: ["reason"],
      },
    },
  },
];

// ============================================================
// Executors — chamadas quando o modelo pede uma tool
// ============================================================
export async function executeTool(chatId, name, argsJson) {
  const args = typeof argsJson === "string" ? JSON.parse(argsJson) : argsJson;
  switch (name) {
    case "check_availability": {
      const busy = await listBusySlots({ startISO: args.startISO, endISO: args.endISO });
      return { busySlots: busy, hint: "Proponha 2-3 horários dentro do range que NÃO conflitem com busy." };
    }
    case "schedule_appointment": {
      const event = await createCalendarEvent({
        summary: `${args.service} — ${args.patientName}`,
        description: `Telefone: ${args.patientPhone || "—"}\n\n${args.notes || ""}`,
        startISO: args.scheduledAt,
        durationMinutes: args.durationMinutes || 30,
      });
      const record = saveAppointment({
        chatId,
        googleEventId: event.id,
        patientName: args.patientName,
        patientPhone: args.patientPhone,
        service: args.service,
        scheduledAt: args.scheduledAt,
        durationMinutes: args.durationMinutes || 30,
        notes: args.notes,
      });
      return { success: true, appointmentId: record.id, googleEventId: event.id, confirmationText: `${args.service} agendado pra ${new Date(args.scheduledAt).toLocaleString("pt-BR")}` };
    }
    case "save_note": {
      addNote({ chatId, category: args.category, content: args.content });
      return { success: true };
    }
    case "escalate_to_human": {
      updateConversationStatus(chatId, "pending_human");
      addNote({ chatId, category: "general", content: `Escalado pro humano — motivo: ${args.reason}` });
      return { success: true, message: "Conversa marcada como pending_human. Notifique o dono." };
    }
    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}
