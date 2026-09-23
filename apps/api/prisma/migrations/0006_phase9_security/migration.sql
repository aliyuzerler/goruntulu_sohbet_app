-- Phase 9: Ban evasion prevention — banned_devices table.

CREATE TABLE "banned_devices" (
    "id" UUID NOT NULL,
    "phone_hash" VARCHAR(128) NOT NULL,
    "android_id" VARCHAR(64),
    "original_user_id" UUID NOT NULL,
    "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_devices_pkey" PRIMARY KEY ("id")
);

-- One banned device per (phoneHash, androidId) combination.
CREATE UNIQUE INDEX "banned_device_pair_unique" ON "banned_devices"("phone_hash", "android_id");

-- Lookup by phone hash (for new signup with same phone).
CREATE INDEX "banned_devices_phone_hash_idx" ON "banned_devices"("phone_hash");

-- Lookup by androidId (for new signup from same device).
CREATE INDEX "banned_devices_android_id_idx" ON "banned_devices"("android_id");
