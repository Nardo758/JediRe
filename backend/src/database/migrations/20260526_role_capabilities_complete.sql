-- Task #878: Complete role-capability seeding
-- Adds LP-specific and lender-specific view capabilities that are exposed
-- on the ReturnsTab panels. Idempotent (ON CONFLICT DO NOTHING).

-- LP: full set of read surfaces relevant to a passive investor
INSERT INTO role_capabilities (platform_role, capability) VALUES
  ('lp', 'view:lp_returns'),
  ('lp', 'view:risk_distribution')
ON CONFLICT DO NOTHING;

-- Lender: debt-monitoring surfaces
INSERT INTO role_capabilities (platform_role, capability) VALUES
  ('lender', 'view:ltv_trend'),
  ('lender', 'view:exit_cap_stress'),
  ('lender', 'view:refi_scenarios')
ON CONFLICT DO NOTHING;

-- Sponsor: full visibility across ALL view surfaces (including LP/lender panels
-- so a sponsor user can preview how each audience will see the deal)
INSERT INTO role_capabilities (platform_role, capability) VALUES
  ('sponsor', 'view:lp_returns'),
  ('sponsor', 'view:risk_distribution'),
  ('sponsor', 'view:ltv_trend'),
  ('sponsor', 'view:exit_cap_stress'),
  ('sponsor', 'view:refi_scenarios')
ON CONFLICT DO NOTHING;
