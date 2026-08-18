/**
 * Gerenciador de Checkpoints e Histórico de Versões do Coder (Padrão Lovable.dev).
 * Permite capturar snapshots do projeto a cada iteração de prompt e restaurar (rollback)
 * qualquer versão anterior instantaneamente.
 */

const STORAGE_KEY_PREFIX = "coder_checkpoints_";

export function getProjectCheckpoints(projectName = "App") {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + projectName);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[CheckpointStore] Erro ao carregar checkpoints:", err);
    return [];
  }
}

export function saveCheckpoint(projectName = "App", prompt = "Alteração", files = []) {
  if (typeof window === "undefined" || !files || files.length === 0) return null;
  try {
    const checkpoints = getProjectCheckpoints(projectName);
    const newCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      prompt: prompt.slice(0, 140),
      filesCount: files.length,
      files: JSON.parse(JSON.stringify(files)),
      versionNumber: checkpoints.length + 1,
    };

    // Mantém no máximo os 25 checkpoints mais recentes para economizar memória
    const updated = [newCheckpoint, ...checkpoints].slice(0, 25);
    localStorage.setItem(STORAGE_KEY_PREFIX + projectName, JSON.stringify(updated));
    return newCheckpoint;
  } catch (err) {
    console.error("[CheckpointStore] Erro ao salvar checkpoint:", err);
    return null;
  }
}

export function deleteProjectCheckpoints(projectName = "App") {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + projectName);
  } catch {}
}
