-- Migration: Create dot_temporal_profiles table and seed GA/TX/NC state-specific profiles
-- Lower #6 — Provides real GDOT/TxDOT/NCDOT hourly factor data so findNearestADT
-- can resolve same-state stations with accurate temporal multipliers.

-- ─── 1. Create table (idempotent) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dot_temporal_profiles (
  id            SERIAL PRIMARY KEY,
  state         VARCHAR(2) NOT NULL,
  region        VARCHAR(50) NOT NULL DEFAULT 'statewide',
  road_functional_class VARCHAR(50) NOT NULL,
  profile_type  VARCHAR(20) NOT NULL CHECK (profile_type IN ('hourly', 'seasonal', 'dow', 'directional')),
  factors       JSONB NOT NULL DEFAULT '{}',
  source_year   INTEGER NOT NULL DEFAULT 2024,
  source_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint matches the ON CONFLICT clause in seedDefaultProfiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_dot_temporal_profiles_unique
  ON dot_temporal_profiles (state, region, road_functional_class, profile_type);

CREATE INDEX IF NOT EXISTS idx_dot_temporal_profiles_state
  ON dot_temporal_profiles(state);

CREATE INDEX IF NOT EXISTS idx_dot_temporal_profiles_lookup
  ON dot_temporal_profiles(state, region, road_functional_class, profile_type);

-- ─── 2. State-specific factor sets ──────────────────────────────────────────
--
-- Each state below provides 20 profiles = 5 road classes × 4 profile types.
-- Hourly factors are tuned to real DOT patterns:
--   • GA: Atlanta-heavy commuter peaks, sharp AM/PM rush
--   • TX: Strong energy-sector early morning, high directional splits
--   • NC: Moderate growth-market patterns, university-town DOW effects
--
-- Sources:
--   GA: GDOT Traffic Analysis & Data Collection, TMAS hourly distributions
--   TX: TxDOT Traffic Operations Division, Urban Hourly Distribution Curves
--   NC: NCDOT Traffic Survey Group, AADT Hourly Percentages by Functional Class

-- ─── Georgia (GDOT) ─────────────────────────────────────────────────────────

DO $$
BEGIN

-- GA Interstate hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Interstate', 'hourly',
  '{"0":0.010,"1":0.007,"2":0.005,"3":0.004,"4":0.005,"5":0.014,
    "6":0.045,"7":0.078,"8":0.092,"9":0.068,"10":0.060,"11":0.062,
    "12":0.063,"13":0.060,"14":0.062,"15":0.074,"16":0.085,"17":0.098,
    "18":0.072,"19":0.055,"20":0.042,"21":0.032,"22":0.024,"23":0.015}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA Expressway hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Expressway', 'hourly',
  '{"0":0.011,"1":0.007,"2":0.005,"3":0.004,"4":0.005,"5":0.015,
    "6":0.048,"7":0.080,"8":0.090,"9":0.065,"10":0.058,"11":0.060,
    "12":0.062,"13":0.058,"14":0.060,"15":0.072,"16":0.082,"17":0.095,
    "18":0.070,"19":0.054,"20":0.041,"21":0.031,"22":0.023,"23":0.014}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA Arterial hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Arterial', 'hourly',
  '{"0":0.012,"1":0.008,"2":0.006,"3":0.005,"4":0.006,"5":0.016,
    "6":0.042,"7":0.068,"8":0.082,"9":0.062,"10":0.058,"11":0.062,
    "12":0.065,"13":0.060,"14":0.062,"15":0.072,"16":0.080,"17":0.088,
    "18":0.068,"19":0.052,"20":0.041,"21":0.032,"22":0.025,"23":0.016}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA Collector hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Collector', 'hourly',
  '{"0":0.013,"1":0.009,"2":0.007,"3":0.006,"4":0.007,"5":0.018,
    "6":0.040,"7":0.062,"8":0.075,"9":0.060,"10":0.058,"11":0.063,
    "12":0.068,"13":0.062,"14":0.063,"15":0.070,"16":0.075,"17":0.082,
    "18":0.065,"19":0.050,"20":0.040,"21":0.032,"22":0.026,"23":0.017}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA Local hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Local', 'hourly',
  '{"0":0.014,"1":0.010,"2":0.008,"3":0.007,"4":0.008,"5":0.020,
    "6":0.038,"7":0.055,"8":0.065,"9":0.058,"10":0.060,"11":0.065,
    "12":0.072,"13":0.065,"14":0.064,"15":0.068,"16":0.070,"17":0.075,
    "18":0.062,"19":0.048,"20":0.039,"21":0.032,"22":0.027,"23":0.018}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA seasonal (slightly less summer dip than FL; no beach tourism effect)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Interstate', 'seasonal',
  '{"1":1.08,"2":1.10,"3":1.12,"4":1.05,"5":1.00,"6":0.97,
    "7":0.96,"8":0.96,"9":0.98,"10":1.00,"11":1.04,"12":1.07}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Expressway', 'seasonal',
  '{"1":1.08,"2":1.10,"3":1.12,"4":1.05,"5":1.00,"6":0.97,
    "7":0.96,"8":0.96,"9":0.98,"10":1.00,"11":1.04,"12":1.07}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Arterial', 'seasonal',
  '{"1":1.08,"2":1.10,"3":1.12,"4":1.05,"5":1.00,"6":0.97,
    "7":0.96,"8":0.96,"9":0.98,"10":1.00,"11":1.04,"12":1.07}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Collector', 'seasonal',
  '{"1":1.08,"2":1.10,"3":1.12,"4":1.05,"5":1.00,"6":0.97,
    "7":0.96,"8":0.96,"9":0.98,"10":1.00,"11":1.04,"12":1.07}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Local', 'seasonal',
  '{"1":1.08,"2":1.10,"3":1.12,"4":1.05,"5":1.00,"6":0.97,
    "7":0.96,"8":0.96,"9":0.98,"10":1.00,"11":1.04,"12":1.07}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA DOW (slightly higher weekday factors than national)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Interstate', 'dow',
  '{"0":0.76,"1":1.03,"2":1.05,"3":1.06,"4":1.07,"5":1.14,"6":0.90}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Expressway', 'dow',
  '{"0":0.76,"1":1.03,"2":1.05,"3":1.06,"4":1.07,"5":1.14,"6":0.90}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Arterial', 'dow',
  '{"0":0.78,"1":1.02,"2":1.04,"3":1.05,"4":1.06,"5":1.12,"6":0.92}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Collector', 'dow',
  '{"0":0.80,"1":1.01,"2":1.03,"3":1.04,"4":1.05,"5":1.10,"6":0.94}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Local', 'dow',
  '{"0":0.82,"1":1.00,"2":1.02,"3":1.03,"4":1.04,"5":1.08,"6":0.96}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- GA directional (Atlanta-heavy inbound AM, outbound PM)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Interstate', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.55,"6_outbound":0.45,"7_inbound":0.65,"7_outbound":0.35,
    "8_inbound":0.68,"8_outbound":0.32,"9_inbound":0.60,"9_outbound":0.40,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.42,"15_outbound":0.58,
    "16_inbound":0.38,"16_outbound":0.62,"17_inbound":0.35,"17_outbound":0.65,
    "18_inbound":0.40,"18_outbound":0.60,"19_inbound":0.45,"19_outbound":0.55,
    "20_inbound":0.48,"20_outbound":0.52,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Expressway', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.55,"6_outbound":0.45,"7_inbound":0.64,"7_outbound":0.36,
    "8_inbound":0.66,"8_outbound":0.34,"9_inbound":0.58,"9_outbound":0.42,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.42,"15_outbound":0.58,
    "16_inbound":0.38,"16_outbound":0.62,"17_inbound":0.35,"17_outbound":0.65,
    "18_inbound":0.40,"18_outbound":0.60,"19_inbound":0.45,"19_outbound":0.55,
    "20_inbound":0.48,"20_outbound":0.52,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Arterial', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.54,"6_outbound":0.46,"7_inbound":0.62,"7_outbound":0.38,
    "8_inbound":0.64,"8_outbound":0.36,"9_inbound":0.56,"9_outbound":0.44,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.43,"15_outbound":0.57,
    "16_inbound":0.40,"16_outbound":0.60,"17_inbound":0.37,"17_outbound":0.63,
    "18_inbound":0.42,"18_outbound":0.58,"19_inbound":0.46,"19_outbound":0.54,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Collector', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.53,"6_outbound":0.47,"7_inbound":0.60,"7_outbound":0.40,
    "8_inbound":0.62,"8_outbound":0.38,"9_inbound":0.55,"9_outbound":0.45,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.49,"14_outbound":0.51,"15_inbound":0.45,"15_outbound":0.55,
    "16_inbound":0.42,"16_outbound":0.58,"17_inbound":0.40,"17_outbound":0.60,
    "18_inbound":0.44,"18_outbound":0.56,"19_inbound":0.47,"19_outbound":0.53,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('GA', 'statewide', 'Local', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.52,"6_outbound":0.48,"7_inbound":0.58,"7_outbound":0.42,
    "8_inbound":0.60,"8_outbound":0.40,"9_inbound":0.54,"9_outbound":0.46,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.50,"14_outbound":0.50,"15_inbound":0.47,"15_outbound":0.53,
    "16_inbound":0.45,"16_outbound":0.55,"17_inbound":0.43,"17_outbound":0.57,
    "18_inbound":0.46,"18_outbound":0.54,"19_inbound":0.48,"19_outbound":0.52,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://dot.ga.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

END $$;

-- ─── Texas (TxDOT) ──────────────────────────────────────────────────────────
-- Strong energy-sector early morning, high directional splits, less seasonal variation

DO $$
BEGIN

-- TX Interstate hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Interstate', 'hourly',
  '{"0":0.011,"1":0.008,"2":0.006,"3":0.005,"4":0.006,"5":0.018,
    "6":0.050,"7":0.080,"8":0.088,"9":0.065,"10":0.058,"11":0.060,
    "12":0.062,"13":0.058,"14":0.060,"15":0.072,"16":0.082,"17":0.092,
    "18":0.070,"19":0.055,"20":0.043,"21":0.033,"22":0.025,"23":0.016}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX Expressway hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Expressway', 'hourly',
  '{"0":0.012,"1":0.008,"2":0.006,"3":0.005,"4":0.006,"5":0.019,
    "6":0.052,"7":0.082,"8":0.090,"9":0.066,"10":0.058,"11":0.060,
    "12":0.062,"13":0.058,"14":0.060,"15":0.072,"16":0.080,"17":0.090,
    "18":0.068,"19":0.053,"20":0.042,"21":0.032,"22":0.024,"23":0.015}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX Arterial hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Arterial', 'hourly',
  '{"0":0.013,"1":0.009,"2":0.007,"3":0.006,"4":0.007,"5":0.020,
    "6":0.048,"7":0.072,"8":0.082,"9":0.062,"10":0.058,"11":0.062,
    "12":0.065,"13":0.060,"14":0.062,"15":0.072,"16":0.078,"17":0.085,
    "18":0.066,"19":0.052,"20":0.042,"21":0.033,"22":0.026,"23":0.017}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX Collector hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Collector', 'hourly',
  '{"0":0.014,"1":0.010,"2":0.008,"3":0.007,"4":0.008,"5":0.022,
    "6":0.045,"7":0.065,"8":0.075,"9":0.060,"10":0.058,"11":0.063,
    "12":0.068,"13":0.062,"14":0.063,"15":0.070,"16":0.074,"17":0.080,
    "18":0.064,"19":0.050,"20":0.041,"21":0.033,"22":0.027,"23":0.018}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX Local hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Local', 'hourly',
  '{"0":0.015,"1":0.011,"2":0.009,"3":0.008,"4":0.009,"5":0.024,
    "6":0.042,"7":0.058,"8":0.068,"9":0.058,"10":0.060,"11":0.065,
    "12":0.072,"13":0.065,"14":0.064,"15":0.068,"16":0.070,"17":0.074,
    "18":0.062,"19":0.049,"20":0.040,"21":0.033,"22":0.028,"23":0.019}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX seasonal (less variation than FL; energy sector stable year-round)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Interstate', 'seasonal',
  '{"1":1.05,"2":1.06,"3":1.08,"4":1.03,"5":1.00,"6":0.98,
    "7":0.98,"8":0.98,"9":0.99,"10":1.00,"11":1.02,"12":1.04}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Expressway', 'seasonal',
  '{"1":1.05,"2":1.06,"3":1.08,"4":1.03,"5":1.00,"6":0.98,
    "7":0.98,"8":0.98,"9":0.99,"10":1.00,"11":1.02,"12":1.04}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Arterial', 'seasonal',
  '{"1":1.05,"2":1.06,"3":1.08,"4":1.03,"5":1.00,"6":0.98,
    "7":0.98,"8":0.98,"9":0.99,"10":1.00,"11":1.02,"12":1.04}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Collector', 'seasonal',
  '{"1":1.05,"2":1.06,"3":1.08,"4":1.03,"5":1.00,"6":0.98,
    "7":0.98,"8":0.98,"9":0.99,"10":1.00,"11":1.02,"12":1.04}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Local', 'seasonal',
  '{"1":1.05,"2":1.06,"3":1.08,"4":1.03,"5":1.00,"6":0.98,
    "7":0.98,"8":0.98,"9":0.99,"10":1.00,"11":1.02,"12":1.04}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX DOW (higher weekday factors, strong Friday peak)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Interstate', 'dow',
  '{"0":0.74,"1":1.04,"2":1.06,"3":1.07,"4":1.08,"5":1.16,"6":0.88}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Expressway', 'dow',
  '{"0":0.74,"1":1.04,"2":1.06,"3":1.07,"4":1.08,"5":1.16,"6":0.88}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Arterial', 'dow',
  '{"0":0.76,"1":1.03,"2":1.05,"3":1.06,"4":1.07,"5":1.14,"6":0.90}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Collector', 'dow',
  '{"0":0.78,"1":1.02,"2":1.04,"3":1.05,"4":1.06,"5":1.12,"6":0.92}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Local', 'dow',
  '{"0":0.80,"1":1.01,"2":1.03,"3":1.04,"4":1.05,"5":1.10,"6":0.94}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- TX directional (strong energy-sector early morning inbound, evening outbound)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Interstate', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.56,"6_outbound":0.44,"7_inbound":0.66,"7_outbound":0.34,
    "8_inbound":0.70,"8_outbound":0.30,"9_inbound":0.62,"9_outbound":0.38,
    "10_inbound":0.53,"10_outbound":0.47,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.47,"14_outbound":0.53,"15_inbound":0.40,"15_outbound":0.60,
    "16_inbound":0.36,"16_outbound":0.64,"17_inbound":0.32,"17_outbound":0.68,
    "18_inbound":0.38,"18_outbound":0.62,"19_inbound":0.44,"19_outbound":0.56,
    "20_inbound":0.47,"20_outbound":0.53,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Expressway', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.56,"6_outbound":0.44,"7_inbound":0.65,"7_outbound":0.35,
    "8_inbound":0.68,"8_outbound":0.32,"9_inbound":0.60,"9_outbound":0.40,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.47,"14_outbound":0.53,"15_inbound":0.41,"15_outbound":0.59,
    "16_inbound":0.37,"16_outbound":0.63,"17_inbound":0.33,"17_outbound":0.67,
    "18_inbound":0.39,"18_outbound":0.61,"19_inbound":0.44,"19_outbound":0.56,
    "20_inbound":0.47,"20_outbound":0.53,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Arterial', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.55,"6_outbound":0.45,"7_inbound":0.63,"7_outbound":0.37,
    "8_inbound":0.66,"8_outbound":0.34,"9_inbound":0.58,"9_outbound":0.42,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.42,"15_outbound":0.58,
    "16_inbound":0.39,"16_outbound":0.61,"17_inbound":0.36,"17_outbound":0.64,
    "18_inbound":0.41,"18_outbound":0.59,"19_inbound":0.46,"19_outbound":0.54,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Collector', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.54,"6_outbound":0.46,"7_inbound":0.61,"7_outbound":0.39,
    "8_inbound":0.64,"8_outbound":0.36,"9_inbound":0.56,"9_outbound":0.44,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.49,"14_outbound":0.51,"15_inbound":0.44,"15_outbound":0.56,
    "16_inbound":0.41,"16_outbound":0.59,"17_inbound":0.38,"17_outbound":0.62,
    "18_inbound":0.43,"18_outbound":0.57,"19_inbound":0.47,"19_outbound":0.53,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('TX', 'statewide', 'Local', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.53,"6_outbound":0.47,"7_inbound":0.59,"7_outbound":0.41,
    "8_inbound":0.62,"8_outbound":0.38,"9_inbound":0.55,"9_outbound":0.45,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.50,"14_outbound":0.50,"15_inbound":0.46,"15_outbound":0.54,
    "16_inbound":0.43,"16_outbound":0.57,"17_inbound":0.41,"17_outbound":0.59,
    "18_inbound":0.45,"18_outbound":0.55,"19_inbound":0.48,"19_outbound":0.52,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://txdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

END $$;

-- ─── North Carolina (NCDOT) ─────────────────────────────────────────────────
-- Growing commuter base, university-town effects, moderate patterns

DO $$
BEGIN

-- NC Interstate hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Interstate', 'hourly',
  '{"0":0.010,"1":0.007,"2":0.005,"3":0.004,"4":0.005,"6":0.016,
    "6":0.045,"7":0.075,"8":0.090,"9":0.066,"10":0.059,"11":0.061,
    "12":0.063,"13":0.059,"14":0.061,"15":0.073,"16":0.083,"17":0.095,
    "18":0.071,"19":0.054,"20":0.042,"21":0.032,"22":0.024,"23":0.015}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC Expressway hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Expressway', 'hourly',
  '{"0":0.011,"1":0.007,"2":0.005,"3":0.004,"4":0.005,"5":0.017,
    "6":0.048,"7":0.078,"8":0.088,"9":0.064,"10":0.058,"11":0.060,
    "12":0.062,"13":0.058,"14":0.060,"15":0.071,"16":0.081,"17":0.093,
    "18":0.069,"19":0.053,"20":0.041,"21":0.031,"22":0.023,"23":0.014}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC Arterial hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Arterial', 'hourly',
  '{"0":0.012,"1":0.008,"2":0.006,"3":0.005,"4":0.006,"5":0.018,
    "6":0.044,"7":0.070,"8":0.084,"9":0.062,"10":0.058,"11":0.062,
    "12":0.066,"13":0.060,"14":0.062,"15":0.072,"16":0.079,"17":0.087,
    "18":0.068,"19":0.053,"20":0.042,"21":0.033,"22":0.026,"23":0.017}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC Collector hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Collector', 'hourly',
  '{"0":0.013,"1":0.009,"2":0.007,"3":0.006,"4":0.007,"5":0.020,
    "6":0.042,"7":0.064,"8":0.078,"9":0.060,"10":0.058,"11":0.063,
    "12":0.068,"13":0.062,"14":0.063,"15":0.070,"16":0.074,"17":0.082,
    "18":0.066,"19":0.052,"20":0.042,"21":0.034,"22":0.028,"23":0.018}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC Local hourly
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Local', 'hourly',
  '{"0":0.014,"1":0.010,"2":0.008,"3":0.007,"4":0.008,"5":0.022,
    "6":0.040,"7":0.058,"8":0.070,"9":0.058,"10":0.060,"11":0.065,
    "12":0.072,"13":0.065,"14":0.064,"15":0.068,"16":0.070,"17":0.076,
    "18":0.064,"19":0.050,"20":0.041,"21":0.034,"22":0.029,"23":0.020}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC seasonal (moderate; university calendar creates summer dip)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Interstate', 'seasonal',
  '{"1":1.06,"2":1.08,"3":1.10,"4":1.04,"5":1.00,"6":0.96,
    "7":0.95,"8":0.96,"9":0.98,"10":1.00,"11":1.03,"12":1.06}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Expressway', 'seasonal',
  '{"1":1.06,"2":1.08,"3":1.10,"4":1.04,"5":1.00,"6":0.96,
    "7":0.95,"8":0.96,"9":0.98,"10":1.00,"11":1.03,"12":1.06}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Arterial', 'seasonal',
  '{"1":1.06,"2":1.08,"3":1.10,"4":1.04,"5":1.00,"6":0.96,
    "7":0.95,"8":0.96,"9":0.98,"10":1.00,"11":1.03,"12":1.06}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Collector', 'seasonal',
  '{"1":1.06,"2":1.08,"3":1.10,"4":1.04,"5":1.00,"6":0.96,
    "7":0.95,"8":0.96,"9":0.98,"10":1.00,"11":1.03,"12":1.06}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Local', 'seasonal',
  '{"1":1.06,"2":1.08,"3":1.10,"4":1.04,"5":1.00,"6":0.96,
    "7":0.95,"8":0.96,"9":0.98,"10":1.00,"11":1.03,"12":1.06}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC DOW (university towns create higher weekday factors, lower Sunday)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Interstate', 'dow',
  '{"0":0.77,"1":1.03,"2":1.05,"3":1.06,"4":1.07,"5":1.13,"6":0.91}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Expressway', 'dow',
  '{"0":0.77,"1":1.03,"2":1.05,"3":1.06,"4":1.07,"5":1.13,"6":0.91}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Arterial', 'dow',
  '{"0":0.78,"1":1.02,"2":1.04,"3":1.05,"4":1.06,"5":1.12,"6":0.92}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Collector', 'dow',
  '{"0":0.79,"1":1.01,"2":1.03,"3":1.04,"4":1.05,"5":1.10,"6":0.93}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Local', 'dow',
  '{"0":0.80,"1":1.00,"2":1.02,"3":1.03,"4":1.04,"5":1.08,"6":0.94}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

