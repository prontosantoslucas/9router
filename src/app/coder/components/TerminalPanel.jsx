"use client";

import { useState } from "react";
import PropTypes from "prop-types";

export default function TerminalPanel({ logs, isCollapsed, onToggleCollapse }) {
  const [activeTab, setActiveTab] = useState("terminal");

  return (
    <div className={`border-t border-border bg-surface flex flex-col transition-all duration-200 ${isCollapsed ? "h-9" : "h-48"}`}>
      {/* Top Drawer Header */}
      <div className="flex items-center justify-between px-3 h-9 bg-bg-alt border-b border-border select-none">
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md transition-colors ${
              activeTab === "terminal" ? "text-brand-500 font-semibold bg-surface shadow-soft border border-border" : "text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[14px] text-brand-500">terminal</span>
            <span>Terminal Execution</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md transition-colors ${
              activeTab === "logs" ? "text-brand-500 font-semibold bg-surface shadow-soft border border-border" : "text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">receipt_long</span>
            <span>Logs</span>
          </button>
        </div>

        <button
          onClick={onToggleCollapse}
          className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface transition-colors"
          title={isCollapsed ? "Expandir Terminal" : "Recolher Terminal"}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isCollapsed ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
        </button>
      </div>

      {/* Drawer Content / Log Output */}
      {!isCollapsed && (
        <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto space-y-1.5 text-text-main custom-scrollbar bg-bg">
          {logs && logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 leading-relaxed">
                {log.type === "command" && (
                  <span className="text-emerald-500 font-bold">➜</span>
                )}
                {log.type === "success" && (
                  <span className="text-success font-bold">✓</span>
                )}
                {log.type === "error" && (
                  <span className="text-danger font-bold">✗</span>
                )}
                {log.type === "info" && (
                  <span className="text-brand-500 font-bold">i</span>
                )}
                <span className={getLogTextColor(log.type)}>{log.text}</span>
              </div>
            ))
          ) : (
            <div className="text-text-muted italic">Nenhum log no terminal. Prompts e ações de código serão registrados aqui.</div>
          )}
        </div>
      )}
    </div>
  );
}

TerminalPanel.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      text: PropTypes.string.isRequired,
    })
  ).isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
};

function getLogTextColor(type) {
  switch (type) {
    case "command": return "text-emerald-600 dark:text-emerald-400 font-semibold";
    case "success": return "text-success";
    case "error": return "text-danger";
    case "info": return "text-text-main";
    default: return "text-text-muted";
  }
}
