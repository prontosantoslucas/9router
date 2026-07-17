// Standalone self-check for the paid multi-tenant billing schema + repos.
// Run: node --loader ./tests/alias-loader.mjs tests/billing-selfcheck.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-billing-"));
process.env.DATA_DIR = tmp;

const { getAdapter } = await import("../src/lib/db/driver.js");
const users = await import("../src/lib/db/repos/usersRepo.js");
const plans = await import("../src/lib/db/repos/plansRepo.js");
const keys = await import("../src/lib/db/repos/apiKeysRepo.js");
const pays = await import("../src/lib/db/repos/paymentsRepo.js");
const subs = await import("../src/lib/db/repos/subscriptionsRepo.js");
const abuse = await import("../src/lib/db/repos/abuseRepo.js");

await getAdapter(); // triggers migration to SCHEMA_VERSION 3

// 1. user create + lookup + idempotent getOrCreate
const u = await users.getOrCreateUserByEmail("Buyer@Example.com", "hash1");
assert.equal(u.email, "buyer@example.com");
const u2 = await users.getOrCreateUserByEmail("buyer@example.com");
assert.equal(u2.id, u.id, "getOrCreate must not duplicate");

// 2. plan create
const plan = await plans.createPlan({ name: "Weekly", priceCents: 500, durationDays: 7, tokenLimit: 1000000, rpm: 60, allowedCombos: ["fast"] });
assert.equal(plan.durationDays, 7);
assert.deepEqual((await plans.getPlanById(plan.id)).allowedCombos, ["fast"]);

// 3. paid key with access window
const now = new Date();
const end = new Date(now.getTime() + 7 * 86400000).toISOString();
const key = await keys.createPaidApiKey({ userId: u.id, planId: plan.id, key: "sk-test-weekly-1", label: "wk", periodStart: now.toISOString(), periodEnd: end, tokenBalance: 1000000, balanceCents: 500 });
assert.equal(key.userId, u.id);
assert.equal(key.tokenBalance, 1000000);
assert.equal(key.boundIp, null);
assert.deepEqual(await keys.getApiKeysByUser(u.id), [await keys.getApiKeyByKey("sk-test-weekly-1")]);

// 4. atomic debit clamps at zero
const d1 = await keys.debitApiKey(key.id, { tokens: 400000, cents: 100 });
assert.equal(d1.tokenBalance, 600000);
assert.equal(d1.balanceCents, 400);
const d2 = await keys.debitApiKey(key.id, { tokens: 999999999, cents: 999999 });
assert.equal(d2.tokenBalance, 0, "token debit must clamp at 0");
assert.equal(d2.balanceCents, 0, "cents debit must clamp at 0");

// 5. ip bind once, then strikes on new ip
assert.equal(await keys.bindApiKeyIp(key.id, "1.1.1.1"), true, "first bind succeeds");
assert.equal(await keys.bindApiKeyIp(key.id, "2.2.2.2"), false, "bind is one-shot while set");
assert.equal((await keys.getApiKeyByKey("sk-test-weekly-1")).boundIp, "1.1.1.1");
await abuse.recordKeyIp(key.id, "1.1.1.1");
await abuse.recordKeyIp(key.id, "2.2.2.2");
const distinct = await abuse.distinctIpsSince(key.id, new Date(Date.now() - 3600000).toISOString());
assert.equal(distinct.length, 2, "should log 2 distinct ips");
const s1 = await keys.incrementStrike(key.id);
const s2 = await keys.incrementStrike(key.id);
assert.equal(s2, 2, "strikes accumulate");

// 6. ban + unban round trip
await keys.banApiKey(key.id, "ip sharing");
let banned = await keys.getApiKeyByKey("sk-test-weekly-1");
assert.ok(banned.bannedAt, "bannedAt set");
assert.equal(banned.isActive, false, "banned key inactive");
await abuse.recordBanEvent(key.id, "2.2.2.2", "ip sharing");
assert.equal((await abuse.getBanEvents(key.id)).length, 1);
await keys.unbanApiKey(key.id);
banned = await keys.getApiKeyByKey("sk-test-weekly-1");
assert.equal(banned.bannedAt, null, "unban clears ban");
assert.equal(banned.strikeCount, 0, "unban resets strikes");

// 7. webhook idempotency
assert.equal(await abuse.isWebhookProcessed("stripe", "evt_1"), false);
assert.equal(await abuse.markWebhookProcessed("stripe", "evt_1", "paid"), true);
assert.equal(await abuse.isWebhookProcessed("stripe", "evt_1"), true);
assert.equal(await abuse.markWebhookProcessed("stripe", "evt_1", "paid"), false, "second mark is no-op");

// 8. payment + unique external, subscription
const pay = await pays.createPayment({ userId: u.id, apiKeyId: key.id, planId: plan.id, gateway: "stripe", externalId: "pi_1", amountCents: 500, status: "paid" });
assert.equal((await pays.getPaymentByExternal("stripe", "pi_1")).id, pay.id);
assert.equal((await pays.getPaymentsByUser(u.id)).length, 1);
const sub = await subs.createSubscription({ userId: u.id, planId: plan.id, gateway: "stripe", externalId: "sub_1", currentPeriodEnd: end });
assert.equal((await subs.getSubscriptionByExternal("stripe", "sub_1")).id, sub.id);
await subs.updateSubscription(sub.id, { status: "canceled" });
assert.equal((await subs.getSubscriptionByExternal("stripe", "sub_1")).status, "canceled");

// 9. extend key (renewal): clears ban/revoke, tops up, moves periodEnd
const newEnd = new Date(Date.now() + 30 * 86400000).toISOString();
const ext = await keys.extendApiKey(key.id, { periodEnd: newEnd, addTokenBalance: 500000, addBalanceCents: 300, planId: plan.id });
assert.equal(ext.periodEnd, newEnd);
assert.equal(ext.tokenBalance, 500000, "topped up from 0");
assert.equal(ext.balanceCents, 300);
assert.equal(ext.isActive, true);

console.log("OK  billing schema + repos self-check passed");
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* WAL lock on Windows; temp dir is harmless */ }
