const crypto = require("crypto");

const store = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// Gera hash SHA-256 a partir de uma string
function hash(input) {
  return crypto.createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex").slice(0, 16);
}

// Gera chave de cache para uma requisição de chat
function chatKey(messages, model) {
  return hash({ m: messages.slice(-4), model }); // últimas 4 msg + modelo
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  // Não cachear resultados muito grandes (> 50KB)
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str.length > 50000) return;
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function wrap(key, ttlMs, fetcher) {
  const cached = get(key);
  if (cached !== null) return cached;
  const value = await fetcher();
  set(key, value, ttlMs);
  return value;
}

function clear() {
  store.clear();
}

function stats() {
  const now = Date.now();
  let valid = 0;
  for (const v of store.values()) {
    if (now <= v.expiresAt) valid++;
  }
  return { total: store.size, valid };
}

// Cache de respostas do modelo: usa hash das mensagens como chave
function getCachedResponse(messages, model) {
  return get("chat:" + chatKey(messages, model));
}

function setCachedResponse(messages, model, response, ttlMs = 30000) {
  set("chat:" + chatKey(messages, model), response, ttlMs);
}

module.exports = { get, set, wrap, clear, stats, hash, chatKey, getCachedResponse, setCachedResponse };
