import crypto from "node:crypto";
import { config } from "./config.js";

const COOKIE_NAME = "zenda_session";
const SESSION_SECRET = config.security.dashboardPassword || "default-clinic-secret-key-2026";

/**
 * Assina um token de sessão com expiração.
 */
export function createSessionToken(expiresInHours = 24) {
  const expiresAt = Date.now() + expiresInHours * 3600 * 1000;
  const payload = `admin:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

/**
 * Valida o token de sessão.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [role, expiresAtStr, hmac] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const payload = `${role}:${expiresAtStr}`;
  const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

/**
 * Autentica a senha fornecida pelo formulário contra a DASHBOARD_PASSWORD.
 */
export function authenticatePassword(password) {
  if (!password || typeof password !== "string") return false;
  const expected = config.security.dashboardPassword;
  
  try {
    const pBuf = Buffer.from(password.trim());
    const eBuf = Buffer.from(expected.trim());
    if (pBuf.length !== eBuf.length) return false;
    return crypto.timingSafeEqual(pBuf, eBuf);
  } catch {
    return false;
  }
}

/**
 * Middleware para proteger rotas do painel (/dashboard e /setup).
 */
export function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME] || req.headers.authorization?.replace("Bearer ", "");

  if (verifySessionToken(token)) {
    return next();
  }

  // Se for requisição aceitando HTML, redireciona para a página de login
  if (req.headers.accept?.includes("text/html")) {
    return res.status(302).redirect("/login");
  }

  return res.status(401).json({ error: "Não autorizado — faça login no painel." });
}

/**
 * Parser simples de cookies para evitar dependência externa extra.
 */
export function parseCookies(cookieHeader = "") {
  const list = {};
  if (!cookieHeader) return list;
  
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts.shift().trim();
    const value = parts.join("=").trim();
    if (name && value) {
      list[name] = decodeURIComponent(value);
    }
  });
  return list;
}

export { COOKIE_NAME };
