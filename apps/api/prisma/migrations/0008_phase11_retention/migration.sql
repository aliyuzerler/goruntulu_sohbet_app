-- Phase 11: Retention + monetization extras — daily login streaks + referrals.

CREATE TABLE "daily_login_streaks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "last_claim_date" VARCHAR(10),
    "last_claim_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_login_streaks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_login_streaks_user_id_key" ON "daily_login_streaks"("user_id");

CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "invite_code" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "bonus_credited" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referrals_invite_code_key" ON "referrals"("invite_code");
CREATE UNIQUE INDEX "referral_pair_unique" ON "referrals"("referrer_id", "invitee_id");
CREATE INDEX "referrals_invitee_id_idx" ON "referrals"("invitee_id");

ALTER TABLE "daily_login_streaks" ADD CONSTRAINT "daily_login_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
