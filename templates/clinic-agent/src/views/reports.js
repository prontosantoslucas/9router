import { renderLayout } from "./layout.js";

export function renderReportsView({ metrics = {}, workerEvents = [] }) {
  const content = `
    <div>
      <h3 class="text-xl font-bold text-slate-100">Relatórios & Desempenho</h3>
      <p class="text-xs text-slate-400 mt-1">Métricas semanais de conversão, atendimento da IA e histórico dos robôs de lembrete</p>
    </div>

    <!-- Cards de KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
        <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Conversas Totais</span>
        <div class="text-3xl font-extrabold text-slate-100">${metrics.totalConversations || 0}</div>
        <p class="text-[10px] text-slate-500">Pacientes atendidos pelo agente</p>
      </div>

      <div class="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
        <span class="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">Consultas Agendadas</span>
        <div class="text-3xl font-extrabold text-teal-400">${metrics.totalAppointments || 0}</div>
        <p class="text-[10px] text-slate-500">Agendamentos no Google Calendar</p>
      </div>

      <div class="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
        <span class="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Taxa de Conversão</span>
        <div class="text-3xl font-extrabold text-emerald-400">${metrics.conversionRate || "0%"}</div>
        <p class="text-[10px] text-slate-500">Pacientes qualificados em consulta</p>
      </div>

      <div class="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
        <span class="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Lembretes 24h Enviados</span>
        <div class="text-3xl font-extrabold text-amber-400">${metrics.remindersSent || 0}</div>
        <p class="text-[10px] text-slate-500">Confirmações proativas enviadas</p>
      </div>
    </div>

    <!-- Tabela de Logs dos Workers / Auditoria -->
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Histórico de Auditoria dos Robôs (Worker Events)
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th class="p-3">Evento / Robô</th>
              <th class="p-3">Paciente / Destinatário</th>
              <th class="p-3">Detalhes</th>
              <th class="p-3">Data & Hora</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-slate-300">
            ${workerEvents.length === 0 ? `
              <tr>
                <td colspan="4" class="p-6 text-center text-slate-500">Nenhum evento de worker registrado.</td>
              </tr>
            ` : workerEvents.map(e => `
              <tr class="hover:bg-slate-800/40">
                <td class="p-3 font-semibold text-teal-400">${escapeHtml(e.event_type || e.type)}</td>
                <td class="p-3 font-mono">${escapeHtml(e.chat_id || e.recipient)}</td>
                <td class="p-3 text-slate-400">${escapeHtml(e.details || e.metadata || "Sucesso")}</td>
                <td class="p-3 text-slate-500">${e.created_at || ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return renderLayout({ title: "Relatórios", activeTab: "reports", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
