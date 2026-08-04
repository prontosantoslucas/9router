import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { setBaseUrl, setAlwaysOnTop } from "./api.js";

const DEFAULT_BASE = "https://maxrouter-prod.up.railway.app";
let store = null;

function normalizeBase(url) {
  let u = (url || "").trim().replace(/\/+$/, "");
  if (u.endsWith("/v1")) u = u.slice(0, -3).replace(/\/+$/, "");
  return u;
}

async function persistStore() {
  if (!store) store = await load("config.json", { autoSave: true });
  return store;
}

export const useConfig = create((set, get) => ({
  baseUrl: DEFAULT_BASE,
  alwaysOnTop: true,
  period: "today", // "today" | "7d"
  refreshMs: 30000,
  loaded: false,

  async init() {
    const s = await persistStore();
    const baseUrl = normalizeBase((await s.get("baseUrl")) ?? DEFAULT_BASE);
    const alwaysOnTop = (await s.get("alwaysOnTop")) ?? true;
    const refreshMs = (await s.get("refreshMs")) ?? 30000;
    await setBaseUrl(baseUrl);
    await setAlwaysOnTop(alwaysOnTop).catch(() => {});
    set({ baseUrl, alwaysOnTop, refreshMs, loaded: true });
  },

  async setBase(rawUrl) {
    const baseUrl = normalizeBase(rawUrl);
    const s = await persistStore();
    await s.set("baseUrl", baseUrl);
    await setBaseUrl(baseUrl);
    set({ baseUrl });
  },

  async toggleTop() {
    const next = !get().alwaysOnTop;
    const s = await persistStore();
    await s.set("alwaysOnTop", next);
    await setAlwaysOnTop(next).catch(() => {});
    set({ alwaysOnTop: next });
  },

  setPeriod(period) {
    set({ period });
  },
}));
