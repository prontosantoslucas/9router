import { NextResponse } from "next/server";
import { SCENARIOS } from "@/app/maxdemo/scenarios";

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

    // Config via env — fallback: usar o próprio gateway 9router local.
    const baseUrl =
      process.env.MAXROUTER_DEMO_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "http://127.0.0.1:20128/v1";
    const apiKey =
      process.env.MAXROUTER_DEMO_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "sk-demo";
    const model = process.env.MAXROUTER_DEMO_MODEL || "gpt-4o-mini";

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
