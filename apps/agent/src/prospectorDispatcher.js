// Despachante de abordagens: envia os rascunhos aprovados em RITMO CONTROLADO.
//
// ────────────────────────────────────────────────────────────────
// POR QUE ISTO EXISTE
//
// O auto-envio antigo disparava dentro do laço de leads, uma mensagem atrás da
// outra, sem intervalo e sem teto diário. Para número pessoal em WhatsApp não
// oficial (Baileys/Evolution) isso é o padrão exato que a plataforma usa para
// identificar spam: muitas mensagens para contatos que nunca falaram com você,
// em rajada, em horário qualquer. O custo não é a mensagem perdida — é o número
// banido, e com ele todo o histórico e o canal de vendas.
//
// LIMITES PADRÃO (conservadores de propósito)
//
//   20 mensagens/dia por canal      número novo aguenta pouco; subir isso é
//                                   decisão de risco do dono, não default
//   180s de intervalo mínimo        + jitter, para o espaçamento não ficar
//                                   metronômico (padrão regular é detectável)
//   9h às 19h, seg-sáb              clínica não responde de madrugada, e
//                                   mensagem fora de hora é denúncia fácil
//
// Todos configuráveis. O que NÃO é configurável é a honestidade do registro:
// só conta como enviado o que o canal confirmou, e todo pulo fica com motivo.
//
// O despachante nunca envia rascunho sozinho: só o que foi marcado 'queued'
// (aprovado manualmente ou pelo auto-envio). 'draft' espera aprovação.
// ────────────────────────────────────────────────────────────────

const db = require("./db");

const PADROES = {
  cap_diario: 20,
  intervalo_min_seg: 180,
  hora_inicio: 9,
  hora_fim: 19,
  domingo: 0, // 0 = não envia domingo
};

// Migrações idempotentes, no mesmo padrão do prospector.
for (const [col, tipo] of [
  ["send_cap_diario", "INTEGER NOT NULL DEFAULT 20"],
  ["send_intervalo_seg", "INTEGER NOT NULL DEFAULT 180"],
  ["send_hora_inicio", "INTEGER NOT NULL DEFAULT 9"],
  ["send_hora_fim", "INTEGER NOT NULL DEFAULT 19"],
  ["send_domingo", "INTEGER NOT NULL DEFAULT 0"],
]) {
  try { db.exec(`ALTER TABLE prospector_settings ADD COLUMN ${col} ${tipo}`); } catch {}
}

// Registro de cada tentativa. Existe para o cap diário ser verificável e para
// "por que não enviou hoje?" ter resposta em vez de silêncio.
db.exec(`
  CREATE TABLE IF NOT EXISTS prospector_send_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outreach_id INTEGER,
    channel TEXT NOT NULL,
    ymd TEXT NOT NULL,
    ok INTEGER NOT NULL,
    motivo TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_sendlog_dia ON prospector_send_log(ymd, channel, ok);
`);

function agoraBRT() {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "numeric", weekday: "short", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => fmt.find((p) => p.type === t)?.value;
  return {
    ymd: `${g("year")}-${g("month")}-${g("day")}`,
    hora: Number(g("hour")),
    diaSemana: g("weekday"),
  };
}

function config() {
  const r = db.prepare("SELECT * FROM prospector_settings WHERE id = 'default'").get() || {};
  return {
    cap_diario: r.send_cap_diario ?? PADROES.cap_diario,
    intervalo_seg: r.send_intervalo_seg ?? PADROES.intervalo_min_seg,
    hora_inicio: r.send_hora_inicio ?? PADROES.hora_inicio,
    hora_fim: r.send_hora_fim ?? PADROES.hora_fim,
    domingo: r.send_domingo ?? PADROES.domingo,
    auto_wa: !!r.auto_send_wa,
    auto_ig: !!r.auto_send_ig,
  };
}

function atualizarConfig(patch = {}) {
  const c = config();
  const n = {
    cap_diario: Math.min(Math.max(Number(patch.cap_diario ?? c.cap_diario), 1), 200),
    // Abaixo de 30s não é ritmo, é rajada — e é o que queima o número.
    intervalo_seg: Math.min(Math.max(Number(patch.intervalo_seg ?? c.intervalo_seg), 30), 3600),
    hora_inicio: Math.min(Math.max(Number(patch.hora_inicio ?? c.hora_inicio), 0), 23),
    hora_fim: Math.min(Math.max(Number(patch.hora_fim ?? c.hora_fim), 1), 24),
    domingo: patch.domingo == null ? c.domingo : (patch.domingo ? 1 : 0),
  };
  db.prepare(`UPDATE prospector_settings
      SET send_cap_diario = ?, send_intervalo_seg = ?, send_hora_inicio = ?, send_hora_fim = ?, send_domingo = ?
      WHERE id = 'default'`)
    .run(n.cap_diario, n.intervalo_seg, n.hora_inicio, n.hora_fim, n.domingo);
  return config();
}

function enviadosHoje(channel) {
  const { ymd } = agoraBRT();
  return db.prepare(
    "SELECT COUNT(*) n FROM prospector_send_log WHERE ymd = ? AND channel = ? AND ok = 1"
  ).get(ymd, channel).n;
}

