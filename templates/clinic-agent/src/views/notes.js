import { renderLayout } from "./layout.js";

export function renderNotesView({ notes = [], selectedChat = "", filterCategory = "" }) {
  const content = `
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h3 class="text-xl font-bold text-slate-100">Notas & Prontuários dos Pacientes</h3>
        <p class="text-xs text-slate-400 mt-1">Registros automáticos da IA e anotações manuais da equipe médica</p>
      </div>

      <!-- Form para Criar Nota Manual -->
      <button 
        onclick="document.getElementById('modalNewNote').classList.remove('hidden')"
        class="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md"
      >
        <span class="material-icons-outlined text-sm">add</span>
        <span>Nova Nota Manual</span>
      </button>
    </div>

    <!-- Lista de Notas -->
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Registros Clínicos (${notes.length})
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${notes.length === 0 ? `
          <div class="col-span-full py-12 text-center text-xs text-slate-500">
            Nenhuma nota cadastrada. Clique em "Nova Nota Manual" acima para adicionar um prontuário.
          </div>
        ` : notes.map(n => `
          <div class="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getCategoryBadge(n.category)}">
                  ${n.category || "general"}
                </span>
                <span class="text-[10px] text-slate-500">
                  ${n.source === "human" ? "👤 Equipe Médica" : "🤖 Agente IA"}
                </span>
              </div>
              <p class="text-xs text-slate-200 leading-relaxed">${escapeHtml(n.content || n.note)}</p>
            </div>
            
            <div class="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
              <span class="font-mono">${escapeHtml(n.chat_id || n.patient_phone)}</span>
              <span>${n.created_at || ""}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Modal: Adicionar Nova Nota Manual -->
    <div id="modalNewNote" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h4 class="font-bold text-slate-100 text-sm">Adicionar Nota ao Prontuário</h4>
          <button onclick="document.getElementById('modalNewNote').classList.add('hidden')" class="text-slate-500 hover:text-slate-300">
            <span class="material-icons-outlined text-sm">close</span>
          </button>
        </div>

        <form action="/dashboard/notes" method="POST" class="space-y-4">
          <div>
            <label class="block text-xs text-slate-400 font-semibold mb-1">Identificador / Telefone do Paciente</label>
            <input 
              type="text" 
              name="chatId" 
              value="${escapeHtml(selectedChat)}" 
              placeholder="Ex: 5511999999999 ou webchat:..."
              required
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label class="block text-xs text-slate-400 font-semibold mb-1">Categoria da Nota</label>
            <select name="category" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500">
              <option value="clinical">Clínica (Prontuário/Sintomas)</option>
              <option value="preference">Preferência (Horários/Atendimento)</option>
              <option value="restriction">Restrição (Alergias/Condições)</option>
              <option value="general">Geral</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-slate-400 font-semibold mb-1">Conteúdo da Nota</label>
            <textarea 
              name="content" 
              rows="4" 
              placeholder="Descreva as observações médicas ou preferências do paciente..."
              required
              class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button 
              type="button" 
              onclick="document.getElementById('modalNewNote').classList.add('hidden')"
              class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              class="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl"
            >
              Salvar Nota
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  return renderLayout({ title: "Notas & Prontuários", activeTab: "notes", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getCategoryBadge(cat = "") {
  switch (cat) {
    case "clinical": return "bg-teal-500/20 text-teal-300 border border-teal-500/30";
    case "preference": return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
    case "restriction": return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    default: return "bg-slate-800 text-slate-400 border border-slate-700/50";
  }
}
