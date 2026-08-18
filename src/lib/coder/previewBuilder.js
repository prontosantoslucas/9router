/**
 * Constrói documento HTML auto-contido para pré-visualização instantânea no iframe (Padrão Lovable.dev).
 * - Babel Standalone + ESM ImportMap (React 18, Lucide, Framer Motion, Recharts, Supabase, Confetti).
 * - Virtual File System (VFS) multi-arquivos com resolução de imports relativos.
 * - Visual Element Inspector (Click-to-Edit): Realce de elementos e seleção para prompts contextuais.
 * - Console Bridge: Redirecionamento de logs para o terminal do Coder.
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

export function buildPreviewDoc(files = [], projectName = "App", options = {}) {
  const { inspectMode = false } = options;
  const nonEmpty = files.filter((f) => (f.content || "").trim());
  const scriptFiles = nonEmpty.filter((f) => /\.(t|j)sx?$/.test(f.path));
  const cssFiles = nonEmpty.filter((f) => f.path.endsWith(".css"));
  const entry = pickEntry(nonEmpty);

  if (!entry) {
    return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<body style="background:#09090b;color:#8e8e9c;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center;padding:24px">
    <div style="width:48px;height:48px;border-radius:12px;background:#18181b;border:1px solid #27272a;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#ff4d28;font-size:24px">⚡</div>
    <p style="font-size:16px;font-weight:700;color:#f4f4f7;margin:0 0 6px">Nenhum código para pré-visualizar</p>
    <p style="font-size:13px;color:#5e5e6e;margin:0">Descreva sua ideia no chat ao lado para gerar sua aplicação completa.</p>
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
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#fff5f2',
              100: '#ffe8e2',
              200: '#ffd0c5',
              300: '#ffa894',
              400: '#ff7354',
              500: '#ff4d28',
              600: '#ff3b14',
              700: '#d92d09',
              800: '#b32508',
              900: '#8c1e08',
            }
          }
        }
      }
    }
  </script>
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
      "framer-motion": "https://esm.sh/framer-motion@11.13.1",
      "recharts": "https://esm.sh/recharts@2.13.3",
      "canvas-confetti": "https://esm.sh/canvas-confetti@1.9.3",
      "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.47.10",
      "clsx": "https://esm.sh/clsx@2.1.1",
      "tailwind-merge": "https://esm.sh/tailwind-merge@2.5.5"
    }
  }
  </script>
  <style>
    body { margin: 0; background: #09090b; color: #f4f4f7; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
    /* Estilos do Visual Element Inspector */
    .lovable-inspect-highlight {
      outline: 2px dashed #ff4d28 !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
      background-color: rgba(255, 77, 40, 0.08) !important;
    }
    ${userCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="__status" style="padding:16px;font-family:monospace;font-size:13px;color:#8e8e9c">⚙ Compilando aplicação React…</div>
  <div id="__err" style="display:none;white-space:pre-wrap;padding:16px;font-family:monospace;font-size:13px;color:#ff6b6b;background:#18181b;border:1px solid #ff4d28;border-radius:10px;margin:16px"></div>

  <script type="module">
    const VFS = ${JSON.stringify(vfs)};
    const ENTRY = ${JSON.stringify(entryPath)};
    const INSPECT_MODE = ${inspectMode ? "true" : "false"};

    function post(type, payload) {
      try { parent.postMessage({ __coderPreview: true, type, payload }, "*"); } catch(_) {}
    }
    function showErr(m) {
      const e = document.getElementById("__err");
      const s = document.getElementById("__status");
      if (s) s.style.display = "none";
      if (e) { e.style.display = "block"; e.textContent = String(m); }
      post("error", String(m));
    }

    // Bridge de Console (Envia logs para o terminal do Coder)
    const _origLog = console.log;
    const _origWarn = console.warn;
    const _origError = console.error;
    console.log = (...args) => { _origLog(...args); post("console", { level: "info", text: args.map(String).join(" ") }); };
    console.warn = (...args) => { _origWarn(...args); post("console", { level: "warning", text: args.map(String).join(" ") }); };
    console.error = (...args) => { _origError(...args); post("console", { level: "error", text: args.map(String).join(" ") }); };

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

    // ── Visual Inspector (Click-to-Edit) ──
    let hoveredElem = null;
    if (INSPECT_MODE) {
      document.addEventListener("mouseover", (e) => {
        if (!e.target || e.target === document.body || e.target.id === "root") return;
        if (hoveredElem) hoveredElem.classList.remove("lovable-inspect-highlight");
        hoveredElem = e.target;
        hoveredElem.classList.add("lovable-inspect-highlight");
      });
      document.addEventListener("mouseout", (e) => {
        if (e.target) e.target.classList.remove("lovable-inspect-highlight");
      });
      document.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        if (!target) return;
        const tag = target.tagName.toLowerCase();
        const text = (target.innerText || target.textContent || "").trim().slice(0, 50);
        const classes = target.className ? String(target.className).replace("lovable-inspect-highlight", "").trim() : "";
        post("elementSelected", {
          tag,
          text,
          classes,
          selector: \`\${tag}\${classes ? '.' + classes.split(' ').slice(0, 2).join('.') : ''}\`
        });
      }, true);
    }

    async function run() {
      try {
        if (typeof Babel === "undefined") {
          throw new Error("Babel standalone não carregou.");
        }

        // 1. Transpilar todos os arquivos do VFS
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

        // 2. Resolver imports e gerar Blob URLs
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
              // Pacote npm externo não mapeado no importmap -> fallback esm.sh
              if (!importPath.startsWith(".") && !importPath.startsWith("/") && !importPath.startsWith("http")) {
                const known = ["react", "react-dom", "react/jsx-runtime", "lucide-react", "framer-motion", "recharts", "canvas-confetti", "@supabase/supabase-js", "clsx", "tailwind-merge"];
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
