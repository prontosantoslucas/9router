import { useState } from "react";
import { useConfig } from "../store.js";
import { openOAuthWindow } from "../api.js";

export default function Settings({ onClose, onLogout, authed }) {
  const { baseUrl, setBase, alwaysOnTop, toggleTop } = useConfig();
  const [url, setUrl] = useState(baseUrl);
  const [saved, setSaved] = useState(false);

  async function save() {
    await setBase(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div className="settings body">
      <label>Servidor 9Router</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://maxrouter-prod.up.railway.app" />
      <button onClick={save}>{saved ? "Salvo ✓" : "Salvar servidor"}</button>

      <label className="row">
        <input type="checkbox" checked={alwaysOnTop} onChange={toggleTop} />
        Sempre no topo (persistente)
      </label>

      <hr />

      <button className="secondary" onClick={() => openOAuthWindow()}>
        Conectar contas (OAuth)
      </button>
      <p className="hint small">
        Abre o painel do 9Router para autenticar Claude, Codex, Gemini, Cursor, Kiro…
      </p>

      {authed && (
        <button className="secondary danger" onClick={onLogout}>
          Sair da sessão
        </button>
      )}

      <button className="link" onClick={onClose}>
        Fechar
      </button>
    </div>
  );
}
