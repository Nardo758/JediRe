-- Admin-level comp set properties (org-wide)
CREATE TABLE IF NOT EXISTS admin_comp_set_properties (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name TEXT        NOT NULL,
  address       TEXT,
  submarket     TEXT,
  distance_mi   NUMERIC(6,2),
  avg_rent_sf   NUMERIC(8,2),
  occupancy_pct NUMERIC(5,2),
  last_scraped  TIMESTAMPTZ,
  notes         TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-configured pricing alert rules
CREATE TABLE IF NOT EXISTS admin_pricing_alert_rules (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submarket         TEXT        NOT NULL,
  metric            TEXT        NOT NULL CHECK (metric IN ('avg_rent', 'occupancy')),
  threshold_pct     NUMERIC(6,2) NOT NULL,
  direction         TEXT        NOT NULL CHECK (direction IN ('above', 'below')),
  notification_pref TEXT        NOT NULL DEFAULT 'email' CHECK (notification_pref IN ('email', 'sms', 'both', 'none')),
  is_enabled        BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
