-- ============================================================================
-- 110_extraction_pipeline_fixes.sql
--
-- Migration that creates / patches the tables the extraction pipeline writes
-- to and reads from. Idempotent — safe to re-run.
--
-- Apply: psql $DATABASE_URL -f 110_extraction_pipeline_fixes.sql
-- ============================================================================

BEGIN;

-- ─── deal_properties (the missing join table) ────────────────────────────────
-- Referenced by 16+ files in the codebase but never created. Without this,
-- every property created by extraction is orphaned from its deal.
CREATE TABLE IF NOT EXISTS deal_properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  relationship    varchar(32) DEFAULT 'subject',  -- 'subject' | 'comp' | 'reference'
  linked_by       uuid REFERENCES users(id),
  confidence_score numeric(4,3),
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT deal_properties_unique UNIQUE (deal_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_properties_deal ON deal_properties(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_properties_property ON deal_properties(property_id);

-- ─── deal_assumptions (was referenced but never had a CREATE in repo) ───────
-- This is the canonical home for ProForma Year-1 seed data with LayeredValue
-- provenance. Box Score parser already writes to vacancy_pct/total_units cols.
CREATE TABLE IF NOT EXISTS deal_assumptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- Legacy single-value cols (kept for backward compat with existing code)
  vacancy_pct       numeric(7,4),
  total_units       integer,
  -- NEW: Year-1 LayeredValue tree as JSONB (the new canonical assumption surface)
  year1             jsonb,
  -- Provenance
  source_type       varchar(32),
  source_ref        varchar(255),
  source_date       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT deal_assumptions_unique UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_assumptions_deal ON deal_assumptions(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_assumptions_year1_gin ON deal_assumptions USING gin (year1);

-- If the table already existed, ensure the year1 column is present
ALTER TABLE deal_assumptions ADD COLUMN IF NOT EXISTS year1 jsonb;
ALTER TABLE deal_assumptions ADD COLUMN IF NOT EXISTS source_type varchar(32);
ALTER TABLE deal_assumptions ADD COLUMN IF NOT EXISTS source_ref varchar(255);
ALTER TABLE deal_assumptions ADD COLUMN IF NOT EXISTS source_date timestamptz;
ALTER TABLE deal_assumptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

-- Idempotent unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_assumptions_unique'
  ) THEN
    ALTER TABLE deal_assumptions ADD CONSTRAINT deal_assumptions_unique UNIQUE (deal_id);
  END IF;
END $$;

-- ─── platform_intel (already created in 104_provenance_and_alerts.sql) ──────
-- Add the unique constraint on (deal_id, alert_type) so cross-validation can
-- ON CONFLICT DO UPDATE per metric — replaces stale alerts instead of stacking.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_intel_deal_alert_unique'
  ) THEN
    -- Allow multiple alerts per deal+type for historical tracking, but unique on
    -- the (deal_id, alert_type) tuple WHERE alert_type starts with 'cross_doc_'
    -- so cross-validation re-runs replace, not duplicate.
    CREATE UNIQUE INDEX IF NOT EXISTS platform_intel_xdoc_unique
      ON platform_intel(deal_id, alert_type)
      WHERE alert_type LIKE 'cross_doc_%';
  END IF;
END $$;

-- ─── properties: enrichment columns extracted from tax bills ────────────────
ALTER TABLE properties ADD COLUMN IF NOT EXISTS legal_owner varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_mailing text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parcel_id varchar(64);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS county_pin varchar(64);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tax_district varchar(64);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gross_rentable_sqft integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS avg_unit_sqft integer;

CREATE INDEX IF NOT EXISTS idx_properties_parcel_id ON properties(parcel_id) WHERE parcel_id IS NOT NULL;

-- ─── deals: legal_owner column for cross-doc validation ─────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS legal_owner varchar(255);

-- ─── deal_document_files: extended extraction_status values ─────────────────
-- Existing values: 'pending', 'completed', 'failed'
-- No schema change — just documentation that extraction_result JSONB now contains
-- the new fields: capsuleUpdated, libraryUpdated, proformaSeeded, crossValidationVariances
COMMENT ON COLUMN deal_document_files.extraction_result IS
  'JSONB: { success, error, rowsInserted, capsuleUpdated, libraryUpdated, proformaSeeded, crossValidationVariances, alerts }';

-- ─── Backfill: for any existing deals with property_id in deal_monthly_actuals
-- but no row in deal_properties, repair the join.
INSERT INTO deal_properties (deal_id, property_id, relationship)
SELECT DISTINCT dma.deal_id, dma.property_id, 'subject'
FROM deal_monthly_actuals dma
WHERE dma.property_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM deal_properties dp
    WHERE dp.deal_id = dma.deal_id AND dp.property_id = dma.property_id
  )
ON CONFLICT (deal_id, property_id) DO NOTHING;

COMMIT;

-- Verification queries to run after applying:
--
--   -- Confirm tables exist:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('deal_properties', 'deal_assumptions');
--
--   -- Confirm year1 column exists:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'deal_assumptions' AND column_name = 'year1';
--
--   -- Count repaired deal_properties rows:
--   SELECT COUNT(*) FROM deal_properties;
--
--   -- For the test deal:
--   SELECT * FROM deal_properties WHERE deal_id = 'c85c5ff5-49d1-42e7-92a2-a82f790587de';
--   SELECT year1 FROM deal_assumptions WHERE deal_id = 'c85c5ff5-49d1-42e7-92a2-a82f790587de';
