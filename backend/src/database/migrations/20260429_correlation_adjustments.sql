-- F9 Pro Forma Tier-2 (Spec §3): Persist Correlation Engine outputs on the deal.
-- In-memory only is insufficient — required for audit trail, M22 post-close
-- attribution, and defending platform values when broker numbers diverge.
--
-- Shape: array of { cor_id, target_field, delta_pct, signal, confidence,
--                   computed_at, model_version, lead_time?, source_refs? }

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS correlation_adjustments JSONB
    NOT NULL DEFAULT '[]'::jsonb;
