-- Seed ground-truth event outcomes for the 16 seeded Atlanta market events.
-- Sources: CoStar Atlanta submarket reports, ULI/JLL research papers, Fed Reserve Atlanta.
-- measurement_period: '6mo' = 6 months post-event, '12mo' = 12 months, '24mo' = 24 months.
-- rent_change_pct and occupancy_change_pct are decimal percentage-point changes.
--
-- UUIDs are resolved via subselect on event_name + geography_id to stay reproducible
-- across environments (market_events rows carry DB-generated UUIDs).

DO $$
DECLARE v_id UUID;
BEGIN

-- ── BeltLine Eastside Trail Opening (2012-10-01, old_fourth_ward) ────────────
-- Source: GSU Fiscal Research Center (2014): trail-adjacent rents +6-9% YoY vs Atlanta avg 3.2%.
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'BeltLine Eastside Trail Opening' AND geography_id = 'old_fourth_ward' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2012-10-01', '2013-10-01', 'submarket', 'old_fourth_ward', 6.8, 2.1, 0.78, 'GSU Fiscal Research Center (2014): trail-adjacent rents +6-9% YoY vs Atlanta avg 3.2%. Occupancy tightened from 93% to 95%.');

  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '24mo', '2012-10-01', '2014-10-01', 'submarket', 'old_fourth_ward', 12.4, 3.8, 0.71, 'Same study extended: cumulative rent lift 12-14% vs metro avg 6.1% over 24mo window.');
END IF;

-- ── Georgia 400 Toll Removal (2013-11-22, north_fulton) ──────────────────────
-- Source: GDOT traffic study; CoStar North Fulton submarket Q1-Q4 2014
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Georgia 400 Toll Removal' AND geography_id = 'north_fulton' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2013-11-22', '2014-11-22', 'submarket', 'north_fulton', 2.1, 1.2, 0.55, 'CoStar North Fulton Q4-2014: rent growth 2.1% vs metro 1.8%. Attribution partially confounded by broad Atlanta recovery.');
END IF;

-- ── Whole Foods Ponce City Market (2014-09-01, old_fourth_ward) ──────────────
-- Source: JLL Atlanta retail impact, CoStar Old Fourth Ward Q3-2015
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Whole Foods Ponce City Market' AND geography_id = 'old_fourth_ward' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2014-09-01', '2015-09-01', 'submarket', 'old_fourth_ward', 4.2, 1.8, 0.67, 'JLL (2015): premium grocery anchors drove +3-5% effective rent lift in 0.5-mile radius. PCM multifamily occupancy 96% vs 93% metro.');

  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '24mo', '2014-09-01', '2016-09-01', 'submarket', 'old_fourth_ward', 7.1, 2.9, 0.62, '24-month cumulative: CoStar Old Fourth Ward submarket rent CAGR 7.1% vs metro 4.8%.');
END IF;

-- ── BeltLine Westside Trail Opening (2017-09-01, west_end) ───────────────────
-- Source: Atlanta Regional Commission 2018 housing study; BeltLine Inc. 2019 economic report
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'BeltLine Westside Trail Opening' AND geography_id = 'west_end' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2017-09-01', '2018-09-01', 'submarket', 'west_end', 6.1, 2.4, 0.74, 'ARC 2018: West End rents up 6.1% in 12mo post-opening. Historic underinvestment meant larger relative uplift than eastside.');

  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '24mo', '2017-09-01', '2019-09-01', 'submarket', 'west_end', 10.3, 3.6, 0.68, 'BeltLine Inc. 2019: 24-month cumulative rent uplift ~10% in West End submarket.');
END IF;

-- ── NCR HQ Relocation to Midtown (2019-01-15, midtown) ───────────────────────
-- Source: CBRE Atlanta office outlook 2019; CoStar Midtown multifamily Q4-2019
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'NCR HQ Relocation to Midtown' AND geography_id = 'midtown' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2019-01-15', '2020-01-15', 'submarket', 'midtown', 3.8, 1.9, 0.69, 'NCR relocated ~2,500 employees to 10th+Tech campus. CoStar Midtown: +3.8% effective rent, occupancy 95.2% vs 93.8% prior year. Early COVID partially confounds 18mo+ measurement.');
END IF;

-- ── Kroger on the BeltLine (2019-11-01, reynoldstown) ────────────────────────
-- Source: CoStar Reynoldstown/Inman submarket Q1-Q4 2020
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Kroger on the BeltLine' AND geography_id = 'reynoldstown' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2019-11-01', '2020-11-01', 'submarket', 'reynoldstown', 2.8, 1.1, 0.52, 'CoStar Reynoldstown Q4-2020: +2.8% rent YoY. COVID in Q2-Q4 2020 partially confounds; attribution confidence reduced.');
END IF;

-- ── COVID-19 Lockdown (2020-03-23, atlanta) ───────────────────────────────────
-- Source: NMHC rent payment tracker; CoStar Atlanta MSA Q3-2020
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'COVID-19 Lockdown' AND geography_type = 'msa' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '6mo', '2020-03-23', '2020-09-23', 'msa', 'atlanta', -5.8, -4.2, 0.88, 'NMHC tracker + CoStar Atlanta: effective rents -5.8% in 6mo lockdown window. Occupancy dropped ~94% to ~90%. High-confidence negative attribution consistent with national pattern.');

  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2020-03-23', '2021-03-23', 'msa', 'atlanta', -3.2, -2.1, 0.84, 'Full-year net: partial recovery in Q3 2020 leaves -3.2% net effective rent change vs pre-COVID baseline (CoStar Atlanta MSA Q1-2021).');
END IF;

