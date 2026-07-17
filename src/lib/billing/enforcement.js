// Stateful enforcement wrapper around the pure accessPolicy. Reads the key,
// evaluates access, applies IP side effects (bind/rebind/strike/ban), and
// returns a decision the request handler can turn into an HTTP response.
import { getApiKeyByKey, bindApiKeyIp, rebindApiKeyIp, incrementStrike, banApiKey } from "@/lib/db/repos/apiKeysRepo.js";
import { getPlanById } from "@/lib/db/repos/plansRepo.js";
import { recordKeyIp, distinctIpsSince, recordBanEvent } from "@/lib/db/repos/abuseRepo.js";
import { evaluateKeyAccess, resolveIpPolicy, isComboAllowed } from "./accessPolicy.js";

// Returns:
//   { ok:true, key, plan, apiKeyId }
//   { ok:false, code, reason }
export async function resolveApiKey(rawKey, { ip = null, settings = {} } = {}) {
  if (!rawKey) return { ok: false, code: 401, reason: "Missing API key" };
  const key = await getApiKeyByKey(rawKey);
  if (!key) return { ok: false, code: 401, reason: "Invalid API key" };

  const pol = resolveIpPolicy(settings);
  let distinctIpsInWindow = null;
  if (pol.mode !== "off" && ip && key.boundIp && key.boundIp !== ip) {
    const since = new Date(Date.now() - pol.windowMinutes * 60000).toISOString();
    const ips = await distinctIpsSince(key.id, since);
    const set = new Set(ips);
    set.add(ip);
    distinctIpsInWindow = set.size;
  }

  const decision = evaluateKeyAccess(key, { ip, now: Date.now(), settings, distinctIpsInWindow });
  if (ip) { try { await recordKeyIp(key.id, ip); } catch { /* logging best-effort */ } }

  if (!decision.ok) return { ok: false, code: decision.code, reason: decision.reason };

  // apply IP side effect
  const act = decision.action;
  if (act) {
    if (act.type === "bind") {
      await bindApiKeyIp(key.id, act.ip);
    } else if (act.type === "rebind") {
      await rebindApiKeyIp(key.id, act.ip);
    } else if (act.type === "strike") {
      const strikes = await incrementStrike(key.id);
      if (strikes >= pol.maxStrikes) {
        await banApiKey(key.id, "Too many IP strikes");
        try { await recordBanEvent(key.id, act.ip, "Too many IP strikes"); } catch { /* best-effort */ }
        return { ok: false, code: 403, reason: "Key banned: IP sharing" };
      }
      return { ok: false, code: 429, reason: `IP mismatch (warning ${strikes}/${pol.maxStrikes})` };
    } else if (act.type === "ban") {
      await banApiKey(key.id, act.reason || "Abuse");
      try { await recordBanEvent(key.id, act.ip, act.reason || "Abuse"); } catch { /* best-effort */ }
      return { ok: false, code: 403, reason: `Key banned: ${act.reason || "Abuse"}` };
    }
  }

  const plan = key.planId ? await getPlanById(key.planId) : null;
  return { ok: true, key, plan, apiKeyId: key.id, userId: key.userId || null };
}

export { isComboAllowed };
