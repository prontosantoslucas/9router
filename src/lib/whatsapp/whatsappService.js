const WHATSAPP_API = "https://graph.facebook.com/v21.0";

async function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

async function sendText({ to, body }) {
  const cfg = await getConfig();
  if (!cfg) return { ok: false, error: "WhatsApp not configured" };
  const res = await fetch(`${WHATSAPP_API}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error?.message || "WhatsApp API error" };
  return { ok: true, id: data.messages?.[0]?.id };
}

export async function sendPaymentNotification({ to, planName, amount, currency, keyString }) {
  const body = `Payment Received! ✅\n\nPlan: ${planName}\nAmount: ${amount} ${currency}\nAPI Key: ${keyString}\n\nThank you for your purchase!`;
  return sendText({ to, body });
}

export { sendText };
