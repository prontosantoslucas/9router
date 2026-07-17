// Pure access-policy decisions for paid API keys. No IO — fully unit-testable.
// The caller performs the side effects (bind ip, strike, ban) based on `action`.

export const DEFAULT_IP_POLICY = {
  mode: "sticky",       // "strict" | "sticky" | "off"
  stickyHours: 24,      // in sticky mode, allow rebind after this idle window
  maxStrikes: 3,        // ban after this many strikes
  concurrentIps: 2,     // >= this many distinct IPs in `windowMinutes` => abuse
  windowMinutes: 10,
};

export function resolveIpPolicy(settings) {
  const p = (settings && settings.ipPolicy) || {};
  return { ...DEFAULT_IP_POLICY, ...p };
}

// key: row from apiKeysRepo (may have billing fields). now: ms epoch.
// Returns { ok } or { ok:false, code, reason }. When ok, may include
// `action` describing an IP-related side effect for the caller to apply.
export function evaluateKeyAccess(key, { ip = null, now = Date.now(), settings = {}, distinctIpsInWindow = null } = {}) {
  if (!key) return deny(401, "Invalid API key");
  if (key.bannedAt) return deny(403, key.banReason ? `Key banned: ${key.banReason}` : "Key banned");
  if (key.revokedAt) return deny(403, "Key revoked");
  if (key.isActive === false) return deny(403, "Key inactive");

  // access window
  if (key.periodEnd) {
    const end = Date.parse(key.periodEnd);
    if (Number.isFinite(end) && now > end) return deny(402, "Subscription expired");
  }

  // balance / quota (only enforce when the field is set)
  if (key.tokenBalance != null && key.tokenBalance <= 0) return deny(402, "Token quota exhausted");
  if (key.balanceCents != null && key.periodEnd == null && key.balanceCents <= 0 && key.tokenBalance == null) {
    return deny(402, "Balance exhausted");
  }

  // ip binding
  const pol = resolveIpPolicy(settings);
  if (pol.mode !== "off" && ip) {
    if (!key.boundIp) {
      return allow({ type: "bind", ip });
    }
    if (key.boundIp !== ip) {
      // concurrency signal => hard abuse
      if (distinctIpsInWindow != null && distinctIpsInWindow >= pol.concurrentIps) {
        return allow({ type: "ban", ip, reason: "Concurrent IP sharing" });
      }
      if (pol.mode === "strict") {
        return allow({ type: "strike", ip });
      }
      // sticky: allow rebind only if the bound IP has been idle long enough
      const lastSeen = key.boundIpLastSeen ? Date.parse(key.boundIpLastSeen) : null;
      const idleOk = lastSeen != null && now - lastSeen >= pol.stickyHours * 3600000;
      if (idleOk) return allow({ type: "rebind", ip });
      return allow({ type: "strike", ip });
    }
  }
  return allow(null);
}

// Is a combo/model permitted by this plan? plan.allowedCombos null => all allowed.
export function isComboAllowed(plan, comboName) {
  if (!plan || plan.allowedCombos == null) return true;
  if (!Array.isArray(plan.allowedCombos)) return true;
  if (plan.allowedCombos.length === 0) return true;
  return plan.allowedCombos.includes(comboName);
}

function allow(action) { return { ok: true, action: action || null }; }
function deny(code, reason) { return { ok: false, code, reason }; }
