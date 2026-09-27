# syntax=docker/dockerfile:1.7
# FlowSync web client: static Vite build served by an unprivileged nginx that also
# reverse-proxies /api and /ws to the backend, so the browser sees a single origin
# (cookies, CORS and the WebSocket origin check stay same-origin).
#
#   docker build -t flowsync-web .
#   docker run -p 8080:8080 -e API_UPSTREAM=http://api:4000 flowsync-web
#
# Runtime settings (env): API_UPSTREAM, CSP_IMG_SRC, CSP_CONNECT_SRC — see nginx/default.conf.template.

ARG NODE_IMAGE=node:22-alpine

# --- Build ----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time client settings (public — never put secrets in VITE_ variables).
ARG VITE_APP_NAME=FlowSync
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_WS_URL=/ws
ARG VITE_API_TIMEOUT_MS=15000
ARG VITE_UPLOAD_MAX_FILE_SIZE_MB=25
ENV VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_WS_URL=${VITE_WS_URL} \
    VITE_API_TIMEOUT_MS=${VITE_API_TIMEOUT_MS} \
    VITE_UPLOAD_MAX_FILE_SIZE_MB=${VITE_UPLOAD_MAX_FILE_SIZE_MB}
RUN npm run build \
  # Hidden source maps are for error tracking uploads, never for serving.
  && find dist -name '*.map' -delete

# --- Runtime ----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="FlowSync web client" \
      org.opencontainers.image.version="${APP_VERSION}"
# Rendered into /etc/nginx/conf.d/ by the image's entrypoint (envsubst) at startup.
ENV API_UPSTREAM=http://backend:4000 \
    CSP_IMG_SRC="" \
    CSP_CONNECT_SRC=""
COPY nginx/*.template /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz > /dev/null || exit 1
