-- Migration: 20260510_data_quality_alerts
-- Description: Creates the data_quality_alerts table for the Data Quality Agent (Task #691).
--
-- The agent audits each document extraction against its source and writes structured
-- findings here. Findings surface as row-level indicators on the Pro Forma tab before
-- the underwriter starts modifying numbers.
--
-- Classification taxonomy:
--   warning/critical: PARSER_MISS, PARSER_INCORRECT, RANGE_ANOMALY, INCONSISTENCY, SEED_PLUMBING
--   info:             CROSS_DOC_VARIANCE, LOW_CONFIDENCE_EXTRACTION
--   not stored:       EXTRACTION_OK, NOT_IN_DOC
--
-- Status lifecycle: open → dismissed | acknowledged | fixed
-- Supersession: a new agent run marks prior open findings for the same
--   (deal_id, document_type, proforma_column, proforma_row) as superseded.

BEGIN;

CREATE TABLE IF NOT EXISTS data_quality_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  document_type     TEXT        NOT NULL,
  proforma_column   TEXT        NOT NULL,
  proforma_row      TEXT        NOT NULL,
  classification    TEXT        NOT NULL,
  severity          TEXT        NOT NULL DEFAULT 'warning',
  agent_finding     JSONB       NOT NULL DEFAULT '{}',
  status            TEXT        NOT NULL DEFAULT 'open',
  dismissed_at      TIMESTAMPTZ,
  dismissed_by      TEXT,
  dismissal_reason  TEXT,
  superseded_by     UUID        REFERENCES data_quality_alerts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE data_quality_alerts IS
  'Per-extraction data quality findings from the Data Quality Agent. '
  'Each finding targets a specific Pro Forma row × column intersection. '
  'Newer agent runs supersede prior open findings for the same row/column.';

COMMENT ON COLUMN data_quality_alerts.classification IS
  'PARSER_MISS | PARSER_INCORRECT | RANGE_ANOMALY | INCONSISTENCY | SEED_PLUMBING | CROSS_DOC_VARIANCE | LOW_CONFIDENCE_EXTRACTION';

COMMENT ON COLUMN data_quality_alerts.severity IS
  'critical | warning | info. PARSER_INCORRECT is always critical. '
  'severity is set by the agent based on classification and confidence.';

COMMENT ON COLUMN data_quality_alerts.agent_finding IS
  'Structured finding: { proforma_column, proforma_row, classification, source_evidence, '
  'reasoning, extracted_value, expected_value, confidence, recommended_action }';

COMMENT ON COLUMN data_quality_alerts.status IS
  'open | dismissed | acknowledged | fixed. '
  'dismissed: hidden, stays in audit log. '
  'acknowledged: reduced to subtle indicator. '
  'fixed: cleared on next passing agent run.';

COMMENT ON COLUMN data_quality_alerts.superseded_by IS
  'Points to the newer finding that replaces this one. '
  'Superseded findings are hidden from the active view.';

-- Index: fast lookup of open alerts for a deal (used by the REST GET endpoint)
CREATE INDEX IF NOT EXISTS idx_dqa_deal_open
  ON data_quality_alerts (deal_id, status)
  WHERE status = 'open';

-- Index: cross-deal aggregation by classification (Phase 2 pattern queries)
CREATE INDEX IF NOT EXISTS idx_dqa_classification_open
  ON data_quality_alerts (classification, created_at)
  WHERE status = 'open';

COMMIT;
