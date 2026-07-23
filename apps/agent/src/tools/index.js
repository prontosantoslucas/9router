const cache = require("../cache");
const scheduler = require("../scheduler");
const superbrain = require("../superbrain");
const memoryStore = require("../memoryStore");
const { ROUTER_BASE_URL, PHONE_AGENT_URL, PHONE_TOKEN, BOT_TOKEN } = require("../config");
const keyrotator = require("../keyrotator");
const notion = require("../notion");
const fs = require("fs");
const path = require("path");
const { Telegraf } = require("telegraf");
const { execSync } = require("child_process");

const ALLOWED_DIRS = [process.cwd(), path.join(process.cwd(), "data")];

function isPathSafe(target) {
  try {
    return ALLOWED_DIRS.some((d) => path.resolve(target).startsWith(path.resolve(d)));
  } catch { return false; }
}

const TOOLS = {
  web_search: {
    name: "web_search",
    desc: "Busca informações na web. Retorna resultados com título, URL e snippet.",
    args: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca" },
      },
      required: ["query"],
    },
    run: async (args) => {
      const url = `${ROUTER_BASE_URL.replace(/\/v1$/, "")}/v1/search`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tavily", query: String(args.query), max_results: 5 }),
      });
      if (!res.ok) return `Erro na busca: ${res.status}`;
      const data = await res.json();
      return (data.results || []).map((r, i) =>
        `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet || ""}`
      ).join("\n\n") || "Nenhum resultado encontrado.";
    },
  },
  web_fetch: {
    name: "web_fetch",
    desc: "Lê o conteúdo de uma URL e retorna em markdown.",
    args: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL completa para buscar" },
      },
      required: ["url"],
    },
    run: async (args) => {
      const url = `${ROUTER_BASE_URL.replace(/\/v1$/, "")}/v1/web/fetch`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "jina-reader", url: String(args.url), format: "markdown", max_characters: 8000 }),
      });
      if (!res.ok) return `Erro ao buscar URL: ${res.status}`;
      const data = await res.json();
      return data.content?.text || "Conteúdo não disponível.";
    },
  },
  github_api: {
    name: "github_api",
    desc: "Faz requisição autenticada à API do GitHub. Usa o token configurado no webchat.",
    args: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho da API do GitHub (ex: /repos/nortelucas/9router/contents/README.md, /user/repos, /repos/nortelucas/9router)" },
        method: { type: "string", description: "Método HTTP (GET, POST, PUT, DELETE, PATCH)", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
        body: { type: "string", description: "Corpo da requisição (JSON string, opcional)" },
      },
      required: ["path"],
    },
    run: async (args, ctx) => {
      const token = ctx.githubToken || process.env.GITHUB_TOKEN;
      if (!token) return "❌ GitHub token não configurado. Adicione no chat web (botão 🐙) ou configure GITHUB_TOKEN no servidor.";
      const method = args.method || "GET";
      const url = `https://api.github.com${String(args.path)}`;
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MaxRouter",
      };
      const opts = { method, headers };
      if (args.body && method !== "GET") opts.body = args.body;
      const res = await fetch(url, opts);
      const text = await res.text();
      if (res.ok) {
        try {
          const data = JSON.parse(text);
          // Pretty-print JSON, truncate large responses
          const out = JSON.stringify(data, null, 2);
          return out.length > 6000 ? out.slice(0, 6000) + "\n... (truncado)" : out;
        } catch {
          return text.slice(0, 3000);
        }
      }
      return `GitHub API error ${res.status}: ${text.slice(0, 500)}`;
    },
  },
  read_file: {
    name: "read_file",
    desc: "Lê o conteúdo de um arquivo local.",
    args: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo" },
      },
      required: ["path"],
    },
    run: async (args) => {
      const resolved = path.resolve(String(args.path));
      if (!isPathSafe(resolved)) return "Acesso negado: caminho fora dos diretórios permitidos.";
      if (!fs.existsSync(resolved)) return `Arquivo não encontrado: ${args.path}`;
      const content = fs.readFileSync(resolved, "utf-8");
      return `\`\`\`\n${content.slice(0, 5000)}\n\`\`\`${content.length > 5000 ? "\n... (truncado)" : ""}`;
    },
  },
  write_file: {
    name: "write_file",
    desc: "Escreve conteúdo em um arquivo local (cria ou sobrescreve).",
    args: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo" },
        content: { type: "string", description: "Conteúdo a escrever" },
      },
      required: ["path", "content"],
    },
    run: async (args) => {
      const resolved = path.resolve(String(args.path));
      if (!isPathSafe(resolved)) return "Acesso negado: caminho fora dos diretórios permitidos.";
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, String(args.content), "utf-8");
      return `✅ Arquivo salvo: ${args.path} (${args.content.length} bytes)`;
    },
  },
  run_command: {
    name: "run_command",
    desc: "Executa um comando no terminal (somente leitura).",
    args: {
      type: "object",
      properties: {
        cmd: { type: "string", description: "Comando para executar" },
      },
      required: ["cmd"],
    },
    run: async (args) => {
      const cmd = String(args.cmd);
      const blocked = ["rm -rf", "format", "del /", "rd /", "shutdown", "restart", ">", "|"];
      if (blocked.some((b) => cmd.toLowerCase().includes(b))) return "Comando bloqueado.";
      try {
        const output = execSync(cmd, { timeout: 15000, encoding: "utf-8", cwd: process.cwd() });
        return output.slice(0, 3000) || "(sem saída)";
      } catch (err) {
        return `Erro: ${err.message.slice(0, 500)}`;
      }
    },
  },
  notify: {
    name: "notify",
    desc: "Envia uma notificação para o usuário no Telegram.",
    args: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título (opcional)" },
        text: { type: "string", description: "Conteúdo da notificação" },
      },
      required: ["text"],
    },
    run: async (args) => {
      return `🔔 ${args.title || "Notificação"}: ${args.text}`;
    },
  },
  schedule: {
    name: "schedule",
    desc: "Agenda uma tarefa para execução futura. delay em segundos.",
    args: {
      type: "object",
      properties: {
        delay: { type: "number", description: "Delay em segundos" },
        task: { type: "string", description: "Descrição da tarefa" },
        action: { type: "string", description: "Ação a executar (opcional)" },
      },
      required: ["delay", "task"],
    },
    run: async (args, ctx) => {
      const delay = parseInt(args.delay) || 60;
      const label = args.task || args.action || "tarefa";
      const meta = { action: args.action };
      if (ctx?.chatId) meta.chatId = ctx.chatId;
      scheduler.add(delay, label, meta);
      return `✅ Tarefa agendada: "${label}" em ${delay}s`;
    },
  },
  save_memory: {
    name: "save_memory",
    desc: "Salva informação importante na memória persistente. Use quando algo relevante ao contexto do usuário for discutido.",
    args: {
      type: "object",
      properties: {
        text: { type: "string", description: "Conteúdo a salvar na memória" },
        tags: { type: "array", items: { type: "string" }, description: "Tags para categorizar (opcional)" },
      },
      required: ["text"],
    },
    run: async (args) => {
      memoryStore.save(args.text, args.tags || [], "agent");
      const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;
      return `✅ Memória salva.`;
    },
  },
  search_memory: {
    name: "search_memory",
    desc: "Busca informações na memória persistente. Use para lembrar de conversas ou dados salvos anteriormente.",
    args: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo para buscar na memória" },
      },
      required: ["query"],
    },
    run: async (args) => {
      const results = memoryStore.search(args.query);
      if (results.length === 0) return "Nenhum resultado encontrado na memória.";
      return results.map((r, i) =>
        `${i + 1}. ${r.text}\n   _${r.created_at}_`
      ).join("\n\n");
    },
  },
};

