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
Object.assign(TOOLS, PHONE_TOOLS);
Object.assign(TOOLS, NOTION_TOOLS);

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
