import { config } from "../config.js";
import { runReminderWorker } from "./reminder.js";
import { runReengagementWorker } from "./reengagement.js";
import { startProspectorWorker } from "./prospectorWorker.js";

// ============================================================
// Orquestrador dos workers de background (lembretes + reativação + prospecção 24/7).
// ============================================================

const REMINDER_INTERVAL_MS = 15 * 60 * 1000;      // checa lembretes a cada 15min
const REENGAGE_INTERVAL_MS = 6 * 60 * 60 * 1000;  // checa reativação a cada 6h

let timers = [];

async function safe(fn, name) {
  try {
    await fn();
  } catch (err) {
    console.error(`[workers] ${name} erro:`, err.message);
  }
}

export function startWorkers() {
  if (!config.workers.enabled) {
    console.log("[workers] desabilitados (WORKERS_ENABLED=false)");
    return;
  }

  console.log(
    `[workers] iniciados — lembrete ${config.workers.reminderHoursBefore}h antes | ` +
    `reativação tiers [${config.workers.reengageTiers}] dias | prospecção 24/7 ativa | modo ${config.agent.mode}`
  );

  // Inicia o worker de prospecção autônoma 24/7
  startProspectorWorker();

  // Primeira execução de lembretes após 30s
  const boot = setTimeout(() => {
    safe(runReminderWorker, "reminder");
    safe(runReengagementWorker, "reengagement");
  }, 30_000);
  timers.push(boot);

  timers.push(setInterval(() => safe(runReminderWorker, "reminder"), REMINDER_INTERVAL_MS));
  timers.push(setInterval(() => safe(runReengagementWorker, "reengagement"), REENGAGE_INTERVAL_MS));
}

export function stopWorkers() {
  timers.forEach((t) => clearTimeout(t) || clearInterval(t));
  timers = [];
}
