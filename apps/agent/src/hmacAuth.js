// Middleware HMAC — valida X-9R-Agent-Auth injetado pelo proxy do Maxrouter.
// Formato do header: "<timestamp>:<hex_hmac_sha256>"
// Payload assinado: `maxrouter:<timestamp>`
// Janela válida: ±30 segundos (proteção contra replay).
// Segredo: AGENT_INTERNAL_SECRET — obrigatório em produção.

const crypto = require("crypto");

const HEADER = "x-9r-agent-auth";
const WINDOW_MS = 30 * 1000;

/**
 * Extrai e valida o header HMAC. Retorna { ok: true } ou { ok: false, reason }.
 * Função pura — testável sem Express.
 */
function verifyHmacHeader(headerValue, secret, now = Date.now()) {
  if (!secret) return { ok: false, reason: "server_secret_missing" };
  if (!headerValue) return { ok: false, reason: "header_missing" };

  const parts = String(headerValue).split(":");
  if (parts.length !== 2) return { ok: false, reason: "header_malformed" };

  const [timestampStr, sigHex] = parts;
  const ts = Number(timestampStr);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(now - ts) > WINDOW_MS) return { ok: false, reason: "expired" };

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`maxrouter:${timestampStr}`)
    .digest("hex");

  // Comparação constant-time para evitar timing attacks
  let a, b;
  try {
    a = Buffer.from(sigHex, "hex");
    b = Buffer.from(expected, "hex");
  } catch {
    return { ok: false, reason: "invalid_hex" };
  }
  if (a.length !== b.length) return { ok: false, reason: "length_mismatch" };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "hmac_mismatch" };

  return { ok: true };
}

/**
 * Constrói um header HMAC — útil para testes ou clientes internos.
 */
function buildHmacHeader(secret, timestamp = Date.now()) {
  const ts = String(timestamp);
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`maxrouter:${ts}`)
    .digest("hex");
  return `${ts}:${sig}`;
}

/**
 * Middleware Express.
 * @param {object} opts
 * @param {string} opts.secret — AGENT_INTERNAL_SECRET
 * @param {string[]} opts.skipPrefixes — paths (prefix match) que passam sem HMAC
 *   Ex.: ["/health", "/api/agent/webhook/evolution"]
 */
function createHmacMiddleware({ secret, skipPrefixes = [] } = {}) {
  return function hmacMiddleware(req, res, next) {
    // Rotas explicitamente públicas passam sem validação
    for (const prefix of skipPrefixes) {
      if (req.path === prefix || req.path.startsWith(`${prefix}/`)) return next();
    }

    const header = req.headers[HEADER];
    const result = verifyHmacHeader(header, secret);
    if (!result.ok) {
      return res.status(401).json({
        error: "HMAC auth failed",
        reason: result.reason,
      });
    }
    next();
  };
}

module.exports = {
  HEADER,
  WINDOW_MS,
  verifyHmacHeader,
  buildHmacHeader,
  createHmacMiddleware,
};
