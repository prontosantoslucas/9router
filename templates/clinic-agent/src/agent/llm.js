import OpenAI from "openai";
import { config } from "../config.js";
import { buildSystemPrompt } from "./prompt.js";
import { TOOL_DEFS, executeTool } from "./tools.js";
import { addMessage, getMessages } from "../db/db.js";
import { evaluateForNote } from "../notes/autoNote.js";

const client = new OpenAI({
  baseURL: config.router.baseUrl,
  apiKey: config.router.apiKey,
});

const MAX_TOOL_ITERATIONS = 4;
const HISTORY_TURNS = 12;

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

  if (!finalText) finalText = "Desculpa, tive um problema aqui. Pode repetir?";

  addMessage({ chatId, role: "assistant", content: finalText });

  // Fire-and-forget: avalia se cabe uma nota automática do que o paciente disse
  evaluateForNote(chatId, userMessage).catch((e) =>
    console.warn("[autoNote] falhou:", e.message)
  );

  return { reply: finalText, iterations, toolsUsed };
}
