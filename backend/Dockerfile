# syntax=docker/dockerfile:1.7
# FlowSync backend images — one Dockerfile, three targets built from the same compiled code:
#
#   docker build --target api     -t flowsync-api .      # HTTP API + WebSocket gateway (default)
#   docker build --target worker  -t flowsync-worker .   # BullMQ workers + schedulers
#   docker build --target migrate -t flowsync-migrate .  # one-off `prisma migrate deploy` job
#
# Runtime images contain production dependencies and compiled JavaScript only, run as the
# unprivileged `node` user and work with a read-only root filesystem.

ARG NODE_IMAGE=node:22-alpine

# --- Dependencies (incl. dev) + generated Prisma client -------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# --- Compile TypeScript ----------------------------------------------------------------
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Database migrations (run once per release, before rolling out api/worker) --------
FROM deps AS migrate
# Local CLIs (prisma, tsx for `prisma db seed`) on PATH.
ENV NODE_ENV=production \
    PATH=/app/node_modules/.bin:$PATH
USER node
CMD ["prisma", "migrate", "deploy"]

# --- Production dependencies only ---------------------------------------------------------
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# Scripts are skipped: the Prisma client is compiled into dist/ and argon2 ships prebuilt binaries.
# `--omit=optional` also drops the Prisma CLI (an optional peer of @prisma/client) and its tooling
# dependencies, which the running app never loads.
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force

# --- Shared runtime base --------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime-base
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.title="FlowSync backend" \
      org.opencontainers.image.version="${APP_VERSION}"
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node

# --- Background worker ------------------------------------------------------------------------
FROM runtime-base AS worker
ENV WORKER_HEALTH_PORT=4001
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4001/health/live > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/worker.js"]

# --- HTTP API + WebSocket gateway (default target) ---------------------------------------------
FROM runtime-base AS api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health/live > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
