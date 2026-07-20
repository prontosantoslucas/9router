const RESEND_API = "https://api.resend.com/emails";

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "noreply@9router.com";
  if (!apiKey) return null;
  return { apiKey, from };
}

async function send({ to, subject, html, text }) {
  const cfg = getConfig();
  if (!cfg) return { ok: false, error: "RESEND_API_KEY not configured" };
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to, subject, html, text }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.message || data.error || "Resend API error" };
  return { ok: true, id: data.id };
}

function paymentReceiptHtml({ planName, amount, currency, keyString, password, email }) {
  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h2>Payment Confirmed</h2>
<p>Thank you for your purchase!</p>
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:8px 0;color:#666">Plan</td><td style="padding:8px 0;font-weight:600">${planName}</td></tr>
<tr><td style="padding:8px 0;color:#666">Amount</td><td style="padding:8px 0;font-weight:600">${amount} ${currency}</td></tr>
<tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0;font-weight:600">${email}</td></tr>
</table>
<h3>Your Credentials</h3>
<p style="background:#f5f5f5;padding:12px;border-radius:6px;font-family:monospace">
Key: ${keyString}<br>
Password: ${password}
</p>
<p>Use these to access your API key at the dashboard.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#999;font-size:12px">9Router</p>
</body></html>`;
}

export async function sendPaymentReceipt({ email, planName, amount, currency, keyString, password }) {
  if (!email) return { ok: false, error: "no email" };
  return send({
    to: email,
    subject: `Payment Confirmed — ${planName}`,
    html: paymentReceiptHtml({ planName, amount, currency, keyString, password, email }),
    text: `Payment Confirmed — ${planName}\n\nAmount: ${amount} ${currency}\nKey: ${keyString}\nPassword: ${password}`,
  });
}

export { send };