function ultimoEnvio(channel) {
  return db.prepare(
    "SELECT created_at FROM prospector_send_log WHERE channel = ? AND ok = 1 ORDER BY id DESC LIMIT 1"
  ).get(channel)?.created_at || 0;
}

// Um único lugar decide se PODE enviar agora.
//
// O que o envio manual dispensa: a JANELA de horário e o domingo — aí há uma
// pessoa decidindo, e é ela quem assume o risco de mandar às 21h.
//
// O que o manual NÃO dispensa: o teto diário e o INTERVALO MÍNIMO. Clicar
// "Enviar" vinte vezes em trinta segundos produz exatamente a rajada que faz a
// plataforma marcar o número como spam — a proteção não pode depender de o
// usuário ter paciência.
function podeEnviar(channel, { ignorarJanela = false } = {}) {
  const c = config();
  const { hora, diaSemana } = agoraBRT();

  const usados = enviadosHoje(channel);
  if (usados >= c.cap_diario) {
    return { pode: false, motivo: `teto diario atingido (${usados}/${c.cap_diario} em ${channel})`, config: c, usados };
  }

  if (!ignorarJanela) {
    if (!c.domingo && /^dom/i.test(diaSemana)) {
      return { pode: false, motivo: "domingo desativado", config: c, usados };
    }
    if (hora < c.hora_inicio || hora >= c.hora_fim) {
      return { pode: false, motivo: `fora da janela (${c.hora_inicio}h-${c.hora_fim}h, agora ${hora}h)`, config: c, usados };
    }
  }

  // Intervalo mínimo: vale sempre, manual incluído.
  const ultimo = ultimoEnvio(channel);
  if (ultimo) {
    const desde = Math.floor(Date.now() / 1000) - ultimo;
    // Decorrido negativo significa registro no futuro: relógio andou para trás
    // (correção de NTP, container subindo com hora errada). Bloquear nesse caso
    // travaria o envio até o relógio "alcançar" o registro — o canal morreria
    // em silêncio, com mensagem absurda de segundos negativos. Libera e avisa.
    if (desde < 0) {
      console.warn(`[dispatcher] ultimo envio de ${channel} esta ${-desde}s no futuro — relogio inconsistente, liberando o envio`);
    } else if (desde < c.intervalo_seg) {
      return {
        pode: false,
        motivo: `aguardando intervalo (${desde}s de ${c.intervalo_seg}s)`,
        esperarSeg: c.intervalo_seg - desde,
        config: c, usados,
      };
    }
  }

  return { pode: true, config: c, usados };
}

// created_at é gravado explicitamente com o relógio do JS, e não pelo default
// `unixepoch()` do SQLite. Duas fontes de tempo no mesmo cálculo é o que
// produzia "aguardando intervalo (-11545s)": o portão comparava Date.now()
// contra um registro escrito pelo relógio do banco. Uma fonte só.
function registrar(outreachId, channel, ok, motivo = null) {
  db.prepare("INSERT INTO prospector_send_log (outreach_id, channel, ymd, ok, motivo, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      outreachId ?? null, channel, agoraBRT().ymd, ok ? 1 : 0,
      motivo ? String(motivo).slice(0, 300) : null,
      Math.floor(Date.now() / 1000),
    );
}

// Rascunhos, com dados do lead, para a aba de aprovação.
function listarRascunhos({ status = "draft", channel = null, limit = 50 } = {}) {
  const where = ["o.status = ?"];
  const params = [status];
  if (channel) { where.push("o.channel = ?"); params.push(channel); }
  const rows = db.prepare(`
    SELECT o.id, o.lead_id, o.channel, o.message, o.followup_message, o.status, o.error, o.created_at,
           l.name AS lead_nome, l.phone, l.instagram_handle, l.city, l.category
    FROM prospector_outreach o
    LEFT JOIN prospector_leads l ON l.id = o.lead_id
    WHERE ${where.join(" AND ")}
    ORDER BY o.id DESC LIMIT ?
  `).all(...params, Math.min(Number(limit) || 50, 200));

  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    canal: r.channel,
    nome: r.lead_nome || r.lead_id,
    cidade: r.city || null,
    categoria: r.category || null,
    destino: r.channel === "whatsapp" ? r.phone : r.instagram_handle,
    mensagem: r.message,
    followup: r.followup_message,
    status: r.status,
    erro: r.error,
    em: r.created_at,
    // Sem destino não há envio possível — o front desabilita em vez de deixar
    // o usuário clicar e receber erro.
    podeEnviar: !!(r.channel === "whatsapp" ? r.phone : r.instagram_handle),
  }));
}

