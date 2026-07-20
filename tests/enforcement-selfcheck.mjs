// Self-check for access policy + enforcement + atomic usage debit.
// Run: node tests/run-enforcement-selfcheck.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-enf-"));
process.env.DATA_DIR = tmp;

const pol = await import("../src/lib/billing/accessPolicy.js");
const enf = await import("../src/lib/billing/enforcement.js");
const { getAdapter } = await import("../src/lib/db/driver.js");
const users = await import("../src/lib/db/repos/usersRepo.js");
const plans = await import("../src/lib/db/repos/plansRepo.js");
const keys = await import("../src/lib/db/repos/apiKeysRepo.js");
const usage = await import("../src/lib/db/repos/usageRepo.js");

// --- pure policy ---
const base = { id: "k", isActive: true, boundIp: null, tokenBalance: 100, periodEnd: new Date(Date.now()+86400000).toISOString(), planId: "p1" };
assert.equal(pol.evaluateKeyAccess(null).code, 401);
assert.equal(pol.evaluateKeyAccess({ ...base, bannedAt: "x" }).code, 403);
assert.equal(pol.evaluateKeyAccess({ ...base, periodEnd: new Date(Date.now()-1000).toISOString() }).code, 402);
assert.equal(pol.evaluateKeyAccess({ ...base, tokenBalance: 0 }).code, 402);
assert.equal(pol.evaluateKeyAccess(base, { ip: "1.1.1.1" }).action.type, "bind");
assert.equal(pol.evaluateKeyAccess({ ...base, boundIp: "1.1.1.1" }, { ip: "1.1.1.1" }).ok, true);
assert.equal(pol.evaluateKeyAccess({ ...base, boundIp: "1.1.1.1" }, { ip: "9.9.9.9" }).action.type, "strike");
assert.equal(pol.evaluateKeyAccess({ ...base, boundIp: "1.1.1.1" }, { ip: "9.9.9.9", distinctIpsInWindow: 2 }).action.type, "ban");
assert.equal(pol.evaluateKeyAccess({ ...base, boundIp: "1.1.1.1" }, { ip: "9.9.9.9", settings: { ipPolicy: { mode: "off" } } }).ok, true);
assert.equal(pol.isComboAllowed({ allowedCombos: null }, "x"), true);
assert.equal(pol.isComboAllowed({ allowedCombos: ["a"] }, "b"), false);
assert.equal(pol.isComboAllowed({ allowedCombos: ["a"] }, "a"), true);

// --- stateful enforcement + debit (needs DB) ---
await getAdapter();
const u = await users.createUser({ email: "e@e.com" });
const plan = await plans.createPlan({ name: "wk", durationDays: 7, allowedCombos: ["fast"] });
const end = new Date(Date.now()+7*86400000).toISOString();
await keys.createPaidApiKey({ userId: u.id, planId: plan.id, key: "sk-enf-1", periodStart: new Date().toISOString(), periodEnd: end, tokenBalance: 1000, balanceCents: 1000 });

// first use binds ip
let r = await enf.resolveApiKey("sk-enf-1", { ip: "1.2.3.4", settings: {} });
assert.equal(r.ok, true, "first use ok");
assert.equal(r.plan.name, "wk");
assert.equal((await keys.getApiKeyByKey("sk-enf-1")).boundIp, "1.2.3.4", "ip bound");

// same ip ok
r = await enf.resolveApiKey("sk-enf-1", { ip: "1.2.3.4", settings: {} });
assert.equal(r.ok, true);

// different ip, strict mode -> strike (429) then ban at maxStrikes=3
const strict = { ipPolicy: { mode: "strict", maxStrikes: 3, concurrentIps: 99 } };
r = await enf.resolveApiKey("sk-enf-1", { ip: "5.5.5.5", settings: strict });
assert.equal(r.code, 429, "1st mismatch = warning");
r = await enf.resolveApiKey("sk-enf-1", { ip: "5.5.5.5", settings: strict });
assert.equal(r.code, 429, "2nd mismatch = warning");
r = await enf.resolveApiKey("sk-enf-1", { ip: "5.5.5.5", settings: strict });
assert.equal(r.code, 403, "3rd mismatch = ban");
assert.ok((await keys.getApiKeyByKey("sk-enf-1")).bannedAt, "key banned");

// banned key denied even on bound ip
r = await enf.resolveApiKey("sk-enf-1", { ip: "1.2.3.4", settings: {} });
assert.equal(r.code, 403, "banned denied");

// --- atomic debit on usage save ---
const u2 = await users.createUser({ email: "e2@e.com" });
const k2 = await keys.createPaidApiKey({ userId: u2.id, planId: plan.id, key: "sk-enf-2", periodStart: new Date().toISOString(), periodEnd: end, tokenBalance: 1000, balanceCents: 1000 });
await usage.saveRequestUsage({ provider: "openai", model: "gpt-x", apiKey: "sk-enf-2", tokens: { prompt_tokens: 100, completion_tokens: 50 }, endpoint: "/v1/chat" });
const after = await keys.getApiKeyByKey("sk-enf-2");
assert.equal(after.tokenBalance, 850, "debited 150 tokens");
assert.equal(after.userId, u2.id);
// usageHistory stamped with userId
const db = await getAdapter();
const row = db.get(`SELECT userId FROM usageHistory WHERE apiKey = ? ORDER BY id DESC LIMIT 1`, ["sk-enf-2"]);
assert.equal(row.userId, u2.id, "usage row stamped userId");
void k2;

console.log("OK  enforcement + policy + debit self-check passed");
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* WAL lock on Windows */ }
