-- Phase 1 init — single health_pings table.
-- Prisma migrations will be the source of truth from Phase 2 onwards;
-- this file just makes sure a fresh container has the table before
-- the API boots for the first time.

CREATE TABLE IF NOT EXISTS health_pings (
  id          BIGSERIAL PRIMARY KEY,
  source      VARCHAR(64)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Helpful index for dev dashboard queries.
CREATE INDEX IF NOT EXISTS idx_health_pings_created_at ON health_pings (created_at DESC);
