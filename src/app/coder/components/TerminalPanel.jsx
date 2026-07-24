"use client";

import { useState } from "react";
import PropTypes from "prop-types";

export default function TerminalPanel({ logs, isCollapsed, onToggleCollapse }) {
  const [activeTab, setActiveTab] = useState("terminal");

  return (
    <div className={`border-t border-[#1E1E22] bg-[#0E0E10] flex flex-col transition-all duration-200 ${isCollapsed ? "h-9" : "h-48"}`}>
      {/* Top Drawer Header */}
      <div className="flex items-center justify-between px-3 h-9 bg-[#121215] border-b border-[#1E1E22] select-none">
        <div className="flex items-center gap-4 text-xs font-mono">
          <button
            onClick={() => setActiveTab("bolt")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              activeTab === "bolt" ? "text-white font-medium bg-[#1A1A1E]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="text-amber-400">⚡</span> Bolt
          </button>

          <button
            onClick={() => setActiveTab("output")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              activeTab === "output" ? "text-white font-medium bg-[#1A1A1E]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Publish Output
          </button>

          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              activeTab === "terminal" ? "text-white font-medium bg-[#1A1A1E]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-[14px] text-blue-400">terminal</span>
            <span>Terminal</span>
            <span className="text-slate-500 text-[10px]">✕</span>
          </button>

          <button className="text-slate-500 hover:text-slate-300 text-sm font-bold">+</button>
        </div>

        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#1E1E22] transition-colors"
          title={isCollapsed ? "Expandir Terminal" : "Recolher Terminal"}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isCollapsed ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
        </button>
      </div>

      {/* Drawer Content / Log Output */}
      {!isCollapsed && (
        <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto space-y-1.5 text-slate-300 custom-scrollbar bg-[#0A0A0C]">
          {logs && logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 leading-relaxed">
                {log.type === "command" && (
                  <span className="text-emerald-400 font-bold">➜</span>
                )}
                {log.type === "success" && (
                  <span className="text-cyan-400">✓</span>
                )}
                {log.type === "error" && (
                  <span className="text-rose-400">✗</span>
                )}
                {log.type === "info" && (
                  <span className="text-blue-400 font-bold">i</span>
                )}
                <span className={getLogTextColor(log.type)}>{log.text}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic">Nenhum log no terminal. Digite um prompt para executar operações.</div>
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
    case "command": return "text-emerald-300 font-semibold";
    case "success": return "text-cyan-300";
    case "error": return "text-rose-400";
    case "info": return "text-slate-300";
    default: return "text-slate-400";
  }
}
