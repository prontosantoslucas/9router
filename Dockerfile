# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS builder

RUN apk --no-cache upgrade && apk --no-cache add python3 make g++ linux-headers

COPY package.json ./
# Railway exige `id` em cache mounts (formato s/<service-id>-<target>).
RUN --mount=type=cache,id=s/132e6acb-4d7c-439e-a5df-c1fc136a5855-/root/.npm,target=/root/.npm \
  npm install

COPY . ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
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
# Standalone node_modules may omit deps only required by the MITM child process.
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge
# Ensure `next` is available at runtime in case tracing did not include it.
COPY --from=builder /app/node_modules/next ./node_modules/next
# Native libSQL/Turso binary for Alpine (not traced by Next.js standalone)
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql

RUN mkdir -p /app/data && chown -R node:node /app && \
  mkdir -p /app/data-home && chown node:node /app/data-home && \
  ln -sf /app/data-home /root/.9router 2>/dev/null || true

# Headroom token saver bundled by default (Python proxy, started by the app at boot).
# Only the [proxy] extra here: it is pure-Python wheels and needs no compiler.
# The [code] (tree-sitter) extra is installed lazily at runtime by autostart.js.
# Non-fatal: a headroom install hiccup must never fail the image build.
RUN apk --no-cache add python3 py3-pip && \
  (pip3 install --no-cache-dir --break-system-packages "headroom-ai[proxy]" || echo "headroom install skipped")

# Fix permissions at runtime (handles mounted volumes)
RUN apk --no-cache upgrade && apk --no-cache add su-exec && \
  printf '#!/bin/sh\nchown -R node:node /app/data /app/data-home 2>/dev/null\nexec su-exec node "$@"\n' > /entrypoint.sh && \
  chmod +x /entrypoint.sh

# Persistent data (SQLite config, OAuth connections, combos) lives in /app/data.
# Railway does NOT support the Dockerfile VOLUME instruction — attach a
# persistent volume in the dashboard instead: Service > Volumes > mount path
# /app/data. (Or use managed Turso: set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.)
# On Fly/other hosts, mount a volume at /app/data likewise.

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "custom-server.js"]
