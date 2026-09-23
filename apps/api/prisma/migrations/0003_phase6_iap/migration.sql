-- Phase 6: Google Play IAP — purchases table + wallet.negative_balance.

-- AlterTable — add negativeBalance flag.
ALTER TABLE "wallets" ADD COLUMN "negative_balance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable — Google Play purchases (one row per verified IAP).
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "order_id" VARCHAR(128) NOT NULL,
    "product_id" VARCHAR(64) NOT NULL,
    "purchase_token" VARCHAR(512) NOT NULL,
    "coins_credited" INTEGER NOT NULL,
    "amount_micros" INTEGER,
    "currency" VARCHAR(3),
    "purchase_state" VARCHAR(32) NOT NULL,
    "refunded_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "last_rtdn_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — unique orderId (idempotency key — duplicate verify-purchase requests are no-ops).
CREATE UNIQUE INDEX "purchases_order_id_key" ON "purchases"("order_id");

-- CreateIndex — unique purchaseToken (RTDN webhook lookup key).
CREATE UNIQUE INDEX "purchases_purchase_token_key" ON "purchases"("purchase_token");

-- CreateIndex — user history dashboard queries.
CREATE INDEX "purchases_userId_created_at_idx" ON "purchases"("userId", "created_at");

-- CreateIndex — product KPI dashboard.
CREATE INDEX "purchases_product_id_idx" ON "purchases"("product_id");

-- AddForeignKey — purchase → user.
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
