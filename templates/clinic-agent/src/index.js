import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { db, getConversation, getMessages, upcomingAppointments } from "./db/db.js";
import { handleWebchat } from "./channels/webchat.js";
import { handleEvolutionWebhook, getPairingQr } from "./channels/evolution.js";
import { getAuthUrl, exchangeCodeForTokens } from "./integrations/googleCalendar.js";
import { startWorkers } from "./workers/index.js";

// Módulos de Autenticação e Views
import { 
  requireAuth, 
  authenticatePassword, 
  createSessionToken, 
  COOKIE_NAME 
} from "./auth.js";

import { renderConversationsView } from "./views/conversations.js";
import { renderAppointmentsView } from "./views/appointments.js";
import { renderPatientsView } from "./views/patients.js";
import { renderNotesView } from "./views/notes.js";
import { renderReportsView } from "./views/reports.js";
import { renderChannelsView } from "./views/channels.js";
import { renderConfigView } from "./views/config.js";
import { renderLoginView } from "./views/login.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(config.paths.web));

// ============================================================
// Health Probe
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
// Login / Logout
// ============================================================
app.get("/login", (_req, res) => {
  res.type("html").send(renderLoginView({}));
});

app.post("/login", (req, res) => {
  const { password } = req.body || {};
  if (authenticatePassword(password)) {
    const token = createSessionToken(24);
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict`);
    return res.redirect("/dashboard/conversations");
  }
  res.status(401).type("html").send(renderLoginView({ error: "Senha de acesso incorreta." }));
});

app.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.redirect("/login");
});

// ============================================================
// Chat web público (Seguro)
// ============================================================
app.post("/webchat", handleWebchat);

// ============================================================
// Evolution webhook (WhatsApp)
// ============================================================
app.post("/webhook/evolution", handleEvolutionWebhook);

// ============================================================
// Proteção de Autenticação para /dashboard e /setup
// ============================================================
app.use(["/setup", "/dashboard"], requireAuth);

// ============================================================
// Setup: Google OAuth (Protegido)
// ============================================================
app.get("/setup/google", (_req, res) => {
  res.redirect(getAuthUrl());
});

app.get("/oauth/google/callback", async (req, res) => {
  try {
    await exchangeCodeForTokens(req.query.code);
    res.send(`
      <h2>Google Calendar conectado</h2>
      <p>Agora o agente pode criar eventos na sua agenda. <a href="/dashboard/channels">Voltar para o painel</a>.</p>
    `);
  } catch (err) {
    res.status(500).send(`Falha: ${err.message}`);
  }
});

// ============================================================
// Setup: QR code do WhatsApp (Protegido)
// ============================================================
app.get("/setup/whatsapp", async (_req, res) => {
  try {
    const data = await getPairingQr();
    const qr = data.base64 || data.qrcode?.base64 || null;
    if (!qr) return res.send(`<p>Instância já pareada ou sem QR disponível: ${JSON.stringify(data).slice(0,200)}</p>`);
    res.send(`
      <h2>Escanear com WhatsApp Business</h2>
      <p>Abra o WhatsApp Business → Aparelhos conectados → Conectar aparelho → aponte para o QR abaixo.</p>
      <img src="${qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}" style="max-width:400px" />
      <p><a href="/dashboard/channels">← Voltar para o painel</a></p>
    `);
  } catch (err) {
    res.status(500).send(`Falha: ${err.message}`);
  }
});

// ============================================================
// Painel do Cliente (7 Telas)
// ============================================================
app.get("/dashboard", (_req, res) => {
  res.redirect("/dashboard/conversations");
});

// Tela 1: Conversas
app.get("/dashboard/conversations", (req, res) => {
  const search = (req.query.q || "").trim();
  const selectedChat = req.query.chatId || null;

  let query = `
    SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.chat_id) msg_count
    FROM conversations c
  `;
  const params = [];

  if (search) {
    query += ` WHERE c.chat_id LIKE ? OR c.patient_name LIKE ? OR c.patient_phone LIKE ?`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY c.last_seen_at DESC LIMIT 50`;

  const conversations = db.prepare(query).all(...params);
  let messages = [];

  if (selectedChat) {
    messages = db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 100").all(selectedChat);
  }

  res.type("html").send(renderConversationsView({ conversations, selectedChat, messages, search }));
});

// Tela 2: Agenda
app.get("/dashboard/appointments", (_req, res) => {
  const appointments = db.prepare("SELECT * FROM appointments ORDER BY scheduled_at ASC LIMIT 100").all();
  res.type("html").send(renderAppointmentsView({ appointments }));
});

