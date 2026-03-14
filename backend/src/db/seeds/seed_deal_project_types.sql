-- Seed: Ensure at least one deal of each project_type exists for testing
-- Run after initial deal seeding to give a representative set of deal types.
--
-- Targets (by name):
--   Inman Park Multifamily  → development  (active, SIGNAL_INTAKE)
--   Westside Retail Center  → redevelopment (active, SIGNAL_INTAKE)
--   All others              → remain existing (no-op)

UPDATE deals
SET project_type = 'development',
    status       = 'active',
    state        = 'SIGNAL_INTAKE'
WHERE name = 'Inman Park Multifamily';

UPDATE deals
SET project_type = 'redevelopment',
    status       = 'active',
    state        = 'SIGNAL_INTAKE'
WHERE name = 'Westside Retail Center';
