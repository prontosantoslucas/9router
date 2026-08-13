import { renderLayout } from "./layout.js";
import { config } from "../config.js";

export function renderConfigView({ runtimeConfig = {} }) {
  const content = `
    <div>
      <h3 class="text-xl font-bold text-slate-100">Configurações da Clínica</h3>
      <p class="text-xs text-slate-400 mt-1">Ajuste o comportamento do Agente Zenda e informações de atendimento sem redeploy</p>
    </div>

    <!-- Form de Configuração -->
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <form action="/dashboard/config" method="POST" class="space-y-6 max-w-2xl">
        
        <div class="space-y-4">
          <h4 class="font-bold text-sm text-teal-400 border-b border-slate-800 pb-2">Informações da Clínica</h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-400 font-semibold mb-1">Nome da Clínica</label>
              <input 
                type="text" 
                disabled 
                value="${escapeHtml(config.clinic.name)}" 
                class="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 font-semibold mb-1">Especialidade / Tipo</label>
              <input 
                type="text" 
                disabled 
                value="${escapeHtml(config.clinic.type)}" 
                class="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="font-bold text-sm text-teal-400 border-b border-slate-800 pb-2">Modo do Agente de IA</h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-400 font-semibold mb-1">Modo de Operação</label>
              <select name="agentMode" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500">
                <option value="prod" ${runtimeConfig.agentMode === "prod" || config.agent.mode === "prod" ? "selected" : ""}>Produção (Envia msgs reais no WhatsApp)</option>
                <option value="test" ${runtimeConfig.agentMode === "test" || config.agent.mode === "test" ? "selected" : ""}>Teste (Simula respostas nos logs)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs text-slate-400 font-semibold mb-1">Telefone do Responsável (Notificações)</label>
              <input 
                type="text" 
                name="ownerWhatsapp" 
                value="${escapeHtml(runtimeConfig.ownerWhatsapp || config.agent.ownerWhatsapp || "")}" 
                placeholder="Ex: 5511999999999" 
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="font-bold text-sm text-teal-400 border-b border-slate-800 pb-2">Regras de Atendimento</h4>

          <div>
            <label class="block text-xs text-slate-400 font-semibold mb-1">Horário de Atendimento da Clínica</label>
            <input 
              type="text" 
              name="workingHours" 
              value="${escapeHtml(runtimeConfig.workingHours || "Segunda a Sexta, das 08h às 18h")}" 
              placeholder="Ex: Segunda a Sexta, 08h às 18h" 
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div class="pt-4 border-t border-slate-800 flex justify-end">
          <button 
            type="submit" 
            class="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md"
          >
            Salvar Configurações
          </button>
        </div>

      </form>
    </div>
  `;

  return renderLayout({ title: "Configurações", activeTab: "config", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
