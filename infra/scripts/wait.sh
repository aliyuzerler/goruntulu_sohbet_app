#!/usr/bin/env bash
# Wait for services to be ready before running tests.
# Usage: bash infra/scripts/wait.sh
set -euo pipefail

echo "Waiting for Postgres on :5432…"
until docker exec randchat-pg pg_isready -U randchat >/dev/null 2>&1; do
  sleep 1
done
echo "✓ Postgres ready"

echo "Waiting for Redis on :6379…"
until docker exec randchat-redis redis-cli ping >/dev/null 2>&1; do
  sleep 1
done
echo "✓ Redis ready"

echo "Waiting for MinIO on :9000…"
until docker exec randchat-minio mc ls local >/dev/null 2>&1; do
  sleep 1
done
echo "✓ MinIO ready"
