/**
 * OpenClaude / Free-Claude-Code Engine for Coder
 * Simulates coding agent workflows, prompt enhancement, file generation, and terminal command execution.
 */

// Inicialização vazia por padrão (o usuário cria a aplicação do zero)
export const INITIAL_PROJECT_FILES = [];

/**
 * Aprimora o prompt bruto do usuário com base na sua ideia,
 * adicionando especificações técnicas detalhadas de Frontend e Backend.
 */
export function enhanceUserPrompt(rawIdea = "") {
  const idea = rawIdea.trim();
  if (!idea) return "";

  return `[ESPECIFICAÇÃO DE APLICAÇÃO - OPENCLAUDE CODER]
Objetivo: Criar uma aplicação web completa, responsiva e moderna com base na ideia: "${idea}".

--- ESTRUTURA E ARQUITETURA ---
1. FRONTEND (Construir Primeiro):
   - Criar interface responsiva em React (src/App.tsx) utilizando Tailwind CSS e componentes modernos.
   - Incluir menu de navegação, cards interativos, tabelas de dados, formulários com estados React (useState) e badges de status.
   - Design System impecável com gradientes, suporte a tema escuro/claro e visual elegante sem placeholders genéricos.

2. BACKEND LOCALHOST:
   - Estruturar o servidor Node.js/Express (server.js) para simulação em localhost.
   - Incluir rotas API de leitura/gravação (GET/POST /api/data) para integração com o frontend.

3. VISUALIZAÇÃO INSTANTÂNEA:
   - Garantir renderização imediata no Live Preview do Coder IDE.`;
}

