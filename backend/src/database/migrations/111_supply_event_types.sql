-- Migration 111: Add supply_event_types table and supply_event_type_id column to supply_events
-- Fixes: supply-signal.service.ts getSupplyEvents() JOIN on missing table/column

CREATE TABLE IF NOT EXISTS supply_event_types (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(100) NOT NULL,
  event_type  VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(category, event_type)
);

INSERT INTO supply_event_types (category, event_type, description) VALUES
  ('residential', 'permit',       'Building permit issued'),
  ('residential', 'construction', 'Construction started'),
  ('residential', 'completion',   'Project completed'),
  ('residential', 'absorption',   'Units absorbed'),
  ('commercial',  'permit',       'Commercial permit issued'),
  ('commercial',  'construction', 'Commercial construction started'),
  ('commercial',  'completion',   'Commercial project completed'),
  ('mixed_use',   'permit',       'Mixed-use permit issued'),
  ('mixed_use',   'construction', 'Mixed-use construction started'),
  ('mixed_use',   'completion',   'Mixed-use project completed')
ON CONFLICT (category, event_type) DO NOTHING;

ALTER TABLE supply_events
  ADD COLUMN IF NOT EXISTS supply_event_type_id INTEGER REFERENCES supply_event_types(id),
  ADD COLUMN IF NOT EXISTS msa_id INTEGER,
  ADD COLUMN IF NOT EXISTS submarket_id INTEGER,
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS weighted_units INTEGER;
