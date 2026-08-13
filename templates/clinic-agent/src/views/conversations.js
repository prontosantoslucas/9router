import { renderLayout } from "./layout.js";

export function renderConversationsView({ conversations = [], selectedChat = null, messages = [], search = "" }) {
  const content = `
    <!-- Top Bar & Search -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h3 class="text-xl font-bold text-slate-100">Conversas do Atendimento</h3>
        <p class="text-xs text-slate-400 mt-1">Histórico completo de atendimentos pelo WhatsApp e Webchat</p>
      </div>

      <form method="GET" action="/dashboard/conversations" class="flex items-center gap-2 w-full sm:w-auto">
        <div class="relative flex-1 sm:w-64">
          <span class="material-icons-outlined absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
          <input 
            type="text" 
            name="q" 
            value="${escapeHtml(search)}" 
            placeholder="Buscar por telefone ou nome..."
            class="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
          />
        </div>
        <button type="submit" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors">
          Filtrar
        </button>
      </form>
    </div>

    <!-- Grid: Liste de Conversas & Visualizador de Histórico -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Lista de Conversas (Esquerda) -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[600px]">
        <div class="p-4 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Conversas Recentes (${conversations.length})
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
          ${conversations.length === 0 ? `
            <div class="p-8 text-center text-xs text-slate-500">Nenhuma conversa encontrada.</div>
          ` : conversations.map(c => `
            <a href="/dashboard/conversations?chatId=${encodeURIComponent(c.chat_id)}" 
               class="block p-4 hover:bg-slate-800/50 transition-colors ${selectedChat === c.chat_id ? "bg-slate-800/80 border-l-4 border-teal-500" : ""}">
              <div class="flex items-center justify-between mb-1">
                <span class="font-semibold text-xs text-slate-200 truncate max-w-[160px]">
                  ${escapeHtml(c.patient_name || c.chat_id)}
                </span>
                <span class="text-[10px] text-slate-500">${formatChannelBadge(c.channel)}</span>
              </div>
              <div class="text-[11px] text-slate-400 truncate mb-2">
                Telefone: ${escapeHtml(c.patient_phone || c.chat_id)}
              </div>
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(c.status)}">
                  ${c.status}
                </span>
                <span class="text-[10px] text-slate-500">${c.last_seen_at || ""}</span>
              </div>
            </a>

          `).join("")}
        </div>
      </div>

      <!-- Visualizador de Histórico (Direita) -->
      <div class="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden">
        ${selectedChat ? `
          <div class="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div>
              <h4 class="font-bold text-sm text-slate-100">${escapeHtml(selectedChat)}</h4>
              <p class="text-[11px] text-slate-400">Histórico de mensagens trocadas com o paciente</p>
            </div>
          </div>

          <div class="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3 bg-slate-950/40">
            ${messages.length === 0 ? `
              <div class="text-center py-12 text-xs text-slate-500">Nenhuma mensagem registrada nesta conversa.</div>
            ` : messages.map(m => `
              <div class="flex flex-col ${m.role === "user" ? "items-end" : "items-start"}">
                <div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                  m.role === "user" 
                    ? "bg-teal-600 text-white rounded-br-none" 
                    : "bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none"
                }">
                  <div class="font-semibold text-[10px] opacity-75 mb-1">${m.role === "user" ? "Paciente" : "Agente Zenda"}</div>
                  <div class="whitespace-pre-wrap leading-relaxed">${escapeHtml(m.content)}</div>
                  <div class="text-[9px] opacity-60 text-right mt-1">${m.created_at || ""}</div>
                </div>
              </div>
            `).join("")}
          </div>
        ` : `
          <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <span class="material-icons-outlined text-4xl mb-2 text-slate-600">chat_bubble_outline</span>
            <p class="text-xs">Selecione uma conversa na lista ao lado para visualizar o histórico de mensagens.</p>
          </div>
        `}
      </div>

    </div>
  `;

  return renderLayout({ title: "Conversas", activeTab: "conversations", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function formatChannelBadge(channel = "") {
  if (channel === "whatsapp") return "💚 WhatsApp";
  if (channel === "webchat") return "🌐 Webchat";
  return channel;
}
