const path = require("path");
const os = require("os");
const fs = require("fs");
const QRCode = require("qrcode");

const dataDir = process.env.DATA_DIR || path.join(os.homedir(), ".9router");
const AUTH_DIR = path.join(dataDir, "agent", "whatsapp-session");

let sock = null;
let lastQrCodeBase64 = null;
let lastQrCodeRaw = null;
let connectionState = "disconnected"; // 'disconnected' | 'connecting' | 'qrcode' | 'open'
let isInitializing = false;
let messageHandler = null;

function lazyBaileys() {
  try {
    const baileys = require("@whiskeysockets/baileys");
    return baileys;
  } catch (err) {
    console.error("[WhatsAppNative] Falha ao carregar @whiskeysockets/baileys:", err.message);
    return null;
  }
}

async function start(onMessage) {
  if (onMessage) messageHandler = onMessage;
  if (sock && (connectionState === "open" || connectionState === "connecting")) {
    return { ok: true, state: connectionState };
  }

  const baileys = lazyBaileys();
  if (!baileys) return { ok: false, error: "Baileys não disponível" };

  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  isInitializing = true;
  connectionState = "connecting";

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1017531287] }));

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        lastQrCodeRaw = qr;
        try {
          lastQrCodeBase64 = await QRCode.toDataURL(qr);
          connectionState = "qrcode";
          console.log("[WhatsAppNative] Novo QR Code gerado para pareamento.");
        } catch (e) {
          console.error("[WhatsAppNative] Erro ao converter QR:", e.message);
        }
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsAppNative] Conexão fechada. Reconectar: ${shouldReconnect} (status: ${statusCode})`);
        
        lastQrCodeBase64 = null;
        lastQrCodeRaw = null;
        sock = null;

        if (shouldReconnect) {
          connectionState = "connecting";
          setTimeout(() => start(messageHandler), 5000);
        } else {
          connectionState = "disconnected";
          // Se foi deslogado, limpa as credenciais para permitir novo pareamento
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        }
      } else if (connection === "open") {
        console.log("✅ [WhatsAppNative] WhatsApp conectado com sucesso!");
        connectionState = "open";
        lastQrCodeBase64 = null;
        lastQrCodeRaw = null;
      }
    });

    // Handler de mensagens recebidas
    sock.ev.on("messages.upsert", async (m) => {
      try {
        if (m.type !== "notify") return;
        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;
          
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            "";

          if (!text.trim()) continue;

          const remoteJid = msg.key.remoteJid || "";
          const isGroup = remoteJid.endsWith("@g.us");
          const senderName = msg.pushName || "Contato WhatsApp";

          // Registra no buffer de canais
          const channelStore = require("../channelStore");
          channelStore.record({
            channel: "whatsapp",
            chatId: isGroup ? `wa-group:${remoteJid}` : `wa:${remoteJid.replace("@s.whatsapp.net", "")}`,
            chatName: senderName,
            senderName,
            isGroup,
            text,
            replyTarget: remoteJid,
            direction: "in",
          });

          if (messageHandler) {
            await messageHandler({
              chatId: remoteJid,
              text,
              senderName,
              isGroup,
              reply: (responseText) => sendTextMessage(remoteJid, responseText),
            });
          }
        }
      } catch (err) {
        console.error("[WhatsAppNative] Erro no listener de mensagens:", err.message);
      }
    });

    return { ok: true, state: connectionState };
  } catch (err) {
    console.error("[WhatsAppNative] Erro na inicialização:", err.message);
    connectionState = "disconnected";
    return { ok: false, error: err.message };
  } finally {
    isInitializing = false;
  }
}

async function getQrCode() {
  if (connectionState === "open") {
    return { status: "open", connected: true, state: "open" };
  }

  if (lastQrCodeBase64) {
    return { base64: lastQrCodeBase64, code: lastQrCodeRaw, status: "QRCODE" };
  }

  // Inicia a conexão se ainda não iniciou
  if (!sock && connectionState !== "connecting") {
    start();
  }

  // Aguarda até 8 segundos para obter o QR Code gerado
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (connectionState === "open") return { status: "open", connected: true, state: "open" };
    if (lastQrCodeBase64) return { base64: lastQrCodeBase64, code: lastQrCodeRaw, status: "QRCODE" };
  }

  return { error: "Aguardando geração do QR Code pelo WhatsApp... Tente novamente em alguns segundos." };
}

async function sendTextMessage(to, text) {
  if (!sock || connectionState !== "open") {
    console.warn("[WhatsAppNative] Tentativa de envio sem WhatsApp conectado.");
    return { ok: false, error: "WhatsApp nativo não está conectado" };
  }

  try {
    let jid = String(to).trim();
    if (!jid.includes("@")) {
      jid = `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
    }

    const result = await sock.sendMessage(jid, { text });
    return { ok: true, messageId: result.key.id };
  } catch (err) {
    console.error("[WhatsAppNative] Erro ao enviar mensagem:", err.message);
    return { ok: false, error: err.message };
  }
}

function getStatus() {
  return {
    connected: connectionState === "open",
    state: connectionState,
    hasQrCode: !!lastQrCodeBase64,
  };
}

async function disconnect() {
  if (sock) {
    try { await sock.logout(); } catch {}
    try { sock.end(); } catch {}
    sock = null;
  }
  connectionState = "disconnected";
  lastQrCodeBase64 = null;
  lastQrCodeRaw = null;
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
  return { ok: true };
}

module.exports = {
  start,
  getQrCode,
  sendTextMessage,
  getStatus,
  disconnect,
};
