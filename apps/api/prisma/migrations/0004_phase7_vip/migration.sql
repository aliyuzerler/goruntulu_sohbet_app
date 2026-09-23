-- Phase 7: VIP subscription entitlement + filter activations.

-- CreateTable — entitlements (one row per user, upserted on verify-subscription).
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purchase_token" VARCHAR(512) NOT NULL,
    "product_id" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "canceled_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "last_rtdn_at" TIMESTAMP(3),
    "last_rtdn_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- One entitlement per user (upsert pattern).
CREATE UNIQUE INDEX "entitlements_userId_key" ON "entitlements"("userId");

-- One purchase token per entitlement (RTDN correlation key).
CREATE UNIQUE INDEX "entitlements_purchase_token_key" ON "entitlements"("purchase_token");

-- Cron + KPI queries: "find all expired entitlements still marked ACTIVE".
CREATE INDEX "entitlements_status_expires_at_idx" ON "entitlements"("status", "expires_at");

-- CreateTable — filter_activations (paid country filter for 24h, or VIP grant).
CREATE TABLE "filter_activations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "value" VARCHAR(8) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "coins_spent" INTEGER NOT NULL DEFAULT 0,
    "is_vip_grant" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_activations_pkey" PRIMARY KEY ("id")
);

-- Only one active filter per (user, type) — upsert pattern.
CREATE UNIQUE INDEX "filter_activation_user_type_unique" ON "filter_activations"("userId", "type");

-- Cron cleanup query: find all expired activations.
CREATE INDEX "filter_activations_expires_at_idx" ON "filter_activations"("expires_at");

-- AddForeignKey — entitlement → user.
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — filter_activation → user.
ALTER TABLE "filter_activations" ADD CONSTRAINT "filter_activations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
