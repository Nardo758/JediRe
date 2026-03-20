-- scenario_results: stores computed IRR/EMx/CoC/NPV per scenario
-- Fixes P1 backend error on every deal load (INSERT in scenario-generation.service.ts)

CREATE TABLE IF NOT EXISTS scenario_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL UNIQUE REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  irr_pct NUMERIC(8,4),
  equity_multiple NUMERIC(8,4),
  coc_year_5 NUMERIC(8,4),
  npv NUMERIC(14,2),
  calculation_method VARCHAR(50),
  calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_results_scenario ON scenario_results(scenario_id);
