"use client";

import React from "react";

export function FileAttachmentChip({ filename, sizeBytes, isLoading, onRemove }) {
  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-1.5 text-xs text-text-main shadow-soft dark:bg-surface-2">
      <span className="material-symbols-outlined text-base text-brand-500">
        {isLoading ? "sync" : "description"}
      </span>
      <span className="max-w-[150px] truncate font-medium">{filename}</span>
      {sizeBytes && <span className="text-text-subtle">({formatSize(sizeBytes)})</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-text-muted hover:text-danger transition-colors"
          title="Remover anexo"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  );
}
