import { getAdapter } from "@/lib/db/driver.js";
import { send } from "@/lib/email/emailService.js";
import { sendText } from "@/lib/whatsapp/whatsappService.js";
import { isWorthNotifying } from "./scanner.js";

function getNotifyEmail() {
  return process.env.SCANNER_NOTIFY_EMAIL;
}

function getNotifyWhatsapp() {
  return process.env.SCANNER_NOTIFY_WHATSAPP;
}

function scannerAlertHtml(keys) {
  const rows = keys.map(k => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${k.key?.slice(0, 30)}...</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${k.provider}</td>
      <td style="padding:8px;border-bottom:1px solid #eee"><strong>${k.status}</strong></td>
      <td style="padding:8px;border-bottom:1px solid #eee">${k.source}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h2>🔑 Scanner Found Valid Keys</h2>
<p>The API key scanner found <strong>${keys.length}</strong> valid key(s).</p>
<table style="width:100%;border-collapse:collapse">
<thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Key</th><th style="padding:8px;text-align:left">Provider</th><th style="padding:8px;text-align:left">Status</th><th style="padding:8px;text-align:left">Source</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="color:#999;font-size:12px;margin-top:24px">9Router Scanner</p>
</body></html>`;
}

function getNotifyTelegramChatId() {
  return process.env.SCANNER_NOTIFY_TELEGRAM_CHAT_ID;
}

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

async function sendTelegramMessage(chatId, text) {
  const token = getTelegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    return { ok: data.ok, error: data.description };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function sendScannerAlert(validKeys) {
  const errors = [];

  // Signal is "real financial exposure" — drop free-tier keys and paid keys
  // confirmed to have zero balance ($0 credit = no ongoing risk to the owner).
  validKeys = (validKeys || []).filter((k) =>
    isWorthNotifying({ provider: k.provider, status: k.status, balance: k.balance })
  );
  if (validKeys.length === 0) return { sent: false, errors: [], skipped: "nothing_worth_notifying" };

  const emailTo = getNotifyEmail();
  if (emailTo && validKeys.length > 0) {
    try {
      const r = await send({
        to: emailTo,
        subject: `Scanner Alert — ${validKeys.length} valid key(s) found`,
        html: scannerAlertHtml(validKeys),
        text: `Scanner found ${validKeys.length} valid keys.\n\n${validKeys.map(k => `${k.provider}: ${k.key?.slice(0, 30)}... (${k.status}) — ${k.source}`).join("\n")}`,
      });
      if (!r.ok) errors.push({ channel: "email", error: r.error });
    } catch (e) {
      errors.push({ channel: "email", error: e.message });
    }
  }

  const waTo = getNotifyWhatsapp();
  if (waTo && validKeys.length > 0) {
    const valid = validKeys.filter(k => k.status === "valid");
    const body = `🔑 Scanner Alert — ${valid.length} valid key(s) found\n\n${valid.map(k => `${k.provider}: ${k.key?.slice(0, 20)}... (${k.source})`).join("\n")}\n\nCheck dashboard for details.`;
    try {
      const r = await sendText({ to: waTo, body });
      if (!r.ok) errors.push({ channel: "whatsapp", error: r.error });
    } catch (e) {
      errors.push({ channel: "whatsapp", error: e.message });
    }
  }

  const tgTo = getNotifyTelegramChatId();
  if (tgTo && validKeys.length > 0) {
    const valid = validKeys.filter(k => k.status === "valid");
    const body = `🔑 <b>Scanner Alert</b> — ${valid.length} valid key(s) found\n\n${valid.map(k => `${k.provider}: ${k.key?.slice(0, 20)}... (${k.source})`).join("\n")}\n\nCheck dashboard for details.`;
    try {
      const r = await sendTelegramMessage(tgTo, body);
      if (!r.ok) errors.push({ channel: "telegram", error: r.error });
    } catch (e) {
      errors.push({ channel: "telegram", error: e.message });
    }
  }

  if (errors.length === 0 && validKeys.length > 0) {
    // Mark notified
    const db = await getAdapter();
    for (const k of validKeys) {
      db.run("UPDATE scannedKeys SET notified = 1 WHERE key = ?", [k.key]);
    }
  }

  return { sent: true, errors };
}
