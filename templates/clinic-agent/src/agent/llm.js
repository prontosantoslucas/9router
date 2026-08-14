import OpenAI from "openai";
import { config } from "../config.js";
import { buildSystemPrompt } from "./prompt.js";
import { TOOL_DEFS, executeTool } from "./tools.js";
import { addMessage, getMessages, getRuntimeConfig, getEffectiveAgentMode, logWorkerEvent } from "../db/db.js";
import { evaluateForNote } from "../notes/autoNote.js";

const MAX_TOOL_ITERATIONS = 4;
const HISTORY_TURNS = 12;

function getEffectiveApiKey() {
  const runtimeCfg = getRuntimeConfig();
  const token = runtimeCfg.maxrouterToken || config.router.apiKey || process.env.ROUTER_API_KEY;
  if (!token || token.trim() === "" || token === "test_router_api_key") {
    return null;
  }
  return token.trim();
}

/**
 * Processa uma mensagem do paciente e retorna a resposta do agente.
 * Persiste tudo no DB. Executa tools em loop até chegar em resposta textual.
 *
 * @param {string} chatId
 * @param {string} userMessage
 * @returns {Promise<{reply: string, iterations: number, toolsUsed: string[]}>}
 */
export async function respondToMessage(chatId, userMessage) {
  addMessage({ chatId, role: "user", content: userMessage });

  const history = getMessages(chatId, { limit: HISTORY_TURNS });
  const apiKey = getEffectiveApiKey();

  // Exigência de Token MaxRouter Único
  if (!apiKey && getEffectiveAgentMode() === "prod") {
    const noTokenMsg = "⚠️ O Agente Zenda necessita do seu Token de API do MaxRouter para operar a Inteligência Artificial. Por favor, cadastre seu token único em Configurações no painel da clínica.";
    addMessage({ chatId, role: "assistant", content: noTokenMsg });
    return { reply: noTokenMsg, iterations: 0, toolsUsed: [] };
  }

  const client = new OpenAI({
    baseURL: config.router.baseUrl,
    apiKey: apiKey || config.router.apiKey || "sk-demo-local-key",
  });

  const messages = [
    { role: "system", content: buildSystemPrompt(chatId) },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_name ? { tool_calls: [{ id: `tc_${m.id}`, type: "function", function: { name: m.tool_name, arguments: m.tool_args || "{}" } }] } : {}),
    })).filter(m => ["system","user","assistant","tool"].includes(m.role)),
  ];

  const toolsUsed = [];
  let iterations = 0;
  let finalText = null;

  try {
    while (iterations < MAX_TOOL_ITERATIONS && !finalText) {
      iterations++;

      const completion = await client.chat.completions.create({
        model: config.router.model,
        messages,
        tools: TOOL_DEFS,
        tool_choice: "auto",
        temperature: 0.6,
        max_tokens: 400,
      });

      const choice = completion.choices?.[0]?.message;
      if (!choice) throw new Error("no choice from LLM");

      if (choice.tool_calls?.length) {
        messages.push(choice);
        for (const tc of choice.tool_calls) {
          toolsUsed.push(tc.function.name);
          const result = await executeTool(chatId, tc.function.name, tc.function.arguments || "{}");
          addMessage({
            chatId,
            role: "tool",
            content: JSON.stringify(result),
            toolName: tc.function.name,
            toolArgs: tc.function.arguments,
            toolResult: result,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = choice.content?.trim() || "";
    }
  } catch (err) {
    console.warn(`[llm] Erro ao chamar o provedor de LLM (${err.status || err.message}):`, err.message);
    
    // Resposta enlatada SÓ fora de produção. Em prod — inclusive numa demo ao
    // vivo pra prospect — servir script disfarçado de IA é pior que assumir a
    // falha: o paciente recebe algo que não corresponde ao que ele perguntou e
    // ninguém fica sabendo que o LLM caiu.
    if (getEffectiveAgentMode() !== "prod") {
      finalText = getDemoResponse(userMessage, config.clinic.name, history);
    } else {
      logWorkerEvent({
        kind: "llm_failure",
        chatId,
        status: "failed",
        payload: { error: err.message, status: err.status || null },
      });
      finalText = "Desculpa, tive um problema de conexão com o sistema de atendimento. Pode tentar de novo em instantes?";
    }
  }

  if (!finalText) {
    // Mesma regra: nunca inventa resposta enlatada em produção.
    if (getEffectiveAgentMode() !== "prod") {
      finalText = getDemoResponse(userMessage, config.clinic.name, history);
    } else {
      logWorkerEvent({
        kind: "llm_failure",
        chatId,
        status: "failed",
        payload: { error: "resposta vazia do modelo" },
      });
      finalText = "Desculpa, não consegui processar sua mensagem agora. Pode repetir?";
    }
  }

  addMessage({ chatId, role: "assistant", content: finalText });

  // Fire-and-forget: avalia se cabe uma nota automática do que o paciente disse
  evaluateForNote(chatId, userMessage).catch((e) =>
    console.warn("[autoNote] falhou:", e.message)
  );

  return { reply: finalText, iterations, toolsUsed };
}

/**
 * Resposta de demonstração e fallback com motor completo de intenções e contexto de conversa (history).
 */
function getDemoResponse(userMsg = "", clinicName = "Clínica", history = []) {
  const msg = userMsg.toLowerCase().trim();

  // 1. Resolução baseada no histórico (Context Resolver)
  const lastAssistantMsg = [...history]
    .reverse()
    .find((m) => m.role === "assistant")?.content?.toLowerCase() || "";

  // Se o assistente perguntou sobre período/horário na mensagem anterior
  if (
    lastAssistantMsg.includes("manhã ou tarde") ||
    lastAssistantMsg.includes("qual o melhor período") ||
    lastAssistantMsg.includes("qual dia")
  ) {
    if (
      msg.includes("manhã") ||
      msg.includes("tarde") ||
      msg.includes("noite") ||
      msg.includes("hoje") ||
      msg.includes("amanhã") ||
      msg.includes("segunda") ||
      msg.includes("terça") ||
      msg.includes("quarta") ||
      msg.includes("quinta") ||
      msg.includes("sexta") ||
      msg.includes("sábado")
    ) {
      return `Perfeito! Anotei sua preferência para o período/dia (${userMsg}). Para finalizarmos seu agendamento na ${clinicName}, por favor me informe o seu nome completo e um telefone de contato!`;
    }
  }

  // Se o assistente perguntou sobre confirmação de dados/nome
  if (lastAssistantMsg.includes("nome completo") || lastAssistantMsg.includes("telefone de contato")) {
    return `Prontinho! Agendamento pré-reservado com sucesso na ${clinicName}. Nossa recepção enviará a confirmação completa no seu WhatsApp em instantes. Posso te ajudar com mais alguma coisa?`;
  }

  // 2. Sintomas / Urgência / Emergência
  if (
    msg.includes("dor") ||
    msg.includes("doendo") ||
    msg.includes("urgência") ||
    msg.includes("urgencia") ||
    msg.includes("emergência") ||
    msg.includes("emergencia") ||
    msg.includes("sangrando") ||
    msg.includes("quebrou") ||
    msg.includes("febre") ||
    msg.includes("infecção")
  ) {
    return `Atenção: se você está com dor forte ou necessidade de emergência, nossa equipe na ${clinicName} prioriza seu atendimento! Por favor, nos envie seu telefone direto para retorno imediato ou venha até nossa clínica. Quer que eu avise a recepção agora?`;
  }

  // 3. Convênios / Planos de Saúde / Aceitação
  if (
    msg.includes("plano") ||
    msg.includes("convênio") ||
    msg.includes("convenio") ||
    msg.includes("unimed") ||
    msg.includes("amil") ||
    msg.includes("bradesco") ||
    msg.includes("sulamerica") ||
    msg.includes("notredame") ||
    msg.includes("porto seguro") ||
    msg.includes("geap") ||
    msg.includes("cassi") ||
    msg.includes("reembolso") ||
    msg.includes("aceita")
  ) {
    return `Trabalhamos com diversos convênios e também com a modalidade de reembolso facilitado na ${clinicName}, além de condições especiais para atendimentos particulares. Qual é o seu convênio para eu verificar a cobertura exata para você?`;
  }

  // 4. Serviços / Tratamentos / Especialidades
  if (
    msg.includes("serviço") ||
    msg.includes("servico") ||
    msg.includes("oferece") ||
    msg.includes("oferecem") ||
    msg.includes("fazem") ||
    msg.includes("tratamento") ||
    msg.includes("procedimento") ||
    msg.includes("especialidade") ||
    msg.includes("exame") ||
    msg.includes("limpeza") ||
    msg.includes("botox") ||
    msg.includes("aparelho") ||
    msg.includes("ortodontia") ||
    msg.includes("implante")
  ) {
    return `Na ${clinicName}, oferecemos consultas especializadas, avaliações clínicas completas, exames preventivos e tratamentos personalizados. Gostaria de saber mais sobre algum tratamento específico ou prefere agendar uma avaliação? 😊`;
  }

  // 5. Agendamento / Marcação / Vagas
  if (
    msg.includes("agendar") ||
    msg.includes("consulta") ||
    msg.includes("horário") ||
    msg.includes("horario") ||
    msg.includes("vaga") ||
    msg.includes("marcar") ||
    msg.includes("atendimento")
  ) {
    return `Com certeza! Temos horários disponíveis para esta semana na ${clinicName}. Qual o melhor período para você: manhã ou tarde?`;
  }

  // 6. Preços / Valores / Formas de Pagamento
  if (
    msg.includes("preço") ||
    msg.includes("preco") ||
    msg.includes("valor") ||
    msg.includes("quanto") ||
    msg.includes("custo") ||
    msg.includes("orçamento") ||
    msg.includes("orcamento") ||
    msg.includes("tabela") ||
    msg.includes("pix") ||
    msg.includes("cartão") ||
    msg.includes("parcela")
  ) {
    return `Na ${clinicName}, oferecemos facilidades de pagamento no PIX, cartão parcelado e condições acessíveis. Os valores exatos dependem da avaliação clínica inicial. Vamos agendar sua consulta de avaliação?`;
  }

  // 7. Horário de Funcionamento
  if (
    msg.includes("funcionamento") ||
    msg.includes("que horas") ||
    msg.includes("abre") ||
    msg.includes("fecha") ||
    msg.includes("sábado") ||
    msg.includes("sabado") ||
    msg.includes("domingo") ||
    msg.includes("feriado")
  ) {
    return `A ${clinicName} atende de Segunda a Sexta-feira das 08h às 19h e aos Sábado das 08h às 13h. Qual dia e horário fica melhor para o seu atendimento?`;
  }

  // 8. Endereço / Localização / Estacionamento
  if (
    msg.includes("onde") ||
    msg.includes("endereço") ||
    msg.includes("endereco") ||
    msg.includes("local") ||
    msg.includes("fica") ||
    msg.includes("bairro") ||
    msg.includes("rua") ||
    msg.includes("estacionamento") ||
    msg.includes("chegar")
  ) {
    return `A ${clinicName} está localizada em ponto de fácil acesso, com estrutura completa e estacionamento no local. Deseja que eu agende uma consulta para você nos fazer uma visita?`;
  }

  // 9. Médicos / Equipe / Especialistas
  if (
    msg.includes("médico") ||
    msg.includes("medico") ||
    msg.includes("médica") ||
    msg.includes("medica") ||
    msg.includes("doutor") ||
    msg.includes("doutora") ||
    msg.includes("dr") ||
    msg.includes("dra") ||
    msg.includes("especialista") ||
    msg.includes("equipe") ||
    msg.includes("profissional")
  ) {
    return `Nossa equipe na ${clinicName} é formada por especialistas altamente qualificados e dedicados. Você procura atendimento com algum profissional específico ou prefere a primeira vaga disponível?`;
  }

  // 10. Cancelamento / Reagendamento
  if (
    msg.includes("cancelar") ||
    msg.includes("desmarcar") ||
    msg.includes("remarcar") ||
    msg.includes("mudar") ||
    msg.includes("não vou") ||
    msg.includes("nao vou") ||
    msg.includes("adiar")
  ) {
    return `Sem problemas! Podemos remarcar seu atendimento na ${clinicName} para uma data mais conveniente. Qual o novo dia ou período (manhã/tarde) que fica melhor para você?`;
  }

  // 11. Afirmativas / Confirmações (ex: "sim", "claro", "com certeza", "por favor")
  if (
    msg === "sim" ||
    msg.startsWith("sim,") ||
    msg.startsWith("sim ") ||
    msg.includes("claro") ||
    msg.includes("quero") ||
    msg.includes("pode ser") ||
    msg.includes("por favor")
  ) {
    return `Perfeito! Com certeza. Na ${clinicName}, estamos prontos para te atender. Qual o melhor dia e período (manhã ou tarde) para agendarmos sua consulta?`;
  }

  // 12. Negação ou Agradecimento ("não", "obrigado", "valeu")
  if (
    msg === "não" ||
    msg === "nao" ||
    msg.includes("obrigado") ||
    msg.includes("obrigada") ||
    msg.includes("valeu") ||
    msg.includes("agora não")
  ) {
    return `Por nada! A equipe da ${clinicName} permanece à sua total disposição sempre que precisar. Tenha um excelente dia! 👋`;
  }

  // 13. Saudações puras
  if (
    msg.includes("oi") ||
    msg.includes("olá") ||
    msg.includes("ola") ||
    msg.includes("bom dia") ||
    msg.includes("boa tarde") ||
    msg.includes("boa noite") ||
    msg.includes("tudo bem")
  ) {
    return `Olá! Seja muito bem-vindo(a) à ${clinicName}. Como posso te ajudar hoje? Posso agendar sua consulta ou esclarecer dúvidas sobre nossos atendimentos! 😊`;
  }

  // 14. Resposta padrão inteligente
  return `Com certeza! Na ${clinicName}, estamos à disposição para agendar sua consulta, tirar dúvidas sobre tratamentos e te atender com excelência. Como você prefere prosseguir?`;
}
