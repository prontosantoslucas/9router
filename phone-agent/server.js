const http = require("http");
const { execSync } = require("child_process");
const PORT = process.env.PORT || 3333;

function run(cmd) {
  try { return execSync(cmd, { timeout: 10000, encoding: "utf8" }).trim(); }
  catch (e) { return "ERRO: " + e.stderr?.trim() || e.message; }
}

const ROUTES = {
  "open-url": (args) => run(`termux-open-url "${args.url}"`),
  "notify": (args) => run(`termux-notification -t "${args.title}" -c "${args.text}"`),
  "read-file": (args) => run(`cat "${args.path}"`),
  "list-files": (args) => run(`ls -la "${args.path || "."}"`),
  "exec": (args) => run(args.cmd),
  "sms-list": (args) => {
    const limit = args.limit || 10;
    const out = run(`termux-sms-list -l ${limit}`);
    try { return JSON.parse(out).map(m => `${m.number} [${m.date}]: ${m.body}`).join("\n---\n"); }
    catch { return out; }
  },
  "sms-send": (args) => {
    if (!args.numero) return "ERRO: numero obrigatorio";
    return run(`termux-sms-send -n "${args.numero}" "${args.texto || ""}"`);
  },
};

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => {
    const { action, ...args } = JSON.parse(body || "{}");
    const handler = ROUTES[action];
    if (!handler) return res.end(`acao desconhecida: ${action}`);
    const result = handler(args);
    res.end(result);
  });
});

server.listen(PORT, () => console.log(`PhoneAgent rodando na porta ${PORT}`));
