-- Task #878 Phase 2: Role-capability matrix
-- Adds role_capabilities(platform_role, capability) as the authoritative
-- role-level grant source.  requireCapability checks EITHER a per-user
-- override (user_capabilities) OR the role-level matrix for the user's
-- platform_role — whichever grants access first.
--
-- This supplements the existing per-user user_capabilities table which
-- handles ad-hoc / custom grants.

CREATE TABLE IF NOT EXISTS role_capabilities (
  platform_role  TEXT  NOT NULL
                       CHECK (platform_role IN ('sponsor', 'lp', 'lender')),
  capability     TEXT  NOT NULL,
  PRIMARY KEY (platform_role, capability)
);

-- Sponsor / GP: full edit access + all view surfaces
INSERT INTO role_capabilities (platform_role, capability) VALUES
  ('sponsor', 'edit:capital_structure'),
  ('sponsor', 'edit:operating_assumptions'),
  ('sponsor', 'view:returns'),
  ('sponsor', 'view:gp_returns'),
  ('sponsor', 'view:lp_distribution_schedule'),
  ('sponsor', 'view:dscr_panel')
ON CONFLICT DO NOTHING;

-- LP: read-only — returns + distribution schedule only
INSERT INTO role_capabilities (platform_role, capability) VALUES
  ('lp', 'view:returns'),
  ('lp', 'view:lp_distribution_schedule')
ON CONFLICT DO NOTHING;

-- Lender: read-only — returns + DSCR/LTV panel only
INSERT INTO role_capabilities (platform_role, capability) VALUES
  ('lender', 'view:returns'),
  ('lender', 'view:dscr_panel')
ON CONFLICT DO NOTHING;
