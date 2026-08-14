import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { 
  db, 
  getConversation, 
  getMessages, 
  upcomingAppointments, 
  getProspectingMetrics, 
  getProspectsWithDrafts, 
  updateProspectStage, 
  updateDraftMessage, 
  deleteProspect 
} from "./db/db.js";
import { handleWebchat } from "./channels/webchat.js";
import { handleEvolutionWebhook, getPairingQr, generateDemoQrSvg } from "./channels/evolution.js";
import { getAuthUrl, exchangeCodeForTokens } from "./integrations/googleCalendar.js";
import { startWorkers } from "./workers/index.js";
import { runProspectingCycle } from "./workers/prospectorWorker.js";

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
import { renderProspectsView } from "./views/prospects.js";
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

// Rate limit do login. A senha do painel é o único portão pra conversa de
// paciente (dado sensível, LGPD art. 11) — sem limite ela é força-brutável.
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

function loginRateOk(ip) {
  const now = Date.now();
  const e = loginAttempts.get(ip);
  if (!e || now > e.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  e.count++;
  return e.count <= LOGIN_MAX_ATTEMPTS;
}

app.post("/login", (req, res) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!loginRateOk(ip)) {
    return res
      .status(429)
      .type("html")
      .send(renderLoginView({ error: "Muitas tentativas. Aguarde 10 minutos." }));
  }

  const { password } = req.body || {};
  if (authenticatePassword(password)) {
    loginAttempts.delete(ip);
    const token = createSessionToken(24);
    // Secure fora de dev: o painel roda em domínio público, e sem essa flag o
    // cookie de sessão trafega em claro se alguém acessar via http://.
    const secure = config.server.env === "production" ? " Secure;" : "";
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=86400`
    );
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
// `state` é gerado aqui (rota já protegida por requireAuth) e conferido no
// callback. Sem ele, qualquer um autoriza com a PRÓPRIA conta Google e chama o
// callback da clínica: `oauth_tokens` tem PK por provider, então a linha é
// sobrescrita e os agendamentos dos pacientes passam a ser criados na agenda
// do atacante — com nome, serviço e horário de cada um.
const pendingOAuthStates = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

app.get("/setup/google", (_req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  pendingOAuthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  res.redirect(getAuthUrl(state));
});

app.get("/oauth/google/callback", async (req, res) => {
  try {
    const { state } = req.query;
    const expiresAt = state ? pendingOAuthStates.get(state) : null;
    if (!expiresAt || Date.now() > expiresAt) {
      pendingOAuthStates.delete(state);
      return res
        .status(400)
        .send("Requisição de autorização inválida ou expirada. Refaça a conexão pelo painel.");
    }
    pendingOAuthStates.delete(state);

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
// Endpoint API JSON: QR Code em tempo real (Polling)
// ============================================================
// requireAuth explícito: esta rota está fora dos prefixos /setup e /dashboard
// cobertos pelo middleware acima, e devolve o QR de pareamento. Sem a trava,
// qualquer um busca o QR e vincula o próprio aparelho ao WhatsApp da clínica.
app.get("/api/whatsapp/qrcode", requireAuth, async (_req, res) => {
  try {
    const data = await getPairingQr();
    if (data.connected) {
      return res.json({ connected: true, qrCodeBase64: null });
    }
    return res.json({ connected: false, qrCodeBase64: data.base64 || null, error: data.error || null });
  } catch (err) {
    return res.json({ connected: false, qrCodeBase64: null, error: err.message });
  }
});

// ============================================================
// Setup: QR code do WhatsApp em Tela Cheia (Protegido)
// ============================================================
app.get("/setup/whatsapp", (_req, res) => {
  res.redirect("/dashboard/channels");
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

// Tela 8: Prospecção Automática & Rascunhos
app.get("/dashboard/prospects", (_req, res) => {
  const metrics = getProspectingMetrics();
  const prospects = getProspectsWithDrafts();
  res.type("html").send(renderProspectsView({ metrics, prospects }));
});

app.post("/api/prospects/search-now", async (_req, res) => {
  try {
    await runProspectingCycle();
  } catch (err) {
    console.warn("[prospects] erro ao buscar prospects:", err.message);
  }
  res.redirect("/dashboard/prospects");
});

app.post("/api/prospects/stage", (req, res) => {
  const { prospectId, stage } = req.body || {};
  if (prospectId && stage) {
    updateProspectStage(Number(prospectId), stage);
  }
  res.redirect("/dashboard/prospects");
});

app.post("/api/prospects/draft", (req, res) => {
  const { draftId, draftMessage } = req.body || {};
  if (draftId && draftMessage !== undefined) {
    updateDraftMessage(Number(draftId), draftMessage);
  }
  res.redirect("/dashboard/prospects");
});

app.post("/api/prospects/delete", (req, res) => {
  const { prospectId } = req.body || {};
  if (prospectId) {
    deleteProspect(Number(prospectId));
  }
  res.json({ ok: true });
});

// Tela 6: Canais & QR Code
app.get("/dashboard/channels", async (_req, res) => {
  let whatsappConnected = false;
  let qrCodeBase64 = null;

  try {
    const data = await getPairingQr();
    if (data.connected) {
      whatsappConnected = true;
    } else {
      qrCodeBase64 = data.base64 || null;
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
  const { agentMode, ownerWhatsapp, workingHours, maxrouterToken, demoAllowlist } = req.body || {};

  const upsert = db.prepare(`
    INSERT INTO runtime_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  if (agentMode) upsert.run("agentMode", agentMode);
  if (ownerWhatsapp) upsert.run("ownerWhatsapp", ownerWhatsapp);
  if (workingHours) upsert.run("workingHours", workingHours);
  // Allowlist de demo — precisa ser editável aqui (e não só no .env) porque o
  // roteiro de demonstração manda incluir o número do prospect antes da call e
  // limpar depois. Editar .env + redeploy no meio de uma call não é viável.
  if (demoAllowlist !== undefined) {
    upsert.run("demoAllowlist", String(demoAllowlist).replace(/[^\d,]/g, ""));
  }
  if (maxrouterToken !== undefined) {
    const trimmedToken = maxrouterToken.trim();
    upsert.run("maxrouterToken", trimmedToken);
    config.router.apiKey = trimmedToken;
  }

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
