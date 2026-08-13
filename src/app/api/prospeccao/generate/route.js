import { NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/prospeccao/store.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NICHE_LABEL = {
  odonto: "clínica odontológica",
  estetica: "clínica de estética",
  vet: "clínica veterinária",
};

// Regras de outreach que definimos: curto, menciona algo real, sem venda dura,
// termina com baixa pressão. Gera 3 saídas (Instagram DM, WhatsApp, follow-up).
function buildPrompt(lead) {
  const nicheLabel = NICHE_LABEL[lead.niche] || "clínica";
  return `Você escreve mensagens de prospecção B2B para o Zenda — um agente de IA que atende o WhatsApp de clínicas 24/7 (responde paciente, qualifica, agenda no Google Calendar).

Quem envia: Lucas, fundador do Zenda (desenvolvedor). Tom: humano, respeitoso, curto, brasileiro. NUNCA parece robô ou spam.

Regras rígidas:
- Menciona algo REAL e específico da clínica (use o contexto abaixo). Se não houver contexto, foca no nicho + cidade.
- Curto. Instagram DM: máx 4 linhas. WhatsApp: máx 5 linhas.
- Não usa emoji na primeira linha. No máximo 1 emoji na mensagem toda.
- Não promete resultado. Não fala preço.
- Termina com pergunta de baixa pressão ("faz sentido eu te mandar um vídeo de 90s?") + saída fácil ("se não for pra vocês, sem problema").
- Assina como "Lucas, do Zenda".
- Português informal-profissional do Brasil.

Dados da clínica:
- Nome: ${lead.name}
- Tipo: ${nicheLabel}
- Cidade: ${lead.city || "—"}
- Contato/dono: ${lead.contactName || "—"}
- Contexto real: ${lead.context || "—"}

Gere um JSON com exatamente estas chaves:
{
  "instagram": "<DM pra mandar no direct do Instagram>",
  "whatsapp": "<mensagem pra mandar no WhatsApp — pode ser um pouco mais completa, começa com saudação do horário>",
  "followup": "<follow-up curto pra enviar 3-4 dias depois se não responder — 2 linhas, sem cobrança>"
}

Responda SOMENTE o JSON, nada mais.`;
}

export async function POST(req) {
  try {
    const { id } = await req.json();
    const lead = getLead(id);
    if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    const baseUrl = process.env.ROUTER_BASE_URL || "http://127.0.0.1:8080/v1";
    const model = process.env.MAXROUTER_DEMO_MODEL || "gemini-2.5-flash";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Você gera mensagens de prospecção. Responde só JSON válido." },
          { role: "user", content: buildPrompt(lead) },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[prospeccao/generate] upstream:", res.status, t.slice(0, 200));
      return NextResponse.json({ error: "Falha ao gerar (agente aquecendo, tenta de novo)" }, { status: 503 });
    }

    const data = await res.json();
    let raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
    // Alguns modelos embrulham em ```json — limpa.
    raw = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Resposta inválida do modelo, tenta de novo" }, { status: 502 });
    }

    const updated = updateLead(id, {
      dmInstagram: parsed.instagram || "",
      dmWhatsapp: parsed.whatsapp || "",
      followup: parsed.followup || "",
      status: lead.status === "novo" ? "gerado" : lead.status,
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    console.error("[prospeccao/generate] fatal:", err.message);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
