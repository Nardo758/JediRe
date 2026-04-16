ALTER TABLE deal_scenarios ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS custom_scenario_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  selected_event_ids JSONB DEFAULT '[]',
  excluded_event_ids JSONB DEFAULT '[]',
  assumption_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_scenario_configs_scenario ON custom_scenario_configs(scenario_id);
