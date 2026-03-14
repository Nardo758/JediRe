-- Seed: Ensure at least one deal of each project_type exists for testing
-- Run after initial deal seeding to give a representative set of deal types.
--
-- Targets (by name):
--   Inman Park Multifamily  → development  (pipeline, active, SIGNAL_INTAKE)
--   Westside Retail Center  → redevelopment (pipeline, active, SIGNAL_INTAKE)
--   All others              → remain existing (no-op)

UPDATE deals
SET project_type  = 'development',
    deal_category = 'pipeline',
    status        = 'active',
    state         = 'SIGNAL_INTAKE'
WHERE name = 'Inman Park Multifamily';

UPDATE deals
SET project_type  = 'redevelopment',
    deal_category = 'pipeline',
    status        = 'active',
    state         = 'SIGNAL_INTAKE'
WHERE name = 'Westside Retail Center';
