const { ROUTER_BASE_URL } = require("./config");
const { getPriorityList, markExhausted } = require("./models");
const cache = require("./cache");
const metrics = require("./metrics");
const keyrotator = require("./keyrotator");
const OPENAI = require("openai");

const client = new OPENAI({ baseURL: ROUTER_BASE_URL, apiKey: keyrotator.getKey() || "dummy_internal_key" });

// Semáforo: max 2 requests simultâneos para não estourar rate limit do upstream
const MAX_CONCURRENT = 2;
let active = 0;
const queue = [];
function acquire() {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) { active++; resolve(); return; }
    queue.push(resolve);
  });
}
function release() {
  active--;
  if (queue.length > 0) { const next = queue.shift(); active++; next(); }
}

function needsVision(messages) {
  return messages.some(m => {
    if (!m.content) return false;
    // OpenAI format: content array with image_url
    if (typeof m.content !== "string" && Array.isArray(m.content)) {
      return m.content.some(c => c.type === "image_url" || c.type === "image");
    }
    return false;
  });
}

async function forward(req, res) {
  const body = req.body || {};
  const msgs = body.messages || [];
  const hasVision = needsVision(msgs);
  const required = hasVision ? { vision: true } : undefined;
  const models = getPriorityList(required);
  if (models.length === 0) return res.status(503).json({ error: "Nenhum modelo disponível" + (hasVision ? " com visão" : "") });

  const path = req.path;
  let lastErr = null;

  for (const model of models) {
    try {
      const ok = await proxyRequest(path, { ...body, model }, req.headers, res);
      if (ok) return;
    } catch (err) {
      lastErr = err;
      const status = err.status || err.responseStatus || 0;
      if ([429, 402, 403, 413].includes(status)) { markExhausted(model); continue; }
      if (status >= 500) continue;
      if (status === 400) { markExhausted(model); continue; }
      if (err.message?.toLowerCase().includes("too large") || err.message?.includes("not supported")) { markExhausted(model); continue; }
      throw err;
    }
  }

  const status = lastErr?.status || lastErr?.responseStatus || 502;
  const msg = lastErr?.message || "Todos os modelos falharam";
  if (!res.headersSent) res.status(status).json({ error: msg });
}

async function proxyRequest(path, body, originalHeaders, res) {
  await acquire();
  const upstreamPath = path.replace(/^\/v1/, "");
  const url = `${ROUTER_BASE_URL.replace(/\/+$/, "")}${upstreamPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      const err = new Error(errText || `HTTP ${upstream.status}`);
      err.status = upstream.status;
      if ([429, 401, 403].includes(upstream.status)) keyrotator.markExhausted(body.api_key);
      throw err;
    }
    if (body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
      release();
    } else {
      const data = await upstream.json();
      res.json(data);
      release();
    }
    return true;
  } catch (err) {
    clearTimeout(timer);
    release();
    if (err.name === "AbortError") { err.status = 504; err.message = "Upstream timeout"; }
    throw err;
  }
}

async function listModels() {
  const url = `${ROUTER_BASE_URL.replace(/\/+$/, "")}/models`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${keyrotator.getKey()}` } });
    const data = await resp.json();
    return data.data || [];
  } catch {
    return getPriorityList().map((id) => ({ id, object: "model", owned_by: "9router-agent" }));
  }
}

// Chama o modelo com fallback entre modelos da fila prioritária
// Retorna { content, model } (texto puro, sem tool_calls)
async function complete(messages, opts = {}) {
  await acquire();
  try {
    const hasVision = needsVision(messages);
    const required = {};
    if (hasVision) required.vision = true;
    if (opts.requiredCapabilities) Object.assign(required, opts.requiredCapabilities);

    // Cache check para respostas idênticas (tool calls = sem cache)
    if (!opts.tools && !hasVision) {
      const cached = cache.getCachedResponse(messages, null);
      if (cached) return cached;
    }

    const models = getPriorityList(Object.keys(required).length > 0 ? required : undefined);
    if (models.length === 0) throw new Error("Nenhum modelo disponível" + (hasVision ? " com visão" : ""));

    for (const model of models) {
      try {
        const url = `${ROUTER_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
        const body = { model, messages, stream: false };
        if (opts.tools) body.tools = opts.tools;
        if (opts.tool_choice) body.tool_choice = opts.tool_choice;

        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) {
          if ([429, 402, 403, 413].includes(res.status)) { markExhausted(model); continue; }
          if (res.status >= 500 || res.status === 400) continue;
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const choice = data.choices?.[0];
        if (!choice) continue;
        let content = choice.message?.content || "";
        content = content.replace(/<parameter name="thinking">[\s\S]*?<\/parameter>/g, "").trim();
        const result = {
          content,
          tool_calls: choice.message?.tool_calls || null,
          model: data.model || model,
        };
        // Cache de respostas sem tool calls (30s TTL)
        if (!result.tool_calls && !opts.tools) {
          cache.setCachedResponse(messages, model, result);
        }
        metrics.track("complete", result.model, 0, 200);
        return result;
      } catch (err) {
        if (err.name === "TimeoutError" || err.message?.includes("timeout")) continue;
        throw err;
      }
    }
    throw new Error("Todos os modelos falharam");
  } finally {
    release();
  }
}

// Pass-through: envia pro upstream com modelo "auto" para roteamento inteligente
async function passThrough(req, res) {
  const upstreamPath = req.path.replace(/^\/v1/, "");
  const url = `${ROUTER_BASE_URL.replace(/\/+$/, "")}${upstreamPath}`;
  const body = { ...req.body, model: "auto" };
  const bodyStr = JSON.stringify(body);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyrotator.getKey()}`,
        "Content-Type": "application/json",
        "anthropic-version": req.headers["anthropic-version"] || "2023-06-01",
      },
      body: bodyStr,
      signal: AbortSignal.timeout(300000),
    });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({ error: errText || `HTTP ${upstream.status}` });
    }
    const ct = upstream.headers.get("content-type") || "";
    if (ct.includes("text/event-stream")) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      const data = await upstream.json();
      res.json(data);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      res.status(504).json({ error: "Upstream timeout" });
    } else {
      throw err;
    }
  }
}

module.exports = { forward, passThrough, listModels, complete };