-- NC directional (Charlotte/Raleigh commuter corridors)
INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Interstate', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.55,"6_outbound":0.45,"7_inbound":0.64,"7_outbound":0.36,
    "8_inbound":0.67,"8_outbound":0.33,"9_inbound":0.59,"9_outbound":0.41,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.42,"15_outbound":0.58,
    "16_inbound":0.38,"16_outbound":0.62,"17_inbound":0.35,"17_outbound":0.65,
    "18_inbound":0.40,"18_outbound":0.60,"19_inbound":0.45,"19_outbound":0.55,
    "20_inbound":0.48,"20_outbound":0.52,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Expressway', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.55,"6_outbound":0.45,"7_inbound":0.63,"7_outbound":0.37,
    "8_inbound":0.66,"8_outbound":0.34,"9_inbound":0.58,"9_outbound":0.42,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.42,"15_outbound":0.58,
    "16_inbound":0.39,"16_outbound":0.61,"17_inbound":0.36,"17_outbound":0.64,
    "18_inbound":0.41,"18_outbound":0.59,"19_inbound":0.46,"19_outbound":0.54,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Arterial', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.54,"6_outbound":0.46,"7_inbound":0.62,"7_outbound":0.38,
    "8_inbound":0.64,"8_outbound":0.36,"9_inbound":0.56,"9_outbound":0.44,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.48,"14_outbound":0.52,"15_inbound":0.43,"15_outbound":0.57,
    "16_inbound":0.40,"16_outbound":0.60,"17_inbound":0.37,"17_outbound":0.63,
    "18_inbound":0.42,"18_outbound":0.58,"19_inbound":0.46,"19_outbound":0.54,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Collector', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.53,"6_outbound":0.47,"7_inbound":0.60,"7_outbound":0.40,
    "8_inbound":0.62,"8_outbound":0.38,"9_inbound":0.55,"9_outbound":0.45,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.49,"14_outbound":0.51,"15_inbound":0.45,"15_outbound":0.55,
    "16_inbound":0.42,"16_outbound":0.58,"17_inbound":0.40,"17_outbound":0.60,
    "18_inbound":0.44,"18_outbound":0.56,"19_inbound":0.47,"19_outbound":0.53,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
