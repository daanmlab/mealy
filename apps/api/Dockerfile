# ─── Stage 1: install dependencies ───────────────────────────────────────────
# Copy only workspace manifests first so this layer is cached unless
# a package.json or lock file changes.
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/scraper/package.json ./apps/scraper/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
# Copy workspace-local node_modules — packages that can't be hoisted due to
# version conflicts live here (e.g. commander@13 for scraper, @nestjs/cli for api)
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/scraper/node_modules ./apps/scraper/node_modules
COPY . .

# Generate Prisma client, then build workspace packages in dependency order:
# scraper must be built before the API (api depends on @mealy/scraper at runtime)
RUN npm run db:generate --workspace=apps/api && \
    npm run build --workspace=apps/scraper && \
    npm run build --workspace=apps/api

# ─── Stage 3: production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Root workspace manifest (required for npm workspace package resolution)
COPY --from=builder /app/package.json ./

# node_modules contains the Prisma client and workspace symlinks
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Prisma schema, migrations, and config (needed for `prisma migrate deploy` on boot)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/

# Scraper compiled output — runtime dependency used in admin.service.ts
# The workspace symlink node_modules/@mealy/scraper -> ../../apps/scraper
# must resolve to a directory with the built dist/lib.js
COPY --from=builder /app/apps/scraper/dist ./apps/scraper/dist
COPY --from=builder /app/apps/scraper/package.json ./apps/scraper/

COPY --from=builder /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN chmod +x apps/api/docker-entrypoint.sh

USER nestjs

EXPOSE 3001

CMD ["apps/api/docker-entrypoint.sh"]
