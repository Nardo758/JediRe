-- =============================================================================
-- M07 Subject History Engine & Diff Extractor — Task #524
-- =============================================================================
-- Depends on: 100_m07_traffic_calibration.sql (rent_roll_snapshots base table)
--
-- Changes:
--   1. ALTER rent_roll_snapshots — add parsed_payload, unit_count,
--      occupied_count, parser_source
--   2. CREATE rent_roll_diffs — per-diff aggregate metrics + per-unit events
--   3. CREATE subject_traffic_history — S1/S2/S3/S4 tier history per deal
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend rent_roll_snapshots
-- -----------------------------------------------------------------------------

ALTER TABLE rent_roll_snapshots
  ADD COLUMN IF NOT EXISTS parsed_payload   jsonb        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit_count       integer      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS occupied_count   integer      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parser_source    text         DEFAULT NULL;

-- Index for fast parsed_payload access (S1 aggregator reads by snapshot id)
CREATE INDEX IF NOT EXISTS idx_rrs_parsed_payload_notnull
  ON rent_roll_snapshots (id)
  WHERE parsed_payload IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Create rent_roll_diffs
-- -----------------------------------------------------------------------------
-- One row per (from_snapshot_id, to_snapshot_id) pair.
-- Unique constraint enables idempotent ON CONFLICT DO UPDATE.
-- per_unit_events is a capped JSONB array (≤10,000 events) for drill-down.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rent_roll_diffs (
  id                      serial          PRIMARY KEY,
  deal_id                 uuid            NOT NULL
                            REFERENCES deals(id) ON DELETE CASCADE,
  from_snapshot_id        integer         NOT NULL
                            REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  to_snapshot_id          integer         NOT NULL
                            REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  period_days             integer         NOT NULL,

  -- Aggregate leasing dynamics
  renewal_rate            numeric(6,4)    DEFAULT NULL,  -- 0.0–1.0
  turnover_rate           numeric(6,4)    DEFAULT NULL,  -- 0.0–1.0
  new_lease_trade_out_pct numeric(8,4)    DEFAULT NULL,  -- signed %, can be negative
  renewal_trade_out_pct   numeric(8,4)    DEFAULT NULL,

  signing_velocity        numeric(8,4)    DEFAULT NULL,  -- leases/month
  days_vacant_median      numeric(8,2)    DEFAULT NULL,
  concession_trend        text            DEFAULT NULL   -- 'increasing'|'stable'|'decreasing'
                            CHECK (concession_trend IS NULL OR concession_trend IN ('increasing','stable','decreasing')),
  loss_to_lease           numeric(8,4)    DEFAULT NULL,  -- 0.0–1.0 fraction

  -- Sample sizes (used for Bayesian confidence weights)
  renewal_n               integer         NOT NULL DEFAULT 0,
  turnover_n              integer         NOT NULL DEFAULT 0,
  trade_out_n             integer         NOT NULL DEFAULT 0,
  days_vacant_n           integer         NOT NULL DEFAULT 0,

  -- Per-unit event classification (capped at 10,000 entries)
  per_unit_events         jsonb           DEFAULT '[]',

  computed_at             timestamptz     NOT NULL DEFAULT NOW(),
  created_at              timestamptz     NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rent_roll_diffs_pair UNIQUE (from_snapshot_id, to_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_rent_roll_diffs_deal_id
  ON rent_roll_diffs (deal_id);

CREATE INDEX IF NOT EXISTS idx_rent_roll_diffs_to_snapshot
  ON rent_roll_diffs (to_snapshot_id);

COMMENT ON TABLE rent_roll_diffs IS
  'M07 §6.2: Per-pair aggregate dynamics extracted by RentRollDiffService. '
  'Feeds S2 promotion in subject_traffic_history. '
  'Unique on (from_snapshot_id, to_snapshot_id) — idempotent ON CONFLICT DO UPDATE.';

-- -----------------------------------------------------------------------------
-- 3. Create subject_traffic_history
-- -----------------------------------------------------------------------------
-- One row per deal — upserted by SubjectHistoryS1Service (S1) and
-- RentRollDiffService.promoteToS2().
-- Tier progression: S1 (single snapshot) → S2 (≥2 snapshots, ≥60 days apart)
--   → S3/S4 (future: 6-month / 12-month longitudinal tiers).
-- NEVER demoted: once S2, remains S2 even if re-ingesting an older snapshot.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subject_traffic_history (
  id                  serial          PRIMARY KEY,
  deal_id             uuid            NOT NULL UNIQUE
                        REFERENCES deals(id) ON DELETE CASCADE,

  -- Evidence tier
  tier                text            NOT NULL DEFAULT 'S1'
                        CHECK (tier IN ('S1','S2','S3','S4')),

  -- How many qualifying rent roll snapshots exist for this deal
  snapshot_count      integer         NOT NULL DEFAULT 1,

  -- Calendar span of available snapshots (months, one decimal)
  coverage_months     numeric(6,2)    DEFAULT NULL,

  -- S1: current-state object (SubjectCurrentState) — from latest snapshot
  current_state       jsonb           DEFAULT NULL,

  -- S2+: observed leasing dynamics (SubjectObservedDynamics) — aggregated from diffs
  observed_dynamics   jsonb           DEFAULT NULL,

  -- Per-metric Bayesian confidence weights
  -- { metric_key: { n_obs, n_required, weight } }
  confidence_weights  jsonb           NOT NULL DEFAULT '{}',

  -- Peer collisions (computed at S2 promotion, refreshed on re-ingestion)
  peer_collisions     jsonb           NOT NULL DEFAULT '[]',

  created_at          timestamptz     NOT NULL DEFAULT NOW(),
  updated_at          timestamptz     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_traffic_history_deal_id
  ON subject_traffic_history (deal_id);

CREATE INDEX IF NOT EXISTS idx_subject_traffic_history_tier
  ON subject_traffic_history (tier);

COMMENT ON TABLE subject_traffic_history IS
  'M07 §6: Per-deal subject property traffic history. '
  'S1 = current-state from single rent roll snapshot. '
  'S2 = observed dynamics from ≥2 snapshots ≥60 days apart. '
  'S3/S4 = extended longitudinal tiers (future). '
  'Never demoted — tier monotonically increases. '
  'Consumed by CoefficientResolverService for Bayesian subject-vs-peer blending.';

-- Function + trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_subject_traffic_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subject_traffic_history_updated_at
  ON subject_traffic_history;

CREATE TRIGGER trg_subject_traffic_history_updated_at
  BEFORE UPDATE ON subject_traffic_history
  FOR EACH ROW EXECUTE FUNCTION update_subject_traffic_history_updated_at();
