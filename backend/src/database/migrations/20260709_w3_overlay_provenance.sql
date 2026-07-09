-- W3: Add provenance columns to deal_assumption_overlays.
--   reasoning TEXT       — human-readable explanation of why the agent proposed this value
--   evidence_refs JSONB  — array of evidence pointers (correlation id, comp id, doc row, etc.)
--                          each entry carries { kind, ref_id, data_kind: 'actual'|'forecast' }
--   build_hash TEXT      — deal_financial_models.assumptions_hash of the run that wrote
--                          this overlay (W5 stamping anchor)

ALTER TABLE deal_assumption_overlays
  ADD COLUMN IF NOT EXISTS reasoning      TEXT,
  ADD COLUMN IF NOT EXISTS evidence_refs  JSONB,
  ADD COLUMN IF NOT EXISTS build_hash     TEXT;

COMMENT ON COLUMN deal_assumption_overlays.reasoning
  IS 'Agent reasoning string: why was this value proposed? Surfaces in F9 audit trail.';
COMMENT ON COLUMN deal_assumption_overlays.evidence_refs
  IS 'JSON array of evidence pointers [{kind,ref_id,data_kind}]. kind in (correlation,comp,doc,observation). data_kind in (actual,forecast).';
COMMENT ON COLUMN deal_assumption_overlays.build_hash
  IS 'deal_financial_models.assumptions_hash of the build run that wrote this overlay (W5).';
