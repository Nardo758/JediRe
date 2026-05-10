-- Migration: 20260511_extraction_events
-- Description: Field-level extraction events audit table for DQA Phase 2 (Task #698).
--
-- Records per-field write timestamps whenever a value is written to
-- broker_claims.proforma or other extraction source slots. Replaces the coarse
-- deals.updated_at proxy used in Phase 1 (Task #696) for WRITE_RACE vs STALE_SEED
-- timestamp classification.
--
-- The primary write site is routeOM (data-router.ts): each non-null field in
-- brokerProforma emits one row. T12/RENT_ROLL/TAX_BILL write to dedicated tables
-- (deal_monthly_actuals, deal_lease_transactions, deal_assumptions) rather than
-- broker_claims.proforma, so Phase 2 scopes to OM initially; other source types
-- can be added when field-level provenance is needed for their write paths.
--
-- Phase 2 signed-delta semantics (implemented in extraction-events.service.ts):
--   seed_written_at >= source_written_at  → SEED_PLUMBING_WRITE_RACE
--   seed_written_at <  source_written_at  → SEED_PLUMBING_STALE_SEED
--   (replaces Phase 1 absolute |delta| < 300 s heuristic)

BEGIN;

CREATE TABLE IF NOT EXISTS extraction_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  source_type  TEXT        NOT NULL,
  field_name   TEXT        NOT NULL,
  field_value  NUMERIC,
  written_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  written_by   TEXT        NOT NULL DEFAULT 'extraction_pipeline',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE extraction_events IS
  'Per-field write audit log for DQA Phase 2 timestamp classification. '
  'One row per field write; query for the most-recent row per (deal_id, source_type, field_name) '
  'to get the authoritative source write time.';

COMMENT ON COLUMN extraction_events.source_type IS
  'Document type that produced the value: OM | T12 | RENT_ROLL | TAX_BILL | manual';

COMMENT ON COLUMN extraction_events.field_name IS
  'Pro Forma row name (matches AUDIT_ROWS_BY_DOCTYPE keys): '
  'gpr | vacancy_pct | real_estate_tax | contract_services | payroll | '
  'repairs_maintenance | turnover | marketing | utilities | insurance | '
  'management_fee_pct | noi | other_income_total';

COMMENT ON COLUMN extraction_events.field_value IS
  'Numeric value written; NULL when the extraction produced a null for this field '
  '(tracked so absence is auditable, not just missing).';

COMMENT ON COLUMN extraction_events.written_by IS
  'Actor: extraction_pipeline (automated), manual:<userId> (operator override), '
  'or seeder (proforma-seeder.service.ts reseed).';

-- Primary lookup: most-recent write time for a specific field on a deal
CREATE INDEX IF NOT EXISTS idx_extraction_events_field_lookup
  ON extraction_events (deal_id, source_type, field_name, written_at DESC);

-- Deal-level audit: all events for a deal, newest first
CREATE INDEX IF NOT EXISTS idx_extraction_events_deal
  ON extraction_events (deal_id, written_at DESC);

COMMIT;
