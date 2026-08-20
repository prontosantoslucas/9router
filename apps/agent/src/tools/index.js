const cache = require("../cache");
const scheduler = require("../scheduler");
const superbrain = require("../superbrain");
const memoryStore = require("../memoryStore");
const { ROUTER_BASE_URL, PHONE_AGENT_URL, PHONE_TOKEN, BOT_TOKEN } = require("../config");
const keyrotator = require("../keyrotator");
const notion = require("../notion");
const { searchWeb } = require("./webSearch");
const { BRAIN_ENTRY_BY_LABEL, BRAIN_LABELS } = require("../brainCategories");
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
      const results = await searchWeb(String(args.query), 5);
      return results.map((r, i) =>
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
      const cmd = String(args.cmd).trim();
      // Intercepta comandos internos do prospector se invocados via shell tool
      if (/^\/?prospector\s+run/i.test(cmd)) {
        const prospector = require("../prospector");
        const res = await prospector.runCycle();
        // Mesma regra da tool prospector_run: falha técnica não pode virar ✅,
        // e enfileirado na extensão não conta como enviado.
        if (res.ok === false) return `❌ O ciclo NÃO concluiu. ${res.error || res.reason || "falha desconhecida"}`;
        const extra = res.queued ? ` (+${res.queued} enfileirada(s) na extensão, entrega não confirmada)` : "";
        return `✅ Ciclo executado: ${res.discovered} clientes minerados, ${res.outreached} confirmada(s) pelo canal${extra}.`;
      }
      if (/^\/?prospector\s+status/i.test(cmd)) {
        const prospector = require("../prospector");
        const stats = prospector.getStats();
        return JSON.stringify(stats, null, 2);
      }
      if (/^\/?prospector\s+avatar\s+(.*)/i.test(cmd)) {
        const niche = cmd.match(/^\/?prospector\s+avatar\s+(.*)/i)[1].trim();
        const prospector = require("../prospector");
        const res = await prospector.researchMarketAvatar(niche);
        return res.ok ? res.dossier : `❌ A pesquisa de mercado para "${niche}" falhou: ${res.error}`;
      }

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
    desc: "Envia notificacao PUSH para o celular do usuario: alerta dedicado (ntfy/Pushover) se configurado, senao pelo chat do Telegram. Use quando ele pedir para ser avisado de algo, ou quando algo importante acontecer fora da conversa.",
    args: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo (opcional). No push dedicado aparece em negrito na tela de bloqueio." },
        text: { type: "string", description: "Conteudo da notificacao" },
        prioridade: { type: "number", description: "1 a 5. 3 e o normal; 4+ vibra mesmo no silencioso. Use 4+ so para algo realmente urgente." },
        url: { type: "string", description: "Link opcional para abrir a partir da notificacao" },
      },
      required: ["text"],
    },
    run: async (args, ctx = {}) => {
      // Esta tool era um STUB: a descricao dizia que enviava para o Telegram e o
      // corpo apenas retornava a string, que aparecia no chat como se tivesse
      // sido enviada. Era a causa de as notificacoes nunca chegarem no celular.
      const channelSender = require("../channelSender");
      const texto = String(args.text || "").trim();
      if (!texto) return "Notificacao sem texto — nada a enviar.";

      const r = await channelSender.sendOwner(texto, {
        title: args.title || null,
        priority: args.prioridade || 3,
        url: args.url || null,
        // Sem destino do dono configurado, usa o chat atual: melhor entregar
        // aqui do que perder o aviso em silencio.
        fallbackChatId: ctx.chatId || null,
      });

      if (!r.ok) return "Nao consegui enviar a notificacao: " + (r.error || "falha desconhecida");

      // `via` diz o canal real. O usuario precisa saber quando NAO houve push,
      // senao volta a achar que o sistema funciona quando nao funciona.
      if (String(r.via).startsWith("push-")) return "Push enviado no celular via " + r.via + ".";
      if (r.via === "webchat-fallback") {
        return "O envio pelo canal principal falhou (" + (r.primary_error || "?") + ") e a mensagem ficou no webchat — voce NAO recebeu push no celular.";
      }
      if (r.via === "webchat-db") {
        return "A mensagem ficou no webchat — voce NAO recebeu push no celular. Configure NTFY_TOPIC (app ntfy, gratuito) ou OWNER_CHAT_ID do Telegram.";
      }
      const nota = r.tentativas?.length ? " (push dedicado nao usado: " + r.tentativas.join("; ") + ")" : "";
      return "Notificacao enviada via " + (r.via || "canal padrao") + nota + ".";
    },
  },
  notify_status: {
    name: "notify_status",
    desc: "Diagnostica por que a notificacao no celular chega ou nao: destino configurado, canal que sera usado, e se o client daquele canal esta realmente conectado. NAO envia nada.",
    args: { type: "object", properties: {} },
    run: async (args = {}, ctx = {}) => {
      // Existe porque 'nao recebo notificacao' tem varias causas diferentes
      // (sem destino, bot caido, WhatsApp despareado) e antes nao havia forma
      // de distinguir sem tentar enviar de verdade.
      const { detectChannel } = require("../channelSender");
      const out = [];

      // Push dedicado vem primeiro porque e o canal preferido do notify.
      let ps = null;
      try { ps = require("../channels/push/pushSender").status(); } catch (e) { out.push(`pushSender indisponivel: ${e.message}`); }
      if (ps?.configured) {
        out.push(`Push dedicado: ${ps.provider} configurado (${JSON.stringify(ps).slice(0, 200)}).`);
        out.push("Resultado: o push sai para o topico. O Telegram abaixo e so rede de seguranca.");
        // Armadilha real: o servidor aceita a publicacao mesmo sem ninguem
        // inscrito, devolve 200, e o fallback do Telegram NUNCA dispara. Como
        // nao existe API para consultar assinantes de topico publico, o unico
        // remedio honesto e avisar que sucesso de envio nao prova recebimento.
        out.push("ATENCAO: o servidor aceita a publicacao mesmo sem nenhum aparelho inscrito no topico — envio com sucesso NAO prova que voce recebeu. Confirme que o app de push no celular esta inscrito neste mesmo topico.");
      } else {
        out.push(`Push dedicado: NAO configurado. ${ps?.hint || ""}`);
      }
      out.push("");

      const destino = process.env.OWNER_CHAT_ID || process.env.SCANNER_NOTIFY_TELEGRAM_CHAT_ID || ctx.chatId || null;
      if (!destino) {
        out.push("Chat do dono: nao configurado. Defina OWNER_CHAT_ID com o id do seu chat no Telegram para ter fallback.");
        return out.join("\n");
      }
      const canal = detectChannel(destino);
      const fonte = process.env.OWNER_CHAT_ID
        ? "OWNER_CHAT_ID"
        : process.env.SCANNER_NOTIFY_TELEGRAM_CHAT_ID ? "SCANNER_NOTIFY_TELEGRAM_CHAT_ID" : "chat atual";
      out.push(`Destino: ${destino} (de ${fonte}) — canal ${canal}.`);

      if (canal === "telegram") {
        let bot = null, ub = null;
        try { bot = require("../botManager").status?.(); } catch (e) { out.push(`botManager indisponivel: ${e.message}`); }
        try { ub = require("../channels/telegram/userbotClient").status?.(); } catch (e) { /* opcional */ }
        const botOn = !!(bot && (bot.running || bot.connected || bot.active));
        const ubOn = !!(ub && (ub.running || ub.connected || ub.authorized));
        out.push(`Bot Telegraf: ${botOn ? "conectado" : "NAO conectado"}${bot ? ` (${JSON.stringify(bot).slice(0, 160)})` : ""}`);
        out.push(`Userbot: ${ubOn ? "conectado" : "NAO conectado"}`);
        out.push(botOn || ubOn
          ? "Resultado: push no celular deve funcionar."
          : "Resultado: NAO vai chegar push. Os dois clients do Telegram estao fora — a mensagem cai no webchat. Reconecte o bot (TELEGRAM_BOT_TOKEN) para receber no celular.");
      } else if (canal === "whatsapp") {
        let st = null;
        try { st = require("../channels/whatsapp/nativeClient").getStatus?.(); } catch (e) { /* pode estar em Evolution */ }
        const on = st && (st.connected || st.state === "open" || st.connectionState === "open");
        out.push(`WhatsApp: ${on ? "conectado" : "NAO conectado"}${st ? ` (${JSON.stringify(st).slice(0, 160)})` : ""}`);
        if (process.env.EVOLUTION_API_URL) out.push("Evolution API configurada — o envio passa por ela, nao pelo client nativo.");
      } else {
        out.push("O destino e um chat de webchat: a mensagem aparece na interface, mas NAO gera push no celular. Configure OWNER_CHAT_ID com seu id do Telegram para isso.");
      }

      return out.join("\n");
    },
  },
  schedule: {
    name: "schedule",
    desc: "Agenda uma tarefa para execução futura. delay em segundos. Se passar repeat_seconds, vira recorrente (ex.: 86400 = todo dia, 604800 = toda semana).",
    args: {
      type: "object",
      properties: {
        delay: { type: "number", description: "Delay em segundos até o primeiro disparo" },
        task: { type: "string", description: "Descrição da tarefa" },
        action: { type: "string", description: "Ação a executar (opcional)" },
        repeat_seconds: { type: "number", description: "Intervalo de recorrência em segundos (opcional). Ex.: 86400 = diário" },
      },
      required: ["delay", "task"],
    },
    run: async (args, ctx) => {
      const delay = parseInt(args.delay) || 60;
      const label = args.task || args.action || "tarefa";
      const meta = { action: args.action };
      if (ctx?.chatId) meta.chatId = ctx.chatId;
      const rep = parseInt(args.repeat_seconds) || 0;
      if (rep > 0) {
        scheduler.addRecurring(delay, rep, label, meta);
        return `✅ Tarefa recorrente agendada: "${label}" em ${delay}s, repetindo a cada ${rep}s`;
      }
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
    desc: "Salva uma nota no Notion (segundo cérebro). Use quando o usuário pedir pra salvar informação, ou quando algo importante for discutido que mereça registro: planos, metas, ideias, viradas de chave, pontos importantes, memórias, conversas profundas, agenda, tarefas, financeiro, alimentação, anotações ou atalhos.",
    args: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título curto da nota" },
        content: { type: "string", description: "Conteúdo completo da nota" },
        categoria: {
          type: "string",
          enum: BRAIN_LABELS,
          description: "Categoria do segundo cérebro para classificar a nota. \"Metas\" existe em duas famílias diferentes — escolha o rótulo que descreve o contexto certo.",
        },
        tags: { type: "array", items: { type: "string" }, description: "Tags para categorizar (opcional)" },
      },
      required: ["title", "content"],
    },
    run: async (args) => {
      const entry = args.categoria && BRAIN_ENTRY_BY_LABEL.get(args.categoria);
      const r = entry
        ? await notion.saveToCategory(entry.categoria, args.title, args.content, args.tags || [], "agent", entry.db())
        : await notion.createPage(args.title, args.content, args.tags || [], "agent", "");
      return r.ok
        ? `✅ Salvo no Notion${r.appended ? ` (anexado em "${args.categoria}")` : ""}: ${r.url}`
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
          enum: ["open-url", "notify", "read-file", "list-files", "exec", "sms-list", "sms-send"],
          description: "Ação a executar no celular",
        },
        url: { type: "string", description: "URL para abrir (se action=open-url)" },
        title: { type: "string", description: "Título da notificação (se action=notify)" },
        text: { type: "string", description: "Texto da notificação (se action=notify)" },
        path: { type: "string", description: "Caminho do arquivo (se action=read-file ou list-files)" },
        cmd: { type: "string", description: "Comando Termux (se action=exec)" },
        numero: { type: "string", description: "Número de telefone com DDD (se action=sms-send)" },
        limit: { type: "number", description: "Quantidade de SMS a listar (se action=sms-list, default 10)" },
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
    desc: "Cria um novo evento na Agenda do Google, com ou sem recorrência.",
    args: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título do evento" },
        start: { type: "string", description: "Data/hora de início em ISO 8601 (ex: 2026-07-24T15:00:00-03:00) ou YYYY-MM-DD para dia inteiro" },
        end: { type: "string", description: "Data/hora de término em ISO 8601 ou YYYY-MM-DD" },
        description: { type: "string", description: "Descrição ou pauta da reunião (opcional)" },
        location: { type: "string", description: "Local ou link de reunião (opcional)" },
        attendees: { type: "array", items: { type: "string" }, description: "Lista de e-mails dos convidados (opcional)" },
        recurrence: { type: "array", items: { type: "string" }, description: "Regras de recorrência RRULE. Ex: [\"RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\"] para seg/qua/sex, [\"RRULE:FREQ=DAILY;COUNT=10\"] para 10 dias seguidos. Veja https://www.rfc-editor.org/rfc/rfc5545#section-3.8.5.3" },
      },
      required: ["title", "start", "end"],
    },
    run: async (args) => {
      try {
        const oauth = require("../google/oauth");
        if (!oauth.isAuthorized()) return "❌ Google Workspace não autorizado. Conecte sua conta do Google no /dashboard2.";
        const calendar = require("../google/calendar");
        const ev = await calendar.createEvent(args);
        let msg = `✅ Evento "${ev.title}" criado com sucesso na Agenda!\n⏰ ${ev.start} até ${ev.end}\n🔗 [Ver no Google Calendar](${ev.htmlLink})`;
        if (args.recurrence) msg += `\n🔁 Recorrência: ${args.recurrence.join(", ")}`;
        return msg;
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

const { callLinkedin } = require("./linkedinClient");

const { runJobHunt } = require("./linkedinJobHunt");
const jobAlerts = require("../jobAlerts");

const LINKEDIN_TOOLS = {
  schedule_job_hunt: {
    name: "schedule_job_hunt",
    desc: "Agenda uma busca RECORRENTE de vagas no LinkedIn. Toda vez que rodar, dedup contra buscas anteriores e envia só vagas NOVAS. Ideal pra alertas semanais/diários. Guarda persistência em SQLite.",
    args: {
      type: "object",
      properties: {
        chat_id: { type: "string", description: "chatId do canal que recebera o alerta (default: chat atual)" },
        channel: { type: "string", description: "'webchat' | 'telegram' | 'whatsapp'. Default: webchat." },
        label: { type: "string", description: "nome descritivo (ex: 'AI engineer remoto weekly')" },
        interval_hours: { type: "number", description: "Frequência em horas. 168=semanal, 24=diário, 72=cada 3 dias. Default: 168." },
        keywords_override: { type: "array", items: { type: "string" }, description: "Se quiser fixar queries LinkedIn. Se omitido, deriva do perfil do usuário via GitHub." },
        location: { type: "string" },
        seniority: { type: "string", description: "junior|mid|senior|staff" },
        max_results: { type: "number", description: "Default 10" },
        cover_letters: { type: "boolean", description: "Default false — em alerts, so link+score é mais util" },
      },
      required: [],
    },
    run: (args, ctx) => {
      const chatId = args.chat_id || ctx?.chatId;
      if (!chatId) return "❌ chatId não determinado. Passa chat_id ou chama do webchat.";
      const criteria = {
        location: args.location,
        seniority: args.seniority,
        max_results: args.max_results || 10,
        cover_letters: args.cover_letters === true,
        github_owner: "prontosantoslucas",
        ...(args.keywords_override ? { queries_override: args.keywords_override } : {}),
      };
      const alert = jobAlerts.createAlert({
        chatId, channel: args.channel || "webchat",
        label: args.label || "Vagas LinkedIn",
        criteria,
        intervalHours: args.interval_hours || 168,
      });
      return `✅ Alerta criado.
  ID: ${alert.id}
  Label: ${alert.label}
  Frequência: ${alert.intervalHours}h (${alert.intervalHours === 168 ? "semanal" : alert.intervalHours === 24 ? "diário" : "cada " + alert.intervalHours + "h"})
  Canal: ${alert.channel}
  Criteria: ${JSON.stringify(criteria)}

Rodará automático. Use "list_scheduled_hunts" pra ver, "run_scheduled_hunt_now" pra forçar execução, "cancel_scheduled_hunt ${alert.id}" pra parar.`;
    },
  },
  list_scheduled_hunts: {
    name: "list_scheduled_hunts",
    desc: "Lista os alertas de vagas ativos do usuário.",
    args: {
      type: "object",
      properties: {
        chat_id: { type: "string", description: "Filtra por chatId (default: chat atual)" },
      },
    },
    run: (args, ctx) => {
      const chatId = args.chat_id || ctx?.chatId;
      if (!chatId) return "❌ chatId não determinado.";
      const alerts = jobAlerts.listAlerts(chatId);
      if (alerts.length === 0) return "Nenhum alerta agendado.";
      return alerts.map((a, i) =>
        `${i + 1}. [${a.id}] ${a.label}\n   ${a.enabled ? "🟢 ativo" : "🔴 pausado"} | a cada ${a.interval_hours}h via ${a.channel}\n   Último run: ${a.last_run || "nunca"}\n   Criteria: ${JSON.stringify(a.criteria)}`
      ).join("\n\n");
    },
  },
  cancel_scheduled_hunt: {
    name: "cancel_scheduled_hunt",
    desc: "Cancela (desabilita) um alerta de vagas pelo ID.",
    args: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "ID do alerta (obtido via list_scheduled_hunts)" },
      },
      required: ["alert_id"],
    },
    run: (args) => {
      const ok = jobAlerts.cancelAlert(String(args.alert_id));
      return ok ? `✅ Alerta ${args.alert_id} cancelado.` : `❌ Alerta ${args.alert_id} não encontrado.`;
    },
  },
  run_scheduled_hunt_now: {
    name: "run_scheduled_hunt_now",
    desc: "Executa um alerta AGORA (fora do horário), útil pra testar antes do primeiro trigger automático.",
    args: {
      type: "object",
      properties: {
        alert_id: { type: "string" },
      },
      required: ["alert_id"],
    },
    run: async (args) => {
      try {
        const r = await jobAlerts.runNow(String(args.alert_id));
        return `✅ Executado: ${r.found} vagas encontradas, ${r.new} novas (o resto já foi visto).`;
      } catch (e) {
        return `❌ ${e.message}`;
      }
    },
  },
  linkedin_job_hunt: {
    name: "linkedin_job_hunt",
    desc: "Caça vagas no LinkedIn alinhadas com o perfil profissional do usuário (extraído dos repos GitHub), rankeia via LLM e opcionalmente gera cover letter para o top 5. Retorna lista com link direto de aplicação. NÃO se inscreve automaticamente — LinkedIn detecta e bane conta.",
    args: {
      type: "object",
      properties: {
        location: { type: "string", description: "Filtro de localidade (ex: 'Remote', 'São Paulo', 'Brazil')" },
        seniority: { type: "string", description: "Nível: 'junior', 'mid', 'senior', 'staff'. Opcional." },
        max_results: { type: "number", description: "Quantas vagas rankear (1-25, default 10)" },
        cover_letters: { type: "boolean", description: "Gerar cover letter para top 5 (default true)" },
        github_owner: { type: "string", description: "Handle GitHub para extrair perfil (default: prontosantoslucas)" },
        queries_override: {
          type: "array", items: { type: "string" },
          description: "Se fornecido, pula geração automática e usa estas queries.",
        },
        sources: {
          type: "array", items: { type: "string" },
          description: "Fontes a consultar: 'linkedin', 'remoteok', 'remotive', 'arbeitnow', 'jobicy', 'workingnomads'. Default: todas.",
        },
      },
      required: [],
    },
    run: async (args) => (await runJobHunt(args)).text,
  },
  linkedin_person_profile: {
    name: "linkedin_person_profile",
    desc: "Busca o perfil público de uma pessoa no LinkedIn (via linkedin-mcp-server sidecar). Requer o username do LinkedIn.",
    args: {
      type: "object",
      properties: {
        linkedin_username: { type: "string", description: "Username do LinkedIn (ex: 'satyanadella', 'jeffweiner08')" },
        sections: {
          type: "string",
          description: "Seções extras separadas por vírgula (experience, education, interests, honors, languages, contact_info, posts). Opcional.",
        },
      },
      required: ["linkedin_username"],
    },
    run: (args) => callLinkedin("get_person_profile", {
      linkedin_username: String(args.linkedin_username),
      ...(args.sections ? { sections: String(args.sections) } : {}),
    }),
  },
  linkedin_edit_profile: {
    name: "linkedin_edit_profile",
    desc: "Edita o PERFIL DO PRÓPRIO USUÁRIO no LinkedIn: Headline (manchete) e About (resumo). Executa no browser real do usuário via extensão MAXROUTER LinkedIn Helper. NÃO usar para editar perfil de terceiros.",
    args: {
      type: "object",
      properties: {
        headline: { type: "string", description: "Nova headline/manchete do perfil (ex: 'Engenheiro de IA | LLMs, Agentes e RAG')" },
        about: { type: "string", description: "Novo texto da seção About/resumo (até ~2600 chars)" },
      },
      required: [],
    },
    run: (args) => callLinkedin("linkedin_edit_profile", {
      ...(args.headline ? { headline: String(args.headline) } : {}),
      ...(args.about ? { about: String(args.about) } : {}),
    }),
  },
  linkedin_search_people: {
    name: "linkedin_search_people",
    desc: "Busca pessoas no LinkedIn por palavras-chave (via linkedin-mcp-server).",
    args: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Termos de busca (ex: 'product manager', 'ML engineer at Meta')" },
        location: { type: "string", description: "Filtro opcional de localidade (ex: 'London', 'São Paulo')" },
      },
      required: ["keywords"],
    },
    run: (args) => callLinkedin("search_people", {
      keywords: String(args.keywords),
      ...(args.location ? { location: String(args.location) } : {}),
    }),
  },
  linkedin_company_profile: {
    name: "linkedin_company_profile",
    desc: "Busca o perfil de uma empresa no LinkedIn pelo slug/username da company page.",
    args: {
      type: "object",
      properties: {
        company_username: { type: "string", description: "Slug da empresa (ex: 'microsoft', 'anthropicai')" },
      },
      required: ["company_username"],
    },
    run: (args) => callLinkedin("get_company_profile", { company_username: String(args.company_username) }),
  },
  linkedin_company_posts: {
    name: "linkedin_company_posts",
    desc: "Lista posts recentes de uma empresa no LinkedIn.",
    args: {
      type: "object",
      properties: {
        company_username: { type: "string", description: "Slug da empresa" },
      },
      required: ["company_username"],
    },
    run: (args) => callLinkedin("get_company_posts", { company_username: String(args.company_username) }),
  },
  linkedin_job_details: {
    name: "linkedin_job_details",
    desc: "Detalha uma vaga do LinkedIn a partir do ID (numérico) da vaga.",
    args: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "ID numérico da vaga (extraído da URL /jobs/view/<id>)" },
      },
      required: ["job_id"],
    },
    run: (args) => callLinkedin("get_job_details", { job_id: String(args.job_id) }),
  },
  linkedin_search_jobs: {
    name: "linkedin_search_jobs",
    desc: "Busca vagas no LinkedIn por palavras-chave.",
    args: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Termos de busca (ex: 'senior backend engineer')" },
        location: { type: "string", description: "Filtro opcional de localidade" },
      },
      required: ["keywords"],
    },
    run: (args) => callLinkedin("search_jobs", {
      keywords: String(args.keywords),
      ...(args.location ? { location: String(args.location) } : {}),
    }),
  },
};