// Tela 3: Pacientes
app.get("/dashboard/patients", (_req, res) => {
  const patients = db.prepare(`
    SELECT * FROM conversations 
    ORDER BY last_seen_at DESC LIMIT 100
  `).all();
  res.type("html").send(renderPatientsView({ patients }));
});


// Tela 4: Notas / Prontuários
app.get("/dashboard/notes", (req, res) => {
  const selectedChat = req.query.chatId || "";
  const filterCategory = req.query.category || "";

  let query = "SELECT * FROM notes";
  const params = [];

  if (selectedChat || filterCategory) {
    query += " WHERE";
    const clauses = [];
    if (selectedChat) {
      clauses.push(" chat_id = ?");
      params.push(selectedChat);
    }
    if (filterCategory) {
      clauses.push(" category = ?");
      params.push(filterCategory);
    }
    query += clauses.join(" AND");
  }

  query += " ORDER BY created_at DESC LIMIT 50";
  const notes = db.prepare(query).all(...params);

  res.type("html").send(renderNotesView({ notes, selectedChat, filterCategory }));
});

app.post("/dashboard/notes", (req, res) => {
  const { chatId, category, content } = req.body || {};
  if (chatId && content) {
    db.prepare(`
      INSERT INTO notes (chat_id, category, content, source, created_at)
      VALUES (?, ?, ?, 'human', datetime('now'))
    `).run(chatId.trim(), category || "general", content.trim());
  }
  res.redirect(`/dashboard/notes?chatId=${encodeURIComponent(chatId || "")}`);
});

// Tela 5: Relatórios
app.get("/dashboard/reports", (_req, res) => {
  const totalConversations = db.prepare("SELECT COUNT(*) c FROM conversations").get().c;
  const totalAppointments = db.prepare("SELECT COUNT(*) c FROM appointments WHERE status='confirmed' OR status='scheduled'").get().c;
  const remindersSent = db.prepare("SELECT COUNT(*) c FROM appointments WHERE reminder_sent_at IS NOT NULL").get().c;
  
  const conversionRate = totalConversations > 0 
    ? `${Math.round((totalAppointments / totalConversations) * 100)}%` 
    : "0%";

  let workerEvents = [];
  try {
    workerEvents = db.prepare("SELECT * FROM worker_events ORDER BY created_at DESC LIMIT 20").all();
  } catch {}

  res.type("html").send(renderReportsView({
    metrics: {
      totalConversations,
      totalAppointments,
      conversionRate,
      remindersSent
    },
    workerEvents
  }));
});

// Tela 6: Canais & QR Code
app.get("/dashboard/channels", async (_req, res) => {
  let whatsappConnected = false;
  let qrCodeBase64 = null;

  try {
    const data = await getPairingQr();
    if (data.connected || data.status === "open") {
      whatsappConnected = true;
    } else {
      qrCodeBase64 = data.base64 || data.qrcode?.base64 || null;
      if (qrCodeBase64 && !qrCodeBase64.startsWith("data:")) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }
    }
  } catch (err) {
    console.warn("[channels] Erro ao verificar status do WhatsApp:", err.message);
  }

  const googleTokens = db.prepare("SELECT * FROM oauth_tokens WHERE provider='google'").get();
  const googleAuthorized = !!googleTokens;

  res.type("html").send(renderChannelsView({
    whatsappConnected,
    qrCodeBase64,
    googleAuthorized,
    publicWebchatUrl: `${config.server.publicUrl}/`
  }));
});

// Tela 7: Configurações
app.get("/dashboard/config", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM runtime_config").all();
  const runtimeConfig = {};
  rows.forEach(r => { runtimeConfig[r.key] = r.value; });

  res.type("html").send(renderConfigView({ runtimeConfig }));
});

app.post("/dashboard/config", (req, res) => {
  const { agentMode, ownerWhatsapp, workingHours } = req.body || {};

  const upsert = db.prepare(`
    INSERT INTO runtime_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  if (agentMode) upsert.run("agentMode", agentMode);
  if (ownerWhatsapp) upsert.run("ownerWhatsapp", ownerWhatsapp);
  if (workingHours) upsert.run("workingHours", workingHours);

  res.redirect("/dashboard/config");
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
  console.log(`[clinic-agent] dashboard: ${config.server.publicUrl}/dashboard`);
  startWorkers();
});
