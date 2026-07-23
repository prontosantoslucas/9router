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

# ─────────────────────────────────────────────────────────────
# Porta do MAXROUTER: o Railway injeta PORT (ex.: 8080). O Next escuta nela.
# O agente precisa chamar o gateway LLM do maxrouter NESSA porta — não em 20128.
# Sem isso, o agente tenta http://127.0.0.1:20128/v1, nada escuta lá, e o chat
# quebra com 500 "fetch failed" (agente→maxrouter). Capturamos a porta real e
# passamos ROUTER_BASE_URL pro agente. Se ROUTER_BASE_URL já vier do env, respeita.
# ─────────────────────────────────────────────────────────────
MAXROUTER_PORT="${PORT:-20128}"
AGENT_ROUTER_BASE_URL="${ROUTER_BASE_URL:-http://127.0.0.1:${MAXROUTER_PORT}/v1}"
echo "[Start] Maxrouter na porta ${MAXROUTER_PORT} · agente chamará ${AGENT_ROUTER_BASE_URL}"

# Iniciar o Agente Lucas em background (loopback 127.0.0.1:3717).
# PORT=3717 é a porta do AGENTE; ROUTER_BASE_URL aponta para o maxrouter.
echo "[Start] Iniciando Agente Lucas em 127.0.0.1:3717..."
AGENT_PORT=3717 PORT=3717 ROUTER_BASE_URL="${AGENT_ROUTER_BASE_URL}" node apps/agent/src/index.js &

# Iniciar o Maxrouter Next.js em primeiro plano — usa o PORT injetado pelo Railway.
echo "[Start] Iniciando Maxrouter em 0.0.0.0:${MAXROUTER_PORT}..."
exec node custom-server.js
