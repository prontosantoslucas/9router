// Push dedicado no celular — notificação de verdade, não mensagem de chat.
//
// ────────────────────────────────────────────────────────────────
// POR QUE UM CANAL SEPARADO DO TELEGRAM
//
// Mensagem de Telegram já vira push no celular, mas cai no meio das conversas:
// o toque das 7h fica ao lado do grupo da família e se perde. Push dedicado
// chega como alerta, com título próprio, e some quando lido.
//
// PROVEDORES SUPORTADOS (o primeiro configurado ganha)
//
//   ntfy   — gratuito, sem conta, sem cadastro. Instala o app ntfy, assina um
//            tópico, e publicar é um POST. É o default por não custar nada e
//            funcionar em Android e iOS. O tópico É a senha: quem souber o nome
//            recebe e pode publicar, então tem que ser longo e aleatório.
//   pushover — pago (licença única por plataforma), mais polido. Suportado
//            porque quem já tem não precisa trocar de app.
//
// Tudo aqui é fail-soft: devolve { ok:false, error } e nunca lança, porque
// quem chama são scheduler e toques automáticos — derrubar o agente por causa
// de uma notificação seria pior que perder a notificação.
// ────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10000;

// Publica em JSON, e não pelos headers (Title/Priority) que o ntfy também
// aceita: header HTTP é latin-1, e "Sessão às 7h — revisão" viraria mojibake.
// O corpo JSON é UTF-8 e preserva o acento.
async function viaNtfy({ title, text, priority, url }) {
  const server = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return { ok: false, error: "NTFY_TOPIC não configurado" };

  const payload = { topic, message: text };
  if (title) payload.title = title;
  // 1 = min … 5 = urgente. 3 é o normal; 4 faz o celular vibrar mesmo no silencioso.
  if (priority) payload.priority = Math.min(Math.max(Number(priority) || 3, 1), 5);
  if (url) payload.actions = [{ action: "view", label: "Abrir", url }];

  const headers = { "Content-Type": "application/json" };
  // Só necessário em tópico protegido ou servidor próprio.
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;

  try {
    const res = await fetch(server, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `ntfy recusou (${res.status}): ${detail.slice(0, 200)}` };
    }
    return { ok: true, via: "push-ntfy", topic };
  } catch (e) {
    return { ok: false, error: `ntfy: ${e.message}` };
  }
}

async function viaPushover({ title, text, priority, url }) {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) return { ok: false, error: "PUSHOVER_TOKEN/PUSHOVER_USER não configurados" };

  const form = new URLSearchParams({ token, user, message: text });
  if (title) form.set("title", title);
  // Escala do Pushover é -2..2, diferente do ntfy (1..5). Converte para não
  // mandar 4 e o Pushover rejeitar.
  if (priority) form.set("priority", String(Math.min(Math.max(Number(priority) - 3, -2), 2)));
  if (url) form.set("url", url);

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== 1) {
      const detail = data?.errors?.join(", ") || `HTTP ${res.status}`;
      return { ok: false, error: `pushover recusou: ${detail}` };
    }
    return { ok: true, via: "push-pushover" };
  } catch (e) {
    return { ok: false, error: `pushover: ${e.message}` };
  }
}

function provedorAtivo() {
  if (process.env.NTFY_TOPIC) return "ntfy";
  if (process.env.PUSHOVER_TOKEN && process.env.PUSHOVER_USER) return "pushover";
  return null;
}

function isConfigured() {
  return provedorAtivo() !== null;
}

// Leitura pura, para diagnóstico. Não envia nada e não expõe token.
function status() {
  const p = provedorAtivo();
  if (!p) {
    return {
      configured: false,
      provider: null,
      hint: "Defina NTFY_TOPIC (gratuito, app ntfy) ou PUSHOVER_TOKEN + PUSHOVER_USER.",
    };
  }
  if (p === "ntfy") {
    const topic = process.env.NTFY_TOPIC;
    return {
      configured: true,
      provider: "ntfy",
      server: process.env.NTFY_SERVER || "https://ntfy.sh",
      // Não imprime o tópico inteiro: ele funciona como senha e o diagnóstico
      // pode acabar colado num log ou num print de tela.
      topic_preview: topic.slice(0, 4) + "…" + topic.slice(-3),
      autenticado: !!process.env.NTFY_TOKEN,
    };
  }
  return { configured: true, provider: "pushover", user_preview: (process.env.PUSHOVER_USER || "").slice(0, 4) + "…" };
}

// title/text obrigatórios na prática: push sem texto não diz nada.
// priority na escala do ntfy (1..5) mesmo para Pushover — a conversão é interna,
// para quem chama não precisar saber qual provedor está ativo.
async function send({ title = null, text, priority = 3, url = null } = {}) {
  const corpo = String(text || "").trim();
  if (!corpo) return { ok: false, error: "texto vazio" };

  const p = provedorAtivo();
  if (!p) return { ok: false, error: "nenhum provedor de push configurado (NTFY_TOPIC ou PUSHOVER_TOKEN+PUSHOVER_USER)" };

  const args = { title, text: corpo, priority, url };
  const r = p === "ntfy" ? await viaNtfy(args) : await viaPushover(args);
  if (!r.ok) console.warn(`[push] falha ${p}: ${r.error}`);
  return r;
}

module.exports = { send, status, isConfigured, provedorAtivo };
