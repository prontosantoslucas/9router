import { renderLayout } from "./layout.js";
import { config } from "../config.js";

export function renderChannelsView({ whatsappConnected = false, qrCodeBase64 = null, googleAuthorized = false, publicWebchatUrl = "" }) {
  const webUrl = publicWebchatUrl || `${config.server.publicUrl}/`;

  const content = `
    <div>
      <h3 class="text-xl font-bold text-slate-100">Canais & Divulgação</h3>
      <p class="text-xs text-slate-400 mt-1">Conexão do WhatsApp, integração com Google Calendar e link público do Webchat</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <!-- Card WhatsApp -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">💚</span>
            <h4 class="font-bold text-sm text-slate-100">WhatsApp da Clínica</h4>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${whatsappConnected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}">
            ${whatsappConnected ? "Conectado" : "Aguardando Pareamento"}
          </span>
        </div>

        ${whatsappConnected ? `
          <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-1">
            <p class="font-bold">✅ Instância WhatsApp ativa!</p>
            <p class="text-slate-400">O Agente Zenda está respondendo mensagens e qualificando pacientes em tempo real.</p>
          </div>
        ` : `
          <div class="space-y-4 text-center">
            <p class="text-xs text-slate-300">Escaneie o QR Code abaixo no WhatsApp da clínica (Menu > Aparelhos Conectados):</p>
            
            ${qrCodeBase64 ? `
              <div class="inline-block p-4 bg-white rounded-2xl border-4 border-teal-500">
                <img src="${qrCodeBase64}" alt="QR Code WhatsApp" class="w-48 h-48 mx-auto" />
              </div>
            ` : `
              <div class="p-8 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-500">
                Gerando QR Code de conexão... Atualize a página se demorar.
              </div>
            `}

            <div>
              <a href="/setup/whatsapp" class="text-xs text-teal-400 font-semibold hover:underline">
                Abrir página cheia de pareamento →
              </a>
            </div>
          </div>
        `}
      </div>

      <!-- Card Google OAuth -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">📅</span>
            <h4 class="font-bold text-sm text-slate-100">Google Calendar</h4>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${googleAuthorized ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}">
            ${googleAuthorized ? "Conectado" : "Não Autorizado"}
          </span>
        </div>

        <p class="text-xs text-slate-400 leading-relaxed">
          Permite que o Agente consulte horários disponíveis na agenda da clínica e insira agendamentos de consultas de forma automática.
        </p>

        <div>
          <a href="/setup/google" class="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700">
            <span class="material-icons-outlined text-sm text-teal-400">link</span>
            <span>${googleAuthorized ? "Reconectar Conta Google" : "Conectar Google Calendar"}</span>
          </a>
        </div>
      </div>

      <!-- Card Link Público do Webchat / Divulgação -->
      <div class="col-span-full bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">🌐</span>
            <h4 class="font-bold text-sm text-slate-100">Link Público do Chat do Atendimento (Webchat)</h4>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300">Estilo WhatsApp</span>
        </div>

        <p class="text-xs text-slate-400 leading-relaxed">
          Divulgue este link no Instagram, no site da clínica ou em campanhas de anúncios para direcionar visitantes direto ao chat de atendimento do Agente Zenda.
        </p>

        <div class="flex flex-col sm:flex-row items-center gap-3">
          <input 
            type="text" 
            readOnly 
            value="${escapeHtml(webUrl)}" 
            class="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-teal-400 font-mono"
          />
          <button 
            onclick="navigator.clipboard.writeText('${escapeHtml(webUrl)}'); alert('Link copiado para a área de transferência!');"
            class="w-full sm:w-auto px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl transition-all"
          >
            Copiar Link
          </button>
        </div>
      </div>

    </div>
  `;

  return renderLayout({ title: "Canais & Divulgação", activeTab: "channels", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
