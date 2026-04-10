# Mealy

Mealy is a full-stack meal-planning application. It lets users discover recipes, build weekly meal plans, generate grocery lists, and save favourites — with AI-assisted recipe suggestions and an optional web scraper for importing recipes from URLs.

## Architecture

```
┌─────────────────────┐     HTTPS      ┌─────────────────────────┐
│   Next.js (web)     │ ─────────────►   NestJS API            │
│   Vercel            │                │   Render (Docker)       │
└─────────────────────┘                └────────────┬────────────┘
                                                    │
                                       ┌────────────┴────────────┐
                                       │                         │
                               ┌───────▼───────┐   ┌────────────▼──────┐
                               │  Neon Postgres  │   │  Upstash Redis    │
                               │  (database)   │   │  (sessions/cache) │
                               └───────────────┘   └───────────────────┘
```

| Layer            | Technology                           | Hosting         |
| ---------------- | ------------------------------------ | --------------- |
| Frontend         | Next.js 16, React 19, Tailwind CSS 4 | Vercel          |
| API              | NestJS 11, Prisma 7, Passport JWT    | Render (Docker) |
| Database         | PostgreSQL 16                        | Neon            |
| Cache / sessions | Redis 7                              | Upstash         |
| CI               | GitHub Actions                       | —               |

## Repository structure

```
mealy/
├── apps/
│   ├── api/          # NestJS REST API (port 3001)
│   │   ├── prisma/   # Schema, migrations, seed
│   │   └── src/      # Feature modules (auth, recipes, plans, grocery, …)
│   ├── web/          # Next.js frontend (port 3000)
│   │   ├── app/      # Route groups: (auth)/ and (app)/
│   │   ├── components/
│   │   ├── contexts/ # AuthProvider, useAuth
│   │   └── lib/      # Typed API client with token-refresh logic
│   └── scraper/      # CLI tool for importing recipes from URLs
├── packages/
│   ├── types/        # Shared TypeScript types (API ↔ web contract)
│   ├── ui/           # Shared React component library
│   ├── eslint-config/
│   └── typescript-config/
├── docker-compose.yml  # Local Postgres + Redis
└── render.yaml         # Render deployment definition
```

## Local development

### Prerequisites

- Node.js ≥ 18 and npm ≥ 11
- Docker (for local Postgres and Redis)

### Setup

```sh
# 1. Clone and install dependencies
git clone https://github.com/daanmlab/mealy.git
cd mealy
npm install

# 2. Copy and fill environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit both files — see "Environment variables" below

# 3. Start local Postgres and Redis
docker-compose up -d

# 4. Run database migrations and seed
npm run db:migrate --workspace=apps/api
npm run db:seed --workspace=apps/api

# 5. Start all apps (hot-reload)
npm run dev
```

Apps will be available at:

- Frontend: http://localhost:3000
- API: http://localhost:3001/api

### Useful commands

```sh
npm run lint          # ESLint all packages
npm run check-types   # TypeScript check all packages
npm run build         # Production build all packages
npm run format        # Prettier over **/*.{ts,tsx,md}

# From apps/api
npm run test          # Jest unit tests
npm run test:cov      # With coverage
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:migrate    # Run migrations (dev)
npm run db:studio     # Open Prisma Studio
```

## Environment variables

### `apps/api/.env`

```env
DATABASE_URL="postgresql://mealy:mealy@localhost:5432/mealy"
REDIS_URL="redis://localhost:6379"

JWT_ACCESS_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

PORT=3001
FRONTEND_URL="http://localhost:3000"

# Google OAuth (optional for local dev)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# Recipe scraper (optional)
SCRAPER_API_KEY=""
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Deployment

### Frontend — Vercel

1. Import the repository into Vercel.
2. Set the **root directory** to `apps/web`.
3. Add the environment variable `NEXT_PUBLIC_API_URL` pointing to the deployed API URL.
4. Vercel auto-detects Next.js and deploys on every push to `main`.

### API — Render

The API is deployed as a Docker container using the definition in `render.yaml`.

1. Create a new **Blueprint** on Render and connect this repository.
2. Render reads `render.yaml` and creates the `mealy-api` web service.
3. Fill in the secret environment variables in the Render dashboard (marked `sync: false` in `render.yaml`).
4. On the first deploy, run migrations:
   ```sh
   npx prisma migrate deploy
   ```
   This can be run from the Render shell, or added as a pre-deploy command.

> **Docker context note:** The Dockerfile lives in `apps/api/` but the build context is the repository root so it can copy shared workspace packages (`packages/types`, `apps/scraper`).

### Database — Neon

Create a Neon project and copy the connection string (with `?sslmode=require`) into `DATABASE_URL` in the Render dashboard.

### Cache — Upstash

Create an Upstash Redis database and copy the `rediss://` URL into `REDIS_URL` in the Render dashboard.

### CI — GitHub Actions

The pipeline (`.github/workflows/ci.yml`) runs on every push and pull request to `main` and `develop`:

1. **Lint** — ESLint all packages
2. **Typecheck** — `tsc --noEmit` all packages
3. **Test** — Jest unit tests for the API (with ephemeral Postgres + Redis services)
4. **Build** — Production build for all apps to verify nothing is broken

Vercel and Render both support auto-deploy on push to `main` — configure this in each platform's dashboard. CI acts as the quality gate before code reaches production.

---

## First production checklist

- [ ] Provision a **Neon** Postgres database; copy the connection string
- [ ] Provision an **Upstash** Redis database; copy the connection string
- [ ] Set all `sync: false` environment variables in the **Render** dashboard
- [ ] Set `FRONTEND_URL` in Render to the Vercel deployment URL
- [ ] Set `NEXT_PUBLIC_API_URL` in Vercel to the Render service URL
- [ ] Run `prisma migrate deploy` against the production database
- [ ] Update **Google OAuth** callback URLs to the production API URL
- [ ] Verify the CI pipeline passes on `main`
- [ ] Confirm the Render health check (`/api/health`) returns `{ "status": "ok" }`
- [ ] Test the end-to-end auth flow (register → login → token refresh)
