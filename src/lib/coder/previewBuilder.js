/**
 * Constrói documento HTML auto-contido para pré-visualização instantânea no iframe.
 * Usa Babel Standalone + ESM ImportMap para compilar React/TSX/JSX em tempo real no browser,
 * com suporte nativo a VFS (Virtual File System) multi-arquivos e pacotes via esm.sh.
 */

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
  // Ignora arquivos vazios
  const nonEmpty = files.filter((f) => (f.content || "").trim());
  const scriptFiles = nonEmpty.filter((f) => /\.(t|j)sx?$/.test(f.path));
  const cssFiles = nonEmpty.filter((f) => f.path.endsWith(".css"));
  const entry = pickEntry(nonEmpty);

  if (!entry) {
    return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<body style="background:#0e0e11;color:#9da0ad;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <p style="font-size:16px;font-weight:600;color:#f4f4f7">Sem arquivos JS/TS para pré-visualizar.</p>
    <p style="font-size:13px;color:#6c6f7e">Descreva seu projeto no chat para gerar o código.</p>
  </div>
</body>
</html>`;
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
<html lang="pt-BR" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.26.4/babel.min.js"></script>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1?dev",
      "react/": "https://esm.sh/react@18.3.1/",
      "react-dom": "https://esm.sh/react-dom@18.3.1?dev",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?dev",
      "react-dom/": "https://esm.sh/react-dom@18.3.1/",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
      "lucide-react": "https://esm.sh/lucide-react@0.468.0",
      "clsx": "https://esm.sh/clsx",
      "tailwind-merge": "https://esm.sh/tailwind-merge"
    }
  }
  </script>
  <style>
    body { margin: 0; background: #0e0e11; color: #f4f4f7; font-family: system-ui, -apple-system, sans-serif; }
    ${userCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="__status" style="padding:16px;font-family:monospace;font-size:13px;color:#9da0ad">⚙ Compilando aplicação React…</div>
  <div id="__err" style="display:none;white-space:pre-wrap;padding:16px;font-family:monospace;font-size:13px;color:#ff6b6b;background:#1e1e24;border:1px solid #ff4520;border-radius:8px;margin:16px"></div>

  <script type="module">
    const VFS = ${JSON.stringify(vfs)};
    const ENTRY = ${JSON.stringify(entryPath)};

    function post(type, payload) {
      try { parent.postMessage({ __coderPreview: true, type, payload: String(payload || "") }, "*"); } catch(_) {}
    }
    function showErr(m) {
      const e = document.getElementById("__err");
      const s = document.getElementById("__status");
      if (s) s.style.display = "none";
      if (e) { e.style.display = "block"; e.textContent = String(m); }
      post("error", m);
    }
    window.addEventListener("error", (ev) => { showErr(ev.message || ev); });
    window.addEventListener("unhandledrejection", (ev) => { showErr(ev.reason?.stack || ev.reason || ev); });

    function resolveVfsPath(spec, importer) {
      if (spec.startsWith("http://") || spec.startsWith("https://") || (!spec.startsWith(".") && !spec.startsWith("/"))) {
        return null;
      }
      const baseParts = importer ? importer.split("/").slice(0, -1) : [""];
      const rawParts = spec.startsWith("/") ? spec.split("/") : [...baseParts, ...spec.split("/")];
      const stack = [];
      for (const p of rawParts) {
        if (p === "." || p === "") continue;
        if (p === "..") stack.pop();
        else stack.push(p);
      }
      const target = "/" + stack.join("/");
      const candidates = [
        target,
        target + ".tsx",
        target + ".ts",
        target + ".jsx",
        target + ".js",
        target + "/index.tsx",
        target + "/index.jsx",
        target + "/index.ts",
        target + "/index.js"
      ];
      for (const c of candidates) {
        if (VFS[c] !== undefined) return c;
      }
      return target;
    }

    async function run() {
      try {
        if (typeof Babel === "undefined") {
          throw new Error("Babel compiler failed to load from CDN.");
        }

        // 1. Transpilar todos os arquivos do VFS com Babel
        const transpiled = {};
        for (const [path, code] of Object.entries(VFS)) {
          if (path.endsWith(".css")) continue;
          try {
            const res = Babel.transform(code, {
              presets: [
                ["react", { runtime: "automatic" }],
                ["typescript", { isTSX: true, allExtensions: true }]
              ],
              filename: path,
            });
            transpiled[path] = res.code;
          } catch (err) {
            throw new Error("Erro de compilação em " + path + ": " + err.message);
          }
        }

        // 2. Resolver imports relativos e criar Blob URLs
        const createdUrls = {};
        function getBlobUrl(filePath) {
          if (createdUrls[filePath]) return createdUrls[filePath];
          let code = transpiled[filePath];
          if (!code) return null;

          code = code.replace(
            /(from\\s*['"]|import\\s*\\(['"]|import\\s*['"])([^'"]+)(['"])/g,
            (match, prefix, importPath, suffix) => {
              if (importPath.endsWith(".css")) {
                return prefix + "data:text/javascript," + suffix;
              }
              const resolved = resolveVfsPath(importPath, filePath);
              if (resolved && transpiled[resolved]) {
                const subUrl = getBlobUrl(resolved);
                return prefix + subUrl + suffix;
              }
              if (!importPath.startsWith(".") && !importPath.startsWith("/") && !importPath.startsWith("http")) {
                const known = ["react", "react-dom", "react/jsx-runtime", "lucide-react", "clsx", "tailwind-merge"];
                if (!known.includes(importPath)) {
                  return prefix + "https://esm.sh/" + importPath + suffix;
                }
              }
              return match;
            }
          );

          const blob = new Blob([code], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          createdUrls[filePath] = url;
          return url;
        }

        // 3. Obter URL do arquivo de entrada e importar
        const entryUrl = getBlobUrl(ENTRY);
        if (!entryUrl) {
          throw new Error("Arquivo de entrada não encontrado: " + ENTRY);
        }

        const mod = await import(entryUrl);
        const status = document.getElementById("__status");
        if (status) status.style.display = "none";

        const root = document.getElementById("root");
        if (root && !root.hasChildNodes()) {
          const App = mod.default || mod.App;
          if (App) {
            const React = await import("react");
            const { createRoot } = await import("react-dom/client");
            createRoot(root).render(React.createElement(App));
          }
        }
        post("ready", "");
      } catch (e) {
        showErr((e && e.stack) || e);
      }
    }

    run();
  </script>
</body>
</html>`;
}
