import { config } from "../config.js";

export function renderLoginView({ error = null }) {
  const name = config.clinic.name || "Clínica Zenda";

  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — ${name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
  <style> body { font-family: 'Inter', sans-serif; } </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 antialiased">

  <div class="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl space-y-6">
    <div class="text-center space-y-2">
      <div class="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30 mx-auto flex items-center justify-center text-teal-400 mb-4">
        <span class="material-icons-outlined text-3xl">medical_services</span>
      </div>
      <h1 class="text-2xl font-extrabold text-slate-100">${name}</h1>
      <p class="text-xs text-slate-400">Acesse o Painel de Atendimento do Agente Zenda</p>
    </div>

    ${error ? `
      <div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
        <span class="material-icons-outlined text-base">error_outline</span>
        <span>${escapeHtml(error)}</span>
      </div>
    ` : ""}

    <form action="/login" method="POST" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-slate-400 mb-1.5">Senha de Acesso do Painel</label>
        <div class="relative">
          <span class="material-icons-outlined absolute left-3 top-3 text-slate-500 text-sm">lock</span>
          <input 
            type="password" 
            name="password" 
            placeholder="Digite sua senha de acesso"
            required
            autoFocus
            class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>
      </div>

      <button 
        type="submit" 
        class="w-full py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
      >
        <span>Entrar no Painel</span>
        <span class="material-icons-outlined text-sm">arrow_forward</span>
      </button>
    </form>

    <div class="text-center text-[10px] text-slate-600 border-t border-slate-800/80 pt-4">
      Zenda Agente de IA · Todos os direitos reservados
    </div>
  </div>

</body>
</html>`;
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
