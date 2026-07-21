const { Telegraf } = require("telegraf");
const { BOT_TOKEN } = require("./config");
const { getStatus } = require("./models");
const { AGENT_LIST, getAgent } = require("./agents");
const { getHistory, clearHistory, processMessage } = require("./orchestrator");
const { popNotifies } = require("./tools");
const farejador = require("./farejador");
const notion = require("./notion");

function createBot() {
  if (!BOT_TOKEN) {
    console.log("[Telegram] BOT_TOKEN não configurado — bot desativado");
    return null;
  }

  const bot = new Telegraf(BOT_TOKEN);

  // Envia notificações pendentes a cada 10s
  setInterval(async () => {
    // Não temos acesso ao chatId aqui sem um mapa chatId→username
    // As notificações são enviadas inline nas respostas por enquanto
  }, 10000);

  bot.start(async (ctx) => {
    const status = getStatus();
    await ctx.reply(
      `Olá! 🧑‍💻\n\nModelos: ${status.available}/${status.total}\n\n` +
      `Comandos:\n/new — limpar histórico\n/status — status dos modelos\n/agents — lista de especialistas\n/notion — notas no Notion\n/phone — configurar PhoneAgent (celular)\n\n` +
      `Basta perguntar — o sistema escolhe o especialista certo, e outro complementa.`
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      "**Comandos:**\n" +
      "/start — iniciar\n/new — limpar histórico\n/status — status\n/agents — especialistas\n/phone — configurar PhoneAgent\n\n" +
      "Qualquer pergunta ativa o especialista do tema + revisor automático."
    );
  });

  bot.command("new", async (ctx) => {
    clearHistory(ctx.chat.id);
    await ctx.reply("🧹 Histórico limpo!");
  });

  bot.command("status", async (ctx) => {
    const s = getStatus();
    let msg = `📊 *Status dos Modelos*\n\n`;
    msg += `Disponíveis: ${s.available}/${s.total}\n\n*Ordem:*\n`;
    s.ranking.slice(0, 10).forEach((m, i) => {
      const blocked = s.blocked.find((b) => b.modelId === m);
      const label = blocked ? `⏳ ${blocked.retryIn}s` : "✅";
      msg += `${i + 1}. \`${m.split("/").pop()}\` ${label}\n`;
    });
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  bot.command("agents", async (ctx) => {
    let msg = `*Especialistas*\n\n`;
    AGENT_LIST.forEach((a) => {
      msg += `${a.emoji} **${a.name}** — ${a.desc}\n`;
    });
    msg += `\nO sistema escolhe o especialista certo + outro complementa.`;
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  bot.command("phone", async (ctx) => {
    await ctx.reply(
      `📱 *PhoneAgent — Controlar Celular pelo Bot*\n\n` +
      `Para conectar seu celular:\n\n` +
      `1. Instale Termux na Play Store/F-Droid\n` +
      `2. Instale Termux:API pelo F-Droid\n` +
      `3. No Termux execute:\n` +
      "```\npkg install nodejs\nnpm install express\n```\n" +
      `4. Copie o script phone-agent/server.js para o Termux\n` +
      `5. Execute: \`node server.js\`\n` +
      `6. Exponha com Cloudflare Tunnel:\n` +
      "```\ncloudflared tunnel --url http://localhost:3333\n```\n" +
      `7. Configure a URL gerada no .env:\n` +
      "```\nPHONE_AGENT_URL=https://exemplo.trycloudflare.com\n```\n\n" +
      `Após configurado, os agentes podem:\n` +
      `📱 Abrir URLs no navegador\n` +
      `📱 Enviar notificações push\n` +
      `📱 Ler arquivos do celular\n` +
      `📱 Executar comandos no Termux`
    );
  });

  bot.command("farejador", async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const sub = args[0]?.toLowerCase();

    if (sub === "add" || sub === "criar") {
      const query = args.slice(1, -1).join(" ") || args.slice(1).join(" ");
      const rawInterval = args[args.length - 1];
      let intervalSec = 21600;
      if (/^\d+[hm]$/i.test(rawInterval)) {
        const n = parseInt(rawInterval);
        intervalSec = rawInterval.endsWith("h") ? n * 3600 : n * 60;
      }
      if (!query || query.length < 3) {
        return ctx.reply("Uso: /farejador add \"termo de busca\" [intervalo]\nEx: /farejador add \"novos modelos de IA\" 6h");
      }
      const f = farejador.add(ctx.chat.id, query, intervalSec);
      await ctx.reply(`\u{1F43E} *Farejador criado!*\n\nID: \`${f.id}\`\nBusca: ${f.query}\nIntervalo: ${intervalSec / 3600}h\n\nComandos:\n/farejador list\n/farejador pause ${f.id}\n/farejador resume ${f.id}\n/farejador remove ${f.id}`, { parse_mode: "Markdown" });
      return;
    }

    if (sub === "list" || sub === "listar") {
      const lista = farejador.list(ctx.chat.id);
      if (lista.length === 0) return ctx.reply("Nenhum farejador ativo. Crie um com /farejador add \"busca\" 6h");
      let msg = `\u{1F43E} *Farejadores ativos:*\n\n`;
      lista.forEach((f) => {
        const status = f.paused ? "\u{23F8}\u{FE0F} Pausado" : "\u{25B6}\u{FE0F} Ativo";
        msg += `\`${f.id}\` ${status} — "${f.query}" a cada ${f.intervalSec / 3600}h\n`;
      });
      await ctx.reply(msg, { parse_mode: "Markdown" });
      return;
    }

    if (sub === "pause" && args[1]) {
      const ok = farejador.pause(args[1]);
      return ctx.reply(ok ? `\u{23F8}\u{FE0F} Farejador \`${args[1]}\` pausado.` : "Farejador não encontrado.", { parse_mode: "Markdown" });
    }

    if (sub === "resume" && args[1]) {
      const ok = farejador.resume(args[1]);
      return ctx.reply(ok ? `\u{25B6}\u{FE0F} Farejador \`${args[1]}\` retomado.` : "Farejador não encontrado.", { parse_mode: "Markdown" });
    }

    if ((sub === "remove" || sub === "stop" || sub === "parar") && args[1]) {
      farejador.remove(args[1]);
      return ctx.reply(`\u{1F5D1}\u{FE0F} Farejador \`${args[1]}\` removido.`, { parse_mode: "Markdown" });
    }

    await ctx.reply(
      "\u{1F43E} *Farejador* — busca contínua na web\n\n" +
      "/farejador add \"consulta\" 6h — criar (intervalo: 30m, 2h, 12h etc)\n" +
      "/farejador list — listar ativos\n" +
      "/farejador pause id — pausar\n" +
      "/farejador resume id — retomar\n" +
      "/farejador remove id — parar\n\n" +
      "Quando encontrar resultados novos, avisa automático.",
      { parse_mode: "Markdown" }
    );
  });

  bot.command("id", async (ctx) => {
    const chatId = ctx.chat.id;
    const link = `https://9router-agent-production.up.railway.app/chat?link=${chatId}`;
    await ctx.reply(
      `🆔 *Seu Chat ID:* \`${chatId}\`\n\n` +
      `Para linkar com o Web Chat:\n` +
      `1. Acesse: ${link}\n` +
      `2. Ou copie o ID acima e cole no botão "Link Telegram" do chat web.\n\n` +
      `_Compartilhando o mesmo ID, web e Telegram veem o mesmo histórico._`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("notion", async (ctx) => {
    if (!notion.isConfigured()) {
      return ctx.reply("❌ Notion não configurado. Peça pro admin configurar NOTION_TOKEN e NOTION_DATABASE_ID.");
    }
    const args = ctx.message.text.split(" ").slice(1);
    const sub = args[0]?.toLowerCase();

    if (sub === "save" || sub === "salvar") {
      const text = args.slice(1).join(" ");
      if (!text) return ctx.reply("Uso: /notion save <texto>\nEx: /notion save Ideia para um novo projeto de IA");
      ctx.reply("📝 Salvando no Notion...").then(async (sent) => {
        const r = await notion.createPage(
          text.split("\n")[0].slice(0, 80),
          text,
          ["telegram"],
          "telegram"
        );
        const msg = r.ok
          ? `✅ Salvo no Notion!\n${r.url}`
          : `❌ Erro: ${r.error}`;
        ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, msg);
      });
      return;
    }

    if (sub === "list" || sub === "listar") {
      ctx.reply("📋 Buscando notas...").then(async (sent) => {
        const r = await notion.queryDatabase({}, [{ property: "Criado", direction: "descending" }]);
        if (!r.ok) return ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, `❌ Erro: ${r.error}`);
        if (r.pages.length === 0) return ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, "Nenhuma nota encontrada.");
        let msg = `📋 *Últimas notas:*\n\n`;
        r.pages.slice(0, 10).forEach((p, i) => {
          msg += `${i + 1}. [${p.title}](${p.url})\n`;
        });
        ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, msg, { parse_mode: "Markdown", disable_web_page_preview: true });
      });
      return;
    }

    if (sub === "search" || sub === "buscar") {
      const query = args.slice(1).join(" ");
      if (!query) return ctx.reply("Uso: /notion search <termo>");
      ctx.reply("🔍 Buscando...").then(async (sent) => {
        const r = await notion.searchPages(query);
        if (!r.ok) return ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, `❌ Erro: ${r.error}`);
        if (r.results.length === 0) return ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, "Nenhum resultado.");
        let msg = `🔍 *Resultados para "${query}":*\n\n`;
        r.results.slice(0, 5).forEach((p, i) => {
          msg += `${i + 1}. [${p.title}](${p.url})\n`;
        });
        ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, msg, { parse_mode: "Markdown", disable_web_page_preview: true });
      });
      return;
    }

    await ctx.reply(
      "📝 *Notion*\n\n" +
      "/notion save <texto> — salvar nota\n" +
      "/notion list — listar recentes\n" +
      "/notion search <termo> — buscar\n\n" +
      "_Salva automaticamente conversas quando o agente achar relevante._",
      { parse_mode: "Markdown" }
    );
  });

  bot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const userText = ctx.message.text;
    const userName = ctx.from.first_name || ctx.from.username || "Você";

    const typingTimer = setInterval(() => ctx.sendChatAction("typing").catch(() => {}), 4000);

    try {
      const result = await processMessage(chatId, userText, userName);
      clearInterval(typingTimer);
      const text = result.formatted || result.content;
      if (result.image) {
        await ctx.replyWithPhoto({ url: result.image }, { caption: text, parse_mode: "Markdown" }).catch(() =>
          ctx.reply(text, { parse_mode: "Markdown" })
        );
      } else {
        await ctx.reply(text, { parse_mode: "Markdown" });
      }
    } catch (err) {
      clearInterval(typingTimer);
      console.error("[Telegram] Erro:", err.message);
      await ctx.reply("❌ Erro ao processar. Tente novamente.");
    }
  });

  bot.catch((err) => console.error("[Telegram] Erro geral:", err.message));

  return bot;
}

module.exports = { createBot };
