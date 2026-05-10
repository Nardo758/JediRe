-- Migration: 20260512_dqa_reliability_index
-- Description: Adds a composite index on data_quality_alerts for cross-deal
--   reliability queries (GET /api/v1/command-center/dqa/reliability, Task #707).
--   Also adds a partial index on (document_type, proforma_row, classification)
--   scoped to non-dismissed rows for fast aggregation.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_dqa_reliability
  ON data_quality_alerts (document_type, proforma_row, classification, created_at)
  WHERE status != 'dismissed';

COMMENT ON INDEX idx_dqa_reliability IS
  'Supports cross-deal DQA reliability aggregation queries (Task #707 Phase 2). '
  'Scoped to non-dismissed rows; covers document_type × proforma_row × classification breakdown.';

COMMIT;
