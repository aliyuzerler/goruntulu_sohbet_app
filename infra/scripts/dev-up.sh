#!/usr/bin/env bash
# Start dev infrastructure (PostgreSQL + Redis + MinIO + Socket.IO).
# Usage: bash infra/scripts/dev-up.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env if present (optional — defaults are baked into compose file).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

echo "→ docker compose up -d"
docker compose up -d

echo
echo "✓ Services ready"
echo "  Postgres: localhost:5432 (randchat/randchat)"
echo "  Redis:    localhost:6379"
echo "  MinIO:    http://localhost:9001  (randchat_minio / randchat_minio_secret_2024)"
echo "  Socket.IO: http://localhost:3001"
