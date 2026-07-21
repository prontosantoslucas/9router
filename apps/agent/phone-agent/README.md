# PhoneAgent — Controle seu celular pelo Telegram

## Requisitos
- Android com Termux + Termux:API
- Node.js no Termux

## Instalação no celular

```bash
# No Termux:
pkg update && pkg upgrade
pkg install nodejs
npm install express

# Conceder permissões:
termux-setup-storage
pkg install termux-api
```

## Rodar

```bash
node phone-agent/server.js
```

## Expor com túnel

```bash
# Opção 1: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3333

# Opção 2: Usar o tunnel do 9router pelo dashboard
```

Pegue a URL gerada e configure no .env do 9router-agent:

```
PHONE_AGENT_URL=https://seu-tunel.trycloudflare.com
```

## Comandos disponíveis

- `open-url` — abre URL no navegador
- `notify` — notificação push no celular
- `read-file` — lê arquivo do celular
- `list-files` — lista diretório
- `exec` — executa comando no Termux