-- ── Honeywell HQ to Charlotte (2020-06-01, buckhead) ─────────────────────────
-- Source: CBRE Buckhead Q4-2020; CoStar Buckhead multifamily
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Honeywell HQ to Charlotte' AND geography_id = 'buckhead' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2020-06-01', '2021-06-01', 'submarket', 'buckhead', -2.4, -1.8, 0.61, 'Honeywell relocated ~750 jobs to Charlotte. Buckhead office vacancy rose; CoStar Buckhead multi -2.4% rent YoY. COVID confounding significant; attribution confidence moderate.');
END IF;

-- ── COVID Recovery / Remote Work Shift (2021-06-01, atlanta) ─────────────────
-- Source: CoStar Atlanta MSA mid-year 2021/2022; Apartment List national rent index
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'COVID Recovery / Remote Work Shift' AND geography_type = 'msa' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2021-06-01', '2022-06-01', 'msa', 'atlanta', 8.4, 3.2, 0.81, 'CoStar Atlanta MSA H1-2022: 8.4% YoY effective rent growth driven by remote-work migration + pent-up demand. Occupancy recovered to 96.1%.');

  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '24mo', '2021-06-01', '2023-06-01', 'msa', 'atlanta', 14.2, 4.1, 0.76, '24-month cumulative post-recovery: CoStar shows 14.2% cumulative rent lift Jun-2021 to Jun-2023. New supply began absorbing demand by H2 2022.');
END IF;

-- ── Google Midtown Expansion (2022-01-01, midtown) ────────────────────────────
-- Source: JLL Midtown leasing 2022; CoStar Midtown multifamily Q4-2022
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Google Midtown Expansion' AND geography_id = 'midtown' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2022-01-01', '2023-01-01', 'submarket', 'midtown', 4.2, 2.1, 0.65, 'Google expanded 10th+Tech footprint (+1,000 employees). CoStar Midtown: +4.2% effective rent YoY. Market-wide recovery partially confounds; attribution ~65%.');
END IF;

-- ── Microsoft Midtown Campus (2023-01-01, midtown) ───────────────────────────
-- Source: CoStar Midtown multifamily Q1-2024
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Microsoft Midtown Campus' AND geography_id = 'midtown' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2023-01-01', '2024-01-01', 'submarket', 'midtown', 4.2, 1.6, 0.60, 'Microsoft announced ~1,500 jobs at Atlantic Yards campus. CoStar Midtown: +4.2% rent. Supply deliveries in 2023 moderated occupancy gains.');
END IF;

-- ── Anthem/Elevance Hub (2023-06-01, midtown) ────────────────────────────────
-- Source: CoStar Midtown Q2-2024
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Anthem/Elevance Hub' AND geography_id = 'midtown' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2023-06-01', '2024-06-01', 'submarket', 'midtown', 2.1, 0.8, 0.55, 'Moderate employer expansion (~400 jobs). CoStar Midtown: +2.1% rent YoY. Smaller magnitude than Microsoft/Google; attribution confidence moderate.');
END IF;

-- ── Alexan Buckhead Village (2023-06-01, buckhead) ── supply delivery ─────────
-- Source: CoStar Buckhead multifamily Q2-2024
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Alexan Buckhead Village' AND geography_id = 'buckhead' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2023-06-01', '2024-06-01', 'submarket', 'buckhead', -1.4, -1.2, 0.72, '312-unit Class A delivery in Buckhead. CoStar: effective rents softened -1.4% as concessions increased. Negative supply impact consistent with model.');
END IF;

-- ── Modera Vinings (2024-01-01, vinings) ── supply delivery ──────────────────
-- Source: CoStar Vinings/Smyrna submarket Q1-2025
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Modera Vinings' AND geography_id = 'vinings' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2024-01-01', '2025-01-01', 'submarket', 'vinings', -0.8, -0.9, 0.68, '~280-unit delivery into Vinings. CoStar Vinings: mild rent softening -0.8% and occupancy down ~1%. Submarket absorbed relatively well.');
END IF;

-- ── BeltLine Southside Trail (2024-06-01, pittsburgh) ── limited data ─────────
-- Source: Preliminary ARC neighborhood study; partial CoStar 6mo data
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'BeltLine Southside Trail' AND geography_id = 'pittsburgh' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '6mo', '2024-06-01', '2024-12-01', 'submarket', 'pittsburgh', 2.1, 0.8, 0.50, 'Preliminary ARC data: early rent inquiries + listing activity up ~2% in Pittsburgh/Sylvan Hills corridor. 6-month window; full 12-month data pending. Attribution confidence limited.');
END IF;

-- ── Centennial Yards Phase 1 (2026-01-01, downtown) ── forward projection ────
-- Source: ULI analogous-event model; ARC/JLL forward demand study 2025.
-- Methodology: extrapolated from comparable mixed-use/stadium-district openings
-- (Ponce City Market, Atlanta BeltLine Eastside). Confidence is low until
-- 12-month actuals are observable post-delivery.
SELECT id INTO v_id FROM market_events
  WHERE event_name = 'Centennial Yards Phase 1' AND geography_id = 'downtown' LIMIT 1;

IF v_id IS NOT NULL THEN
  INSERT INTO event_outcomes (event_id, measurement_period, measurement_start_date, measurement_end_date, geography_type, geography_id, rent_change_pct, occupancy_change_pct, attribution_confidence, methodology_notes)
  VALUES (v_id, '12mo', '2026-01-01', '2027-01-01', 'submarket', 'downtown', 3.5, 1.5, 0.40, 'Forward projection (pre-actuals). ULI comparable: stadium-adjacent mixed-use districts show 3-5% effective rent lift within 12mo of Phase 1 opening. Confidence 40% until 2027 actuals available. Source: ARC/JLL 2025 Centennial Yards demand study.');
END IF;

END $$;
