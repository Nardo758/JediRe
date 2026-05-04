-- ============================================================================
-- Migration 20260503_018 — M07 Subject History Engine & Diff Extractor
--
-- Three changes:
--   1. Extend rent_roll_snapshots with parser-agnostic payload columns so the
--      Subject History S1/S2 aggregators can work without joining leasing_events.
--   2. Create rent_roll_diffs — the cross-snapshot event ledger produced by the
--      Diff Extractor (S2 aggregator input).
--   3. Create subject_traffic_history — the canonical per-deal subject history
--      record that the Bayesian blend reads before falling back to the peer set.
--
-- All statements use IF NOT EXISTS / IF EXISTS guards so the migration is
-- idempotent and safe to re-run in any environment.
-- ============================================================================

-- ── Step 1: Extend rent_roll_snapshots ──────────────────────────────────────

ALTER TABLE rent_roll_snapshots
  ADD COLUMN IF NOT EXISTS parsed_payload   jsonb,
  ADD COLUMN IF NOT EXISTS unit_count       int,
  ADD COLUMN IF NOT EXISTS occupied_count   int,
  ADD COLUMN IF NOT EXISTS parser_source    text;

COMMENT ON COLUMN rent_roll_snapshots.parsed_payload IS
  'Normalised per-unit array written by the parser (RentRollLeaseEvent[]). '
  'Used by S1/S2 aggregators without re-joining leasing_events.';
COMMENT ON COLUMN rent_roll_snapshots.unit_count IS
  'Total row count after dedup/validation (may differ from raw row_count).';
COMMENT ON COLUMN rent_roll_snapshots.occupied_count IS
  'Units with unit_status = ''occupied'' at snapshot date.';
COMMENT ON COLUMN rent_roll_snapshots.parser_source IS
  'Identifies the parser path that produced this snapshot '
  '(e.g. ''yardi_csv'', ''generic_xlsx'').';

-- ── Step 2: rent_roll_diffs ──────────────────────────────────────────────────
-- One row per (from_snapshot_id, to_snapshot_id) pair.  Written by the Diff
-- Extractor service after the second rent roll is uploaded for a deal.

CREATE TABLE IF NOT EXISTS rent_roll_diffs (
  id                       serial        PRIMARY KEY,
  deal_id                  uuid          NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_snapshot_id         int           NOT NULL REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  to_snapshot_id           int           NOT NULL REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  period_days              int           NOT NULL,         -- calendar days between snapshot dates

  -- S2 aggregated lease-event metrics (null when sample too small)
  renewal_rate             numeric(6,4),                   -- 0.0–1.0; fraction of matched units that renewed
  turnover_rate            numeric(6,4),                   -- 0.0–1.0; fraction of units that turned over
  new_lease_trade_out_pct  numeric(8,4),                   -- % change vs prior contract_rent (new leases only)
  renewal_trade_out_pct    numeric(8,4),                   -- % change vs prior contract_rent (renewals only)
  signing_velocity         numeric(8,4),                   -- leases/month (observed across period)
  days_vacant_median       numeric(8,2),                   -- median days vacant across unit transitions
  concession_trend         text CHECK (concession_trend IN ('increasing','stable','decreasing')),
  loss_to_lease            numeric(6,4),                   -- (market_rent − contract_rent) / market_rent

  -- Sample sizes that underlie each metric
  renewal_n                int NOT NULL DEFAULT 0,
  turnover_n               int NOT NULL DEFAULT 0,
  trade_out_n              int NOT NULL DEFAULT 0,
  days_vacant_n            int NOT NULL DEFAULT 0,

  -- Per-unit event log for audit / drill-down (capped at 10 k entries in service)
  per_unit_events          jsonb,

  computed_at              timestamptz   NOT NULL DEFAULT NOW(),

  UNIQUE (from_snapshot_id, to_snapshot_id)
);

CREATE INDEX IF NOT EXISTS rent_roll_diffs_deal_idx ON rent_roll_diffs (deal_id);
CREATE INDEX IF NOT EXISTS rent_roll_diffs_to_snap_idx ON rent_roll_diffs (to_snapshot_id);

COMMENT ON TABLE rent_roll_diffs IS
  'Cross-snapshot event ledger: one row per consecutive snapshot pair per deal. '
  'Written by the Diff Extractor; consumed by the S2 aggregator and peer-collision detector.';

-- ── Step 3: subject_traffic_history ─────────────────────────────────────────
-- One row per deal (UNIQUE deal_id).  Tier is promoted in-place:
--   S1 → current-state from single snapshot
--   S2 → S1 + observed dynamics from ≥2 snapshots ≥60 days apart
--   S3/S4 → future tiers (data model in place, aggregation logic deferred)

CREATE TABLE IF NOT EXISTS subject_traffic_history (
  id                  serial        PRIMARY KEY,
  deal_id             uuid          NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  tier                text          NOT NULL CHECK (tier IN ('S1','S2','S3','S4')),
  snapshot_count      int           NOT NULL DEFAULT 1,
  coverage_months     numeric(6,2),                       -- months between first and last snapshot

  -- S1+: current-state coefficients from most-recent single snapshot
  current_state       jsonb,
  -- S2+: observed dynamics aggregated from rent_roll_diffs
  observed_dynamics   jsonb,

  -- Per-coefficient Bayesian weights:
  --   { "<coeff_name>": { n_obs: int, n_required: int, weight: float } }
  confidence_weights  jsonb         NOT NULL DEFAULT '{}',

  -- Material divergences from peer set (|subject − peer| > 1.5σ):
  --   [ { coefficient, subject_value, peer_value, sigma_deviation } ]
  peer_collisions     jsonb         NOT NULL DEFAULT '[]',

  -- Deal operating mode at time of last S1 aggregation.
  -- ConcessionEnvironmentEngine uses this to reject mode-mismatched subject coefficients
  -- (e.g. LEASE_UP subject history must not influence STABILIZED projections).
  deal_mode           text,

  created_at          timestamptz   NOT NULL DEFAULT NOW(),
  updated_at          timestamptz   NOT NULL DEFAULT NOW(),

  UNIQUE (deal_id)    -- one row per deal; tier and payloads are promoted in-place
);

CREATE INDEX IF NOT EXISTS subject_traffic_history_deal_idx ON subject_traffic_history (deal_id);

-- Backfill: add deal_mode if the table was already created without it
-- (idempotent — ADD COLUMN IF NOT EXISTS is safe to re-run)
ALTER TABLE subject_traffic_history
  ADD COLUMN IF NOT EXISTS deal_mode text;

COMMENT ON TABLE subject_traffic_history IS
  'Per-deal subject history record consumed by the M07 Bayesian blend. '
  'Tier S1 = current-state from first upload; S2 = adds observed dynamics. '
  'Subject row is promoted above peer-set in the coefficient resolution hierarchy.';
