// PhoneAgent — roda no Termux (Android)
// npm install express
// node server.js
// Depois expor com: cloudflared tunnel, ngrok, ou 9router tunnel

const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3333;
const TOKEN = process.env.PHONE_TOKEN || "minha-senha";

function auth(req, res, next) {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

// Abrir URL no navegador
app.post("/open-url", auth, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send("URL obrigatória");
  try {
    execSync(`termux-open-url "${url}"`, { timeout: 5000 });
    res.send(`URL aberta: ${url}`);
  } catch (e) {
    res.status(500).send(`Erro: ${e.message}`);
  }
});

// Notificação no celular
app.post("/notify", auth, (req, res) => {
  const { title, text } = req.body;
  try {
    execSync(`termux-notification --title "${title || "Bot"}" --content "${text || ""}" --priority high`, { timeout: 5000 });
    res.send(`Notificação enviada: ${title}`);
  } catch (e) {
    res.status(500).send(`Erro: ${e.message}`);
  }
});

// Ler arquivo do celular
app.post("/read-file", auth, (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).send("Caminho obrigatório");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    res.send(content);
  } catch (e) {
    res.status(500).send(`Erro: ${e.message}`);
  }
});

// Listar arquivos
app.post("/list-files", auth, (req, res) => {
  const { path: dirPath } = req.body;
  try {
    const dir = dirPath || "/storage/emulated/0";
    const files = fs.readdirSync(dir).slice(0, 50);
    res.send(files.join("\n"));
  } catch (e) {
    res.status(500).send(`Erro: ${e.message}`);
  }
});

// Executar comando no Termux
app.post("/exec", auth, (req, res) => {
  const { cmd } = req.body;
  if (!cmd) return res.status(400).send("Comando obrigatório");
  try {
    const out = execSync(cmd, { timeout: 15000, encoding: "utf-8" });
    res.send(out.slice(0, 3000) || "(sem saída)");
  } catch (e) {
    res.status(500).send(`Erro: ${e.message}`);
  }
});

// Healthcheck
app.get("/health", (req, res) => {
  res.send("PhoneAgent ativo 📱");
});

app.listen(PORT, () => {
  console.log(`📱 PhoneAgent rodando na porta ${PORT}`);
  console.log(`Para expor: cloudflared tunnel --url http://localhost:${PORT}`);
});
