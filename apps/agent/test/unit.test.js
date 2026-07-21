const cache = require("../src/cache");
const memory = require("../src/memory");

async function main() {
  // Cache
  cache.set("test", { ok: true }, 5000);
  const v = cache.get("test");
  if (!v || !v.ok) { console.error("FAIL: cache get/set"); process.exit(1); }
  console.log("PASS: cache get/set");

  const stats = cache.stats();
  if (stats.total !== 1 || stats.valid !== 1) { console.error("FAIL: cache stats"); process.exit(1); }
  console.log("PASS: cache stats");

  cache.clear();
  if (cache.stats().total !== 0) { console.error("FAIL: cache clear"); process.exit(1); }
  console.log("PASS: cache clear");

  // Memory
  const initLen = memory.getState().corrections.length;
  await memory.addCorrection("teste de correção");
  if (memory.getState().corrections.length !== initLen + 1) { console.error("FAIL: memory addCorrection"); process.exit(1); }
  console.log("PASS: memory addCorrection");

  const recent = memory.getRecentCorrections(1);
  if (recent.length !== 1 || !recent[0].includes("teste")) { console.error("FAIL: memory getRecent"); process.exit(1); }
  console.log("PASS: memory getRecent");

  // Orquestrador
  const { getHistory, clearHistory } = require("../src/orchestrator");
  const h = getHistory("test-user");
  if (!h || !h.msgs) { console.error("FAIL: history init"); process.exit(1); }
  console.log("PASS: history init");

  clearHistory("test-user");
  if (getHistory("test-user").msgs.length !== 0) { console.error("FAIL: history clear"); process.exit(1); }
  console.log("PASS: history clear");

  console.log("\n✅ Todos os testes passaram.");
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
