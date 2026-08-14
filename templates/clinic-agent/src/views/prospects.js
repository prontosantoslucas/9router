import { renderLayout } from "./layout.js";

export function renderProspectsView({ metrics = {}, prospects = [] }) {
  const content = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 class="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>🎯</span> <span>Prospecção B2B de Novas Clínicas 24/7 (SaaS / Agência)</span>
        </h3>
        <p class="text-xs text-slate-400 mt-1">
          Robô de busca contínua minerando consultórios, clínicas e estabelecimentos na Web, Maps e LinkedIn para expansão das suas vendas de IA.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <form action="/api/prospects/search-now" method="POST" class="inline">
          <button type="submit" class="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5">
            <span class="material-icons-outlined text-sm">search</span>
            <span>Minerar Novas Clínicas Agora</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Indicador do Modo Rascunho -->
    <div class="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-300">
      <span class="text-xl">🔒</span>
      <div>
        <p class="font-bold text-amber-200">Modo Rascunho Comercial Ativo (Draft Mode)</p>
        <p class="text-slate-300">
          O robô opera 24/7 buscando clínicas e escrevendo abordagens comerciais exclusivas por IA. <strong>Nenhuma mensagem é enviada sem sua ação.</strong> Você revisa e abre diretamente no WhatsApp/Instagram com a mensagem pré-digitada.
        </p>
      </div>
    </div>

    <!-- Métricas do Funil de Prospecção -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prospects Hoje</p>
        <p class="text-2xl font-black text-slate-100">${metrics.totalToday || 0}</p>
        <p class="text-[10px] text-slate-500">Minerados nas últimas 24h</p>
      </div>

      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taxa de Resposta</p>
        <p class="text-2xl font-black text-teal-400">${metrics.responseRate || 0}%</p>
        <p class="text-[10px] text-slate-500">${metrics.replied || 0} de ${metrics.contacted || 0} contatados</p>
      </div>

      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ainda Não Agendados</p>
        <p class="text-2xl font-black text-amber-400">${metrics.interviewScheduled || 0}</p>
        <p class="text-[10px] text-slate-500">Entrevistas/Reuniões pendentes</p>
      </div>

      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clientes Fechados</p>
        <p class="text-2xl font-black text-emerald-400">${metrics.closed || 0}</p>
        <p class="text-[10px] text-slate-500">Convertidos com sucesso</p>
      </div>

      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Conversão Final</p>
        <p class="text-2xl font-black text-indigo-400">${metrics.conversionRate || 0}%</p>
        <p class="text-[10px] text-slate-500">Total geral: ${metrics.totalAll || 0} leads</p>
      </div>

    </div>

    <!-- Tabela de Clientes & Rascunhos Pré-Digitados -->
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden space-y-4">
      <div class="p-5 border-b border-slate-800 flex items-center justify-between">
        <h4 class="font-bold text-sm text-slate-100 flex items-center gap-2">
          <span>📋</span> <span>Clientes do Dia & Fila de Rascunhos</span>
        </h4>
        <span class="text-xs text-slate-400 font-mono">${prospects.length} registros listados</span>
      </div>

      ${prospects.length === 0 ? `
        <div class="p-12 text-center text-slate-500 text-xs space-y-2">
          <p class="text-base font-bold">Nenhum prospect encontrado no momento.</p>
          <p>O robô 24/7 está varrendo a Web e Google Maps em busca de novos clientes para sua clínica.</p>
        </div>
      ` : `
        <div class="divide-y divide-slate-800/80">
          ${prospects.map(p => {
            const waUrl = p.phone ? `https://wa.me/${p.phone.replace(/\D/g,"")}?text=${encodeURIComponent(p.draft_message || "")}` : null;
            const igUrl = p.instagram_handle ? `https://instagram.com/${p.instagram_handle.replace(/^@/,"")}` : null;
            const sourceBadge = p.source === "maps" ? "📍 Google Maps" : p.source === "linkedin" ? "💼 LinkedIn" : "🌐 Web Search";

            return `
              <div class="p-5 space-y-4 hover:bg-slate-950/40 transition-colors">
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <h5 class="font-bold text-sm text-slate-100">${escapeHtml(p.name)}</h5>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        ${sourceBadge}
                      </span>
                    </div>
                    <p class="text-xs text-slate-400 mt-0.5">
                      ${escapeHtml(p.category || "Segmento")} • ${escapeHtml(p.city || "Localização")}
                    </p>
                  </div>

                  <!-- Seletor de Etapa no Funil -->
                  <form action="/api/prospects/stage" method="POST" class="flex items-center gap-2">
                    <input type="hidden" name="prospectId" value="${p.prospect_id}" />
                    <select 
                      name="stage" 
                      onchange="this.form.submit()" 
                      class="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-500"
                    >
                      <option value="discovered" ${p.stage === "discovered" ? "selected" : ""}>🔍 Descoberto / Rascunho</option>
                      <option value="contacted" ${p.stage === "contacted" ? "selected" : ""}>✉️ Contatado</option>
                      <option value="replied" ${p.stage === "replied" ? "selected" : ""}>💬 Respondeu</option>
                      <option value="interview_scheduled" ${p.stage === "interview_scheduled" ? "selected" : ""}>📅 Entrevista Agendada</option>
                      <option value="closed" ${p.stage === "closed" ? "selected" : ""}>🟢 Fechado / Cliente</option>
                      <option value="lost" ${p.stage === "lost" ? "selected" : ""}>🔴 Perdido</option>
                    </select>
                  </form>
                </div>

                <!-- Caixa de Rascunho da Mensagem -->
                <form action="/api/prospects/draft" method="POST" class="space-y-2">
                  <input type="hidden" name="draftId" value="${p.draft_id || ""}" />
                  <label class="block text-[11px] font-semibold text-slate-400">
                    Mensagem Personalizada Gerada por IA (Pré-digitada como Rascunho):
                  </label>
                  <div class="relative">
                    <textarea 
                      name="draftMessage" 
                      rows="3" 
                      class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-teal-300 font-sans focus:outline-none focus:border-teal-500 leading-relaxed"
                    >${escapeHtml(p.draft_message || "")}</textarea>
                  </div>
                  <div class="flex items-center justify-between text-xs pt-1">
                    <div class="flex items-center gap-2">
                      ${waUrl ? `
                        <a 
                          href="${waUrl}" 
                          target="_blank" 
                          class="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <span>💬</span>
                          <span>Abrir no WhatsApp com Rascunho</span>
                        </a>
                      ` : ""}

                      ${igUrl ? `
                        <a 
                          href="${igUrl}" 
                          target="_blank" 
                          class="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <span>📸</span>
                          <span>Abrir Instagram (@${escapeHtml(p.instagram_handle)})</span>
                        </a>
                      ` : ""}
                    </div>

                    <div class="flex items-center gap-2">
                      <button 
                        type="submit" 
                        class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-all border border-slate-700"
                      >
                        Salvar Alterações do Rascunho
                      </button>

                      <button 
                        type="button"
                        onclick="if(confirm('Deseja excluir este prospect?')) { fetch('/api/prospects/delete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prospectId: ${p.prospect_id} }) }).then(() => location.reload()); }"
                        class="px-3 py-1.5 text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </form>

              </div>
            `;
          }).join("")}
        </div>
      `}
    </div>
  `;

  return renderLayout({ title: "Prospecção & Rascunhos", activeTab: "prospects", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
