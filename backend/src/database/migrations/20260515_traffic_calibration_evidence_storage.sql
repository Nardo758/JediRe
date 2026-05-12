-- FIX-3: Add per-evidence JSONB storage to traffic_calibration_factors
-- Enables asymmetric percentile band computation and M38 recomputation.

ALTER TABLE traffic_calibration_factors
  ADD COLUMN IF NOT EXISTS evidence_values JSONB;

COMMENT ON COLUMN traffic_calibration_factors.evidence_values IS
  'JSONB array of per-evidence records [{ deal_id, value, recorded_at }].
   Preserves raw evidence for M38 percentile recomputation.
   NULL for rows pre-dating FIX-3. From FIX-3 onward: populated by
   trafficCalibrationJob with the exact evidence used to compute the
   posterior and percentile confidence band.';

CREATE INDEX IF NOT EXISTS idx_traffic_calibration_evidence
  ON traffic_calibration_factors USING gin(evidence_values)
  WHERE evidence_values IS NOT NULL;
