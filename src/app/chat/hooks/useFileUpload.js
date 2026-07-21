"use client";

import { useState } from "react";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file) => {
    if (!file) return null;
    setIsUploading(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result?.toString().split(",")[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);

      const base64 = await base64Promise;

      const res = await fetch("/api/agent/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          mimeType: file.type,
          filename: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar arquivo");

      return data; // { text, filename }
    } catch (err) {
      console.error("[useFileUpload] Erro:", err.message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}