const NOTION_TOOLS = {
  notion_save: {
    name: "notion_save",
    desc: "Salva uma nota no Notion. Use quando o usuário pedir pra salvar informação, ou quando algo importante for discutido que mereça registro.",
    args: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título curto da nota" },
        content: { type: "string", description: "Conteúdo completo da nota" },
        tags: { type: "array", items: { type: "string" }, description: "Tags para categorizar (opcional)" },
      },
      required: ["title", "content"],
    },
    run: async (args) => {
      const r = await notion.createPage(args.title, args.content, args.tags || [], "agent");
      return r.ok
        ? `✅ Salvo no Notion: ${r.url}`
        : `❌ Erro: ${r.error}`;
    },
  },
  notion_search: {
    name: "notion_search",
    desc: "Busca notas no Notion. Use quando o usuário perguntar sobre notas salvas ou informações registradas.",
    args: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca" },
      },
      required: ["query"],
    },
    run: async (args) => {
      const r = await notion.searchPages(args.query);
      if (!r.ok) return `❌ Erro: ${r.error}`;
      if (r.results.length === 0) return "Nenhuma nota encontrada.";
      return r.results.map((p, i) => `${i + 1}. [${p.title}](${p.url})`).join("\n");
    },
  },
};

// ── Ferramentas de canais pessoais (Telegram/WhatsApp) ──
// O agente do webchat usa estas tools sob comando do usuário: ler, resumir,
// buscar conversas e responder um contato/grupo.
const CHANNEL_TOOLS = {
  channels_list_chats: {
    name: "channels_list_chats",
    desc: "Lista as conversas/grupos recentes do Telegram e/ou WhatsApp (com última atividade). Use quando o usuário perguntar 'quais grupos', 'minhas conversas', etc.",
    args: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["telegram", "whatsapp"], description: "Filtrar por canal (opcional)" },
      },
    },
    run: async (args) => {
      const store = require("../channels/channelStore");
      const chats = store.listChats({ channel: args.channel });
      if (!chats.length) return "Nenhuma conversa registrada ainda. As mensagens aparecem aqui conforme chegam nos canais conectados.";
      return chats.map((c) =>
        `- [${c.channel}] ${c.chat_name || c.chat_id}${c.is_group ? " (grupo)" : ""} — ${c.msg_count} msg, última em ${c.last_at}`
      ).join("\n");
    },
  },
  channels_read: {
    name: "channels_read",
    desc: "Lê as últimas mensagens de uma conversa/grupo específico (por nome). Use para resumir ou entender o que rolou. Retorna o histórico recente.",
    args: {
      type: "object",
      properties: {
        chatName: { type: "string", description: "Nome (ou parte) do contato/grupo" },
        channel: { type: "string", enum: ["telegram", "whatsapp"], description: "Canal (opcional)" },
        limit: { type: "number", description: "Quantas mensagens (default 30)" },
      },
      required: ["chatName"],
    },
    run: async (args) => {
      const store = require("../channels/channelStore");
      const matches = store.findChatByName(args.chatName, { channel: args.channel });
      if (!matches.length) return `Nenhuma conversa encontrada com "${args.chatName}".`;
      const chat = matches[0];
      const msgs = store.recent({ channel: chat.channel, chatId: chat.chat_id, limit: args.limit || 30 });
      if (!msgs.length) return `Sem mensagens em "${chat.chat_name || chat.chat_id}".`;
      const header = `Conversa: ${chat.chat_name || chat.chat_id} [${chat.channel}]\n\n`;
      return header + msgs.map((m) =>
        `${m.direction === "out" ? "Você" : m.sender_name || "Contato"}: ${m.text}`
      ).join("\n");
    },
  },
  channels_search: {
    name: "channels_search",
    desc: "Busca por um termo em todas as conversas de Telegram/WhatsApp. Use quando o usuário pedir 'procura X nas conversas', 'onde falaram de Y'.",
    args: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo a buscar" },
        channel: { type: "string", enum: ["telegram", "whatsapp"], description: "Canal (opcional)" },
      },
      required: ["query"],
    },
    run: async (args) => {
      const store = require("../channels/channelStore");
      const hits = store.search(args.query, { channel: args.channel });
      if (!hits.length) return `Nenhuma mensagem encontrada com "${args.query}".`;
      return hits.map((m) =>
        `[${m.channel}] ${m.chat_name || m.chat_id} · ${m.sender_name || "Contato"}: ${m.text}`
      ).join("\n");
    },
  },
  channels_reply: {
    name: "channels_reply",
    desc: "Envia uma mensagem para um contato/grupo no Telegram ou WhatsApp. SÓ use quando o usuário pedir explicitamente para responder/enviar algo. Confirme o destinatário antes.",
    args: {
      type: "object",
      properties: {
        chatName: { type: "string", description: "Nome (ou parte) do contato/grupo destino" },
        channel: { type: "string", enum: ["telegram", "whatsapp"], description: "Canal" },
        message: { type: "string", description: "Texto a enviar" },
      },
      required: ["chatName", "message"],
    },
    run: async (args) => {
      const store = require("../channels/channelStore");
      const matches = store.findChatByName(args.chatName, { channel: args.channel });
      if (!matches.length) return `Não achei "${args.chatName}" nas conversas. Verifique o nome.`;
      const chat = matches[0];
      try {
        if (chat.channel === "telegram") {
          const { sendUserbotMessage } = require("../channels/telegram/userbotSender");
          const r = await sendUserbotMessage(chat.chat_id, args.message);
          if (!r.ok) return `❌ Falha ao enviar no Telegram: ${r.error}`;
        } else {
          const evo = require("../channels/evolution/evolutionApi");
          const target = chat.reply_target || chat.chat_id;
          await evo.sendTextMessage(target, args.message);
        }
        store.record({
          channel: chat.channel, chatId: chat.chat_id, chatName: chat.chat_name,
          senderName: "Você", isGroup: chat.is_group, text: args.message,
          replyTarget: chat.reply_target, direction: "out",
        });
        return `✅ Mensagem enviada para ${chat.chat_name || chat.chat_id} (${chat.channel}).`;
      } catch (err) {
        return `❌ Erro ao enviar: ${err.message}`;
      }
    },
  },
};

