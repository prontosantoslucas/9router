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

function getScenarioDemoReply(scenarioId, userMessage) {
  const msg = String(userMessage || "").toLowerCase();
  
  if (scenarioId === "odonto") {
    if (msg.includes("preço") || msg.includes("valor") || msg.includes("quanto") || msg.includes("custa")) {
      return "Para clareamento e procedimentos ortodônticos, os valores variam de acordo com a avaliação clínica. Nossa primeira consulta de avaliação é gratuita! Gostaria de agendar um horário esta semana?";
    }
    if (msg.includes("bradesco") || msg.includes("convênio") || msg.includes("plano") || msg.includes("amil") || msg.includes("sulamérica")) {
      return "Aceitamos Bradesco Dental, Amil Dental e SulAmérica! Também facilitamos em até 12x no cartão para procedimentos particulares. Quer que eu veja uma vaga para você?";
    }
    if (msg.includes("horário") || msg.includes("agendar") || msg.includes("vaga") || msg.includes("consulta") || msg.includes("amanhã") || msg.includes("semana")) {
      return "Temos horários disponíveis de segunda a sexta (8h-19h) e aos sábados (8h-13h). Qual período fica melhor para você: manhã ou tarde?";
    }
    return "Com certeza! Na Clínica Sorriso Vivo, cuidamos da sua saúde bucal com equipamentos modernos e atendimento humanizado. Gostaria de agendar uma avaliação gratuita com nossos especialistas?";
  }

  if (scenarioId === "estetica") {
    if (msg.includes("lábio") || msg.includes("labio") || msg.includes("preencher") || msg.includes("botox") || msg.includes("harmonização")) {
      return "O preenchimento labial e harmonização são feitos com nossa biomédica especializada usando ácido hialurônico de alta qualidade. O resultado fica super natural! Quer agendar uma avaliação?";
    }
    if (msg.includes("preço") || msg.includes("valor") || msg.includes("quanto") || msg.includes("avaliação")) {
      return "Nossa avaliação estética personalizada custa R$ 150, que são 100% revertidos no valor do seu primeiro procedimento! Qual dia você prefere vir?";
    }
    return "Na Clínica Beleza Real na Barra da Tijuca, oferecemos tratamentos estéticos avançados. Posso agendar sua avaliação inicial para esta semana?";
  }

  if (scenarioId === "vet") {
    if (msg.includes("emergência") || msg.includes("urgência") || msg.includes("sangrando") || msg.includes("grave") || msg.includes("atropelado")) {
      return "Atenção: como somos uma clínica 24 horas, em casos graves e emergências você pode trazer o seu pet IMEDIATAMENTE sem agendar. Nosso endereço é Av. Rio das Pedras, 979!";
    }
    if (msg.includes("preço") || msg.includes("quanto") || msg.includes("valor") || msg.includes("consulta")) {
      return "Nossa consulta clínica com veterinário especialista atende cães e gatos com toda dedicação. Aceitamos os planos Petlove Saúde, Pet Center e Sepy! Quer marcar um horário?";
    }
    return "Na PetVida 24h, cuidamos do seu pet com todo carinho e estrutura veterinária completa. Qual o nome do seu pet e qual horário você prefere?";
  }

  return "Olá! Sou o assistente virtual do atendimento. Como posso te ajudar hoje? Posso te explicar nossos serviços ou verificar horários para agendamento!";
}

export async function POST(req) {
  let scenarioId = "odonto";
  let lastUserMsg = "";

  try {
    const body = await req.json();
    scenarioId = body.scenario || "odonto";
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) {
      return NextResponse.json({ error: "Cenário inválido" }, { status: 400 });
    }

    const clientMessages = Array.isArray(body.messages) ? body.messages : [];
    if (!clientMessages.length) {
      return NextResponse.json({ error: "Sem mensagens" }, { status: 400 });
    }

    lastUserMsg = clientMessages.filter(m => m.role === "user").slice(-1)[0]?.content || "";

    const ip = getClientIp(req);
    if (!rateCheck(ip)) {
      return NextResponse.json(
        { error: "Muitas mensagens seguidas. Aguarde 1 minuto." },
        { status: 429 }
      );
    }

    const baseUrl =
      process.env.ROUTER_BASE_URL ||
      process.env.MAXROUTER_DEMO_BASE_URL ||
      "http://127.0.0.1:8080/v1";

    const model = process.env.MAXROUTER_DEMO_MODEL || "gemini-2.5-flash";

    const messages = [
      { role: "system", content: scenario.systemPrompt },
      ...clientMessages.slice(-12).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 800),
      })),
    ];

    try {
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
        const errText = await upstreamRes.text().catch(() => "");
        console.error("[maxrouter demo] upstream error:", upstreamRes.status, errText);
        const reply = getScenarioDemoReply(scenarioId, lastUserMsg);
        return NextResponse.json({ reply });
      }

      const rawText = await upstreamRes.text();
      let data = {};
      try { data = JSON.parse(rawText); } catch {}

      const reply =
        data?.choices?.[0]?.message?.content?.trim() ||
        getScenarioDemoReply(scenarioId, lastUserMsg);

      return NextResponse.json({ reply });
    } catch (fetchErr) {
      console.warn("[maxrouter demo] upstream fetch failed, using fallback:", fetchErr.message);
      const reply = getScenarioDemoReply(scenarioId, lastUserMsg);
      return NextResponse.json({ reply });
    }
  } catch (err) {
    console.error("[maxrouter demo] fatal:", err.message);
    const reply = getScenarioDemoReply(scenarioId, lastUserMsg);
    return NextResponse.json({ reply });
  }
}
