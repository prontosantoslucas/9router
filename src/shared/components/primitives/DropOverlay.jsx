"use client";

import React from "react";

export function DropOverlay({ isDragging }) {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-500/10 backdrop-blur-md border-4 border-dashed border-brand-500 p-6 animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-white shadow-warm animate-bounce">
        <span className="material-symbols-outlined text-3xl">upload_file</span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-text-main">Solte seus arquivos aqui</h3>
      <p className="text-sm text-text-muted">PDFs, imagens ou documentos de texto para o Lucas analisar</p>
    </div>
  );
}
