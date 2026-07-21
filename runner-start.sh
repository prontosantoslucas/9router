#!/bin/sh
set -e

# Garante que os diretórios de dados existam
mkdir -p /app/data/agent /app/data-home

# Iniciar o Agente Lucas em background (loopback 127.0.0.1:3717)
echo "[Start] Iniciando Agente Lucas em 127.0.0.1:3717..."
PORT=3717 node apps/agent/src/index.js &

# Iniciar o Maxrouter Next.js (porta 20128) em primeiro plano
echo "[Start] Iniciando Maxrouter em 0.0.0.0:20128..."
exec node custom-server.js
