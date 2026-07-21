const { ROUTER_API_KEY } = require("./config");

const KEYS = (process.env.ROUTER_API_KEYS || ROUTER_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const exhausted = new Map(); // key -> retryAt

const KEY_BASE_MS = 60000;
const KEY_MAX_MS = 3600000;

function getKey() {
  const now = Date.now();
  // Clean expired
  for (const [k, expiry] of exhausted) {
    if (now >= expiry) exhausted.delete(k);
  }

  // Pick first non-exhausted (round-robin: track last used)
  for (const key of KEYS) {
    if (!exhausted.has(key)) return key;
  }

  // All exhausted — return the one that will recover soonest
  let best = null;
  let bestTime = Infinity;
  for (const [key, expiry] of exhausted) {
    if (expiry < bestTime) { best = key; bestTime = expiry; }
  }
  return best || KEYS[0];
}

function markExhausted(key) {
  const prev = exhausted.get(key) || 0;
  const prevDuration = Math.max(prev - Date.now(), 0);
  const duration = Math.min(Math.max(prevDuration * 2, KEY_BASE_MS), KEY_MAX_MS);
  exhausted.set(key, Date.now() + duration);
}

function getKeyCount() { return KEYS.length; }

function getExhaustedCount() { return exhausted.size; }

function resetExhausted() { exhausted.clear(); }

function getAllKeys() { return [...KEYS]; }

module.exports = { getKey, markExhausted, getKeyCount, getExhaustedCount, resetExhausted, getAllKeys };
