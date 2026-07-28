# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS builder

RUN apk --no-cache upgrade && apk --no-cache add python3 make g++ linux-headers

COPY package.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm \
  npm install

COPY . ./

# Instala deps do agente (workspace independente).
# --ignore-scripts evita o postinstall que tenta git submodule update
# (submodule 9router não é usado no deploy unificado).
RUN --mount=type=cache,id=npm,target=/root/.npm \
  cd apps/agent && npm install --omit=dev --no-audit --no-fund --ignore-scripts

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/custom-server.js ./custom-server.js
COPY --from=builder /app/open-sse ./open-sse
# Next file tracing can omit sibling files; MITM runs server.js as a separate process.
COPY --from=builder /app/src/mitm ./src/mitm
# Ensure all production node_modules (including agent workspace dependencies) are available at runtime
COPY --from=builder /app/node_modules ./node_modules
# Inclui apps/agent/node_modules (googleapis, google-auth-library, @modelcontextprotocol/sdk, telegram, better-sqlite3, ...)
COPY --from=builder /app/apps/agent ./apps/agent
COPY --from=builder /app/runner-start.sh ./runner-start.sh
RUN chmod +x ./runner-start.sh

RUN mkdir -p /app/data /app/data/agent && chown -R node:node /app && \
  mkdir -p /app/data-home && chown node:node /app/data-home && \
  ln -sf /app/data-home /root/.9router 2>/dev/null || true

# Headroom token saver bundled by default (Python proxy, started by the app at boot).
RUN apk --no-cache add python3 py3-pip && \
  (pip3 install --no-cache-dir --break-system-packages "headroom-ai[proxy]" || echo "headroom install skipped")

# ffmpeg — usado pelo agente para processar vídeo (extrair áudio p/ STT e frames p/ visão).
RUN apk --no-cache add ffmpeg || echo "ffmpeg install skipped"

# Fix permissions at runtime (handles mounted volumes)
RUN apk --no-cache upgrade && apk --no-cache add su-exec && \
  printf '#!/bin/sh\nchown -R node:node /app/data /app/data-home 2>/dev/null\nexec su-exec node "$@"\n' > /entrypoint.sh && \
  chmod +x /entrypoint.sh

EXPOSE 7860

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/sh", "/app/runner-start.sh"]
