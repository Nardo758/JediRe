-- Migration 073: Add metadata fields to development_scenarios

ALTER TABLE development_scenarios 
  ADD COLUMN IF NOT EXISTS timeline VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cost_estimate VARCHAR(50),
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS success_probability INTEGER;

-- Add comments
COMMENT ON COLUMN development_scenarios.timeline IS 'Human-readable timeline (e.g., "6-9 months")';
COMMENT ON COLUMN development_scenarios.cost_estimate IS 'Human-readable cost (e.g., "$50K-$150K")';
COMMENT ON COLUMN development_scenarios.risk_level IS 'low | medium | high';
COMMENT ON COLUMN development_scenarios.success_probability IS 'Percent (0-100)';

-- Populate defaults for existing records
UPDATE development_scenarios 
SET 
  timeline = CASE name
    WHEN 'by_right' THEN '6-9 months'
    WHEN 'variance' THEN '9-18 months'
    WHEN 'rezone' THEN '12-36 months'
  END,
  cost_estimate = CASE name
    WHEN 'by_right' THEN '$50K-$150K'
    WHEN 'variance' THEN '$100K-$350K'
    WHEN 'rezone' THEN '$200K-$750K'
  END,
  risk_level = CASE name
    WHEN 'by_right' THEN 'low'
    WHEN 'variance' THEN 'medium'
    WHEN 'rezone' THEN 'high'
  END,
  success_probability = CASE name
    WHEN 'by_right' THEN 95
    WHEN 'variance' THEN 65
    WHEN 'rezone' THEN 35
  END
WHERE timeline IS NULL;
