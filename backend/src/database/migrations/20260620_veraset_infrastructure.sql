-- Migration: 20260620_veraset_infrastructure
-- Description: Veraset subscription tracking + mobility ingest readiness.
--   The historical_observations table already has mobility_* columns (added in
--   20260511). This migration creates the subscription control table so the
--   platform can gate Veraset data ingestion and reflect subscription status in
--   the coverage panel. Ingestion is disabled until the paid subscription deal
--   is active — the code path (VerasetMobilityService) is wired but gated by
--   subscription.is_active.
--
-- Blocker: #10 — "Add Veraset infrastructure (paid subscription — code ready
--   when deal active)"

BEGIN;

-- ─── 1. Subscription control table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS veraset_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msa_id                VARCHAR(20) NOT NULL,
  msa_name              VARCHAR(120),
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_tier     VARCHAR(20),              -- 'basic' | 'premium' | 'enterprise'
  monthly_quota         INTEGER,                  -- max POIs / visits per month
  quota_used_this_month INTEGER DEFAULT 0,
  quota_resets_at       TIMESTAMPTZ,              -- monthly reset timestamp
  api_key_encrypted     TEXT,                     -- encrypted Veraset API key
  api_endpoint          TEXT,                     -- Veraset API base URL
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (msa_id)
);

-- Index for quick lookup in coverage queries
CREATE INDEX IF NOT EXISTS idx_veraset_subscriptions_msa_id
  ON veraset_subscriptions(msa_id);

-- Index for active-subscription filtering
CREATE INDEX IF NOT EXISTS idx_veraset_subscriptions_active
  ON veraset_subscriptions(is_active) WHERE is_active = TRUE;

-- ─── 2. Ingestion job log (idempotent, audit trail) ────────────────────────

CREATE TABLE IF NOT EXISTS veraset_ingest_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msa_id          VARCHAR(20) NOT NULL REFERENCES veraset_subscriptions(msa_id),
  job_type        VARCHAR(40) NOT NULL,         -- 'daily_mobility' | 'poi_snapshot' | 'backfill'
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | running | completed | failed | skipped
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  rows_inserted   INTEGER DEFAULT 0,
  rows_updated    INTEGER DEFAULT 0,
  error_message   TEXT,
  metadata        JSONB,                        -- raw API response summary, pagination tokens, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veraset_jobs_msa_status
  ON veraset_ingest_jobs(msa_id, status);

CREATE INDEX IF NOT EXISTS idx_veraset_jobs_created_at
  ON veraset_ingest_jobs(created_at DESC);

-- ─── 3. Seed a placeholder Atlanta subscription (inactive) ─────────────────

INSERT INTO veraset_subscriptions (msa_id, msa_name, is_active, notes)
VALUES ('MSA_12060', 'Atlanta-Sandy Springs-Roswell, GA', FALSE,
        'Placeholder — activate when paid subscription deal is signed')
ON CONFLICT (msa_id) DO NOTHING;

COMMIT;
