# syntax=docker/dockerfile:1.7
# Multi-stage build for the ContentFlow AI API and worker.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/usr/local/bin
WORKDIR /app
# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --ignore-scripts

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @contentflow/shared \
    && npx prisma generate --schema apps/api/prisma/schema.prisma \
    && npm run build --workspace @contentflow/api

# --- production dependencies ------------------------------------------------
FROM deps AS prod-deps
RUN npm prune --omit=dev

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 contentflow \
    && useradd --system --uid 1001 --gid contentflow contentflow

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY package.json ./

USER contentflow
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
