#!/bin/sh
set -e

# Prisma 7 discovers prisma.config.ts from CWD; run in subshell to
# avoid changing the working directory for the server process.
(cd /app/apps/api && /app/node_modules/.bin/prisma migrate deploy)

exec node apps/api/dist/apps/api/src/main
