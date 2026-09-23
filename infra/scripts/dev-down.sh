#!/usr/bin/env bash
# Stop dev infrastructure. Volumes are preserved under infra/data/.
# Usage: bash infra/scripts/dev-down.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ docker compose down"
docker compose down

echo "✓ Services stopped (volumes preserved in infra/data/)"
echo "  To wipe: rm -rf infra/data/{postgres,redis,minio}"
