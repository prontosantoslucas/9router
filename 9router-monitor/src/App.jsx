import { useEffect, useState } from "react";
import { useConfig } from "./store.js";
import { login as apiLogin, logout as apiLogout, getStats } from "./api.js";
import Header from "./components/Header.jsx";
import Settings from "./components/Settings.jsx";
import QuotaTab from "./components/QuotaTab.jsx";
import ModelsTab from "./components/ModelsTab.jsx";
import LatencyTab from "./components/LatencyTab.jsx";

const TABS = [
  { id: "quota", label: "Cota" },
  { id: "models", label: "Modelos" },
  { id: "latency", label: "Latência" },
];

export default function App() {
  const { init, loaded, baseUrl } = useConfig();
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("login"); // login | settings | dashboard
  const [tab, setTab] = useState("quota");
  const [online, setOnline] = useState(null);
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    init();
  }, []);

  // Probe connectivity + session once config is loaded.
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await getStats("today");
        setOnline(true);
        setAuthed(true);
        setView("dashboard");
      } catch (e) {
        setOnline(!String(e).includes("request failed"));
      }
    })();
  }, [loaded, baseUrl]);

  async function doLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiLogin(baseUrl, pw);
      setAuthed(true);
      setOnline(true);
      setView("dashboard");
      setPw("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await apiLogout();
    setAuthed(false);
    setView("login");
  }

  if (!loaded) {
    return (
      <div className="card">
        <div className="loading">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <Header
        online={online}
        onSettings={() => setView(view === "settings" ? "dashboard" : "settings")}
      />

      {view === "settings" ? (
        <Settings onClose={() => setView("dashboard")} onLogout={doLogout} authed={authed} />
      ) : !authed ? (
        <form className="login" onSubmit={doLogin}>
          <p className="hint">Conectar ao servidor</p>
          <p className="mono">{baseUrl}</p>
          <input
            type="password"
            placeholder="Senha do painel"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="body">
            {tab === "quota" && <QuotaTab />}
            {tab === "models" && <ModelsTab />}
            {tab === "latency" && <LatencyTab />}
          </div>
        </>
      )}
    </div>
  );
}
