# Mealy – Copilot Instructions

## Repository Overview

Turborepo monorepo for a meal-planning app.

- `apps/api` — NestJS 11 + Prisma 7 + PostgreSQL + Redis (port 3001)
- `apps/web` — Next.js 16 + React 19 + Tailwind CSS 4 (port 3000)
- `packages/types` — Shared TypeScript types consumed by both apps
- `packages/ui` — Shared React component library

## Commands

```bash
# From repo root
npm run dev          # Start all apps with hot-reload (Turborepo TUI)
npm run build        # Build all packages in dependency order
npm run lint         # ESLint all packages
npm run check-types  # tsc --noEmit all packages
npm run format       # Prettier over **/*.{ts,tsx,md}

# From apps/api
npm run test                     # Run all Jest tests once
npm run test:watch               # Watch mode
npm run test:cov                 # With coverage
npm run test -- --testPathPattern=auth  # Run a single test file
npm run db:generate              # Regenerate Prisma client after schema changes
npm run db:migrate               # Run migrations (dev)
npm run db:seed                  # Seed the database

# Local infrastructure (run before npm run dev)
docker-compose up    # Starts PostgreSQL 16 (5432) and Redis 7 (6379)
```

## Architecture

### Auth Flow
1. Login/register → `accessToken` (JWT, 15 min) + `refreshToken` (HTTP-only cookie, 7 days)
2. All API requests include `Authorization: Bearer <accessToken>`
3. On 401, the web client (`apps/web/lib/api.ts`) automatically calls `POST /auth/refresh`, then retries the original request
4. Access token is stored in memory only (not localStorage)

### API → Web Type Sharing
- `packages/types` is the source of truth for shared contracts
- `apps/api/tsconfig.json` maps `@mealy/types` to `../../packages/types/src/index.ts` (source, not compiled)
- This path alias causes TypeScript to output to `dist/apps/api/src/` instead of `dist/` — the NestJS entry point is configured as `"entryFile": "apps/api/src/main"` in `nest-cli.json`

### Web API Client
`apps/web/lib/api.ts` contains both the typed API client and local type mirrors. All fetch calls go through `api.get<T>()`, `api.post<T>()`, etc. which handle auth headers and token refresh.

## NestJS Module Conventions

Each feature module follows this structure:

```
feature/
├── feature.module.ts
├── feature.controller.ts
├── feature.service.ts
└── feature.dto.ts        # DTOs co-located, not in a separate folder
```

Guards live in `auth/guards/`, Passport strategies in `auth/strategies/`, custom decorators in `auth/decorators/`. `PrismaService` is injected as a dependency — there is no repository layer.

## Next.js Conventions

Route groups split auth and app:
- `app/(auth)/` — login, register, callback pages (own layout)
- `app/(app)/` — plan, favorites, settings, onboarding pages (own layout)

Auth state is provided via `AuthProvider` (`contexts/auth.tsx`). Use `useAuth()` to access `{ user, loading, login, register, logout, refreshUser }` in any client component.

## Database

Schema at `apps/api/prisma/schema.prisma`. Key models: `User`, `Recipe`, `RecipeIngredient`, `WeeklyPlan`, `WeeklyPlanMeal`, `GroceryList`, `GroceryListItem`, `FavoriteRecipe`, `RefreshToken`.

After any schema change: run `npm run db:generate` from `apps/api` before doing anything else.

## Environment Variables

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`. Minimum required to run locally:

```
# apps/api/.env
DATABASE_URL="postgresql://mealy:mealy@localhost:5432/mealy"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET=<any string>
JWT_REFRESH_SECRET=<any string>

# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:3001"
```
