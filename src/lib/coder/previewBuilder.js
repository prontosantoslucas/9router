/**
 * Builds a self-contained HTML doc that REALLY bundles the generated project
 * with esbuild-wasm (in-iframe) and runs the result. No dev server needed.
 *
 * ponytail: esbuild-wasm bundles a virtual FS; react/react-dom come from esm.sh.
 * Ceiling: no arbitrary npm installs (only react/react-dom externalized).
 * Upgrade path: swap the iframe for a WebContainer to run real `npm i`/`vite`.
 */

const ESBUILD_VERSION = "0.24.0";
const ESM = "https://esm.sh";

function pickEntry(files) {
  const byPath = (p) => files.find((f) => f.path === p);
  return (
    byPath("src/main.tsx") ||
    byPath("src/main.jsx") ||
    byPath("src/index.tsx") ||
    byPath("src/index.jsx") ||
    byPath("src/App.tsx") ||
    byPath("src/App.jsx") ||
    files.find((f) => /\.(t|j)sx?$/.test(f.path))
  );
}

export function buildPreviewDoc(files = [], projectName = "App") {
  const scriptFiles = files.filter((f) => /\.(t|j)sx?$/.test(f.path));
  const cssFiles = files.filter((f) => f.path.endsWith(".css"));
  const entry = pickEntry(files);

  if (!entry) {
    return `<!DOCTYPE html><html><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div>Sem arquivos JS/TS para pré-visualizar.</div></body></html>`;
  }

  const vfs = scriptFiles.reduce((acc, f) => {
    acc["/" + f.path.replace(/^\.?\//, "")] = f.content;
    return acc;
  }, {});

  const userCss = cssFiles
    .map((f) => f.content)
    .join("\n")
    .replace(/@import\s+["']tailwindcss["'];?/g, "");

  const entryPath = "/" + entry.path.replace(/^\.?\//, "");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${projectName}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>${userCss}</style>
</head>
<body>
<div id="root"></div>
<div id="__status" style="padding:16px;font-family:monospace;color:#94a3b8">⚙ Compilando com esbuild…</div>
<div id="__err" style="display:none;white-space:pre-wrap;padding:16px;font-family:monospace;color:#fca5a5;background:#1e1e1e"></div>
<script type="module">
import * as esbuild from "${ESM}/esbuild-wasm@${ESBUILD_VERSION}";

const VFS = ${JSON.stringify(vfs)};
const ENTRY = ${JSON.stringify(entryPath)};
const EXTERNAL = { react: "${ESM}/react@18", "react-dom": "${ESM}/react-dom@18", "react-dom/client": "${ESM}/react-dom@18/client", "react/jsx-runtime": "${ESM}/react@18/jsx-runtime" };

function setStatus(t){ const e=document.getElementById("__status"); if(e) e.textContent=t; }
function showErr(m){ const e=document.getElementById("__err"); const s=document.getElementById("__status"); if(s) s.style.display="none"; if(e){ e.style.display="block"; e.textContent=String(m);} }

function resolveInVfs(spec, importer) {
  if (spec in EXTERNAL) return null; // handled as external
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const baseDir = importer ? importer.split("/").slice(0, -1) : [""];
  const parts = (spec.startsWith("/") ? spec.split("/") : [...baseDir, ...spec.split("/")]);
  const stack = [];
  for (const p of parts) { if (p === "." || p === "") continue; if (p === "..") stack.pop(); else stack.push(p); }
  let path = "/" + stack.join("/");
  const cands = [path, path + ".tsx", path + ".ts", path + ".jsx", path + ".js", path + "/index.tsx", path + "/index.jsx", path + "/index.ts", path + "/index.js"];
  return cands.find((c) => VFS[c] != null) || path;
}

const vfsPlugin = {
  name: "vfs",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.path in EXTERNAL) return { path: args.path, external: true };
      if (args.path.endsWith(".css")) return { path: args.path, namespace: "css-null" };
      const resolved = resolveInVfs(args.path, args.importer);
      if (resolved && VFS[resolved] != null) return { path: resolved, namespace: "vfs" };
      // bare import we don't ship → externalize to esm.sh so it at least loads
      if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
        return { path: "${ESM}/" + args.path, external: true };
      }
      return { path: resolved, namespace: "vfs" };
    });
    build.onLoad({ filter: /.*/, namespace: "vfs" }, (args) => {
      const ext = args.path.split(".").pop();
      const loader = ext === "ts" ? "ts" : ext === "tsx" ? "tsx" : ext === "jsx" ? "jsx" : "js";
      return { contents: VFS[args.path] ?? "", loader };
    });
    build.onLoad({ filter: /.*/, namespace: "css-null" }, () => ({ contents: "", loader: "js" }));
  },
};

(async () => {
  try {
    await esbuild.initialize({ wasmURL: "${ESM}/esbuild-wasm@${ESBUILD_VERSION}/esbuild.wasm" });
    const result = await esbuild.build({
      entryPoints: [ENTRY],
      bundle: true,
      write: false,
      format: "esm",
      jsx: "automatic",
      target: "es2020",
      minify: true,
      plugins: [vfsPlugin],
      define: { "process.env.NODE_ENV": '"production"' },
    });
    let code = result.outputFiles[0].text;
    // Rewrite bare externals to their esm.sh URLs so the browser can import them.
    for (const [name, url] of Object.entries(EXTERNAL)) {
      const re = new RegExp('from"' + name.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + '"', "g");
      code = code.replace(re, 'from"' + url + '"');
      const re2 = new RegExp('import"' + name.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + '"', "g");
      code = code.replace(re2, 'import"' + url + '"');
    }
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const mod = await import(url);
    const root = document.getElementById("root");
    const status = document.getElementById("__status");
    if (status) status.style.display = "none";
    if (!root.hasChildNodes()) {
      const App = mod.default;
      if (App) {
        const React = await import("${ESM}/react@18");
        const { createRoot } = await import("${ESM}/react-dom@18/client");
        createRoot(root).render(React.createElement(App));
      }
    }
  } catch (e) {
    showErr((e && e.stack) || e);
  }
})();
</script>
</body>
</html>`;
}
