# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mealy is a meal-planning app: discover recipes, build weekly meal plans, generate grocery lists, save favourites. Turborepo monorepo with npm workspaces.

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

There is also `./start.sh` which does docker-compose up, starts both dev servers, and tears everything down on Ctrl+C.

## Architecture

### Stack

| Layer    | Tech                                          | Port/Host       |
|----------|-----------------------------------------------|-----------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4          | :3000 / Vercel  |
| API      | NestJS 11, Prisma 7, Passport JWT             | :3001 / Render  |
| Database | PostgreSQL 16                                 | Neon            |
| Cache    | Redis 7                                       | Upstash         |

### Auth flow

NextAuth (v5 beta) handles sessions on the web side. JWT tokens are HS256-signed with the shared `AUTH_SECRET` so NestJS can validate them directly.

- `apps/web/proxy.ts` acts as Next.js middleware: intercepts `/api/*` requests, injects the NextAuth session JWT as a `Bearer` token, and rewrites to the NestJS backend. It also redirects unauthenticated users to `/login`.
- `apps/web/lib/auth.ts` configures NextAuth with Credentials + Google providers. On Google sign-in, it calls the API's `upsert-oauth-user` endpoint (guarded by `INTERNAL_API_KEY`).
- `apps/web/contexts/auth.tsx` provides `AuthProvider` / `useAuth()` which wraps NextAuth's `SessionProvider` and fetches the full user profile from the API.

### API module conventions

Each NestJS feature module follows: `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`, `feature.dto.ts` (DTOs co-located). No repository layer -- `PrismaService` is injected directly. Guards in `auth/guards/`, strategies in `auth/strategies/`, decorators in `auth/decorators/`.

The API uses a global prefix `/api`, global `ValidationPipe` (whitelist + transform), `ThrottlerGuard`, and `helmet`.

### Shared types

`packages/types` is the single source of truth for the API-web contract. The API's tsconfig maps `@mealy/types` to the source file directly (not compiled output). This causes NestJS to output to `dist/apps/api/src/` -- the entry point is `"entryFile": "apps/api/src/main"` in `nest-cli.json`.

### Web routing

Next.js route groups:
- `app/(auth)/` -- login, register, OAuth callback (own layout, no auth required)
- `app/(app)/` -- plan, recipes, favorites, settings, onboarding, admin (own layout, auth required)
- `app/api/[...proxy]/` -- API proxy route + NextAuth handlers at `app/api/auth/`

### Web API client

`apps/web/lib/api.ts` provides typed `api.get<T>()`, `api.post<T>()`, `api.patch<T>()`, `api.delete<T>()`. All requests use `credentials: 'include'` and go through the Next.js proxy in production. On 401, fires a session-expired callback that redirects to login.

### Database

Schema at `apps/api/prisma/schema.prisma`. After any schema change, run `npm run db:generate` from `apps/api` before anything else.

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main` and `develop`: lint, typecheck, API unit tests (with ephemeral Postgres + Redis), and production build.

## Environment

Two env files needed locally:
- `apps/api/.env` (copy from `.env.example`) -- needs `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`
- `apps/web/.env.local` (copy from `.env.example`) -- needs `NEXT_PUBLIC_API_URL`, `AUTH_SECRET` (must match API)