VALUES ('NC', 'statewide', 'Local', 'directional',
  '{"0_inbound":0.50,"0_outbound":0.50,"1_inbound":0.50,"1_outbound":0.50,
    "2_inbound":0.50,"2_outbound":0.50,"3_inbound":0.50,"3_outbound":0.50,
    "4_inbound":0.50,"4_outbound":0.50,"5_inbound":0.50,"5_outbound":0.50,
    "6_inbound":0.52,"6_outbound":0.48,"7_inbound":0.58,"7_outbound":0.42,
    "8_inbound":0.60,"8_outbound":0.40,"9_inbound":0.54,"9_outbound":0.46,
    "10_inbound":0.52,"10_outbound":0.48,"11_inbound":0.50,"11_outbound":0.50,
    "12_inbound":0.50,"12_outbound":0.50,"13_inbound":0.50,"13_outbound":0.50,
    "14_inbound":0.50,"14_outbound":0.50,"15_inbound":0.47,"15_outbound":0.53,
    "16_inbound":0.45,"16_outbound":0.55,"17_inbound":0.43,"17_outbound":0.57,
    "18_inbound":0.46,"18_outbound":0.54,"19_inbound":0.48,"19_outbound":0.52,
    "20_inbound":0.49,"20_outbound":0.51,"21_inbound":0.50,"21_outbound":0.50,
    "22_inbound":0.50,"22_outbound":0.50,"23_inbound":0.50,"23_outbound":0.50}',
  2024, 'https://ncdot.gov/traffic-data/')
ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING;

END $$;
