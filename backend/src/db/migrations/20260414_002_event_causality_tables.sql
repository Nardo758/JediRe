-- M35 Event Causality Analysis Tables
-- Caches Granger lead-lag results for event × metric pairs
-- Direction: event_drives_market | market_attracts_event | simultaneous | insufficient_data

CREATE TABLE IF NOT EXISTS event_causality_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,
  metric_key           VARCHAR(64) NOT NULL,
  geography_id         VARCHAR(128) NOT NULL,

  -- Lead-lag sweep result
  best_lag_months      SMALLINT NOT NULL DEFAULT 0,
  -- positive = event leads metric (event drives market)
  -- negative = metric leads event (market attracts event)
  best_r               NUMERIC(8,4) NOT NULL DEFAULT 0,
  p_value              NUMERIC(8,6),
  sample_size          SMALLINT NOT NULL DEFAULT 0,

  -- Pre-event trend (OLS slope over T-12 to T0)
  pre_event_slope      NUMERIC(18,8),
  pre_event_r2         NUMERIC(6,4),

  -- Post-event change vs extrapolated trend
  post_event_delta     NUMERIC(18,4),
  post_event_delta_pct NUMERIC(10,4),

  -- Verdict
  direction            VARCHAR(32) NOT NULL DEFAULT 'insufficient_data',
  -- 'event_drives_market' | 'market_attracts_event' | 'simultaneous' | 'insufficient_data'
  confidence           VARCHAR(16) NOT NULL DEFAULT 'low',
  -- 'high' | 'medium' | 'low'
  verdict_text         TEXT,

  computed_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_causality_unique
  ON event_causality_results (event_id, metric_key, geography_id);

CREATE INDEX IF NOT EXISTS idx_event_causality_event
  ON event_causality_results (event_id);

CREATE INDEX IF NOT EXISTS idx_event_causality_direction
  ON event_causality_results (direction);

-- Event type treatments for M07 integration
-- Controls how nightly calibration handles each event type
-- Editable via admin panel without code changes
CREATE TABLE IF NOT EXISTS event_type_treatments (
  event_type           VARCHAR(64) PRIMARY KEY,
  baseline_treatment   VARCHAR(16) NOT NULL DEFAULT 'PASS_THROUGH',
  -- 'EXCLUDE' | 'ATTRIBUTE' | 'PASS_THROUGH'
  default_magnitude    NUMERIC(8,4) DEFAULT 0,
  typical_lead_months  SMALLINT DEFAULT 0,
  typical_decay_months SMALLINT DEFAULT 6,
  decay_shape          VARCHAR(16) DEFAULT 'linear',
  -- 'linear' | 's_curve' | 'ramp' | 'step' | 'permanent'
  notes                TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default treatments per M07 spec §2.3.1
INSERT INTO event_type_treatments (event_type, baseline_treatment, default_magnitude, typical_lead_months, typical_decay_months, decay_shape, notes)
VALUES
  ('disaster',              'EXCLUDE',       -0.25,  0,  16, 's_curve',   'Hurricane, flood, wildfire — sharp drop, S-curve recovery'),
  ('employer_opening',      'ATTRIBUTE',      0.18,  6,  0,  'ramp',      'New HQ/plant — ramp to opening, then sustained lift'),
  ('employer_closure',      'ATTRIBUTE',     -0.15,  0,  18, 'step',      'Layoff/closure — step down at announcement'),
  ('infrastructure_pos',    'ATTRIBUTE',      0.12,  0,  0,  'permanent', 'Transit station, interchange — permanent lift after open'),
  ('infrastructure_neg',    'EXCLUDE',       -0.08,  0,  0,  'step',      'Road closure, construction — suppression during window'),
  ('demand_gen_open',       'ATTRIBUTE',      0.14,  0,  0,  'permanent', 'Stadium, university expansion — sustained lift'),
  ('demand_gen_close',      'ATTRIBUTE',     -0.10,  0,  24, 'step',      'Campus/anchor closure — step down, slow substitution'),
  ('regulatory',            'PASS_THROUGH',   0.05,  0,  0,  'permanent', 'Rent control, zoning — variable, becomes new baseline'),
  ('redevelopment_catalyst','ATTRIBUTE',      0.08,  0,  0,  'ramp',      'Major mixed-use project — gradual lift over build period')
ON CONFLICT (event_type) DO NOTHING;
