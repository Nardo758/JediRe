-- leasing_weekly_observations: weekly funnel + occupancy (from Weekly tab)
CREATE TABLE IF NOT EXISTS leasing_weekly_observations (
  id              BIGSERIAL PRIMARY KEY,
  property_code   TEXT NOT NULL,
  week_ending     DATE NOT NULL,
  total_units     INT,
  traffic         INT,
  tours_inperson  INT,
  apps            INT,
  cancellations   INT,
  denials         INT,
  net_leases      INT,
  closing_ratio   NUMERIC(6,4),
  beg_occ_units   INT,
  move_ins        INT,
  move_outs       INT,
  transfers       INT,
  end_occ_units   INT,
  notice_rented   INT,
  notice_unrented INT,
  total_notice    INT,
  occ_pct         NUMERIC(6,4),
  leased_pct      NUMERIC(6,4),
  avail_pct       NUMERIC(6,4),
  avg_market_rent NUMERIC(12,2),
  gross_market_rent NUMERIC(14,2),
  gross_rent_psf  NUMERIC(8,4),
  effective_rent  NUMERIC(12,2),
  effective_rent_psf NUMERIC(8,4),
  source_file     TEXT,
  ingested_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (property_code, week_ending)
);

-- lease_tradeout_events: per-lease trade-out events (from Renewal & Trade Out tab)
CREATE TABLE IF NOT EXISTS lease_tradeout_events (
  id                  BIGSERIAL PRIMARY KEY,
  property_code       TEXT NOT NULL,
  unit                TEXT NOT NULL,
  unit_type           TEXT,
  sqft                INT,
  event_type          TEXT NOT NULL,
  lease_start_date    DATE NOT NULL,
  market_rent_at_exec NUMERIC(12,2),
  prior_rent          NUMERIC(12,2),
  new_rent            NUMERIC(12,2),
  tradeout_delta      NUMERIC(12,2),
  tradeout_pct        NUMERIC(8,4),
  loss_to_lease       NUMERIC(12,2),
  prior_rent_psf      NUMERIC(8,4),
  new_rent_psf        NUMERIC(8,4),
  source_file         TEXT,
  ingested_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (property_code, unit, lease_start_date, event_type)
);

-- deal_monthly_actuals_lines: account-line granularity from 13 month rolling tab
CREATE TABLE IF NOT EXISTS deal_monthly_actuals_lines (
  id              BIGSERIAL PRIMARY KEY,
  property_code   TEXT NOT NULL,
  period_month    DATE NOT NULL,
  account_label   TEXT NOT NULL,
  gl_range        TEXT,
  amount          NUMERIC(16,2),
  books           TEXT DEFAULT 'Accrual^GAAP',
  source_file     TEXT,
  ingested_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (property_code, period_month, account_label)
);
