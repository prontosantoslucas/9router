# Migração Railway → Zeabur

**Plano grátis:** 256MB RAM, 2 serviços, sem cartão de crédito.

## 1. Criar conta

1. Acesse https://zeabur.com
2. Login com GitHub (sem CC)
3. Painel → "Create Project"

## 2. Deploy do 9Router

No Zeabur:
1. **Create Project** → nome `9router`
2. **Add Service** → "GitHub" → selecione `nortelucas/9router`
3. Zeabur detecta `Dockerfile` automaticamente
4. **Configurar serviço:**
   - Domain: gerado automático (`9router.zeabur.app`)
   - **Port**: Zeabur injeta `PORT` automaticamente (não precisa configurar)
   - **Memory**: 256MB (free) — suficiente para Next.js + agente

## 3. Variáveis de ambiente

No serviço → **Environment Variables**, adicione:

| Variável | Obrigatório | Valor |
|---|---|---|
| `JWT_SECRET` | ✅ | string longa aleatória |
| `INITIAL_PASSWORD` | ✅ | sua senha (troque de `123456`) |
| `API_KEY_SECRET` | ✅ | string aleatória |
| `MACHINE_ID_SALT` | ✅ | string aleatória |
| `AGENT_INTERNAL_SECRET` | ✅ | mínimo 16 chars, FIXO (nunca mude) |
| `BOT_TOKEN` | ✅ | `8842388810:AAHHyqCKKZz7ye1T8pWM2XMF7xZVte9ontE` |
| `NOTION_TOKEN` | opcional | seu token Notion |
| `NOTION_DATABASE_ID` | opcional | ID do banco Notion |

**O `PORT` é automático** — Zeabur define e injeta. Não configure manualmente.

## 4. Persistência

Zeabur oferece **Persistent Storage** pago (R$ ~3/mês). Sem ele, dados SQLite são perdidos em redeploy.

**Opções:**
1. **Turso** (grátis, recomendo) — SQLite cloud. Configure:
   - `TURSO_DATABASE_URL=libsql://seu-db.turso.io`
   - `TURSO_AUTH_TOKEN=...`
   - Dados sobrevivem a qualquer deploy.
2. **Persistent Storage** do Zeabur — monte em `/data` (plano Growth $5/mês)

## 5. Acessar

- URL: `https://9router.zeabur.app` (ou o domínio gerado)
- Login: senha definida em `INITIAL_PASSWORD`

## 6. Atualizar

Deploy automático ao fazer push no GitHub:
```bash
git push
```

Zeabur detecta o push e faz rebuild automático.

## 7. Limitações do free tier

- **256MB RAM**: suficiente para o bundle (Next.js + agente). Se estourar, upgrade para Growth ($5/mês, 1GB).
- **Sleep**: serviço dorme após 30min sem uso. Acorda automaticamente no próximo request (leva ~5s).
- **2 serviços**: pode adicionar headroom/searxng como serviços separados se quiser.

## 8. Remover Railway

Depois de tudo funcionando no Zeabur:
1. Railway dashboard → remove o projeto
2. Cancela o trial antes do vencimento
