/**
 * OpenClaude / Free-Claude-Code Engine for Coder
 * Simulates coding agent workflows, prompt processing, file generation, and terminal command execution.
 */

export const INITIAL_PROJECT_FILES = [
  {
    path: "src/App.tsx",
    content: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0F0F11] text-white flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-xl text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono">
          <span>⚡ Coder Powered by OpenClaude</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
          Crystal Water Landing Page
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Digite seu prompt no chat para ver a mágica acontecer! O Coder irá gerar o código, atualizar os arquivos e executar comandos em tempo real.
        </p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <button className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/20">
            Começar Agora
          </button>
          <button className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-medium text-sm transition-all">
            Ver Documentação
          </button>
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    path: "src/index.css",
    content: `@import "tailwindcss";

body {
  margin: 0;
  background-color: #0d0d0e;
  color: #f3f4f6;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}
`,
  },
  {
    path: "src/main.tsx",
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
  },
  {
    path: "package.json",
    content: JSON.stringify(
      {
        name: "crystal-water-landing-page",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "lucide-react": "^0.475.0",
        },
        devDependencies: {
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          "@vitejs/plugin-react": "^4.3.0",
          typescript: "^5.6.0",
          vite: "^6.0.0",
        },
      },
      null,
      2
    ),
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Crystal Water Landing Page</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
  },
];

export async function processOpenClaudePrompt({ prompt, currentFiles, onStreamMessage, onTerminalLog, onUpdateFiles }) {
  if (onTerminalLog) {
    onTerminalLog({ type: "info", text: `$ openclaude agent --prompt "${prompt.substring(0, 40)}..."` });
  }

  // Send initial planning status
  if (onStreamMessage) {
    onStreamMessage("Analisando solicitação e mapeando estrutura do projeto...");
  }

  await new Promise((r) => setTimeout(r, 600));

  if (onTerminalLog) {
    onTerminalLog({ type: "command", text: "⚡ Local Server running at http://localhost:5173/" });
    onTerminalLog({ type: "success", text: "✓ Free-Claude-Code OpenRouter/NVIDIA proxy connected" });
  }

  // Generate code modification based on user prompt
  const updatedFiles = [...currentFiles];
  const appFileIndex = updatedFiles.findIndex((f) => f.path === "src/App.tsx");

  let responseText = "Entendi! Atualizei a aplicação com base no seu pedido. Você pode visualizar o código editado no Monaco Editor e a renderização na aba Preview.";

  if (appFileIndex !== -1) {
    let newAppContent = updatedFiles[appFileIndex].content;

    if (prompt.toLowerCase().includes("landing") || prompt.toLowerCase().includes("water") || prompt.toLowerCase().includes("crystal")) {
      newAppContent = `export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between backdrop-blur-md bg-slate-950/80 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/30">
            💧
          </div>
          <span className="font-bold text-lg tracking-tight">Crystal Water</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-300">
          <a href="#features" className="hover:text-cyan-400 transition-colors">Recursos</a>
          <a href="#pricing" className="hover:text-cyan-400 transition-colors">Planos</a>
          <a href="#contact" className="hover:text-cyan-400 transition-colors">Contato</a>
          <button className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition-all">
            Experimentar Grátis
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0,transparent_70%)] pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-mono mb-6">
          ✨ Pureza e Tecnologia Em Cada Gota
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-400 max-w-3xl leading-tight">
          A Água Mineral Mais Pura do Mercado
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-xl">
          Filtragem tripla avançada e minerais essenciais selecionados para máxima hidratação e bem-estar para o seu dia a dia.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button className="px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-base transition-all shadow-lg shadow-cyan-500/25">
            Peça Sua Entrega
          </button>
          <button className="px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-base transition-all">
            Conhecer Nossa Fonte
          </button>
        </div>
      </main>
    </div>
  );
}`;
    }

    updatedFiles[appFileIndex] = { ...updatedFiles[appFileIndex], content: newAppContent };
  }

  if (onUpdateFiles) {
    onUpdateFiles(updatedFiles);
  }

  if (onTerminalLog) {
    onTerminalLog({ type: "info", text: "✓ Updated src/App.tsx" });
    onTerminalLog({ type: "info", text: "✓ HMR update /src/App.tsx" });
  }

  return {
    message: responseText,
    files: updatedFiles,
  };
}
