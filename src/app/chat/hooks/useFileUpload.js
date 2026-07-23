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

      // IMAGEM: não extrai texto — envia como visão (base64) junto da mensagem.
      if ((file.type || "").startsWith("image/")) {
        return { isImage: true, base64, mimeType: file.type, filename: file.name };
      }

      // VÍDEO: processa no backend (áudio→transcrição + frames→visão).
      if ((file.type || "").startsWith("video/")) {
        const vres = await fetch("/api/agent/video/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType: file.type, mode: "both", frames: 4 }),
        });
        const vdata = await vres.json();
        if (!vres.ok) throw new Error(vdata.error || "Erro ao processar vídeo");
        return {
          isVideo: true,
          filename: file.name,
          transcript: vdata.transcript || "",
          frames: vdata.frames || [], // [{base64, mimeType}]
        };
      }

      // Documentos (pdf/docx/xlsx/txt): extrai texto no backend.
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

      return { isImage: false, ...data }; // { text, filename }
    } catch (err) {
      console.error("[useFileUpload] Erro:", err.message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}
