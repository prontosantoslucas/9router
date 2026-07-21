"use client";

import React from "react";

export function AgentBadge({ size = "md", agentId = "lucas" }) {
  const isSm = size === "sm";

  return (
    <div className="flex items-center gap-2">
      <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-amber-400 text-white font-bold shadow-soft ${
        isSm ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"
      }`}>
        <span>L</span>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
      </div>

      {!isSm && (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-main leading-tight">Lucas</span>
          <span className="text-[11px] text-text-muted">Agente Autônomo</span>
        </div>
      )}
    </div>
  );
}
