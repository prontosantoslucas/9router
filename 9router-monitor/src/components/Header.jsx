import { getCurrentWindow } from "@tauri-apps/api/window";
import { useConfig } from "../store.js";

export default function Header({ online, onSettings }) {
  const { alwaysOnTop, toggleTop } = useConfig();

  return (
    <header className="header" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <span className={`dot ${online === null ? "wait" : online ? "on" : "off"}`} />
        <span data-tauri-drag-region>9Router</span>
      </div>
      <div className="actions">
        <button
          title={alwaysOnTop ? "Fixado no topo" : "Fixar no topo"}
          className={alwaysOnTop ? "pin active" : "pin"}
          onClick={toggleTop}
        >
          📌
        </button>
        <button title="Configurações" onClick={onSettings}>
          ⚙
        </button>
        <button title="Minimizar" onClick={() => getCurrentWindow().hide()}>
          –
        </button>
      </div>
    </header>
  );
}