const automations = require("../automations");
const db = require("../db");

// Setup schema feedback (idempotente — outros módulos podem já ter criado)
db.exec(`
  CREATE TABLE IF NOT EXISTS insight_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER,
    chat_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const INTROSPECTION_TOOLS = {
  show_my_profile: {
    name: "show_my_profile",
    desc: "Mostra o perfil comportamental atual do usuário (síntese semanal auto-gerada). Use quando ele perguntar 'o que você sabe sobre mim', 'qual meu perfil', 'quais padrões você notou'.",
    args: { type: "object", properties: {} },
    run: (_, ctx) => {
      const chatId = ctx?.chatId;
      if (!chatId) return "❌ chatId não determinado.";
      let profile;
      try { profile = require("../autonomous/psychProfile").getCurrent(chatId); }
      catch { return "⏳ Perfil comportamental ainda não gerado (precisa de ~5 interações substanciais + 24h desde a última síntese)."; }
      if (!profile?.content) return "⏳ Perfil comportamental ainda não gerado. O sistema sintetiza automaticamente 1x/dia com base nos últimos 7 dias.";
      const when = new Date(profile.generated_at * 1000).toLocaleString("pt-BR");
      return `📊 **Perfil comportamental** (gerado em ${when})\n\n${profile.content}`;
    },
  },
  list_my_memories: {
    name: "list_my_memories",
    desc: "Lista o que o agent lembra sobre o usuário. Use quando ele perguntar 'quais memórias você tem sobre mim', 'o que você sabe', 'lista o que aprendeu'.",
    args: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filtro opcional. Se omitido, retorna as 20 mais recentes." },
        limit: { type: "number", description: "Default 20, max 100" },
      },
    },
    run: (args, ctx) => {
      const chatId = ctx?.chatId;
      const limit = Math.min(args.limit || 20, 100);
      const tag = chatId ? `%chat:${chatId}%` : "%";
      let rows;
      if (args.query) {
        rows = db.prepare(
          `SELECT id, text, tags, source, created_at FROM memories
           WHERE tags LIKE ? AND text LIKE ?
           ORDER BY created_at DESC LIMIT ?`
        ).all(tag, `%${args.query}%`, limit);
      } else {
        rows = db.prepare(
          `SELECT id, text, tags, source, created_at FROM memories
           WHERE tags LIKE ?
           ORDER BY created_at DESC LIMIT ?`
        ).all(tag, limit);
      }
      if (rows.length === 0) return "Nenhuma memória salva ainda.";
      return rows.map((r) => `[${r.id}] (${r.source}) ${r.text}`).join("\n\n");
    },
  },
  forget_memory: {
    name: "forget_memory",
    desc: "Apaga uma memória específica. Use quando o usuário disser 'esquece que eu disse X', 'apaga essa lembrança', 'remove essa memória'. Aceita ID exato OU busca por texto (apaga a mais recente que bate).",
    args: {
      type: "object",
      properties: {
        memory_id: { type: "number", description: "ID exato (visto em list_my_memories)" },
        text_match: { type: "string", description: "Ou busca por trecho do texto — apaga a memória mais recente que contém isso" },
      },
    },
    run: (args, ctx) => {
      const chatId = ctx?.chatId;
      const tag = chatId ? `%chat:${chatId}%` : "%";
      if (args.memory_id) {
        const row = db.prepare(`SELECT id, text FROM memories WHERE id = ? AND tags LIKE ?`).get(args.memory_id, tag);
        if (!row) return `❌ Memória ${args.memory_id} não encontrada (ou não pertence a esse chat).`;
        memoryStore.remove(row.id);
        return `✅ Esquecido: "${row.text.slice(0, 100)}"`;
      }
      if (args.text_match) {
        const row = db.prepare(
          `SELECT id, text FROM memories WHERE tags LIKE ? AND text LIKE ? ORDER BY created_at DESC LIMIT 1`
        ).get(tag, `%${args.text_match}%`);
        if (!row) return `❌ Nenhuma memória com "${args.text_match}" encontrada.`;
        memoryStore.remove(row.id);
        return `✅ Esquecido (id ${row.id}): "${row.text.slice(0, 100)}"`;
      }
      return "❌ Passe memory_id ou text_match.";
    },
  },
  list_daily_insights: {
    name: "list_daily_insights",
    desc: "Lista os insights matutinos espontâneos que o agent gerou recentemente pra o usuário (incluindo feedback dado, se houver).",
    args: {
      type: "object",
      properties: { limit: { type: "number", description: "Default 10" } },
    },
    run: (args, ctx) => {
      const chatId = ctx?.chatId;
      if (!chatId) return "❌ chatId não determinado.";
      const limit = args.limit || 10;
      const rows = db.prepare(
        `SELECT pn.id, pn.body, pn.tag, pn.created_at,
                (SELECT rating FROM insight_feedback WHERE notification_id = pn.id LIMIT 1) as feedback
         FROM proactive_notifications pn
         WHERE pn.chat_id = ? AND pn.tag LIKE 'daily-insight-%'
         ORDER BY pn.created_at DESC LIMIT ?`
      ).all(String(chatId), limit);
      if (rows.length === 0) return "Ainda não gerei nenhum insight matutino pra você.";
      return rows.map((r) => {
        const when = new Date(r.created_at * 1000).toLocaleString("pt-BR");
        const fb = r.feedback ? ` [${r.feedback === "up" ? "👍" : "👎"}]` : "";
        return `[${r.id}] ${when}${fb}\n${r.body}`;
      }).join("\n\n");
    },
  },
  insight_feedback: {
    name: "insight_feedback",
    desc: "Grava feedback do usuário sobre um insight recebido. Use quando ele escrever 'útil <id>', 'não útil <id>', 'gostei do <id>', 'ignora esse tipo de sugestão'. O rating vira input pra gerar melhores insights no futuro.",
    args: {
      type: "object",
      properties: {
        notification_id: { type: "number", description: "ID do insight (aparece no rodapé da mensagem)" },
        rating: { type: "string", enum: ["up", "down"], description: "up=útil, down=não-útil" },
        note: { type: "string", description: "Comentário opcional do usuário sobre o porquê" },
      },
      required: ["notification_id", "rating"],
    },
    run: (args, ctx) => {
      const chatId = ctx?.chatId;
      if (!chatId) return "❌ chatId não determinado.";
      const notif = db.prepare(
        `SELECT id FROM proactive_notifications WHERE id = ? AND chat_id = ?`
      ).get(args.notification_id, String(chatId));
      if (!notif) return `❌ Insight ${args.notification_id} não encontrado.`;
      db.prepare(
        `INSERT INTO insight_feedback (notification_id, chat_id, rating, note) VALUES (?, ?, ?, ?)`
      ).run(args.notification_id, String(chatId), args.rating, args.note || null);
      return `✅ Feedback registrado. Vou usar isso pra melhorar próximos insights.`;
    },
  },
};

const AUTOMATION_TOOLS = {
  create_automation: {
    name: "create_automation",
    desc: `Cria uma automação que dispara sozinha quando um evento acontece. Use quando o usuário disser "sempre que X, faça Y", "toda vez que", "todo dia às", "quando chegar email de", etc. Antes de chamar, entenda EXATAMENTE trigger + action com o usuário. Depois de criar, avise o ID pro caso de ele querer cancelar.

Exemplos de uso:
  - "toda vez que chegar email com 'urgente' no gmail, me manda no whatsapp"
    → trigger: gmail_new / query="urgente"
    → action: send_message / chat_id=<wa>, template="📧 {{trigger.from}}: {{trigger.subject}} — {{trigger.snippet}}"
  - "toda segunda 9h roda um resumo dos meus emails da semana"
    → trigger: schedule / repeat_seconds=604800, first_at="próxima segunda 9h ISO"
    → action: process_message / prompt_template="me faz resumo dos emails importantes da semana"`,
    args: {
      type: "object",
      properties: {
        label: { type: "string", description: "Nome curto descritivo (ex: 'emails urgentes → wa')" },
        trigger: {
          type: "object",
          description: "Gatilho do disparo.",
          properties: {
            type: { type: "string", enum: ["schedule", "gmail_new"] },
            config: {
              type: "object",
              description: "schedule: {repeat_seconds (segundos, obrigatório), first_at? (ISO 8601, ex 2026-08-21T08:00:00-03:00)}. gmail_new: {query (busca Gmail)}.",
              properties: {
                repeat_seconds: { type: "integer", description: "Intervalo em segundos (86400 = diário, 604800 = semanal)" },
                first_at: { type: "string", description: "Primeiro disparo em ISO 8601 (ex: 2026-08-21T08:00:00-03:00)" },
                query: { type: "string", description: "Busca Gmail (ex: 'is:unread subject:urgente')" },
              },
            },
          },
          required: ["type", "config"],
        },
        action: {
          type: "object",
          description: "Ação executada quando o gatilho disparar.",
          properties: {
            type: { type: "string", enum: ["send_message", "run_tool", "process_message"] },
            config: {
              type: "object",
              description: "send_message: {chat_id, template}. process_message: {chat_id, prompt_template}. run_tool: {tool_name, args_template}.",
              properties: {
                chat_id: { type: "string" },
                template: { type: "string" },
                prompt_template: { type: "string" },
                tool_name: { type: "string" },
                args_template: { type: "object" },
              },
            },
          },
          required: ["type", "config"],
        },
      },
      required: ["label", "trigger", "action"],
    },
    run: (args, ctx) => {
      try {
        const a = automations.createAutomation({
          chatId: ctx?.chatId || args.chat_id,
          label: args.label,
          trigger: args.trigger,
          action: args.action,
        });
        return `✅ Automação criada: ${a.id} (${a.label})\n\nUse 'list_automations' pra ver todas, 'cancel_automation ${a.id}' pra parar, 'run_automation_now ${a.id}' pra testar agora.`;
      } catch (e) {
        return `❌ Erro: ${e.message}`;
      }
    },
  },
  list_automations: {
    name: "list_automations",
    desc: "Lista automações ativas do usuário atual.",
    args: { type: "object", properties: {} },
    run: (_, ctx) => {
      const chatId = ctx?.chatId;
      if (!chatId) return "❌ chatId não determinado.";
      const items = automations.listAutomations(chatId);
      if (!items.length) return "Nenhuma automação criada.";
      return items.map((a, i) =>
        `${i + 1}. [${a.id}] ${a.label} ${a.enabled ? "🟢" : "🔴"}\n   Trigger: ${a.trigger.type} ${JSON.stringify(a.trigger.config).slice(0, 60)}\n   Action: ${a.action.type} → ${JSON.stringify(a.action.config).slice(0, 60)}\n   Último run: ${a.last_run || "nunca"}${a.last_error ? " · ⚠ " + a.last_error : ""}`
      ).join("\n\n");
    },
  },
  cancel_automation: {
    name: "cancel_automation",
    desc: "Desativa uma automação pelo ID.",
    args: {
      type: "object",
      properties: { automation_id: { type: "string" } },
      required: ["automation_id"],
    },
    run: (args) => automations.cancelAutomation(String(args.automation_id))
      ? `✅ Automação ${args.automation_id} desativada.`
      : `❌ Automação ${args.automation_id} não encontrada.`,
  },
  run_automation_now: {
    name: "run_automation_now",
    desc: "Força execução imediata de uma automação (útil pra testar).",
    args: {
      type: "object",
      properties: { automation_id: { type: "string" } },
      required: ["automation_id"],
    },
    run: async (args) => {
      try {
        const r = await automations.runNow(String(args.automation_id));
        return `✅ Executado: ${r.matches} match(es), ${r.executed} ação(ões) disparadas.`;
      } catch (e) { return `❌ ${e.message}`; }
    },
  },
};

const PROSPECTOR_TOOLS = {
  prospector_run: {
    name: "prospector_run",
    desc: "Executa imediatamente um ciclo de busca e mineração de novos clientes (para o Zenda AI ou produto ativo) e gera abordagens de vendas.",
    args: { type: "object", properties: {} },
    run: async () => {
      const prospector = require("../prospector");
      const res = await prospector.runCycle();

      // Respeita ok:false. Antes retornava "✅ concluído" em qualquer caso —
      // então falha técnica (ex.: erro de schema gravando lead) chegava ao
      // modelo como "0 novos clientes", e ele inventava "filtros exaustos" e
      // sugeria trocar de nicho. O erro precisa chegar como erro.
      if (res.ok === false) {
        return `❌ O ciclo NÃO concluiu. ${res.error || res.reason || "falha desconhecida"}`;
      }

      const parts = [`✅ Ciclo concluído: ${res.discovered} novos clientes minerados, ${res.outreached} mensagem(ns) confirmada(s) pelo canal.`];
      if (res.queued) {
        // Separado de `outreached` de propósito: enfileirado na extensão não é
        // entregue. Relatar os dois juntos escondia envios que nunca saíram.
        parts.push(`📥 ${res.queued} enfileirada(s) na extensão do Chrome — entrega NÃO confirmada. Se a extensão não estiver rodando e logada, essas mensagens não saem.`);
      }
      if (res.notion) {
        parts.push(res.notion.ok
          ? `📓 Notion: ${res.notion.synced} lead(s) sincronizados.`
          : `📓 Notion: falhou — ${res.notion.error || `${res.notion.failed} erro(s)`}`);
      }
      // Descarte precisa ser VISÍVEL. Sem isso, "5 novos leads" esconde que 40
      // resultados foram jogados fora, e não se sabe se o filtro está calibrado
      // ou se a busca está trazendo lixo.
      if (res.rejected && (res.rejected.aggregator || res.rejected.noContact)) {
        parts.push("🚫 Descartados: " + res.rejected.noContact + " sem contato (telefone/Instagram/e-mail) e " + res.rejected.aggregator + " páginas de diretório/agregador.");
        if (res.rejectedSamples && res.rejectedSamples.length) {
          parts.push("   Exemplos: " + res.rejectedSamples.slice(0, 3).join(" · "));
        }
      }
      if (res.discovered === 0) {
        parts.push("Obs: 0 NOVOS não significa 0 leads — os já conhecidos não são recontados. Use prospector_status para o total.");
      }
      return parts.join("\n");
    },
  },
  prospector_purge_sem_contato: {
    name: "prospector_purge_sem_contato",
    desc: "Remove da base os leads sem NENHUM canal de contato (sem telefone, sem Instagram e sem e-mail) — esses nunca serao abordaveis. Por padrao apenas SIMULA e mostra o que seria removido; passe confirmar=true para apagar de verdade.",
    args: {
      type: "object",
      properties: { confirmar: { type: "boolean", description: "true apaga de verdade. Sem isso, so simula." } },
      required: [],
    },
    run: async (args = {}) => {
      const prospector = require("../prospector");
      // Simula por padrao: apagar lead e irreversivel, e o usuario precisa ver
      // o numero antes de autorizar.
      if (!args.confirmar) {
        const r = prospector.purgeLeadsWithoutContact({ dryRun: true });
        const out = [
          "SIMULACAO — nada foi apagado:",
          "Base atual: " + r.total + " lead(s)",
          "Seriam removidos: " + r.removeriam + " (sem telefone, Instagram nem e-mail)",
          "Permaneceriam: " + r.ficam,
        ];
        if (r.exemplos.length) out.push("Exemplos: " + r.exemplos.join(" · "));
        out.push("Para apagar de verdade, confirme a limpeza.");
        return out.join("\n");
      }
      const r = prospector.purgeLeadsWithoutContact();
      return "Limpeza concluida: " + r.removidos + " lead(s) sem contato removidos e " + r.abordagens + " rascunho(s) descartados. Base: " + r.antes + " para " + r.depois + ".";
    },
  },
  prospector_regerar_rascunhos: {
    name: "prospector_regerar_rascunhos",
    desc: "Regera as abordagens em rascunho com o texto atual (dor antes de produto, pergunta aberta). Os rascunhos antigos sairam do prompt que falava de produto e pedia demonstracao. Nao altera abordagem ja enviada.",
    args: {
      type: "object",
      properties: { limit: { type: "number", description: "Quantos regerar (default 30, max 200)" } },
      required: [],
    },
    run: async (args = {}) => {
      const prospector = require("../prospector");
      const r = await prospector.regenerateDrafts({ limit: args.limit || 30 });
      if (r.candidatos === 0) return "Nao ha rascunho pendente para regerar.";
      const out = [r.regerados + " de " + r.candidatos + " rascunho(s) regerados com o texto novo."];
      if (r.falhas) out.push(r.falhas + " falha(s): " + r.detalhes.join(" | "));
      out.push("Veja o resultado com whatsapp_outreach_list ou instagram_outreach_list.");
      return out.join("\n");
    },
  },
  whatsapp_outreach_list: {
    name: "whatsapp_outreach_list",
    desc: "Mostra os rascunhos de WhatsApp pendentes por completo, para revisao antes do envio, com link wa.me que abre a conversa JA COM A MENSAGEM PREENCHIDA. Use quando o usuario pedir para ver/revisar os rascunhos ou quiser enviar manualmente pelo celular.",
    args: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Quantos rascunhos listar (default 5)" },
        full: { type: "boolean", description: "true mostra o texto inteiro; false resume em 160 chars (default true)" },
      },
      required: [],
    },
    run: async (args = {}) => {
      const db = require("../db");
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 15);
      const { aplicarSaudacao } = require("../prospector");
      const full = args.full !== false;
      // Saudação resolvida AGORA, não quando o rascunho foi gerado: texto criado
      // de manhã e enviado à tarde diria "Bom dia" às 15h.
      const aplicar = (t) => aplicarSaudacao(String(t || "").trim());

      const rows = db.prepare(
        `SELECT l.name, l.city, l.phone, l.email, l.cnpj, o.id AS outreach_id, o.message, o.followup_message
         FROM prospector_outreach o
         JOIN prospector_leads l ON l.id = o.lead_id
         WHERE o.channel = 'whatsapp' AND o.status = 'draft'
           AND l.phone IS NOT NULL AND l.phone != ''
         ORDER BY l.created_at DESC LIMIT ?`
      ).all(limit);

      if (rows.length === 0) {
        const semFone = db.prepare(
          `SELECT COUNT(*) n FROM prospector_outreach o JOIN prospector_leads l ON l.id = o.lead_id
           WHERE o.channel = 'whatsapp' AND o.status = 'draft' AND (l.phone IS NULL OR l.phone = '')`
        ).get().n;
        return semFone > 0
          ? "Nenhum rascunho de WhatsApp com telefone. Ha " + semFone + " rascunho(s) de lead sem numero — esses so servem por Instagram ou e-mail."
          : "Nenhum rascunho de WhatsApp pendente. Rode prospector_run para minerar leads.";
      }

      const out = [
        "RASCUNHOS DE WHATSAPP - " + rows.length + " pendente(s)",
        "O link abre a conversa com a mensagem JA PREENCHIDA. Revise antes de enviar.",
        "",
      ];
      rows.forEach((r, i) => {
        const msg = aplicar(r.message);
        const fone = String(r.phone).replace(/\D/g, "");
        out.push((i + 1) + ") " + r.name + (r.city ? " - " + r.city : "") + "  [id " + r.outreach_id + "]");
        const extras = [];
        if (r.email) extras.push("email: " + r.email);
        if (r.cnpj) extras.push("CNPJ: " + r.cnpj);
        if (extras.length) out.push("   " + extras.join(" | "));
        // wa.me aceita ?text= pre-preenchido — diferente do Instagram, que nao
        // permite. Um toque abre a conversa com o texto pronto.
        out.push("   1) ABERTURA — toque no link, ela vai preenchida:");
        out.push("  [Abrir conversa com a mensagem pronta](https://wa.me/" + fone + "?text=" + encodeURIComponent(msg) + ")");
        out.push("      " + (full ? msg.replace(/\n+/g, " / ") : msg.slice(0, 160)));
        if (r.followup_message) {
          // Só depois de a empresa responder. Mostrar junto evita ter que voltar
          // aqui no meio da conversa para descobrir o que dizer em seguida.
          out.push("   2) DEPOIS QUE RESPONDEREM — envie esta:");
          out.push("      " + aplicar(r.followup_message).replace(/\n+/g, " / "));
        }
        out.push("");
      });
      out.push("Depois de enviar: marcar whatsapp enviado <id> (ou o telefone).");
      out.push("Para editar um texto antes de mandar, peca: reescreve o rascunho <id> com <instrucao>.");
      return out.join("\n");
    },
  },
  whatsapp_outreach_mark_sent: {
    name: "whatsapp_outreach_mark_sent",
    desc: "Marca um rascunho de WhatsApp como enviado, depois que o usuario mandou manualmente. Aceita o id do rascunho ou o telefone do lead.",
    args: {
      type: "object",
      properties: {
        outreach_id: { type: "number", description: "Id do rascunho (aparece na lista)" },
        phone: { type: "string", description: "Telefone do lead, so digitos ou formatado" },
      },
      required: [],
    },
    run: async (args = {}) => {
      const db = require("../db");
      let row;
      if (args.outreach_id) {
        row = db.prepare("SELECT id, lead_id FROM prospector_outreach WHERE id = ? AND channel = 'whatsapp'").get(Number(args.outreach_id));
      } else if (args.phone) {
        // Compara so digitos: o numero e gravado normalizado (5511...) mas o
        // usuario digita com parenteses e hifen.
        const digits = String(args.phone).replace(/\D/g, "");
        row = db.prepare(
          `SELECT o.id, o.lead_id FROM prospector_outreach o JOIN prospector_leads l ON l.id = o.lead_id
           WHERE o.channel = 'whatsapp' AND o.status = 'draft'
             AND REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'+',''),'-',''),' ',''),'(','') LIKE '%' || ? LIMIT 1`
        ).get(digits.slice(-8));
      }
      if (!row) return "Nao achei esse rascunho de WhatsApp pendente. Rode whatsapp_outreach_list para ver os disponiveis.";

      db.prepare("UPDATE prospector_outreach SET status = 'sent', sent_at = unixepoch() WHERE id = ?").run(row.id);
      db.prepare("UPDATE prospector_leads SET status = 'sent', updated_at = unixepoch() WHERE id = ?").run(row.lead_id);
      return "Marcado como enviado. Se responderem, me avise para registrar o retorno.";
    },
  },
  instagram_outreach_list: {
    name: "instagram_outreach_list",
    desc: "Lista as abordagens de Instagram pendentes prontas para envio MANUAL pelo celular: nome do lead, link ig.me que abre a conversa e o texto para colar. Use quando o usuario quiser prospectar pelo Instagram sem PC ligado.",
    args: {
      type: "object",
      properties: { limit: { type: "number", description: "Quantos leads listar (default 5)" } },
      required: [],
    },
    run: async (args = {}) => {
      const db = require("../db");
      const { aplicarSaudacao } = require("../prospector");
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 15);

      // Só rascunho de Instagram, de lead que tem handle e ainda nao foi tratado.
      const rows = db.prepare(
        `SELECT l.name, l.city, l.instagram_handle, l.category, o.id AS outreach_id, o.message, o.followup_message
         FROM prospector_outreach o
         JOIN prospector_leads l ON l.id = o.lead_id
         WHERE o.channel = 'instagram' AND o.status = 'draft'
           AND l.instagram_handle IS NOT NULL AND l.instagram_handle != ''
         ORDER BY l.created_at DESC LIMIT ?`
      ).all(limit);

      if (rows.length === 0) return "Nenhuma abordagem de Instagram pendente. Rode prospector_run para minerar leads com @.";

      const out = [
        "ABORDAGENS DE INSTAGRAM - " + rows.length + " pendente(s)",
        "Toque no link para abrir a conversa, cole o texto e envie. Sai da SUA conta, do seu celular.",
        "",
      ];
      rows.forEach((r, i) => {
        const handle = String(r.instagram_handle).replace(/^@/, "");
        out.push((i + 1) + ") " + r.name + (r.city ? " - " + r.city : ""));
        out.push("  [Abrir a conversa no Instagram](https://ig.me/m/" + handle + ")");
        out.push("   1) ABERTURA (copie e envie):");
        out.push("      " + aplicarSaudacao(String(r.message || "").trim()).replace(/\s+/g, " "));
        if (r.followup_message) {
        out.push("   2) DEPOIS QUE RESPONDEREM:");
        out.push("      " + String(r.followup_message).replace(/\s+/g, " "));
        }
        out.push("");
      });
      out.push("Depois de enviar, diga: marcar instagram enviado <numero da lista>");
      // O Instagram nao aceita mensagem pre-preenchida por URL — o link abre a
      // conversa, o texto precisa ser colado. Dizer isso evita a expectativa de
      // que o link ja leva a mensagem pronta.
      out.push("Obs: o Instagram nao permite pre-preencher a mensagem pelo link; o texto acima e para copiar.");
      return out.join("\n");
    },
  },
  instagram_outreach_mark_sent: {
    name: "instagram_outreach_mark_sent",
    desc: "Marca uma abordagem de Instagram como enviada, depois que o usuario mandou manualmente pelo celular. Aceita o @ do lead ou o id do rascunho.",
    args: {
      type: "object",
      properties: {
        handle: { type: "string", description: "@ do Instagram do lead" },
        outreach_id: { type: "number", description: "Id do rascunho, se souber" },
      },
      required: [],
    },
    run: async (args = {}) => {
      const db = require("../db");
      let row;
      if (args.outreach_id) {
        row = db.prepare("SELECT id, lead_id FROM prospector_outreach WHERE id = ? AND channel = 'instagram'").get(Number(args.outreach_id));
      } else if (args.handle) {
        const h = String(args.handle).replace(/^@/, "").trim();
        // Normaliza os DOIS lados: o handle e gravado as vezes com @ e as vezes
        // sem (depende de onde foi extraido), e comparar cru nao encontrava.
        row = db.prepare(
          `SELECT o.id, o.lead_id FROM prospector_outreach o JOIN prospector_leads l ON l.id = o.lead_id
           WHERE o.channel = 'instagram' AND o.status = 'draft'
             AND REPLACE(LOWER(l.instagram_handle), '@', '') = LOWER(?) LIMIT 1`
        ).get(h);
      }
      if (!row) return "Nao achei esse rascunho de Instagram pendente. Rode instagram_outreach_list para ver os disponiveis.";

      // 'sent' aqui e legitimo: foi o proprio usuario que enviou e confirmou,
      // diferente do envio automatico pela extensao, que fica em 'queued'.
      db.prepare("UPDATE prospector_outreach SET status = 'sent', sent_at = unixepoch() WHERE id = ?").run(row.id);
      db.prepare("UPDATE prospector_leads SET status = 'sent', updated_at = unixepoch() WHERE id = ?").run(row.lead_id);
      return "Marcado como enviado. Se responderem, me avise para registrar o retorno.";
    },
  },
  ingles_exercicio: {
    name: "ingles_exercicio",
    desc: "Monta o exercicio de ingles do dia: revisao das palavras vencidas (repeticao espacada) + texto curto com ~98% de palavras conhecidas + pergunta de entendimento + producao. Use quando o usuario pedir aula/pratica de ingles.",
    args: {
      type: "object",
      properties: {
        dominio: { type: "string", description: "dev | vendas | clinica. Se omitido, alterna sozinho." },
        novas: { type: "number", description: "Quantas palavras novas (default 2). Acima de 3 quebra a regra dos 98%." },
      },
      required: [],
    },
    run: async (args = {}) => {
      const en = require("../autonomous/english");
      const ex = await en.exercicioDoDia({
        dominio: args.dominio || null,
        novas: Math.min(Math.max(Number(args.novas) || 2, 1), 3),
      });
      const st = en.stats();
      const out = [];
      if (!ex.ok) {
        out.push("Nao consegui gerar o texto novo (" + ex.error + ").");
        if (ex.due.length) {
          out.push("Mas a revisao nao depende disso. Palavras vencidas hoje:");
          for (const d of ex.due) out.push("- " + d.palavra + (d.contexto ? " — no contexto: " + d.contexto : ""));
          out.push("Tente lembrar o significado antes de olhar. Depois me diga se acertou.");
        }
        return out.join("\n");
      }
      out.push(ex.texto);
      out.push("");
      out.push("Vocabulario: " + st.total + " palavra(s), " + st.consolidadas + " consolidada(s), " + st.due + " para revisar hoje.");
      if (ex.due.length) out.push("Reciclei em contexto novo: " + ex.due.map((d) => d.palavra).join(", ") + ". Me diga se lembrou de cada uma.");
      return out.join("\n");
    },
  },
  ingles_revisar: {
    name: "ingles_revisar",
    desc: "Registra se o usuario lembrou ou nao de uma palavra, e reagenda pela repeticao espacada. Acertou avanca o intervalo (1, 3, 7, 16, 35, 90 dias); errou volta ao inicio.",
    args: {
      type: "object",
      properties: {
        palavra: { type: "string", description: "A palavra revisada" },
        acertou: { type: "boolean", description: "true se lembrou o significado" },
      },
      required: ["palavra", "acertou"],
    },
    run: async (args = {}) => {
      const en = require("../autonomous/english");
      const db = require("../db");
      const p = String(args.palavra || "").trim().toLowerCase();
      const row = db.prepare("SELECT id FROM english_vocab WHERE palavra = ?").get(p);
      if (!row) return 'Nao tenho "' + p + '" no vocabulario. Use ingles_nova_palavra para cadastrar.';
      const r = en.review(row.id, !!args.acertou);
      return r.acertou
        ? 'Boa. "' + r.palavra + '" volta em ' + r.voltaEm + " dia(s)."
        : '"' + r.palavra + '" voltou para o inicio: revisao amanha. Errar e parte do processo — e a dificuldade de lembrar que fixa.';
    },
  },
  ingles_nova_palavra: {
    name: "ingles_nova_palavra",
    desc: "Cadastra palavra nova no vocabulario, SEMPRE com a frase onde ela apareceu. O contexto e obrigatorio na pratica: palavra isolada nao cola.",
    args: {
      type: "object",
      properties: {
        palavra: { type: "string" },
        significado: { type: "string", description: "Em portugues" },
        contexto: { type: "string", description: "A frase em ingles onde a palavra apareceu" },
        dominio: { type: "string", description: "dev | vendas | clinica | geral" },
      },
      required: ["palavra", "significado"],
    },
    run: async (args = {}) => {
      const en = require("../autonomous/english");
      const r = en.addWord({
        palavra: args.palavra,
        significado: args.significado,
        contexto: args.contexto || null,
        dominio: args.dominio || "geral",
      });
      if (!r.novo) return '"' + args.palavra + '" ja estava no vocabulario. Encontro numero ' + r.encounters + " — reencontrar em contexto diferente e o que consolida.";
      const aviso = args.contexto ? "" : " (sem contexto: cadastre a frase onde ela apareceu, isolada ela nao cola)";
      return 'Cadastrada: "' + args.palavra + '". Primeira revisao amanha.' + aviso;
    },
  },
  ingles_corrigir: {
    name: "ingles_corrigir",
    desc: "Corrige uma frase que o usuario escreveu em ingles, por REFORMULACAO (recast): devolve como um nativo diria, em vez de marcar erro.",
    args: {
      type: "object",
      properties: { frase: { type: "string", description: "A frase em ingles escrita pelo usuario" } },
      required: ["frase"],
    },
    run: async (args = {}) => {
      const en = require("../autonomous/english");
      const r = await en.corrigir(args.frase);
      return r.ok ? r.resposta : "Nao consegui corrigir agora: " + r.error;
    },
  },
  estudos_hoje: {
    name: "estudos_hoje",
    desc: "Mostra onde o usuario esta no roadmap de 12 meses: mes atual, modulo, itens pendentes, fase do ingles e quanto ele estudou na semana contra a meta de 1h30 tecnico + 30min ingles por dia.",
    args: { type: "object", properties: {} },
    run: async () => {
      const rm = require("../autonomous/roadmap");
      const p = rm.progresso();
      if (!p.inicio) return "O roadmap esta cadastrado, mas falta a data de inicio. Diga quando voce comecou (ou vai comecar) que eu registro.";
      const out = [
        "Mes " + p.mes + " de 12 — modulo: " + p.modulo.nome,
        "Criterio para fechar o modulo: " + p.modulo.criterio,
        "Ingles nesta fase (" + p.faseIngles.meses + "): " + p.faseIngles.foco,
        "",
        "Itens do modulo: " + (p.itens.doModulo?.f || 0) + "/" + (p.itens.doModulo?.t || 0) + " · geral " + p.itens.feitos + "/" + p.itens.total,
        "Semana: " + p.semana.minTecnico + "min tecnico (" + p.semana.pctTecnico + "% da meta) e " + p.semana.minIngles + "min ingles (" + p.semana.pctIngles + "%), em " + p.semana.diasRegistrados + " dia(s) registrado(s).",
      ];
      const pend = rm.itens(p.modulo.id, { pendentes: true });
      if (pend.length) {
        out.push("");
        out.push("Pendentes deste modulo:");
        for (const i of pend.slice(0, 6)) {
          out.push("- [" + i.tipo + "] " + i.titulo + (i.url ? " — [abrir](" + i.url + ")" : ""));
        }
      }
      if (p.semana.pctTecnico < 60 || p.semana.pctIngles < 60) {
        out.push("");
        out.push("Lembrete que voce mesmo escreveu: " + rm.verdadeDoDia());
      }
      return out.join("\n");
    },
  },
  estudos_registrar: {
    name: "estudos_registrar",
    desc: "Registra minutos estudados hoje (tecnico e/ou ingles) e/ou marca item do roadmap como concluido. Sem registro nao ha como dizer se as 2h/dia estao acontecendo.",
    args: {
      type: "object",
      properties: {
        min_tecnico: { type: "number", description: "Minutos de estudo tecnico" },
        min_ingles: { type: "number", description: "Minutos de ingles" },
        item_id: { type: "number", description: "Id de item do roadmap para marcar como concluido" },
        nota: { type: "string" },
        inicio: { type: "string", description: "Define a data de inicio do roadmap, formato AAAA-MM-DD" },
      },
      required: [],
    },
    run: async (args = {}) => {
      const rm = require("../autonomous/roadmap");
      const out = [];
      if (args.inicio) {
        rm.setInicio(String(args.inicio).trim());
        out.push("Inicio do roadmap definido em " + args.inicio + " — voce esta no mes " + rm.mesAtual() + ".");
      }
      if (args.min_tecnico || args.min_ingles) {
        const h = rm.registrarHoras({
          minTecnico: Number(args.min_tecnico) || 0,
          minIngles: Number(args.min_ingles) || 0,
          nota: args.nota || null,
        });
        out.push("Hoje: " + h.min_tecnico + "min tecnico + " + h.min_ingles + "min ingles.");
      }
      if (args.item_id) {
        out.push(rm.concluirItem(Number(args.item_id), args.nota || null)
          ? "Item " + args.item_id + " marcado como concluido."
          : "Nao achei o item " + args.item_id + ".");
      }
      return out.length ? out.join("\n") : "Nada para registrar. Informe minutos, item_id ou a data de inicio.";
    },
  },
  habitos_status: {
    name: "habitos_status",
    desc: "Mostra os habitos rastreados: se foram feitos hoje, a sequencia atual, a melhor sequencia e a aderencia da semana. Use quando o usuario perguntar como esta indo nos habitos, ou antes de cobrar algo dele.",
    args: { type: "object", properties: {} },
    run: async () => {
      const H = require("../autonomous/habits");
      const hs = H.resumo({ dias: 30 });
      if (!hs.length) return "Nenhum habito cadastrado ainda. Use habito_criar para comecar — sem registro nao ha o que acompanhar.";
      const out = [];
      for (const h of hs) {
        const marca = h.hoje === "feito" ? "feito hoje" : h.hoje === "falhou" ? "NAO feito hoje" : "hoje ainda em aberto";
        if (h.tipo === "semanal") {
          out.push(`- ${h.nome} (semanal): ${h.na_semana}/${h.meta_semanal} nesta semana — ${marca}`);
        } else {
          out.push(`- ${h.nome}: sequencia de ${h.streak} dia(s) (melhor: ${h.melhor_streak}), ${h.na_semana}/7 na semana — ${marca}`);
        }
      }
      const pend = H.pendentesHoje();
      if (pend.length) out.push("", "Ainda sem resposta hoje: " + pend.map((x) => x.nome).join(", ") + ".");
      return out.join("\n");
    },
  },
  habito_criar: {
    name: "habito_criar",
    desc: "Cadastra um habito para rastrear. Use tipo semanal com meta quando a frequencia nao e diaria (ex.: academia 3x por semana) — habito semanal medido por sequencia diaria fica sempre quebrado.",
    args: {
      type: "object",
      properties: {
        nome: { type: "string" },
        tipo: { type: "string", description: "diario (default) ou semanal" },
        meta_semanal: { type: "number", description: "Quantas vezes por semana, quando tipo=semanal" },
      },
      required: ["nome"],
    },
    run: async (args = {}) => {
      const H = require("../autonomous/habits");
      const r = H.criar({ nome: args.nome, tipo: args.tipo, metaSemanal: args.meta_semanal });
      if (r.reativado) return `"${args.nome}" voltou a ser rastreado — o historico antigo de check-ins foi preservado.`;
      if (!r.novo) return `"${args.nome}" ja estava cadastrado.`;
      return `Habito "${args.nome}" criado. Marque com habito_marcar quando fizer.`;
    },
  },
  habito_marcar: {
    name: "habito_marcar",
    desc: "Marca um habito como feito ou nao feito num dia. Aceita o nome parcial. Marcar como nao feito e diferente de nao responder: so o registro explicito quebra a sequencia.",
    args: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome (ou parte) do habito" },
        feito: { type: "boolean", description: "true = fez (default), false = registrou que nao fez" },
        ymd: { type: "string", description: "Dia AAAA-MM-DD. Vazio = hoje." },
        nota: { type: "string" },
      },
      required: ["nome"],
    },
    run: async (args = {}) => {
      const H = require("../autonomous/habits");
      const h = H.porNome(args.nome);
      if (!h) return `Nao achei habito com "${args.nome}". Os cadastrados: ` + (H.listar().map((x) => x.nome).join(", ") || "nenhum") + ".";
      const feito = args.feito === false ? false : true;
      H.marcar(h.id, feito, { ymd: args.ymd || null, nota: args.nota || null });
      if (!feito) return `Registrado que "${h.nome}" nao foi feito. Sequencia zerada — errar um dia e dado, nao fracasso.`;
      const s = h.tipo === "diario" ? H.streak(h.id) : null;
      return s != null
        ? `"${h.nome}" marcado. Sequencia: ${s} dia(s).`
        : `"${h.nome}" marcado. ${H.naSemana(h.id)}/${h.meta_semanal} nesta semana.`;
    },
  },
  humor_registrar: {
    name: "humor_registrar",
    desc: "Registra o humor do dia de 1 a 5, com nota opcional. Base do mapa de humor da semana — sem registro, qualquer leitura sobre estar melhor ou pior e chute.",
    args: {
      type: "object",
      properties: {
        score: { type: "number", description: "1 (muito ruim) a 5 (muito bom)" },
        nota: { type: "string", description: "O que marcou o dia" },
        ymd: { type: "string", description: "Dia AAAA-MM-DD. Vazio = hoje." },
      },
      required: ["score"],
    },
    run: async (args = {}) => {
      const mentor = require("../autonomous/mentor");
      const painel = require("../autonomous/painel");
      const r = mentor.registrarHumor(args.score, args.nota || null, args.ymd || null);
      const m = painel.mapaHumor(14);
      const linhas = [`Humor de ${r.ymd || "hoje"} registrado: ${r.score}/5.`];
      if (m.media != null) linhas.push(`Media dos ultimos 14 dias: ${m.media}/5 em ${m.dias_registrados} registro(s).`);
      // Só afirma tendência quando as duas metades da janela têm dado.
      if (m.tendencia) linhas.push(`Tendencia: ${m.tendencia}.`);
      else linhas.push("Ainda nao da para dizer tendencia: falta registro em uma das metades do periodo.");
      return linhas.join("\n");
    },
  },
  painel_resumo: {
    name: "painel_resumo",
    desc: "Resumo do painel inteiro: habitos, humor, metas abertas, aprendizado (ingles e roadmap) e numeros de prospeccao. Use para dar um panorama ou preparar o toque da noite.",
    args: { type: "object", properties: {} },
    run: async () => {
      const p = require("../autonomous/painel").tudo({ dias: 30 });
      const out = [];
      // Cada seção reporta o próprio erro: uma quebrada não apaga as outras.
      const h = p.habitos.dados;
      if (!p.habitos.ok) out.push(`Habitos: erro (${p.habitos.erro}).`);
      else if (!h.length) out.push("Habitos: nenhum cadastrado.");
      else out.push("Habitos: " + h.map((x) => `${x.nome} ${x.tipo === "semanal" ? x.na_semana + "/" + x.meta_semanal + " na semana" : x.streak + "d"}`).join(" · "));

      const m = p.humor.dados;
      if (p.humor.ok) {
        out.push(m.media != null
          ? `Humor: media ${m.media}/5 em ${m.dias_registrados} dia(s)${m.tendencia ? ", " + m.tendencia : ""}; ${m.dias_sem_registro} dia(s) sem registro.`
          : "Humor: sem nenhum registro na janela.");
      }

      const mt = p.metas.dados;
      if (p.metas.ok) {
        const atrasadas = mt.abertos.filter((c) => c.atrasado).length;
        out.push(`Metas: ${mt.abertos.length} aberta(s)${atrasadas ? ` (${atrasadas} atrasada(s))` : ""}, ${mt.fechados_7d.length} fechada(s) em 7 dias.`);
      }

      const ap = p.aprendizado.dados;
      if (p.aprendizado.ok) {
        out.push(`Ingles: ${ap.ingles.vocabulario} palavra(s), ${ap.ingles.consolidadas} consolidada(s), ${ap.ingles.para_revisar_hoje} para revisar hoje.`);
        out.push(ap.roadmap.inicio
          ? `Roadmap: mes ${ap.roadmap.mes} — ${ap.roadmap.modulo?.nome || "?"}; semana com ${ap.roadmap.semana.pctTecnico}% da meta tecnica e ${ap.roadmap.semana.pctIngles}% da de ingles.`
          : "Roadmap: falta a data de inicio — sem ela nao da para dizer em que mes voce esta.");
      }

      const n = p.negocio.dados;
      if (p.negocio.ok && n.leads_7d != null) {
        out.push(`Prospeccao: ${n.leads_7d} lead(s) em 7 dias (${n.com_contato_7d ?? 0} com contato), ${n.enviadas_7d ?? 0} enviada(s), ${n.rascunhos ?? 0} rascunho(s) parado(s).`);
      }
      return out.join("\n");
    },
  },
  whatsapp_session_backup: {
    name: "whatsapp_session_backup",
    desc: "Exporta a sessao do WhatsApp cifrada, como texto, para o usuario guardar FORA do Railway. E o unico jeito de reconectar sem escanear QR se o volume for recriado. O texto sozinho nao serve sem o segredo do servidor.",
    args: { type: "object", properties: {} },
    run: async () => {
      const vault = require("../channels/whatsapp/sessionVault");
      const st = vault.status();
      if (!st.hasSecret) return "Nao posso cifrar: falta SESSION_BACKUP_KEY (ou AGENT_INTERNAL_SECRET) no ambiente.";
      const r = vault.exportBlob();
      if (!r.ok) return "Nao consegui exportar: " + r.error;
      const linhas = [
        "Sessao do WhatsApp exportada (" + r.files + " arquivos, origem: " + r.from + ").",
        "GUARDE o texto abaixo num lugar seguro fora do Railway. Ele reconecta o WhatsApp sem QR.",
        "",
        r.blob,
      ];
      return linhas.join("\n");
    },
  },
  whatsapp_session_restore: {
    name: "whatsapp_session_restore",
    desc: "Restaura a sessao do WhatsApp a partir do texto cifrado gerado por whatsapp_session_backup. Use quando o volume foi recriado e o WhatsApp voltou a pedir QR.",
    args: {
      type: "object",
      properties: { blob: { type: "string", description: "O texto cifrado completo (comeca com v1.)" } },
      required: ["blob"],
    },
    run: async (args = {}) => {
      const vault = require("../channels/whatsapp/sessionVault");
      const r = vault.importBlob(args.blob);
      if (!r.ok) return "Nao restaurou: " + r.error;
      return "Sessao restaurada (" + r.restored + " arquivos). Reinicie a conexao do WhatsApp para ela ser usada.";
    },
  },
  whatsapp_session_status: {
    name: "whatsapp_session_status",
    desc: "Mostra o estado da persistencia da sessao do WhatsApp: arquivos locais, backup no banco e quando foi salvo.",
    args: { type: "object", properties: {} },
    run: async () => {
      const vault = require("../channels/whatsapp/sessionVault");
      const st = vault.status();
      const nc = require("../channels/whatsapp/nativeClient").getStatus();
      const out = [
        "Conexao: " + (nc.connected ? "conectado" : nc.state),
        "Arquivos de sessao no disco: " + st.localFiles,
        "Backup cifrado no banco: " + (st.backupFiles ? st.backupFiles + " arquivos (" + st.backupAt + ")" : "nenhum"),
        "Chave de cifra disponivel: " + (st.hasSecret ? "sim" : "NAO - backup desabilitado"),
        "Diretorio: " + st.authDir,
      ];
      if (!st.backupFiles && st.localFiles) out.push("Aviso: ha sessao local sem backup. Rode whatsapp_session_backup e guarde o texto.");
      return out.join("\n");
    },
  },
  notion_leads_setup: {
    name: "notion_leads_setup",
    desc: "Configura onde a listagem de leads é salva no Notion. Passe parent_page_id para CRIAR um banco novo já com os campos certos (Nome, Telefone, Instagram, Site, Cidade, Nicho, Status, Origem, Data), ou database_id para usar um banco que já existe.",
    args: {
      type: "object",
      properties: {
        parent_page_id: { type: "string", description: "ID da página do Notion que vai conter o banco novo. Cria o banco com os tipos corretos." },
        database_id: { type: "string", description: "ID de um banco já existente, para usar em vez de criar." },
        title: { type: "string", description: "Nome do banco a criar (default: 'Leads Zenda')" },
      },
      required: [],
    },
    run: async (args = {}) => {
      const nl = require("../notionLeads");
      const raw = args.database_id || args.parent_page_id || args.url;
      if (!raw) return "Informe a URL (ou o id) da pagina onde criar o banco, ou de um banco que ja existe.";

      const id = nl.normalizeNotionId(raw);
      if (!id) return "Nao reconheci um id do Notion em: " + String(raw).slice(0, 80) + ". Cole a URL da pagina ou do banco.";

      // URL de banco tem ?v=<viewId>; de pagina nao tem. Detectar isso evita o
      // erro mais comum: mandar id de banco como parent_page_id (e vice-versa),
      // que o Notion recusa com mensagem pouco obvia.
      const looksLikeDb = args.database_id ? true : nl.isDatabaseUrl(raw);

      if (looksLikeDb) {
        // Completa o que faltar em vez de sincronizar pela metade: propriedade
        // ausente e ignorada em silencio pelo sync, o que produziria uma
        // listagem so de nomes.
        const ens = await nl.ensureLeadProperties(id);
        if (!ens.ok) return "Falhou: " + ens.error;
        nl.setLeadsDatabase(id);
        const out = ["Listagem de leads apontada para o banco " + id + "."];
        out.push(ens.alreadyComplete
          ? "O banco ja tinha todas as propriedades."
          : "Criei as que faltavam: " + ens.added.join(", ") + ".");
        if (!ens.hasTitle) out.push("ATENCAO: esse banco nao tem coluna de titulo — o nome do lead nao vai aparecer.");
        out.push("Rode notion_leads_sync para enviar os pendentes.");
        return out.join(" ");
      }

      const r = await nl.createLeadsDatabase(id, args.title || "Leads Zenda");
      return r.ok
        ? "Banco criado no Notion: " + (r.url || r.databaseId) + ". Ja configurado — rode notion_leads_sync para enviar os leads existentes."
        : "Nao criou o banco: " + r.error;
    },
  },
  notion_leads_sync: {
    name: "notion_leads_sync",
    desc: "Envia para o Notion os leads que ainda não foram sincronizados, e informa quantos estão pendentes.",
    args: {
      type: "object",
      properties: { limit: { type: "number", description: "Máximo de leads por execução (default 25)" } },
      required: [],
    },
    run: async (args = {}) => {
      const nl = require("../notionLeads");
      const st = nl.stats();
      if (!st.configured) {
        return `❌ Notion de leads não configurado. Falta ${!require("../config").NOTION_TOKEN ? "NOTION_TOKEN" : "o banco de leads"}. Use notion_leads_setup.`;
      }
      const r = await nl.syncPendingLeads({ limit: Math.min(Math.max(Number(args.limit) || 25, 1), 100) });
      const after = nl.stats();
      return r.ok
        ? `✅ ${r.synced} lead(s) enviados ao Notion. Total lá: ${after.sent}/${after.total} · pendentes: ${after.pending}`
        : `⚠️ ${r.synced} enviados, ${r.failed || 0} falharam. ${r.error || (r.errors || []).join(" | ")}`;
    },
  },
  prospector_status: {
    name: "prospector_status",
    desc: "Consulta o status em tempo real do motor de prospecção 24/7, métricas do dia, produto ativo e total de leads.",
    args: { type: "object", properties: {} },
    run: async () => {
      const prospector = require("../prospector");
      const s = prospector.getStats();
      return `📊 Status do Prospector:\n• Produto Ativo: ${s.settings.product_name}\n• Ativo 24/7: ${s.running ? "Sim" : "Não"}\n• Total de Clientes: ${s.totalLeads}\n• Abordagens Enviadas: ${s.sentOutreach}\n• Rascunhos Prontos: ${s.draftedOutreach}\n• Nichos: ${s.settings.target_keywords}\n• Cidades: ${s.settings.target_location}`;
    },
  },
  prospector_avatar: {
    name: "prospector_avatar",
    desc: "Realiza pesquisa de mercado com IA e WebSearch para mapear o Avatar, ICP, Dores latentes, Objeções e Ganchos de vendas para qualquer nicho.",
    args: {
      type: "object",
      properties: {
        niche: { type: "string", description: "Nicho a pesquisar (ex: 'Clínicas Odontológicas', 'Clínicas de Estética', 'Escritórios')" },
        product: { type: "string", description: "Nome do produto (opcional, default: produto ativo)" },
      },
      required: ["niche"],
    },
    run: async (args) => {
      const prospector = require("../prospector");
      const res = await prospector.researchMarketAvatar(args.niche, args.product);
      return res.ok ? res.dossier : `❌ A pesquisa de mercado para "${args.niche}" falhou: ${res.error}`;
    },
  },
  prospector_list_leads: {
    name: "prospector_list_leads",
    desc: "Lista os últimos clientes prospectados com telefones WhatsApp, perfis do Instagram e abordagens geradas.",
    args: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Quantidade de leads a listar (default 10)" },
      },
    },
    run: async (args) => {
      const prospector = require("../prospector");
      const leads = prospector.listLeads(args.limit || 10);
      if (!leads.length) return "Nenhum cliente registrado ainda.";
      return leads.map((l, i) =>
        `${i + 1}. **${l.name}** (${l.category} - ${l.city})\n   Status: ${l.status} | Canal: ${l.phone ? `📱 WA: ${l.phone}` : ""} ${l.instagram_handle ? `📸 @${l.instagram_handle}` : ""}\n   Msg: ${l.wa_message ? l.wa_message.slice(0, 100) + "..." : "Sem rascunho"}`
      ).join("\n\n");
    },
  },
  prospector_portfolio: {
    name: "prospector_portfolio",
    desc: "Lista os produtos cadastrados no portfólio de vendas e qual está ativo no momento.",
    args: { type: "object", properties: {} },
    run: async () => {
      const prospector = require("../prospector");
      const prods = prospector.listProducts();
      return prods.map((p) => `• **${p.name}** [ID: \`${p.id}\`] ${p.is_active ? "🟢 *[ATIVO]*" : "⚪"}\n  _${p.description}_\n  Nichos: ${p.target_niches}\n  Cidades: ${p.target_locations}`).join("\n\n");
    },
  },
  prospector_set_product: {
    name: "prospector_set_product",
    desc: "Ativa um produto do portfólio para a prospecção 24/7.",
    args: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "ID do produto (ex: 'zenda-ai', '9router-gateway')" },
      },
      required: ["product_id"],
    },
    run: async (args) => {
      const prospector = require("../prospector");
      const active = prospector.setActiveProduct(args.product_id);
      return `🚀 Produto ativo atualizado para "${active.name}". Nichos: ${active.target_niches}, Cidades: ${active.target_locations}.`;
    },
  },
};

Object.assign(TOOLS, PHONE_TOOLS);
Object.assign(TOOLS, NOTION_TOOLS);
Object.assign(TOOLS, CHANNEL_TOOLS);
Object.assign(TOOLS, GOOGLE_TOOLS);
Object.assign(TOOLS, LINKEDIN_TOOLS);
Object.assign(TOOLS, AUTOMATION_TOOLS);
Object.assign(TOOLS, INTROSPECTION_TOOLS);
Object.assign(TOOLS, PROSPECTOR_TOOLS);

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
