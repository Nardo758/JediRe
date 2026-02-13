-- Migration: Consolidate Market Intelligence Modules
-- Description: Merge Competition, Supply, and Market modules into unified Market Intelligence
-- Date: 2024-XX-XX

-- Step 1: Create new unified Market Intelligence module
INSERT INTO module_definitions (
  slug, 
  name, 
  category, 
  description, 
  price_monthly, 
  is_free, 
  bundles, 
  icon, 
  enhances, 
  sort_order
) VALUES (
  'market-intelligence-unified',
  'Market Intelligence (Unified)',
  'Market Intelligence',
  'Comprehensive market analysis combining competitive analysis, supply pipeline tracking, and market demographics/trends in one unified view',
  4900,
  false,
  ARRAY['flipper', 'developer', 'portfolio'],
  '📊',
  ARRAY['Market Intelligence section'],
  50
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  enhances = EXCLUDED.enhances;

-- Step 2: Mark legacy modules as deprecated (keep for backward compatibility)
UPDATE module_definitions
SET 
  description = CONCAT('[DEPRECATED - Use Market Intelligence Unified] ', description),
  sort_order = sort_order + 1000 -- Move to bottom of list
WHERE slug IN ('market-signals', 'supply-pipeline', 'comp-basic')
  AND description NOT LIKE '[DEPRECATED%';

-- Step 3: Update user subscriptions - migrate users from old modules to new unified one
-- First, identify users with ANY of the legacy modules
WITH legacy_users AS (
  SELECT DISTINCT us.user_id, us.workspace_id
  FROM user_subscriptions us
  JOIN module_definitions md ON us.module_id = md.id
  WHERE md.slug IN ('market-signals', 'supply-pipeline', 'comp-basic')
    AND us.status = 'active'
),
new_module AS (
  SELECT id FROM module_definitions WHERE slug = 'market-intelligence-unified'
)
INSERT INTO user_subscriptions (
  user_id,
  workspace_id,
  module_id,
  status,
  start_date,
  created_at,
  updated_at
)
SELECT 
  lu.user_id,
  lu.workspace_id,
  nm.id,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM legacy_users lu
CROSS JOIN new_module nm
ON CONFLICT (user_id, workspace_id, module_id) DO NOTHING;

-- Step 4: Add comment explaining the consolidation
COMMENT ON TABLE module_definitions IS 
  'Module definitions for JEDI RE. Market Intelligence modules consolidated in v2.0: Competition + Supply + Market → Market Intelligence (Unified)';

-- Step 5: Create view for active (non-deprecated) modules
CREATE OR REPLACE VIEW active_modules AS
SELECT *
FROM module_definitions
WHERE description NOT LIKE '[DEPRECATED%'
ORDER BY sort_order, name;

COMMENT ON VIEW active_modules IS 
  'Active modules only (excludes deprecated modules for cleaner UI)';
