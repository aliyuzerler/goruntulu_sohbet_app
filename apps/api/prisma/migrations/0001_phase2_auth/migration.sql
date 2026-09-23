-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('TERMS', 'PRIVACY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "firebase_phone" VARCHAR(20),
ADD COLUMN     "google_subject" VARCHAR(128),
ADD COLUMN     "profile_completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "birth_date",
ADD COLUMN     "birth_year" INTEGER;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "android_id" VARCHAR(64);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "family_id" UUID NOT NULL,
    "device_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "issued_from_ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "type" "AgreementType" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "body_md" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_agreements" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "version_snapshot" VARCHAR(20) NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_from_ip" VARCHAR(45),

    CONSTRAINT "user_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "agreements_type_published_at_idx" ON "agreements"("type", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_type_version_unique" ON "agreements"("type", "version");

-- CreateIndex
CREATE INDEX "user_agreements_userId_idx" ON "user_agreements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_agreement_unique" ON "user_agreements"("userId", "agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "deletion_requests_userId_key" ON "deletion_requests"("userId");

-- CreateIndex
CREATE INDEX "deletion_requests_scheduled_at_executed_at_canceled_at_idx" ON "deletion_requests"("scheduled_at", "executed_at", "canceled_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_phone_key" ON "users"("firebase_phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_displayName_key" ON "profiles"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "device_user_android_unique" ON "devices"("userId", "android_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agreements" ADD CONSTRAINT "user_agreements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agreements" ADD CONSTRAINT "user_agreements_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

