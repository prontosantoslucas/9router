"use client";

import React from "react";

export function HealthDot({ status = "ok", label }) {
  const isOk = status === "ok";
  const isWarning = status === "warning";

  const colorClass = isOk ? "bg-success" : isWarning ? "bg-warning" : "bg-danger";

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClass}`} />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorClass}`} />
      </span>
      {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
    </div>
  );
}
