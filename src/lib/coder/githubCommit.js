/**
 * GitHub Commit Client Helper
 * Handles committing files to GitHub via API or API route proxy and persisting token in SQLite DB.
 */

export async function commitToGitHub({ repo, branch = "main", message, token, files }) {
  if (!repo) throw new Error("Repositório do GitHub não especificado (ex: usuario/meu-repo).");
  if (!message) throw new Error("Mensagem de commit é obrigatória.");
  if (!files || files.length === 0) throw new Error("Nenhum arquivo para commitar.");

  // Save GitHub credentials to SQLite DB so user never loses them on commit or restart
  try {
    await fetch("/api/coder/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        githubRepo: repo,
        githubBranch: branch,
        ...(token ? { githubToken: token } : {}),
      }),
    });
  } catch (e) {
    console.warn("Falha ao persistir credenciais do GitHub no banco:", e);
  }

  const response = await fetch("/api/coder/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, branch, message, token, files }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || "Falha ao commitar no GitHub.");
  }

  return data;
}
