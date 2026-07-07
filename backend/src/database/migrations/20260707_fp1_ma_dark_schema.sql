-- F-P1 Phase 2: M-A dark schema + varchar→uuid (R10)
-- Operator ruling order R4: this migration runs before F-P1-A server-fetch.
--
-- 1. deal_financial_models.deal_id: character varying(255) → uuid  (R10)
-- 2. deal_assumption_overlays: dark overlay table for future M-F decomposition (R3)
-- 3. deal_assumptions.exit_valuation_basis: trending column (R8)

BEGIN;

-- ── R10: deal_financial_models.deal_id varchar → uuid ───────────────────────
-- Pre-condition: purge any legacy integer-style rows that predate UUID migration.
-- These are all in error status with no parent deal; deleting them is safe.
DELETE FROM deal_financial_models
  WHERE deal_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE deal_financial_models
  ALTER COLUMN deal_id TYPE uuid USING deal_id::uuid;

-- ── M-A dark schema: deal_assumption_overlays ───────────────────────────────
-- One row per (deal_id, field_key, source_tag, snapshot_at).
-- Not yet read by any consumer (shadow-read verifier will be added per R3
-- when M-F scenario decomposition is executed).
CREATE TABLE IF NOT EXISTS deal_assumption_overlays (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_key     text        NOT NULL,
  source_tag    text        NOT NULL,
  value         numeric,
  value_text    text,
  confidence    text        CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  note          text,
  snapshot_at   timestamptz NOT NULL DEFAULT NOW(),
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_assumption_overlays_deal
  ON deal_assumption_overlays (deal_id, field_key, snapshot_at DESC);

-- ── R8 trending field: exit_valuation_basis ─────────────────────────────────
-- How exit proceeds were sized: cap-rate capitalisation, gross-revenue multiple,
-- or price-per-unit direct comparison.  NULL = cap_rate (historic default).
ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS exit_valuation_basis text
    CHECK (exit_valuation_basis IN ('cap_rate', 'gross_rev_multiple', 'ppu'));

COMMIT;
