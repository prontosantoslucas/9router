import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { repo, branch = "main", message, token, files } = await request.json();

    if (!repo || !message || !files) {
      return NextResponse.json({ error: "Parâmetros obrigatórios ausentes (repo, message, files)" }, { status: 400 });
    }

    const githubToken = token || process.env.GITHUB_TOKEN;

    if (!githubToken) {
      // Return simulated success when token is not configured yet so user experience works seamlessly in dev mode
      return NextResponse.json({
        success: true,
        simulated: true,
        commitSha: "sim_" + Math.random().toString(36).substring(2, 10),
        message: `Commit simulado com sucesso em '${repo}' (${branch}). Configure um Token do GitHub para commits reais.`,
        committedFilesCount: files.length,
      });
    }

    // Real GitHub API Commit using GitHub REST API
    // 1. Get latest commit SHA for branch
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, {
      headers: { Authorization: `token ${githubToken}`, "User-Agent": "9router-Coder" },
    });

    if (!refRes.ok) {
      const err = await refRes.json();
      return NextResponse.json({ error: `Erro ao obter branch '${branch}': ${err.message}` }, { status: refRes.status });
    }

    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Create blobs for each file
    const treeItems = [];
    for (const f of files) {
      const blobRes = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
        method: "POST",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json",
          "User-Agent": "9router-Coder",
        },
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      });
      const blobData = await blobRes.json();
      treeItems.push({
        path: f.path.replace(/^\//, ""),
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      });
    }

    // 3. Create tree
    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "9router-Coder",
      },
      body: JSON.stringify({ base_tree: latestCommitSha, tree: treeItems }),
    });
    const treeData = await treeRes.json();

    // 4. Create commit
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "9router-Coder",
      },
      body: JSON.stringify({ message, tree: treeData.sha, parents: [latestCommitSha] }),
    });
    const commitData = await commitRes.json();

    // 5. Update ref
    await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "9router-Coder",
      },
      body: JSON.stringify({ sha: commitData.sha }),
    });

    return NextResponse.json({
      success: true,
      commitSha: commitData.sha,
      url: commitData.html_url,
      message: `Commit realizado com sucesso na branch '${branch}'!`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
