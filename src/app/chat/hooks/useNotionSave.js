"use client";

import { useState } from "react";

export function useNotionSave() {
  const [isSaving, setIsSaving] = useState(false);

  const saveToNotion = async ({ title, content, tags = [], source = "web" }) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/agent/notion/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, tags, source }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar no Notion");
      return data;
    } catch (err) {
      console.error("[useNotionSave] Erro:", err.message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { saveToNotion, isSaving };
}
