import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-mp-"));
process.env.DATA_DIR = tmp;
process.env.MERCADOPAGO_ACCESS_TOKEN = "dummy";
process.env.MERCADOPAGO_WEBHOOK_SECRET = "whsec_mp";
process.env.PAYPAL_CLIENT_ID = "dummy";
process.env.PAYPAL_SECRET = "dummy";
process.env.PAYPAL_WEBHOOK_ID = "wh_paypal";
process.env.NOWPAYMENTS_API_KEY = "dummy";
process.env.NOWPAYMENTS_IPN_SECRET = "ipn_secret";

const gateways = await import("../src/lib/billing/gateways/index.js");
assert.deepEqual(gateways.listGateways().sort(), ["mercadopago", "nowpayments", "paypal", "stripe"]);

const mp = await import("../src/lib/billing/gateways/mercadopago.js");
const now = await import("../src/lib/billing/gateways/nowpayments.js");
const pp = await import("../src/lib/billing/gateways/paypal.js");

function signMp(raw, secret, ts) { return crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex"); }
function signNow(raw, secret) { return crypto.createHmac("sha512", secret).update(raw).digest("hex"); }

const mpRaw = JSON.stringify({ type: "payment.created", data: { id: "mp_1", status: "approved", transaction_amount: 9.99, currency_id: "BRL", metadata: { planId: "P1" }, payer: { email: "mp@example.com" } } });
const mpTs = String(Math.floor(Date.now()/1000));
const mpReq = { text: async () => mpRaw, headers: { get: (h) => h === "x-signature" ? `ts=${mpTs},v1=${signMp(mpRaw, process.env.MERCADOPAGO_WEBHOOK_SECRET, mpTs)}` : null } };
const mpRes = await mp.verifyWebhook(mpReq);
assert.equal(mpRes.ok, true, "MP verifies");
assert.equal(mpRes.event.type, "paid");
assert.equal(mpRes.event.customerEmail, "mp@example.com");
assert.equal(mpRes.event.amountCents, 999);

const nowRaw = JSON.stringify({ payment_id: "np_1", payment_status: "finished", price_amount: 20, price_currency: "USD", order_id: "O1", customer_email: "np@example.com", payment_metadata: { planId: "P2" } });
const nowReq = { text: async () => nowRaw, headers: { get: (h) => h === "x-nowpayments-sig" ? signNow(nowRaw, process.env.NOWPAYMENTS_IPN_SECRET) : null } };
const nowRes = await now.verifyWebhook(nowReq);
assert.equal(nowRes.ok, true, "NOWPayments verifies");
assert.equal(nowRes.event.type, "paid");
assert.equal(nowRes.event.amountCents, 2000);

// PayPal verify requires live verify call → just check it refuses without headers
const ppReq = { text: async () => "{}", headers: { get: () => null } };
const ppRes = await pp.verifyWebhook(ppReq);
assert.equal(ppRes.ok, false, "PayPal rejects missing headers");

console.log("OK  all gateway signatures self-check passed");
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* WAL lock */ }
