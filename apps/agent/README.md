# 9Router Agent

Smart AI Agent proxy with multi-model fallback via 9router. OpenAI-compatible endpoint + Telegram bot.

## Features

- **OpenAI-compatible API** — use with Codex, OpenCode, Cursor, Claude Code, etc.
- **Smart fallback** — tenta o melhor modelo disponível, pula rate-limited, volta quando recupera
- **11+ modelos FREE** — Kiro, Kimchi, Groq em ordem de força
- **Telegram Bot** integrado
- **24/7** via Railway

## Quick Start

```bash
cp .env.example .env
# edite .env com seu BOT_TOKEN do Telegram (opcional)
npm install
npm start
```

API em `http://localhost:3000/v1`

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v1/models` | Lista modelos disponíveis |
| POST | `/v1/chat/completions` | Chat completion com fallback |
| GET | `/health` | Status do servidor |

## Deploy no Railway

```bash
railway login
railway up
```

Setar variáveis: `ROUTER_BASE_URL`, `ROUTER_API_KEY`, `BOT_TOKEN` (opcional)

## Model Ranking

Ordem de força (configurável via `MODEL_RANKING`):
1. kr/auto-thinking
2. kr/claude-sonnet-4.5-thinking
3. kr/deepseek-3.2-thinking
4. kr/glm-5-thinking
5. kr/qwen3-coder-next-thinking
6. kr/claude-haiku-4.5-thinking
7. kimchi/deepseek-v4-flash
8. kimchi/kimi-k2.7
9. kimchi/minimax-m3
10. groq/llama-3.3-70b-versatile
11. groq/qwen/qwen3-32b
