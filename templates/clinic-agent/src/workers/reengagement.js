import { config } from "../config.js";
import {
  db,
  conversationsForReengagement,
  markReengaged,
  logWorkerEvent,
} from "../db/db.js";
import { sendWhatsapp } from "../channels/evolution.js";

// ============================================================
// v4 — Reativação de pacientes inativos (LTV recovery).
//
// Tiers configuráveis (REENGAGE_TIERS, default "15,30,60" dias). Cada
// paciente silencioso recebe UMA mensagem por tier, escalando o apelo.
// Ordem: 15d (check-in leve) → 30d (oferta suave) → 60d+ (último toque).
//
// ⚠️ LGPD: mensagem proativa de reativação é comunicação ativa. Só dispara
// em AGENT_MODE=prod. Em test, registra como 'skipped'. O paciente que
// responder "PARAR"/"SAIR" deve ser marcado status='opted_out' (tratado
// no fluxo do agente, não aqui).
// ============================================================

function parseTiers() {
  // "15,30,60" → [15, 30, 60] ascendente
  return (config.workers.reengageTiers || "15,30,60")
    .split(",")
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

// Determina qual tier enviar dado os dias em silêncio e o último tier já enviado.
// Retorna a label do tier a enviar, ou null se nada a fazer.
function nextTier(daysSilent, alreadySent, tiers) {
  // Ordena tiers do maior pro menor pra pegar o mais alto atingido
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i];
    const label = i === tiers.length - 1 ? `${t}d+` : `${t}d`;
    if (daysSilent >= t) {
      // Já mandamos esse tier (ou um mais alto)? Então nada.
      if (alreadySent === label) return null;
      // Se o último enviado foi um tier mais alto, também não regride.
      const sentIdx = tiers.findIndex(
        (tt, idx) => (idx === tiers.length - 1 ? `${tt}d+` : `${tt}d`) === alreadySent
      );
      if (sentIdx >= i) return null;
      return label;
    }
  }
  return null;
}

function hasFutureAppointment(chatId) {
  const row = db
    .prepare(
      `SELECT 1 FROM appointments WHERE chat_id = ? AND status = 'confirmed' AND scheduled_at > datetime('now') LIMIT 1`
    )
    .get(chatId);
  return !!row;
}

function buildText(tierLabel, conv) {
  const nome = conv.patient_name?.split(" ")[0] || "";
  const oi = `Oi${nome ? " " + nome : ""}!`;
  const marca = config.clinic.name;
  switch (tierLabel) {
    case "15d":
      return (
        `${oi} 👋 Aqui é da ${marca}. Notei que faz um tempinho que a gente não se fala. ` +
        `Tá tudo certo com você? Se precisar de qualquer coisa ou quiser marcar um horário, é só chamar. 😊`
      );
    case "30d":
      return (
        `${oi} Passando pra saber como você está. Faz um mês que não conversamos aqui na ${marca}. ` +
        `Se quiser retomar aquele cuidado que a gente tinha conversado, tenho horários abrindo essa semana. Quer que eu veja um pra você?`
      );
    default: // 60d+
      return (
        `${oi} Sentimos sua falta na ${marca} 💚 Faz um tempo que não nos falamos. ` +
        `Preparei uma condição especial pra te receber de volta — quer que eu te conte? ` +
        `(se preferir não receber mais mensagens, é só responder SAIR)`
      );
  }
}

export async function runReengagementWorker() {
  const tiers = parseTiers();
  const rows = conversationsForReengagement();
  let sent = 0;
  let skipped = 0;

  for (const conv of rows) {
    // Paciente voltou a falar (silêncio menor que o 1º tier) → reseta pra
    // poder ser reativado de novo num ciclo futuro.
    if (conv.days_silent < tiers[0]) {
      if (conv.reengaged_stage) markReengaged(conv.chat_id, null);
      continue;
    }

    const tierLabel = nextTier(conv.days_silent, conv.reengaged_stage, tiers);
    if (!tierLabel) continue;

    // Não reativa quem já tem consulta futura marcada (não está "inativo").
    if (hasFutureAppointment(conv.chat_id)) {
      markReengaged(conv.chat_id, tierLabel); // marca pra não reprocessar
      continue;
    }

    // LGPD: só envia de fato em produção.
    if (config.agent.mode !== "prod") {
      logWorkerEvent({
        kind: "reengagement",
        chatId: conv.chat_id,
        status: "skipped",
        payload: { tier: tierLabel, reason: "AGENT_MODE!=prod", daysSilent: conv.days_silent },
      });
      skipped++;
      continue;
    }

    try {
      await sendWhatsapp(conv.chat_id, buildText(tierLabel, conv));
      markReengaged(conv.chat_id, tierLabel);
      logWorkerEvent({
        kind: "reengagement",
        chatId: conv.chat_id,
        status: "sent",
        payload: { tier: tierLabel, daysSilent: conv.days_silent },
      });
      sent++;
    } catch (err) {
      logWorkerEvent({
        kind: "reengagement",
        chatId: conv.chat_id,
        status: "failed",
        payload: { tier: tierLabel, error: err.message },
      });
      console.warn(`[reengage] falha ${conv.chat_id}:`, err.message);
    }
  }

  if (sent || skipped) console.log(`[reengage] ${sent} enviados, ${skipped} skipped (modo test)`);
  return { sent, skipped, checked: rows.length };
}
