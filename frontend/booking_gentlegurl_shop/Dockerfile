# ---- Base ----
FROM mirror.gcr.io/library/node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps_dev: build/local needs devDependencies ----
FROM base AS deps_dev
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
# Compatible without BuildKit: no --mount cache
RUN npm ci --ignore-scripts --no-audit --no-fund && npm cache clean --force

# ---- dev: local hot reload ----
FROM deps_dev AS dev
ENV NODE_ENV=development
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
COPY . .
EXPOSE 7000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ---- builder: build with dev deps then prune ----
FROM deps_dev AS builder
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_COLOR
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_TIMEZONE

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_COLOR=${NEXT_PUBLIC_COLOR} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_TIMEZONE=${NEXT_PUBLIC_TIMEZONE}

COPY . .
RUN mkdir -p public \
 && npm run build \
 && npm prune --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# ---- runner: production runtime (standalone + runtime deps) ----
FROM mirror.gcr.io/library/node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copy build output (standalone includes server.js + runtime deps)
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node healthcheck.js ./healthcheck.js

USER node
EXPOSE 3000
CMD ["node", "server.js"]
