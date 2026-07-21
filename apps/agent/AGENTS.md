# MaxRouter Lessons

## Pre-Delivery Checklist (must-run before marking done)

- [ ] Syntax check: `node -c src/*.js` — catch syntax errors like two switch arms on same line
- [ ] Build check: `dotnet build` if C# project involved
- [ ] Test API: `curl` the endpoint to verify JSON shape
- [ ] Test image: `curl /api/image/:id` returns HTTP 200 + valid bytes
- [ ] Cache bust: warn user to Ctrl+F5 when frontend files change
- [ ] Relative URLs: browser accepts `/path`, Telegram/Gotenberg/etc need `https://host/path` — add `x-forwarded-*` in response

## Mistakes Record

### 1. C# switch arm na mesma linha (ViewModelResolver.cs)
- Dois `=> tryResolve<>()` na mesma linha separados por espaço quebra compilação
- C# não permite duas expressões no mesmo switch arm
- Fix: sempre uma expressão por linha em switch expressions

### 2. Base64 image inline no content
- Colocar `data:image/png;base64,...` dentro da string de conteúdo markdown
- Problemas: tamanho enorme, não renderiza como `<img>`, polui localStorage
- Fix: salvar em disco, servir via URL, retornar campo `image` separado do `content`

### 3. URL relativa em resposta de imagem
- `/api/image/xxx` funciona no navegador (mesmo origin)
- Telegram `replyWithPhoto({ url })` precisa de URL absoluta
- Fix: converter path relativo para absoluto via `x-forwarded-proto/host`

### 4. Não avisar hard-reload após deploy de frontend
- Browser cacheia `chat.html`, `dashboard.html`
- Usuário testa contra código velho e acha que não funcionou
- Fix: sempre avisar Ctrl+F5 quando arquivos em `public/` mudarem

### 5. ANTHROPIC_BASE_URL aponta pro upstream, NÃO pro proxy
- Claude Code deve conectar DIRETAMENTE em `https://maxrouter-prod.up.railway.app/v1`, não no proxy `maxrouter.up.railway.app/v1`
- O proxy (`maxrouter.up.railway.app`) é para webchat e Telegram, não para Claude Code
- Razão: Claude Code envia requests Anthropic format e o upstream (combo system) roteia corretamente via "auto"
- Proxy só adiciona latência e confusão de modelo pra Claude Code

## Provider Ranking Updates (based on 2026-07-14 logs)

### Estado atual dos providers:
- `gh/claude-opus-4.6` → 403 "not licensed to use Copilot" (removido do ranking)
- `kr/*` (Kiro) → todos 402 "monthly request limit" (cota esgotada, movidos para último)
- `nvidia/deepseek-v4-flash` → funciona mas 503 ResourceExhausted (48/48) após muitas reqs
- `nvidia/deepseek-v4-pro` → funciona (lento ~14s)
- `kimchi/deepseek-v4-flash` → funciona bem (~2-7s)
- `kimchi/kimi-k2.7` → funcional
- `kimchi/minimax-m3` → funcional

### Ordem atual do ranking (seedProviders.js):
1. kimchi/deepseek-v4-flash (mais rápido)
2. kimchi/kimi-k2.7
3. kimchi/minimax-m3
4. nvidia/deepseek-ai/deepseek-v4-pro
5. nvidia/deepseek-ai/deepseek-v4-flash
6. groq/llama-3.3-70b-versatile
7. groq/qwen/qwen3-32b
8-13. kr/* (último recurso, monthly limit)
