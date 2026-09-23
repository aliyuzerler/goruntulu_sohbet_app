-- Phase 8: Moderation — frames, strikes, ratings, chat messages.

-- CreateTable — moderation_frames (one per captured video frame).
CREATE TABLE "moderation_frames" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "capture_seq" INTEGER NOT NULL,
    "s3_key" VARCHAR(512) NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "rekognition_result" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_frames_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "moderation_frame_call_seq_unique" ON "moderation_frames"("call_id", "capture_seq");
CREATE INDEX "moderation_frames_user_id_captured_at_idx" ON "moderation_frames"("user_id", "captured_at");
CREATE INDEX "moderation_frames_flagged_idx" ON "moderation_frames"("flagged");

-- CreateTable — strikes (one per user, upserted on apply).
CREATE TABLE "strikes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "last_strike_at" TIMESTAMP(3),
    "cooldown_ends_at" TIMESTAMP(3),
    "last_reason" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strikes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "strikes_user_id_key" ON "strikes"("user_id");
CREATE INDEX "strikes_cooldown_ends_at_idx" ON "strikes"("cooldown_ends_at");

-- CreateTable — call_ratings (post-call stars, one per (call, rater)).
CREATE TABLE "call_ratings" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_rating_call_rater_unique" ON "call_ratings"("call_id", "rater_id");
CREATE INDEX "call_ratings_target_user_id_idx" ON "call_ratings"("target_user_id");

-- CreateTable — call_chat_messages (filtered in-call text chat).
CREATE TABLE "call_chat_messages" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "filtered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_chat_messages_call_id_created_at_idx" ON "call_chat_messages"("call_id", "created_at");
CREATE INDEX "call_chat_messages_sender_id_idx" ON "call_chat_messages"("sender_id");

-- AddForeignKey — moderation_frame → call + user.
ALTER TABLE "moderation_frames" ADD CONSTRAINT "moderation_frames_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "moderation_frames" ADD CONSTRAINT "moderation_frames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — strike → user.
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — call_rating → call + rater + target.
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — call_chat_message → call + sender.
ALTER TABLE "call_chat_messages" ADD CONSTRAINT "call_chat_messages_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_chat_messages" ADD CONSTRAINT "call_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
