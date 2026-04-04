#!/usr/bin/env bash
set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()  { echo -e "${BOLD}${CYAN}[mealy]${RESET} $*"; }
ok()   { echo -e "${BOLD}${GREEN}[mealy]${RESET} $*"; }
warn() { echo -e "${BOLD}${YELLOW}[mealy]${RESET} $*"; }
err()  { echo -e "${BOLD}${RED}[mealy]${RESET} $*" >&2; }

# ── Repo root ──────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# ── PID tracking ──────────────────────────────────────────────────────────────
API_PID=""
WEB_PID=""

# ── Cleanup ────────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  warn "Shutting down…"

  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    warn "Stopping web  (PID $WEB_PID)…"
    # Kill the entire process group so Next.js child workers also die
    kill -- -"$WEB_PID" 2>/dev/null || kill "$WEB_PID" 2>/dev/null || true
  fi

  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    warn "Stopping API  (PID $API_PID)…"
    kill -- -"$API_PID" 2>/dev/null || kill "$API_PID" 2>/dev/null || true
  fi

  warn "Running docker-compose down…"
  docker-compose down 2>/dev/null || true

  ok "All services stopped. Goodbye!"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── 1. Docker Compose ──────────────────────────────────────────────────────────
log "Starting PostgreSQL + Redis via docker-compose…"
docker-compose up -d
ok "Docker containers started."

# ── 2. Wait for database ───────────────────────────────────────────────────────
log "Waiting 5 s for the database to be ready…"
sleep 5
ok "Database should be ready."

# ── 3. API dev server ──────────────────────────────────────────────────────────
log "Starting API dev server (NestJS --watch) on port 3001…"
# setsid gives the child its own process group so we can kill the whole tree
(cd "$REPO_ROOT/apps/api" && npm run dev) &
API_PID=$!
ok "API server started  (PID $API_PID)."

# ── 4. Web dev server ──────────────────────────────────────────────────────────
log "Starting Web dev server (Next.js) on port 3000…"
(cd "$REPO_ROOT/apps/web" && npm run dev) &
WEB_PID=$!
ok "Web server started  (PID $WEB_PID)."

# ── 5. Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  🍽  Mealy is running!${RESET}"
echo -e "  Web  → ${CYAN}http://localhost:3000${RESET}"
echo -e "  API  → ${CYAN}http://localhost:3001${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop all services."
echo ""

# ── Wait for background jobs; forward signals ──────────────────────────────────
wait
