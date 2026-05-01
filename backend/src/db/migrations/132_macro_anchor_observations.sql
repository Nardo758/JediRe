-- M36 Macro-Anchored Mean — Observation Cache
-- 
-- Stores FRED/BLS macro series observations for μ_macro computation.
-- Seeded with defaults on deploy; refreshed per series cadence.
-- See M36_Macro_Anchored_Mean_Addendum.md sections 3.1, 5, 8

-- Macro series observations (ingested from FRED/BLS, cached in DB)
CREATE TABLE IF NOT EXISTS macro_anchor_observations (
    series_id   VARCHAR(50) NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    obs_date    DATE NOT NULL,
    source      VARCHAR(50) NOT NULL DEFAULT 'manual',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    PRIMARY KEY (series_id, obs_date)
);

-- Enable row-level safety for upserts
CREATE INDEX IF NOT EXISTS idx_macro_obs_latest 
    ON macro_anchor_observations(series_id, obs_date DESC);

COMMENT ON TABLE macro_anchor_observations IS 
    'FRED/BLS macro series cache for macro-anchored μ computation (M36 addendum)';
COMMENT ON COLUMN macro_anchor_observations.series_id IS 
    'FRED series ID: CUSR0000SEHC (CPI-OER), DGS10 (10Y Treasury), WPSFD49207 (PPI), ECIWAG (ECI), T10YIE (Breakeven)';
COMMENT ON COLUMN macro_anchor_observations.value IS 
    'Observed value (decimal: 0.032 = 3.2%)';
COMMENT ON COLUMN macro_anchor_observations.obs_date IS 
    'Date of observation (monthly for CPI/PPI, daily for Treasury)';

-- Seed defaults for first deploy (so plausibility works before first FRED fetch)
INSERT INTO macro_anchor_observations (series_id, value, obs_date, source) VALUES
    ('CUSR0000SEHC', 0.038,  CURRENT_DATE, 'manual'),     -- CPI-OER ~3.8% (2025 H1)
    ('DGS10',        0.0425, CURRENT_DATE, 'manual'),     -- 10Y Treasury ~4.25%
    ('WPSFD49207',   0.035,  CURRENT_DATE, 'manual'),     -- PPI Res Construction ~3.5%
    ('ECIWAG',       0.042,  CURRENT_DATE, 'manual'),     -- ECI Wages ~4.2%
    ('T10YIE',       0.023,  CURRENT_DATE, 'manual')      -- 10Y Breakeven ~2.3%
ON CONFLICT (series_id, obs_date) DO NOTHING;

-- Optionally include structural_premiums schema (frozen between annual recalibrations)
CREATE TABLE IF NOT EXISTS structural_premiums (
    premium_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric               VARCHAR(50) NOT NULL,
    asset_class          VARCHAR(50) NOT NULL DEFAULT 'multifamily',
    geographic_tier      VARCHAR(50) NOT NULL DEFAULT 'sun_belt',
    premium_value        DOUBLE PRECISION NOT NULL,
    calibration_window_start DATE,
    calibration_window_end   DATE,
    calibration_method   VARCHAR(50),
    next_recalibration_at TIMESTAMPTZ,
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_premiums_active_unique 
    ON structural_premiums(metric, asset_class, geographic_tier) 
    WHERE is_active = true;

-- Seed initial premiums (from spec §3.2 — illustrative, will be refined)
INSERT INTO structural_premiums (metric, asset_class, geographic_tier, premium_value, calibration_method) VALUES
    ('rentGrowthStabilized', 'multifamily', 'sun_belt',     0.008, 'long_window_mean'),
    ('rentGrowthStabilized', 'multifamily', 'northeast',    0.002, 'long_window_mean'),
    ('rentGrowthY1',         'multifamily', 'sun_belt',     0.010, 'long_window_mean'),
    ('expenseGrowthRate',    'multifamily', 'sun_belt',     0.005, 'long_window_mean'),
    ('entryCapRate',         'multifamily', 'sun_belt',     0.035, 'long_window_mean'),
    ('exitCapRate',          'multifamily', 'sun_belt',     0.040, 'long_window_mean'),
    ('constructionCostGrowth','multifamily', 'sun_belt',    0.005, 'long_window_mean')
ON CONFLICT (metric, asset_class, geographic_tier) WHERE is_active = true DO NOTHING;

COMMENT ON TABLE structural_premiums IS 
    'Frozen-between-recalibrations structural premiums for macro-anchored μ (§3.2)';