export async function processOpenClaudePrompt({
  prompt,
  currentFiles = [],
  onStreamMessage,
  onTerminalLog,
  onUpdateFiles,
}) {
  if (onTerminalLog) {
    onTerminalLog({ type: "info", text: `$ openclaude agent --prompt "${prompt.substring(0, 50)}..."` });
  }

  if (onStreamMessage) {
    onStreamMessage("1/3 Criando interface Frontend (React + Tailwind)...");
  }

  await new Promise((r) => setTimeout(r, 400));

  if (onTerminalLog) {
    onTerminalLog({ type: "command", text: "⚙ Gerando arquivos do Frontend (src/App.tsx, index.html, src/index.css)..." });
  }

  const pLower = prompt.toLowerCase();

  // Detecta o tema/tipo da aplicação para personalizar o código do Frontend
  let appTitle = "Minha Aplicação Web";
  let appSubtitle = "Aplicação criada do zero pelo Agente Lucas Coder";
  let appIcon = "rocket_launch";

  if (pLower.includes("barber") || pLower.includes("barbearia") || pLower.includes("agendamento")) {
    appTitle = "BarberCraft — Agendamentos Premium";
    appSubtitle = "Sistema de agendamento online de cortes e barba em tempo real.";
    appIcon = "content_cut";
  } else if (pLower.includes("finance") || pLower.includes("finança") || pLower.includes("carteira") || pLower.includes("banco")) {
    appTitle = "FinControl — Gestão Financeira";
    appSubtitle = "Painel de controle financeiro com fluxo de caixa, receitas e relatórios.";
    appIcon = "account_balance_wallet";
  } else if (pLower.includes("delivery") || pLower.includes("comida") || pLower.includes("restaurante") || pLower.includes("food")) {
    appTitle = "FoodExpress — Pedidos & Delivery";
    appSubtitle = "Plataforma de pedidos online com cardápio digital e acompanhamento de entrega.";
    appIcon = "restaurant";
  } else if (pLower.includes("task") || pLower.includes("tarefa") || pLower.includes("kanban") || pLower.includes("projeto")) {
    appTitle = "TaskFlow — Gestão de Projetos & Kanban";
    appSubtitle = "Organizador de tarefas inteligentes com quadros Kanban e prioridades.";
    appIcon = "check_box";
  } else if (pLower.includes("saas") || pLower.includes("dashboard") || pLower.includes("painel")) {
    appTitle = "SaaS Metrics — Analytics Dashboard";
    appSubtitle = "Dashboard de acompanhamento de MRR, retenção de usuários e conversão.";
    appIcon = "insights";
  }

  // Code generation: FRONTEND FIRST (src/App.tsx)
  const appTsxContent = `import React, { useState } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [items, setItems] = useState([
    { id: 1, name: "Item Exemplo #1", status: "Ativo", date: "Hoje, 14:30", category: "Principal" },
    { id: 2, name: "Item Exemplo #2", status: "Concluído", date: "Ontem, 09:15", category: "Secundário" },
    { id: 3, name: "Item Exemplo #3", status: "Pendente", date: "Há 2 dias", category: "Urgente" },
  ]);
  const [newItemName, setNewItemName] = useState("");

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setItems([
      ...items,
      { id: Date.now(), name: newItemName.trim(), status: "Ativo", date: "Agora", category: "Geral" },
    ]);
    setNewItemName("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <span className="material-symbols-outlined text-[20px]">${appIcon}</span>
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight">${appTitle}</h1>
            <p className="text-xs text-slate-400 font-mono">${appSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Localhost Server Active</span>
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total de Registros</span>
            <div className="text-2xl font-bold text-white">{items.length}</div>
            <p className="text-[11px] text-emerald-400">✓ Sincronizado via Localhost API</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Status Ativos</span>
            <div className="text-2xl font-bold text-amber-400">
              {items.filter((i) => i.status === "Ativo").length}
            </div>
            <p className="text-[11px] text-slate-400">Em processamento</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Concluídos</span>
            <div className="text-2xl font-bold text-emerald-400">
              {items.filter((i) => i.status === "Concluído").length}
            </div>
            <p className="text-[11px] text-slate-400">Finalizados com sucesso</p>
          </div>
        </div>

        {/* Action & Table Section */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-sm">list_alt</span>
              <span>Painel Principal</span>
            </h2>

            <form onSubmit={handleAddItem} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Novo item na aplicação..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1"
              >
                <span>+ Adicionar</span>
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">Categoria</th>
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">{item.name}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{item.category}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.date}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
`;

  // FRONTEND CONFIG (index.html, src/index.css, src/main.tsx, package.json, vite.config.ts)
  const indexHtmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appTitle}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

  const indexCssContent = `@import "tailwindcss";

body {
  margin: 0;
  background-color: #020617;
  color: #f8fafc;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}`;

  const mainTsxContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`;

  const packageJsonContent = JSON.stringify(
    {
      name: "app-coder-9router",
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        start: "node server.js",
        build: "vite build",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        express: "^4.19.0",
        cors: "^2.8.5",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.3.0",
        vite: "^6.0.0",
      },
    },
    null,
    2
  );

  const viteConfigContent = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`;

  // BACKEND LOCALHOST (server.js & routes/api.js)
  if (onStreamMessage) {
    onStreamMessage("2/3 Estruturando Backend Localhost (Express Server)...");
  }

  await new Promise((r) => setTimeout(r, 400));

  if (onTerminalLog) {
    onTerminalLog({ type: "command", text: "⚙ Criando servidor Node.js/Express (server.js & routes/api.js)..." });
  }

  const serverJsContent = `// Servidor Localhost Node.js/Express para a aplicação ${appTitle}
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Banco de dados em memória para simulação local
let localDb = [
  { id: 1, title: 'Item Localhost 1', status: 'ativo' },
  { id: 2, title: 'Item Localhost 2', status: 'concluido' },
];

// Rotas da API Localhost
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: '${appTitle}', timestamp: new Date() });
});

app.get('/api/items', (req, res) => {
  res.json({ success: true, data: localDb });
});

app.post('/api/items', (req, res) => {
  const newItem = { id: Date.now(), title: req.body.title || 'Novo Item', status: 'ativo' };
  localDb.push(newItem);
  res.status(201).json({ success: true, item: newItem });
});

app.listen(PORT, () => {
  console.log(\`⚡ Servidor Backend Localhost rodando em http://localhost:\${PORT}\`);
});`;

  const apiRouteContent = `// Rotas auxiliares da API Localhost
module.exports = function (router) {
  router.get('/status', (req, res) => {
    res.json({ online: true, version: '1.0.0' });
  });
};`;

  // Agrupa os arquivos gerados
  const newFiles = [
    { path: "src/App.tsx", content: appTsxContent },
    { path: "src/index.css", content: indexCssContent },
    { path: "src/main.tsx", content: mainTsxContent },
    { path: "index.html", content: indexHtmlContent },
    { path: "package.json", content: packageJsonContent },
    { path: "vite.config.ts", content: viteConfigContent },
    { path: "server.js", content: serverJsContent },
    { path: "routes/api.js", content: apiRouteContent },
  ];

  if (onStreamMessage) {
    onStreamMessage("3/3 Concluído! Renderizando Live Preview...");
  }

  if (onUpdateFiles) {
    onUpdateFiles(newFiles);
  }

  if (onTerminalLog) {
    onTerminalLog({ type: "success", text: "✓ Frontend criado com sucesso (src/App.tsx, index.html)" });
    onTerminalLog({ type: "success", text: "✓ Backend Localhost configurado (server.js em http://localhost:3001)" });
    onTerminalLog({ type: "info", text: "➜ Live Preview ativo no Coder IDE" });
  }

  return {
    message: `Aplicação "${appTitle}" gerada com sucesso! O Frontend foi construído em React/Tailwind e o Backend Localhost foi estruturado em server.js.`,
    files: newFiles,
  };
}
