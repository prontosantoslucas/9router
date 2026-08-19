// CRM deal-close automation scheduler.
// Runs periodic checks so deals whose expectedCloseAt is near fire the
// "deal.close_approaching" automation (alert + webhook) without manual action.

const C = {
  // First tick after startup (allow boot + first requests to settle)
  firstTickDelayMs: 5 * 60 * 1000,
  // Then every 6 hours
  tickIntervalMs: 6 * 60 * 60 * 1000,
  // How many days ahead counts as "approaching"
  daysAhead: 7,
};

const g = (global.__crmAlertScheduler ??= {
  interval: null,
  startedAt: null,
});

async function tick() {
  try {
    const { checkCloseApproachingDeals } = await import("@/lib/db/repos/automationRepo.js");
    const alerts = await checkCloseApproachingDeals(C.daysAhead);
    if (alerts.length > 0) {
      console.log(`[CRM Alerts] ${alerts.length} close-approaching alert(s) generated`);
    }
  } catch (error) {
    console.warn("[CRM Alerts] tick error:", error.message);
  }
}

export function startCrmAlertScheduler() {
  if (g.interval) return;
  g.startedAt = Date.now();
  console.log("[CRM Alerts] scheduler started (close-approaching deals)");
  setTimeout(() => { tick().catch(() => {}); }, C.firstTickDelayMs);
  g.interval = setInterval(() => { tick().catch(() => {}); }, C.tickIntervalMs);
  if (g.interval.unref) g.interval.unref();
}