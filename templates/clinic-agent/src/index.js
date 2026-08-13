import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { db, getConversation, getMessages, upcomingAppointments } from "./db/db.js";
import { handleWebchat } from "./channels/webchat.js";
import { handleEvolutionWebhook, getPairingQr } from "./channels/evolution.js";
import { getAuthUrl, exchangeCodeForTokens } from "./integrations/googleCalendar.js";
import { startWorkers } from "./workers/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(config.paths.web));

// ============================================================
// Health
// ============================================================
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    clinic: config.clinic.name,
    mode: config.agent.mode,
    conversations: db.prepare("SELECT COUNT(*) c FROM conversations").get().c,
    appointments: db.prepare("SELECT COUNT(*) c FROM appointments WHERE status='confirmed'").get().c,
  });
});

// ============================================================
// Chat web
// ============================================================
app.post("/webchat", handleWebchat);

// ============================================================
// Evolution webhook (WhatsApp)
// ============================================================
app.post("/webhook/evolution", handleEvolutionWebhook);

// ============================================================
// Setup: Google OAuth
// ============================================================
app.get("/setup/google", (_req, res) => {
  res.redirect(getAuthUrl());
});

app.get("/oauth/google/callback", async (req, res) => {
  try {
    await exchangeCodeForTokens(req.query.code);
    res.send(`
      <h2>Google Calendar conectado</h2>
      <p>Agora o agente pode criar eventos na sua agenda. <a href="/dashboard">Ir pro dashboard</a>.</p>
    `);
  } catch (err) {
    res.status(500).send(`Falha: ${err.message}`);
  }
});

// ============================================================
// Setup: QR code do WhatsApp
// ============================================================
app.get("/setup/whatsapp", async (_req, res) => {
  try {
    const data = await getPairingQr();
    // Evolution retorna { pairingCode, code, base64 } — base64 é o QR
    const qr = data.base64 || data.qrcode?.base64 || null;
    if (!qr) return res.send(`<p>Instância já pareada ou sem QR disponível: ${JSON.stringify(data).slice(0,200)}</p>`);
    res.send(`
      <h2>Escanear com WhatsApp Business</h2>
      <p>Abra o WhatsApp Business → Aparelhos conectados → Conectar aparelho → aponte para o QR abaixo.</p>
      <img src="${qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}" style="max-width:400px" />
    `);
  } catch (err) {
    res.status(500).send(`Falha: ${err.message}`);
  }
});

// ============================================================
// Dashboard — lista de conversas + upcoming appointments
// Protegido por password simples via query ?p=<pw>
// ============================================================
app.get("/dashboard", (req, res) => {
  if (req.query.p !== config.security.dashboardPassword) {
    return res.status(401).send('<p>Password inválido. Acesse ?p=&lt;senha&gt;.</p>');
  }
  const conversations = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.chat_id) msg_count
    FROM conversations c
    ORDER BY c.last_seen_at DESC
    LIMIT 50
  `).all();
  const upcoming = upcomingAppointments({ withinHours: 168 });
  res.type("html").send(renderDashboard({ conversations, upcoming }));
});

app.get("/dashboard/conversation/:chatId", (req, res) => {
  if (req.query.p !== config.security.dashboardPassword) {
    return res.status(401).send('<p>Password inválido.</p>');
  }
  const chatId = decodeURIComponent(req.params.chatId);
  const conv = getConversation(chatId);
  if (!conv) return res.status(404).send("Conversa não encontrada");
  const msgs = getMessages(chatId, { limit: 100 });
  res.type("html").send(renderConversation({ conv, msgs, back: req.query.p }));
});

// ============================================================
// Fallback: index estático (chat web público)
// ============================================================
app.get("/", (_req, res) => {
  res.sendFile(path.join(config.paths.web, "index.html"));
});

// ============================================================
// Boot
// ============================================================
app.listen(config.server.port, "0.0.0.0", () => {
  console.log(`[clinic-agent] ${config.clinic.name} — modo ${config.agent.mode}`);
  console.log(`[clinic-agent] http://0.0.0.0:${config.server.port}`);
  console.log(`[clinic-agent] setup: ${config.server.publicUrl}/setup/whatsapp | /setup/google`);
  startWorkers();
});

// ============================================================
// Renders inline (evita template engine extra)
// ============================================================
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderDashboard({ conversations, upcoming }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Dashboard ${esc(config.clinic.name)}</title>
<style>body{font-family:system-ui;margin:20px;background:#f7f7f7} h2{margin-top:24px} table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)} th,td{padding:10px;border-bottom:1px solid #eee;text-align:left} th{background:#fafafa;font-size:12px;text-transform:uppercase} a{color:#10a37f}</style>
</head><body>
<h1>${esc(config.clinic.name)}</h1>
<p>Modo: <b>${esc(config.agent.mode)}</b></p>

<h2>Próximos agendamentos (${upcoming.length})</h2>
<table><tr><th>Quando</th><th>Paciente</th><th>Serviço</th><th>Status</th></tr>
${upcoming.map((a) => `<tr><td>${esc(a.scheduled_at)}</td><td>${esc(a.patient_name)}</td><td>${esc(a.service)}</td><td>${esc(a.status)}</td></tr>`).join("") || '<tr><td colspan=4>Nenhum</td></tr>'}
</table>

<h2>Conversas recentes</h2>
<table><tr><th>Canal</th><th>Chat ID</th><th>Paciente</th><th>Msgs</th><th>Status</th><th>Última</th><th></th></tr>
${conversations.map((c) => `<tr><td>${esc(c.channel)}</td><td>${esc(c.chat_id)}</td><td>${esc(c.patient_name || '-')}</td><td>${c.msg_count}</td><td>${esc(c.status)}</td><td>${esc(c.last_seen_at)}</td><td><a href="/dashboard/conversation/${encodeURIComponent(c.chat_id)}?p=${esc(config.security.dashboardPassword)}">ver</a></td></tr>`).join("")}
</table>
</body></html>`;
}

function renderConversation({ conv, msgs, back }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Conv ${esc(conv.chat_id)}</title>
<style>body{font-family:system-ui;margin:20px;max-width:720px} .msg{padding:8px 12px;border-radius:12px;margin:6px 0;max-width:80%} .user{background:#dcf8c6;margin-left:auto} .assistant{background:#f0f0f0} .tool{background:#fff3cd;font-family:monospace;font-size:12px} .system{background:#eee;font-size:11px;color:#666}</style>
</head><body>
<a href="/dashboard?p=${esc(back)}">&larr; voltar</a>
<h2>${esc(conv.chat_id)}</h2>
<p>Canal: <b>${esc(conv.channel)}</b> · Paciente: <b>${esc(conv.patient_name || '-')}</b> · Status: <b>${esc(conv.status)}</b></p>
${msgs.map((m) => `<div class="msg ${esc(m.role)}"><b>${esc(m.role)}${m.tool_name ? ' → ' + esc(m.tool_name) : ''}</b><br>${esc(m.content).replace(/\n/g, '<br>')}<br><small>${esc(m.created_at)}</small></div>`).join("")}
</body></html>`;
}
