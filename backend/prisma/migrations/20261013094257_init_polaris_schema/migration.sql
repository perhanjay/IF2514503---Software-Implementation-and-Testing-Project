-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AUDIO_ENGINEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('WELCOME_GRANT', 'TOPUP', 'DEDUCTION', 'REFUND');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'UPLOADING', 'PROCESSING', 'READY', 'REPAIRED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('PENDING', 'ANALYZED', 'REPAIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "PairType" AS ENUM ('MIC_PAIR', 'STEREO_SPLIT', 'BASS_DI_MIC', 'DRUM_TOP_BOTTOM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AUDIO_ENGINEER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sample_rate" INTEGER,
    "bit_depth" INTEGER,
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "health_score" DOUBLE PRECISION,
    "estimated_tokens" INTEGER NOT NULL DEFAULT 1,
    "retention_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_storage_key" TEXT NOT NULL,
    "repaired_storage_key" TEXT,
    "instrument_label" TEXT,
    "detected_label" TEXT,
    "is_stereo" BOOLEAN NOT NULL DEFAULT false,
    "duration_sec" DOUBLE PRECISION,
    "waveform_peaks_json" JSONB,
    "status" "TrackStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_pairs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "track_a_id" TEXT NOT NULL,
    "track_b_id" TEXT NOT NULL,
    "pair_type" "PairType" NOT NULL DEFAULT 'MIC_PAIR',
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_results" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "phase_correlation" DOUBLE PRECISION,
    "has_polarity_invert" BOOLEAN NOT NULL DEFAULT false,
    "has_comb_filtering" BOOLEAN NOT NULL DEFAULT false,
    "has_fake_stereo" BOOLEAN NOT NULL DEFAULT false,
    "true_peak_dbfs" DOUBLE PRECISION,
    "has_clipping" BOOLEAN NOT NULL DEFAULT false,
    "crest_factor" DOUBLE PRECISION,
    "has_dc_offset" BOOLEAN NOT NULL DEFAULT false,
    "has_sub_rumble" BOOLEAN NOT NULL DEFAULT false,
    "health_status" TEXT NOT NULL DEFAULT 'Clean',
    "raw_metrics" JSONB,
    "recommendations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_configs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "is_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_results_track_id_key" ON "diagnostic_results"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "repair_configs_session_id_key" ON "repair_configs"("session_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_pairs" ADD CONSTRAINT "track_pairs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_pairs" ADD CONSTRAINT "track_pairs_track_a_id_fkey" FOREIGN KEY ("track_a_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_pairs" ADD CONSTRAINT "track_pairs_track_b_id_fkey" FOREIGN KEY ("track_b_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_configs" ADD CONSTRAINT "repair_configs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
