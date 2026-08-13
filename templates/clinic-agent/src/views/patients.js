import { renderLayout } from "./layout.js";

export function renderPatientsView({ patients = [] }) {
  const content = `
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-bold text-slate-100">Base de Pacientes</h3>
        <p class="text-xs text-slate-400 mt-1">Pacientes cadastrados via WhatsApp e formulários de agendamento</p>
      </div>
      <div class="text-xs text-slate-400 font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
        Total: ${patients.length} paciente(s)
      </div>
    </div>

    <!-- Tabela de Pacientes -->
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th class="p-4">Nome do Paciente</th>
              <th class="p-4">Telefone / Identificador</th>
              <th class="p-4">Canal Principal</th>
              <th class="p-4">Status da Conta</th>
              <th class="p-4">Última Interação</th>
              <th class="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-slate-200">
            ${patients.length === 0 ? `
              <tr>
                <td colspan="6" class="p-8 text-center text-slate-500">Nenhum paciente cadastrado na base de dados.</td>
              </tr>
            ` : patients.map(p => `
              <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="p-4 font-semibold text-slate-100">${escapeHtml(p.patient_name || "Sem Nome Cadastrado")}</td>
                <td class="p-4 font-mono text-slate-300">${escapeHtml(p.patient_phone || p.chat_id)}</td>
                <td class="p-4">${formatChannel(p.channel)}</td>
                <td class="p-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(p.status)}">
                    ${p.status || "active"}
                  </span>
                </td>
                <td class="p-4 text-slate-400">${p.last_seen_at || ""}</td>

                <td class="p-4 text-right flex items-center justify-end gap-3">
                  <a href="/dashboard/notes?chatId=${encodeURIComponent(p.chat_id)}" class="text-amber-400 hover:text-amber-300 font-semibold">
                    Notas / Prontuário
                  </a>
                  <a href="/dashboard/conversations?chatId=${encodeURIComponent(p.chat_id)}" class="text-teal-400 hover:text-teal-300 font-semibold">
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

  return renderLayout({ title: "Pacientes", activeTab: "patients", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatChannel(ch = "") {
  if (ch === "whatsapp") return "💚 WhatsApp";
  if (ch === "webchat") return "🌐 Webchat";
  return ch;
}

function getStatusColor(status = "") {
  switch (status) {
    case "active": return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    case "pending_human": return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    case "closed": return "bg-slate-700/40 text-slate-400 border border-slate-600/30";
    case "opted_out": return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    default: return "bg-slate-800 text-slate-400";
  }
}
