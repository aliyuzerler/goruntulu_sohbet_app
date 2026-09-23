#!/bin/sh
# MinIO bootstrap — creates the assets bucket and sets a public-read policy.
# Runs once per `docker compose up` (idempotent).

set -e

: "${MINIO_ROOT_USER:?missing}"
: "${MINIO_ROOT_PASSWORD:?missing}"
: "${MINIO_BUCKET:=randchat-assets}"

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" --api S3v4

# Create bucket if missing.
if ! mc ls local/"$MINIO_BUCKET" >/dev/null 2>&1; then
  echo "→ creating bucket $MINIO_BUCKET"
  mc mb local/"$MINIO_BUCKET"
fi

# Phase 1 — keep it private. Phase 4 will create per-user prefixes with
# signed URLs for moderation frame uploads.

echo "✓ MinIO bootstrap complete"
