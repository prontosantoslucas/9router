import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-stripe-"));
process.env.DATA_DIR = tmp;
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

const stripe = await import("../src/lib/billing/gateways/stripe.js");
const credit = await import("../src/lib/billing/credit.js");
const { getAdapter } = await import("../src/lib/db/driver.js");
const users = await import("../src/lib/db/repos/usersRepo.js");
const plans = await import("../src/lib/db/repos/plansRepo.js");
const keys = await import("../src/lib/db/repos/apiKeysRepo.js");
const pays = await import("../src/lib/db/repos/paymentsRepo.js");

function makeEvent(planId) {
  return {
    id: "evt_test_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        amount_total: 500,
        currency: "usd",
        customer_email: "stripe@example.com",
        metadata: { planId },
      },
    },
  };
}

function signPayload(raw, secret) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = `${timestamp}.${raw}`;
  const sig = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

await getAdapter();
const plan = await plans.createPlan({ name: "StripeTest", priceCents: 500, currency: "USD", durationDays: 7, tokenLimit: 10000 });
const raw = JSON.stringify(makeEvent(plan.id));
const sigHdr = signPayload(raw, process.env.STRIPE_WEBHOOK_SECRET);

const fakeReq = {
  text: async () => raw,
  headers: { get: (h) => h === "stripe-signature" ? sigHdr : null },
};

const verify = await stripe.verifyWebhook(fakeReq);
assert.equal(verify.ok, true, "webhook signature verifies");
assert.equal(verify.event.type, "paid");
assert.equal(verify.event.amountCents, 500);

const result = await credit.applyWebhookEvent("stripe", verify.event);
assert.equal(result.action, "credited");
assert.ok(result.userId, "user created");
assert.ok(result.apiKeyId, "key created");

const user = await users.getUserByEmail("stripe@example.com");
assert.equal(user.id, result.userId);
const key = await keys.getApiKeyById(result.apiKeyId);
assert.equal(key.userId, user.id);
assert.equal(key.tokenBalance, 10000);
assert.equal(key.planId, plan.id);
assert.equal((await pays.getPaymentsByUser(user.id)).length, 1);

const result2 = await credit.applyWebhookEvent("stripe", verify.event);
assert.equal(result2.action, "ignored");

console.log("OK  Stripe webhook credit self-check passed");
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* WAL lock on Windows */ }
