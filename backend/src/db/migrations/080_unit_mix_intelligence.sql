-- 080_unit_mix_intelligence.sql
-- Unit Mix Intelligence module tables

CREATE TABLE IF NOT EXISTS comp_properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID NOT NULL,
  trade_area_id UUID NOT NULL,
  name          TEXT NOT NULL,
  address       TEXT,
  class         TEXT,
  built_year    INT,
  total_units   INT,
  is_subject    BOOLEAN DEFAULT false,
  source_url    TEXT,
  scraped_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comp_deal_idx ON comp_properties(deal_id);
CREATE INDEX IF NOT EXISTS comp_area_idx ON comp_properties(trade_area_id);

CREATE TABLE IF NOT EXISTS comp_unit_types (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id        UUID NOT NULL REFERENCES comp_properties(id) ON DELETE CASCADE,
  unit_type      TEXT NOT NULL,
  mix_pct        NUMERIC(5,2),
  avg_sf         INT,
  avg_rent       NUMERIC(10,2),
  vacancy_pct    NUMERIC(5,2),
  days_on_market NUMERIC(5,1),
  concessions    NUMERIC(4,1),
  scraped_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comp_id, unit_type)
);

CREATE INDEX IF NOT EXISTS cut_comp_idx ON comp_unit_types(comp_id);
CREATE INDEX IF NOT EXISTS cut_type_idx ON comp_unit_types(unit_type);

CREATE TABLE IF NOT EXISTS unit_type_trends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL,
  unit_type     TEXT NOT NULL,
  month_label   TEXT NOT NULL,
  period_date   TIMESTAMPTZ NOT NULL,
  avg_vacancy   NUMERIC(5,2),
  avg_dom       NUMERIC(5,1),
  avg_rent      NUMERIC(10,2),
  avg_conc      NUMERIC(4,1),
  comp_count    INT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS utt_area_type_idx ON unit_type_trends(trade_area_id, unit_type);
CREATE INDEX IF NOT EXISTS utt_date_idx ON unit_type_trends(period_date);

CREATE TABLE IF NOT EXISTS deal_unit_programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID NOT NULL UNIQUE,
  total_units  INT NOT NULL,
  unit_config  JSONB NOT NULL,
  total_net_sf INT,
  gross_rev_pa NUMERIC(14,2),
  mix_total    NUMERIC(5,2),
  updated_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
