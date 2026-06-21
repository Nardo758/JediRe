-- Migration: assumption_override_training_signals
-- Purpose: Capture admin overrides on platform-derived assumptions as training
-- signals for M35 playbook improvement. Each row records what the platform
-- predicted, what the analyst overrode it to, and which events were active.
--
-- This is NOT an audit log (for compliance, use assumption_adjustments).
-- This is a machine-learning training dataset for playbook refinement.

CREATE TABLE IF NOT EXISTS assumption_override_training_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What was overridden
  field_path TEXT NOT NULL,               -- e.g. 'rent_growth_yoy', 'year1.vacancy_pct'
  assumption_type TEXT,                 -- e.g. 'rent_growth', 'vacancy', 'exit_cap'

  -- Values
  previous_value NUMERIC,               -- the platform/derived resolved value before override
  override_value NUMERIC,               -- the analyst's new value
  baseline_value NUMERIC,               -- the secular baseline (if known) for delta computation

  -- Provenance of the previous value
  previous_resolution TEXT,               -- 'platform', 'platform_fallback', 'derived', 'event_timeline', etc.
  previous_source TEXT,                   -- resolvedFrom before override (e.g. 'M35', 'M07', 'agent')

  -- Why the analyst overrode
  override_reason TEXT,

  -- Event context at time of override (for training)
  active_event_ids UUID[],                -- key_events considered active for this deal
  computed_delta NUMERIC,                 -- the event-delta computed by the system (if applicable)
  override_delta NUMERIC,                 -- analyst's delta from baseline_value

  -- For future outcome tracking
  outcome_actual_value NUMERIC,         -- actual observed value (filled later, e.g. from rent roll)
  outcome_verified_at TIMESTAMPTZ,        -- when the actual outcome was recorded

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT chk_field_path_not_empty CHECK (char_length(field_path) > 0)
);

CREATE INDEX IF NOT EXISTS idx_aots_deal_id ON assumption_override_training_signals(deal_id);
CREATE INDEX IF NOT EXISTS idx_aots_field_path ON assumption_override_training_signals(field_path);
CREATE INDEX IF NOT EXISTS idx_aots_previous_resolution ON assumption_override_training_signals(previous_resolution);
CREATE INDEX IF NOT EXISTS idx_aots_created_at ON assumption_override_training_signals(created_at DESC);

COMMENT ON TABLE assumption_override_training_signals IS
  'Training-signal table for M35 playbook improvement. Captures analyst overrides on platform-derived assumptions so the playbook can learn from expert judgment over time.';
