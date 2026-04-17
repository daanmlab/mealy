# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo.

## Project

Mealy = meal-planning app: discover recipes, build weekly meal plans, generate grocery lists, save favourites. Turborepo monorepo, npm workspaces.

## Commands

```bash
# Root-level (Turborepo)
npm run dev              # Hot-reload all apps (web :3000, api :3001)
npm run build            # Production build all packages
npm run lint             # ESLint all packages
npm run check-types      # tsc --noEmit all packages
npm run check            # lint + check-types
npm run format           # Prettier **/*.{ts,tsx,md}

# API (run from apps/api or use --workspace=apps/api)
npm run test             # Jest unit tests
npm run test -- --testPathPattern=auth   # Single test file
npm run test:cov         # Tests with coverage
npm run db:generate      # Regenerate Prisma client (run after schema changes)
npm run db:migrate       # Create/run migrations (dev)
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Local infrastructure (must be running before dev)
docker-compose up -d     # PostgreSQL 16 (:5432) + Redis 7 (:6379)
```

Also `./start.sh`: docker-compose up, starts both dev servers, tears down on Ctrl+C.

## Architecture

### Stack

| Layer    | Tech                                          | Port/Host       |
|----------|-----------------------------------------------|-----------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4          | :3000 / Vercel  |
| API      | NestJS 11, Prisma 7, Passport JWT             | :3001 / Render  |
| Database | PostgreSQL 16                                 | Neon            |
| Cache    | Redis 7                                       | Upstash         |

### Auth flow

NextAuth (v5 beta) handles web sessions. JWT tokens HS256-signed with shared `AUTH_SECRET`; NestJS validates directly.

- `apps/web/proxy.ts`: Next.js middleware — intercepts `/api/*`, injects NextAuth session JWT as `Bearer` token, rewrites to NestJS backend; redirects unauthenticated to `/login`.
- `apps/web/lib/auth.ts`: configures NextAuth with Credentials + Google. On Google sign-in, calls API's `upsert-oauth-user` endpoint (guarded by `INTERNAL_API_KEY`).
- `apps/web/contexts/auth.tsx`: provides `AuthProvider` / `useAuth()` wrapping NextAuth's `SessionProvider`, fetches full user profile from API.

### API module conventions

Each NestJS feature module: `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`, `feature.dto.ts` (DTOs co-located). No repository layer — `PrismaService` injected directly. Guards in `auth/guards/`, strategies in `auth/strategies/`, decorators in `auth/decorators/`.

Global: prefix `/api`, `ValidationPipe` (whitelist + transform), `ThrottlerGuard`, `helmet`.

### Shared types

`packages/types` = single source of truth for API-web contract. API's tsconfig maps `@mealy/types` to source directly (not compiled output) → NestJS outputs to `dist/apps/api/src/`; entry point `"entryFile": "apps/api/src/main"` in `nest-cli.json`.

### Web routing

Next.js route groups:
- `app/(auth)/` — login, register, OAuth callback (own layout, no auth required)
- `app/(app)/` — plan, recipes, favorites, settings, onboarding, admin (own layout, auth required)
- `app/api/[...proxy]/` — API proxy route + NextAuth handlers at `app/api/auth/`

### Web API client

`apps/web/lib/api.ts`: typed `api.get<T>()`, `api.post<T>()`, `api.patch<T>()`, `api.delete<T>()`. All use `credentials: 'include'`, go through Next.js proxy in production. On 401, fires session-expired callback → redirects to login.

### Database

Schema at `apps/api/prisma/schema.prisma`. After schema change, run `npm run db:generate` from `apps/api` first.

### CI

GitHub Actions (`.github/workflows/ci.yml`): runs on push/PR to `main` and `develop` — lint, typecheck, API unit tests (ephemeral Postgres + Redis), production build.

## Environment

Two env files needed locally:
- `apps/api/.env` (copy from `.env.example`) — needs `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`
- `apps/web/.env.local` (copy from `.env.example`) — needs `NEXT_PUBLIC_API_URL`, `AUTH_SECRET` (must match API)