async function enviarUm(outreachId, { manual = false } = {}) {
  const row = db.prepare(`
    SELECT o.*, l.phone, l.instagram_handle, l.name AS lead_nome
    FROM prospector_outreach o LEFT JOIN prospector_leads l ON l.id = o.lead_id
    WHERE o.id = ?
  `).get(Number(outreachId));
  if (!row) return { ok: false, error: "rascunho não encontrado" };
  if (row.status === "sent") return { ok: false, error: "já enviado" };

  const destino = row.channel === "whatsapp" ? row.phone : row.instagram_handle;
  if (!destino) {
    registrar(row.id, row.channel, false, "sem destino");
    return { ok: false, error: `lead sem ${row.channel === "whatsapp" ? "telefone" : "instagram"}` };
  }

  // Manual ignora a janela de horário, mas NUNCA o teto diário: o teto é o que
  // protege o número, e furá-lo a mão desfaz a proteção inteira.
  const gate = podeEnviar(row.channel, { ignorarJanela: manual });
  if (!gate.pode) {
    registrar(row.id, row.channel, false, gate.motivo);
    return { ok: false, error: gate.motivo, aguardar: gate.esperarSeg || null };
  }

  const prospector = require("./prospector");
  const res = row.channel === "whatsapp"
    ? await prospector.sendWhatsAppOutreach(destino, row.message)
    : await prospector.sendInstagramOutreach(destino, row.message);

  if (!res.ok) {
    db.prepare("UPDATE prospector_outreach SET status = 'failed', error = ? WHERE id = ?").run(res.error || "falha", row.id);
    registrar(row.id, row.channel, false, res.error);
    return { ok: false, error: res.error || "falha no envio" };
  }

  // Instagram passa pela extensão do Chrome, que só ENFILEIRA: marcar 'sent'
  // produziria relatório de entregas que ninguém entregou.
  const novoStatus = row.channel === "instagram" ? "queued" : "sent";
  db.prepare(`UPDATE prospector_outreach SET status = ?, sent_at = unixepoch(), error = NULL WHERE id = ?`)
    .run(novoStatus, row.id);
  db.prepare("UPDATE prospector_leads SET status = ?, updated_at = unixepoch() WHERE id = ?")
    .run(novoStatus, row.lead_id);
  // Só o que sai de fato entra no log — é o que faz o teto diário significar algo.
  registrar(row.id, row.channel, true, manual ? "manual" : "automatico");

  return { ok: true, status: novoStatus, para: row.lead_nome || destino };
}

function aprovar(outreachId) {
  const info = db.prepare("UPDATE prospector_outreach SET status = 'queued' WHERE id = ? AND status = 'draft'").run(Number(outreachId));
  return info.changes > 0;
}

function descartar(outreachId) {
  const info = db.prepare("UPDATE prospector_outreach SET status = 'discarded' WHERE id = ? AND status IN ('draft','queued','failed')").run(Number(outreachId));
  return info.changes > 0;
}

// ────────────────────────────────────────────────────────────────
// Laço: UMA mensagem por tick, e o tick é curto só para reavaliar as condições.
// Enviar em lote dentro de um tick anularia o intervalo mínimo.
// ────────────────────────────────────────────────────────────────
const TICK_MS = 30 * 1000;
let timer = null;

async function tick() {
  const c = config();
  if (!c.auto_wa && !c.auto_ig) return;

  for (const channel of [c.auto_wa ? "whatsapp" : null, c.auto_ig ? "instagram" : null].filter(Boolean)) {
    const gate = podeEnviar(channel);
    if (!gate.pode) continue;

    const proximo = db.prepare(
      "SELECT id FROM prospector_outreach WHERE status = 'queued' AND channel = ? ORDER BY id ASC LIMIT 1"
    ).get(channel);
    if (!proximo) continue;

    const r = await enviarUm(proximo.id, { manual: false });
    console.log(`[dispatcher] ${channel} #${proximo.id}: ${r.ok ? "enviado" : "falhou — " + r.error}`);
    // Um canal por tick: dois envios no mesmo instante quebram o espaçamento.
    break;
  }
}

function start() {
  if (timer) return;
  timer = setInterval(() => { tick().catch((e) => console.error("[dispatcher] erro:", e.message)); }, TICK_MS);
  const c = config();
  console.log(`[dispatcher] iniciado — teto ${c.cap_diario}/dia, intervalo ${c.intervalo_seg}s, janela ${c.hora_inicio}h-${c.hora_fim}h`);
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

function status() {
  const c = config();
  const { hora, diaSemana, ymd } = agoraBRT();
  const canais = {};
  for (const ch of ["whatsapp", "instagram"]) {
    const gate = podeEnviar(ch);
    canais[ch] = {
      enviadosHoje: enviadosHoje(ch),
      cap: c.cap_diario,
      pode: gate.pode,
      motivo: gate.pode ? null : gate.motivo,
      aguardarSeg: gate.esperarSeg || null,
      naFila: db.prepare("SELECT COUNT(*) n FROM prospector_outreach WHERE status = 'queued' AND channel = ?").get(ch).n,
      rascunhos: db.prepare("SELECT COUNT(*) n FROM prospector_outreach WHERE status = 'draft' AND channel = ?").get(ch).n,
    };
  }
  return { hoje: ymd, hora, diaSemana, config: c, canais, rodando: !!timer };
}

module.exports = {
  start, stop, tick, status, config, atualizarConfig,
  podeEnviar, listarRascunhos, enviarUm, aprovar, descartar,
  enviadosHoje, agoraBRT, PADROES,
};
