import { renderLayout } from "./layout.js";

export function renderAppointmentsView({ appointments = [] }) {
  const content = `
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-bold text-slate-100">Agenda & Agendamentos</h3>
        <p class="text-xs text-slate-400 mt-1">Consultas agendadas automaticamente pelo Agente Zenda no Google Calendar</p>
      </div>
      <div class="text-xs text-slate-400 font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
        Total: ${appointments.length} agendamento(s)
      </div>
    </div>

    <!-- Tabela de Agendamentos -->
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th class="p-4">Paciente</th>
              <th class="p-4">Serviço / Especialidade</th>
              <th class="p-4">Data & Horário</th>
              <th class="p-4">Status</th>
              <th class="p-4">Lembrete 24h</th>
              <th class="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-slate-200">
            ${appointments.length === 0 ? `
              <tr>
                <td colspan="6" class="p-8 text-center text-slate-500">Nenhum agendamento registrado na agenda até o momento.</td>
              </tr>
            ` : appointments.map(a => `
              <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="p-4 font-semibold text-slate-100">
                  ${escapeHtml(a.patient_name || a.chat_id)}
                  <div class="text-[10px] text-slate-500 font-normal">${escapeHtml(a.patient_phone || a.chat_id)}</div>
                </td>
                <td class="p-4">${escapeHtml(a.service_name || "Consulta Geral")}</td>
                <td class="p-4 font-mono text-teal-400 font-semibold">${escapeHtml(a.scheduled_at)}</td>
                <td class="p-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getAppointmentStatusColor(a.status)}">
                    ${a.status || "scheduled"}
                  </span>
                </td>
                <td class="p-4 text-[10px] text-slate-400">
                  ${a.reminder_sent_at ? "✅ Enviado" : "⏳ Pendente"}
                </td>
                <td class="p-4 text-right">
                  <a href="/dashboard/conversations?chatId=${encodeURIComponent(a.chat_id)}" class="text-teal-400 hover:text-teal-300 font-semibold">
                    Ver Conversa →
                  </a>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return renderLayout({ title: "Agenda & Consultas", activeTab: "appointments", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getAppointmentStatusColor(status = "") {
  switch (status) {
    case "scheduled": return "bg-teal-500/20 text-teal-300 border border-teal-500/30";
    case "confirmed": return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    case "cancelled": return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    default: return "bg-slate-800 text-slate-400";
  }
}
