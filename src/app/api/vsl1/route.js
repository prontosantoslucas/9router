import { NextResponse } from "next/server";
import { SCENARIOS } from "@/app/vsl1/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit em memória — protege da demo pública sem infra extra.
// Fingerprint = IP; janela = 20 mensagens / 5 min.
const RATE = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 20;

function rateCheck(ip) {
  const now = Date.now();
  const bucket = RATE.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    RATE.set(ip, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "anon";
}

export async function POST(req) {
  try {
    const body = await req.json();
    const scenarioId = body.scenario || "odonto";
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) {
      return NextResponse.json({ error: "Cenário inválido" }, { status: 400 });
    }

    const clientMessages = Array.isArray(body.messages) ? body.messages : [];
    if (!clientMessages.length) {
      return NextResponse.json({ error: "Sem mensagens" }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (!rateCheck(ip)) {
      return NextResponse.json(
        { error: "Muitas mensagens seguidas. Aguarde 1 minuto." },
        { status: 429 }
      );
    }

    // Usa o MESMO gateway 9router que o webchat usa por baixo — chama
    // /v1/chat/completions no loopback local (sem API key = modo local
    // do handleChat, roteando pelos providers já configurados no dashboard).
    // ROUTER_BASE_URL é setada pelo runner-start.sh: http://127.0.0.1:${PORT}/v1
    //
    // model: "auto" ativa o combo (30 modelos em fallback) — igual webchat
    // e proxy do agent. Se um provider falha (rate limit, quota), passa
    // pro próximo em vez de erro imediato.
    const baseUrl =
      process.env.ROUTER_BASE_URL ||
      process.env.MAXROUTER_DEMO_BASE_URL ||
      "http://127.0.0.1:8080/v1";
    // Modelo específico (não "auto") — combo default tenta providers que
    // podem não estar cadastrados (ex: openai). Gemini 2.5 Flash roda no
    // OAuth do Gemini CLI (free tier Google) — sem custo por request e
    // testado 200 direto no /v1/chat/completions deste deploy. Deepseek
    // direto foi tentado antes mas a conta está com saldo 0 (402
    // Insufficient Balance). Se um dia trocar, override via env.
    const model = process.env.MAXROUTER_DEMO_MODEL || "gemini-2.5-flash";

    const messages = [
      { role: "system", content: scenario.systemPrompt },
      // Só as últimas 12 mensagens do cliente — segura contexto barato.
      ...clientMessages.slice(-12).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 800),
      })),
    ];

    const upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 200,
        stream: false,
      }),
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      console.error("[maxrouter demo] upstream error:", upstreamRes.status, errText);
      return NextResponse.json(
        {
          error:
            "O agente está aquecendo. Tenta de novo em alguns segundos.",
        },
        { status: 503 }
      );
    }

    const data = await upstreamRes.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Desculpa, tive um problema aqui. Pode repetir?";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[maxrouter demo] fatal:", err.message);
    return NextResponse.json(
      { error: "Erro interno. Tenta de novo em instantes." },
      { status: 500 }
    );
  }
}
