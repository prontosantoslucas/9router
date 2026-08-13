import { config } from "../config.js";

export function renderLayout({ title, activeTab, content, clinicName }) {
  const name = clinicName || config.clinic.name || "Clínica Zenda";
  
  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); borderRadius: 3px; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col md:flex-row antialiased">

  <!-- Sidebar -->
  <aside class="w-full md:w-64 bg-slate-900/90 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0">
    <!-- Header Logo -->
    <div class="p-5 border-b border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold">
          <span class="material-icons-outlined text-xl">medical_services</span>
        </div>
        <div>
          <h1 className="font-bold text-sm text-slate-100 truncate max-w-[140px]">${name}</h1>
          <span class="text-[10px] text-teal-400 font-medium uppercase tracking-wider">Painel do Cliente</span>
        </div>
      </div>
    </div>

    <!-- Nav Items -->
    <nav class="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
      ${renderNavItem("/dashboard/conversations", "chat", "Conversas", activeTab === "conversations")}
      ${renderNavItem("/dashboard/appointments", "event", "Agenda & Consultas", activeTab === "appointments")}
      ${renderNavItem("/dashboard/patients", "groups", "Pacientes", activeTab === "patients")}
      ${renderNavItem("/dashboard/notes", "note_alt", "Notas & Prontuários", activeTab === "notes")}
      ${renderNavItem("/dashboard/reports", "insights", "Relatórios", activeTab === "reports")}
      ${renderNavItem("/dashboard/channels", "podcasts", "Canais & QR Code", activeTab === "channels")}
      ${renderNavItem("/dashboard/config", "tune", "Configurações", activeTab === "config")}
    </nav>

    <!-- Footer Logout -->
    <div class="p-4 border-t border-slate-800">
      <form action="/logout" method="POST">
        <button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 text-xs font-medium transition-colors">
          <span class="material-icons-outlined text-base text-rose-400">logout</span>
          <span>Sair da Conta</span>
        </button>
      </form>
    </div>
  </aside>

  <!-- Main Content Area -->
  <main class="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
    <header class="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
      <h2 class="text-base font-semibold text-slate-100 flex items-center gap-2">
        <span>${title}</span>
      </h2>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
          <span class="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
          <span>Agente Ativo</span>
        </span>
      </div>
    </header>

    <div class="p-6 md:p-8 space-y-6">
      ${content}
    </div>
  </main>

</body>
</html>`;
}

function renderNavItem(href, icon, label, isActive) {
  return `
    <a href="${href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
      isActive
        ? "bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
    }">
      <span class="material-icons-outlined text-lg ${isActive ? "text-teal-400" : "text-slate-500"}">${icon}</span>
      <span>${label}</span>
    </a>
  `;
}
