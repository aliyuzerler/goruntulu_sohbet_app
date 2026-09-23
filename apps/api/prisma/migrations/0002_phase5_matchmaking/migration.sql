-- Phase 5: Call.endReason + Call.avgQualityMs + index.
-- ALTER TABLE adds two nullable columns to calls.

-- AlterTable — Phase 5: endReason + avgQualityMs
ALTER TABLE "calls" ADD COLUMN "end_reason" VARCHAR(32),
ADD COLUMN "avg_quality_ms" INTEGER;

-- CreateIndex — Phase 5: KPI dashboard queries by endReason.
CREATE INDEX "calls_end_reason_idx" ON "calls"("end_reason");

-- Phase 5: nothing else — RINGING is semantically same as MATCHED (we
-- didn't add a new enum value, just clarified the meaning in comments).