const PHONE_TOOLS = {
  phone: {
    name: "phone",
    desc: "Controla o celular via PhoneAgent (Termux). Requer PHONE_AGENT_URL configurado.",
    args: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["open-url", "notify", "read-file", "list-files", "exec"],
          description: "Ação a executar no celular",
        },
        url: { type: "string", description: "URL para abrir (se action=open-url)" },
        title: { type: "string", description: "Título da notificação (se action=notify)" },
        text: { type: "string", description: "Texto da notificação (se action=notify)" },
        path: { type: "string", description: "Caminho do arquivo (se action=read-file ou list-files)" },
        cmd: { type: "string", description: "Comando Termux (se action=exec)" },
      },
      required: ["action"],
    },
    run: async (args) => {
      if (!PHONE_AGENT_URL) return "📱 PhoneAgent não conectado. Configure PHONE_AGENT_URL no .env.";
      const action = args.action;
      const params = { ...args };
      delete params.action;
      try {
        const headers = { "Content-Type": "application/json" };
        if (PHONE_TOKEN) headers.Authorization = `Bearer ${PHONE_TOKEN}`;
        const res = await fetch(`${PHONE_AGENT_URL.replace(/\/+$/, "")}/${action}`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return `📱 PhoneAgent erro: ${res.status}`;
        return `📱 ${await res.text()}`;
      } catch (err) {
        return `📱 PhoneAgent inalcançável: ${err.message}`;
      }
    },
  },
};
const GOOGLE_TOOLS = {
  gmail_list: {
    name: "gmail_list",
    desc: "Lista e-mails não lidos ou prioritários no Gmail. Use quando o usuário perguntar 'ver meus e-mails', 'tem e-mail novo?', etc.",
    args: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Quantidade de e-mails para listar (default 5)" },
      },
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const gmail = require("../google/gmail");
        const list = await gmail.listPriorityEmails(args.limit || 5);
        if (!list.length) return "Nenhum e-mail não lido encontrado.";
        return list.map((m, i) =>
          `${i + 1}. **De:** ${m.from || "Desconhecido"}\n   **Assunto:** ${m.subject}\n   **Snippet:** ${m.snippet}\n   **ID:** \`${m.id}\``
        ).join("\n\n");
      } catch (err) {
        return `❌ Erro no Gmail: ${err.message}`;
      }
    },
  },
  gmail_search: {
    name: "gmail_search",
    desc: "Busca e-mails no Gmail usando termos ou operadores de busca (ex: from:joao, subject:reunião).",
    args: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo ou filtro de busca do Gmail" },
        limit: { type: "number", description: "Quantidade máxima de resultados (default 10)" },
      },
      required: ["query"],
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const gmail = require("../google/gmail");
        const list = await gmail.searchEmails(args.query, args.limit || 10);
        if (!list.length) return `Nenhum e-mail encontrado para "${args.query}".`;
        return list.map((m, i) =>
          `${i + 1}. **De:** ${m.from || "?"} → **Para:** ${m.to || "?"}\n   **Assunto:** ${m.subject}\n   **Snippet:** ${m.snippet}\n   **ID:** \`${m.id}\``
        ).join("\n\n");
      } catch (err) {
        return `❌ Erro ao buscar e-mails: ${err.message}`;
      }
    },
  },
  gmail_read: {
    name: "gmail_read",
    desc: "Lê o conteúdo completo de um e-mail específico pelo ID obtido no gmail_list ou gmail_search.",
    args: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "ID da mensagem no Gmail" },
      },
      required: ["messageId"],
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const gmail = require("../google/gmail");
        const res = await gmail.getEmailBody(args.messageId);
        return `**Mensagem ID:** \`${res.id}\`\n\n${res.body.slice(0, 4000)}`;
      } catch (err) {
        return `❌ Erro ao ler e-mail: ${err.message}`;
      }
    },
  },
  gmail_send: {
    name: "gmail_send",
    desc: "Envia um e-mail via Gmail. Use quando o usuário solicitar o envio de uma mensagem por e-mail.",
    args: {
      type: "object",
      properties: {
        to: { type: "string", description: "E-mail do destinatário" },
        subject: { type: "string", description: "Assunto do e-mail" },
        body: { type: "string", description: "Conteúdo do e-mail" },
      },
      required: ["to", "subject", "body"],
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const gmail = require("../google/gmail");
        const r = await gmail.sendEmail(args.to, args.subject, args.body);
        return `✅ E-mail enviado com sucesso para ${args.to} (ID: \`${r.id}\`).`;
      } catch (err) {
        return `❌ Erro ao enviar e-mail: ${err.message}`;
      }
    },
  },
  calendar_list: {
    name: "calendar_list",
    desc: "Lista compromissos e eventos na Agenda do Google (Google Calendar). Use para ver a programação de hoje ou de datas específicas.",
    args: {
      type: "object",
      properties: {
        timeMin: { type: "string", description: "Data/hora inicial ISO (ex: 2026-07-23T00:00:00Z, padrão: início de hoje)" },
        timeMax: { type: "string", description: "Data/hora final ISO (ex: 2026-07-23T23:59:59Z, padrão: fim de hoje)" },
        q: { type: "string", description: "Termo de busca na agenda (opcional)" },
      },
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const calendar = require("../google/calendar");
        const events = args.timeMin || args.timeMax || args.q
          ? await calendar.listEvents({ timeMin: args.timeMin, timeMax: args.timeMax, q: args.q })
          : await calendar.listTodayEvents();
        if (!events.length) return "Nenhum compromisso encontrado para o período informado na sua Agenda.";
        return events.map((e, i) =>
          `${i + 1}. **${e.title}**\n   ⏰ Início: ${e.start} | Fim: ${e.end}\n   📍 Local: ${e.location || "N/A"}\n   📝 ID: \`${e.id}\``
        ).join("\n\n");
      } catch (err) {
        return `❌ Erro na Agenda: ${err.message}`;
      }
    },
  },
  calendar_create: {
    name: "calendar_create",
    desc: "Cria um novo evento na Agenda do Google.",
    args: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título do evento" },
        start: { type: "string", description: "Data/hora de início em ISO 8601 (ex: 2026-07-24T15:00:00-03:00) ou YYYY-MM-DD para dia inteiro" },
        end: { type: "string", description: "Data/hora de término em ISO 8601 ou YYYY-MM-DD" },
        description: { type: "string", description: "Descrição ou pauta da reunião (opcional)" },
        location: { type: "string", description: "Local ou link de reunião (opcional)" },
        attendees: { type: "array", items: { type: "string" }, description: "Lista de e-mails dos convidados (opcional)" },
      },
      required: ["title", "start", "end"],
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const calendar = require("../google/calendar");
        const ev = await calendar.createEvent(args);
        return `✅ Evento "${ev.title}" criado com sucesso na Agenda!\n⏰ ${ev.start} até ${ev.end}\n🔗 [Ver no Google Calendar](${ev.htmlLink})`;
      } catch (err) {
        return `❌ Erro ao criar evento na Agenda: ${err.message}`;
      }
    },
  },
  calendar_delete: {
    name: "calendar_delete",
    desc: "Remove um evento da Agenda do Google pelo ID.",
    args: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "ID do evento obtido via calendar_list" },
      },
      required: ["eventId"],
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const calendar = require("../google/calendar");
        await calendar.deleteEvent(args.eventId);
        return `✅ Evento removido da Agenda com sucesso.`;
      } catch (err) {
        return `❌ Erro ao remover evento: ${err.message}`;
      }
    },
  },
};

Object.assign(TOOLS, PHONE_TOOLS);
Object.assign(TOOLS, NOTION_TOOLS);
Object.assign(TOOLS, CHANNEL_TOOLS);
Object.assign(TOOLS, GOOGLE_TOOLS);

const TOOL_LIST = Object.values(TOOLS).map((t) => ({
  name: t.name,
  desc: t.desc,
  args: t.args,
}));

const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.desc,
    parameters: t.args,
  },
}));

async function runTool(toolName, args, ctx = {}) {
  const tool = TOOLS[toolName];
  if (!tool) return `Ferramenta desconhecida: ${toolName}`;
  try {
    const cacheKey = `${toolName}:${JSON.stringify(args)}`;
    const cached = cache.get(cacheKey);
    if (cached !== null) return cached;
    const result = await tool.run(args, ctx);
    if (toolName === "web_search" || toolName === "web_fetch") {
      cache.set(cacheKey, result, 300_000);
    }
    return result;
  } catch (err) {
    return `Erro ao executar ${toolName}: ${err.message}`;
  }
}

module.exports = { TOOLS, TOOL_LIST, TOOL_SCHEMAS, runTool };
