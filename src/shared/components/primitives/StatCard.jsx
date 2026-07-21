"use client";

import React from "react";

export function StatCard({ title, value, icon, subtitle, trend }) {
  return (
    <div className="card-soft p-5 border border-border flex flex-col justify-between transition-all hover:border-brand-500/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</span>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
            <span className="material-symbols-outlined text-xl">{icon}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-text-main leading-none">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.startsWith("+") ? "text-success" : "text-danger"}`}>
            {trend}
          </span>
        )}
      </div>

      {subtitle && <span className="mt-2 text-xs text-text-subtle">{subtitle}</span>}
    </div>
  );
}
