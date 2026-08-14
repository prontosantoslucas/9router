import { renderLayout } from "./layout.js";
import { config } from "../config.js";

export function renderChannelsView({ whatsappConnected = false, qrCodeBase64 = null, googleAuthorized = false, publicWebchatUrl = "" }) {
  const webUrl = publicWebchatUrl || `${config.server.publicUrl}/`;

  const content = `
    <div>
      <h3 class="text-xl font-bold text-slate-100">Canais & Divulgação</h3>
      <p class="text-xs text-slate-400 mt-1">Conexão do WhatsApp Business, integração com Google Calendar e link público do Webchat</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <!-- Card WhatsApp -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">💚</span>
              <h4 class="font-bold text-sm text-slate-100">WhatsApp da Clínica</h4>
            </div>
            <span id="wa-status-badge" class="px-2.5 py-1 rounded-full text-xs font-bold transition-all ${whatsappConnected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"}">
              ${whatsappConnected ? "🟢 Conectado" : "⏳ Aguardando Pareamento"}
            </span>
          </div>

          <!-- Instruções de Conexão -->
          <div class="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <p class="font-bold text-teal-400 flex items-center gap-1.5">
              <span>📱</span> <span>Instruções para Parear o WhatsApp da Clínica:</span>
            </p>
            <ol class="list-decimal list-inside text-slate-300 space-y-1 pl-1 leading-relaxed">
              <li>Abra o <strong>WhatsApp</strong> no celular da clínica.</li>
              <li>Acesse <strong>Menu (⋮)</strong> no Android ou <strong>Configurações (⚙️)</strong> no iPhone → <strong>Aparelhos Conectados</strong>.</li>
              <li>Toque em <strong>Conectar um Aparelho</strong> e aponte a câmera para o QR Code abaixo.</li>
            </ol>
            <p class="text-[11px] text-slate-500 italic mt-1">⚡ A página detectará a leitura e conectará automaticamente.</p>
          </div>

          <!-- Área do QR Code / Status da Instância -->
          <div id="wa-connection-container" class="mt-4 space-y-4 text-center">
            ${whatsappConnected ? `
              <div class="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-2">
                <p class="text-base font-bold flex items-center justify-center gap-2">
                  <span>✅</span> <span>WhatsApp Pareado com Sucesso!</span>
                </p>
                <p class="text-slate-300 leading-relaxed">
                  O Agente Zenda está conectado à Evolution API e pronto para responder mensagens, qualificar pacientes e realizar agendamentos em tempo real.
                </p>
              </div>
            ` : `
              <div class="p-4 bg-slate-950 border border-slate-800 rounded-2xl inline-block shadow-lg shadow-teal-500/10">
                <div id="qr-wrapper" class="relative flex flex-col items-center justify-center min-h-[220px] min-w-[220px]">
                  ${qrCodeBase64 ? `
                    <div class="p-3 bg-white rounded-xl border-2 border-teal-500/50 shadow-md">
                      <img id="qr-img" src="${qrCodeBase64}" alt="QR Code WhatsApp" class="w-48 h-48 mx-auto object-contain" />
                    </div>
                  ` : `
                    <div id="qr-loading" class="flex flex-col items-center justify-center p-6 space-y-3">
                      <div class="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      <p class="text-xs text-slate-400 font-medium">Buscando / Gerando QR Code em tempo real...</p>
                    </div>
                  `}
                </div>
              </div>
            `}
          </div>
        </div>

        <div class="pt-2 text-center border-t border-slate-800/80 flex items-center justify-between text-xs">
          <a href="/setup/whatsapp" class="text-teal-400 font-semibold hover:underline flex items-center gap-1">
            <span>Abrir tela cheia de pareamento</span>
            <span>→</span>
          </a>
          <button onclick="fetchWaQrCode()" class="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1">
            <span class="material-icons-outlined text-xs">refresh</span>
            <span>Atualizar QR</span>
          </button>
        </div>
      </div>

      <!-- Card Google OAuth -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
        <div class="space-y-4">
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
            Sincroniza a agenda da clínica diretamente com a conta do Google. Permite ao Agente verificar horários livres e cadastrar consultas confirmadas.
          </p>

          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
            <p class="font-bold text-slate-200">Status da Integração:</p>
            <p class="text-slate-400">${googleAuthorized ? "✅ Token OAuth ativo e renovando automaticamente." : "⚠️ Faça login com a conta Google da clínica para habilitar a agenda."}</p>
          </div>
        </div>

        <div>
          <a href="/setup/google" class="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700">
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

    <!-- Polling script para carregar/atualizar o QR Code do WhatsApp em tempo real -->
    <script>
      let isWaConnected = ${whatsappConnected ? "true" : "false"};

      async function fetchWaQrCode() {
        if (isWaConnected) return;
        try {
          const res = await fetch('/api/whatsapp/qrcode');
          const data = await res.json();
          
          const badge = document.getElementById('wa-status-badge');
          const container = document.getElementById('wa-connection-container');

          if (data.connected) {
            isWaConnected = true;
            if (badge) {
              badge.className = "px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
              badge.textContent = "🟢 Conectado";
            }
            if (container) {
              container.innerHTML = \`
                <div class="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-2">
                  <p class="text-base font-bold flex items-center justify-center gap-2">
                    <span>✅</span> <span>WhatsApp Pareado com Sucesso!</span>
                  </p>
                  <p class="text-slate-300 leading-relaxed">
                    O Agente Zenda está conectado à Evolution API e pronto para responder mensagens, qualificar pacientes e realizar agendamentos em tempo real.
                  </p>
                </div>
              \`;
            }
            return;
          }

          if (data.qrCodeBase64) {
            const wrapper = document.getElementById('qr-wrapper');
            if (wrapper) {
              wrapper.innerHTML = \`
                <div class="p-3 bg-white rounded-xl border-2 border-teal-500/50 shadow-md">
                  <img id="qr-img" src="\${data.qrCodeBase64}" alt="QR Code WhatsApp" class="w-48 h-48 mx-auto object-contain" />
                </div>
              \`;
            }
          }
        } catch (err) {
          console.warn('Erro ao atualizar QR Code:', err);
        }
      }

      // Auto-poll a cada 3 segundos se não estiver conectado
      if (!isWaConnected) {
        setInterval(fetchWaQrCode, 3000);
        fetchWaQrCode();
      }
    </script>
  `;

  return renderLayout({ title: "Canais & Divulgação", activeTab: "channels", content });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
