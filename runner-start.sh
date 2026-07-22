#!/bin/sh
set -e

# Garante que os diretórios de dados existam
mkdir -p /app/data/agent /app/data-home

# ─────────────────────────────────────────────────────────────
# Pré-gera AGENT_INTERNAL_SECRET (compartilhado entre agente e proxy)
# se ainda não existir. Evita race condition entre os dois processos
# tentarem gerar simultaneamente e divergirem no HMAC.
# ─────────────────────────────────────────────────────────────
SECRET_FILE=/app/data/.agent-internal-secret
if [ -n "$AGENT_INTERNAL_SECRET" ] && [ "$AGENT_INTERNAL_SECRET" != "default_internal_secret" ] && [ ${#AGENT_INTERNAL_SECRET} -ge 16 ]; then
  echo "[Start] AGENT_INTERNAL_SECRET fornecido via env — pulando geração"
elif [ ! -f "$SECRET_FILE" ]; then
  echo "[Start] Gerando AGENT_INTERNAL_SECRET em $SECRET_FILE (persistido no volume)..."
  # 48 bytes hex = 96 chars. head -c pra evitar tr consumir muito.
  head -c 48 /dev/urandom | od -An -v -tx1 | tr -d ' \n' > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
else
  echo "[Start] Reutilizando AGENT_INTERNAL_SECRET existente em $SECRET_FILE"
fi

# Iniciar o Agente Lucas em background (loopback 127.0.0.1:3717)
echo "[Start] Iniciando Agente Lucas em 127.0.0.1:3717..."
AGENT_PORT=3717 PORT=3717 node apps/agent/src/index.js &

# Iniciar o Maxrouter Next.js (porta 20128) em primeiro plano
echo "[Start] Iniciando Maxrouter em 0.0.0.0:20128..."
exec node custom-server.js
