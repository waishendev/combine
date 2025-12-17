# ---- Base ----
FROM mirror.gcr.io/library/node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps_dev: 构建/本地需要 devDependencies ----
FROM base AS deps_dev
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
# 兼容无 BuildKit：不使用 --mount 缓存
RUN npm ci --ignore-scripts --no-audit --no-fund && npm cache clean --force

# ---- dev: 本地热更 ----
FROM deps_dev AS dev
ENV NODE_ENV=development
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
COPY . .
EXPOSE 7000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ---- builder: 用 dev 依赖构建，然后剔除 dev ----
FROM deps_dev AS builder
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY . .
RUN mkdir -p public \
 && npm run build \
 && npm prune --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# ---- runner: 生产运行（standalone + 纯运行时依赖）----
FROM mirror.gcr.io/library/node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 复制构建产物（standalone 会带 server.js 和运行依赖）
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node healthcheck.js ./healthcheck.js

USER node
EXPOSE 3000
CMD ["node", "server.js"]