// Gmail — read/send reais via googleapis.
const { google } = require("googleapis");
const { getAuthorizedClient } = require("./oauth");

function client() {
  const auth = getAuthorizedClient();
  return google.gmail({ version: "v1", auth });
}

/**
 * Lista as N mais recentes com filtros de "importantes/não-lidos".
 * Retorna metadados: id, threadId, from, subject, snippet, dateISO, unread.
 */
async function listPriorityEmails(limit = 5) {
  const gmail = client();
  const query = "is:unread -category:promotions -category:social";
  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: Math.max(1, Math.min(50, Number(limit) || 5)),
  });
  const ids = (list.data.messages || []).map((m) => m.id);
  if (ids.length === 0) return [];

  const msgs = await Promise.all(
    ids.map((id) =>
      gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })
    )
  );
  return msgs.map((r) => {
    const d = r.data;
    const headers = Object.fromEntries((d.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
    return {
      id: d.id,
      threadId: d.threadId,
      from: headers.from || null,
      subject: headers.subject || "(sem assunto)",
      snippet: d.snippet || "",
      dateISO: headers.date ? new Date(headers.date).toISOString() : null,
      unread: (d.labelIds || []).includes("UNREAD"),
    };
  });
}

/**
 * Busca emails por query livre (sintaxe Gmail: from:, subject:, before:, etc.).
 */
async function searchEmails(query, limit = 20) {
  const gmail = client();
  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: Math.max(1, Math.min(100, Number(limit) || 20)),
  });
  const ids = (list.data.messages || []).map((m) => m.id);
  if (ids.length === 0) return [];
  const msgs = await Promise.all(
    ids.map((id) =>
      gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      })
    )
  );
  return msgs.map((r) => {
    const d = r.data;
    const headers = Object.fromEntries((d.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
    return {
      id: d.id,
      threadId: d.threadId,
      from: headers.from || null,
      to: headers.to || null,
      subject: headers.subject || "(sem assunto)",
      snippet: d.snippet || "",
      dateISO: headers.date ? new Date(headers.date).toISOString() : null,
    };
  });
}

/**
 * Corpo textual (text/plain preferido, fallback pra text/html sem tags).
 */
async function getEmailBody(messageId) {
  const gmail = client();
  const r = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const payload = r.data.payload;
  const body = extractPlainText(payload) || extractHtmlText(payload) || "";
  return { id: r.data.id, threadId: r.data.threadId, body };
}

function extractPlainText(part) {
  if (!part) return null;
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const p of part.parts || []) {
    const t = extractPlainText(p);
    if (t) return t;
  }
  return null;
}

function extractHtmlText(part) {
  if (!part) return null;
  if (part.mimeType === "text/html" && part.body?.data) {
    const html = Buffer.from(part.body.data, "base64url").toString("utf8");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  for (const p of part.parts || []) {
    const t = extractHtmlText(p);
    if (t) return t;
  }
  return null;
}

/**
 * Envia email simples text/plain via Gmail. Retorna { ok, id, threadId }.
 */
async function sendEmail(to, subject, body, { cc, bcc, replyTo } = {}) {
  const gmail = client();
  const headers = [
    `To: ${to}`,
    subject ? `Subject: ${subject}` : "Subject: (sem assunto)",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body || ""}`, "utf8").toString("base64url");
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { ok: true, id: res.data.id, threadId: res.data.threadId };
}

module.exports = {
  listPriorityEmails,
  searchEmails,
  getEmailBody,
  sendEmail,
};
