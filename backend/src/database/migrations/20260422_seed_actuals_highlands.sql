-- Seed: Monthly actuals for any owned deal that has a linked property
-- Selects the first eligible deal (has a deal_properties entry) and inserts
-- 12 budget rows (May 2024 – Apr 2025) and 8 actual rows (May – Dec 2024)
-- plus 8 traffic_funnel rows.
-- Idempotent: all inserts use ON CONFLICT DO NOTHING.
-- Safe no-op if no eligible deal exists.

DO $$
DECLARE
  v_deal_id     UUID;
  v_property_id UUID;
BEGIN

  -- Discover the first deal that has a linked property
  SELECT dp.deal_id, dp.property_id
  INTO   v_deal_id, v_property_id
  FROM   deal_properties dp
  JOIN   deals d ON d.id = dp.deal_id
  WHERE  dp.property_id IS NOT NULL
  ORDER  BY d.created_at ASC
  LIMIT  1;

  IF v_deal_id IS NULL THEN
    RAISE NOTICE 'seed_actuals: no eligible deal+property found, skipping.';
    RETURN;
  END IF;

  RAISE NOTICE 'seed_actuals: seeding deal_id=%, property_id=%', v_deal_id, v_property_id;

  -- ── Budget / proforma rows (is_budget = true) ──────────────────────────
  INSERT INTO deal_monthly_actuals
    (deal_id, property_id, report_month, is_budget, is_proforma,
     occupied_units, total_units, occupancy_rate,
     gross_potential_rent, avg_effective_rent, effective_gross_income,
     noi, expenses,
     payroll, repairs_maintenance, utilities, marketing,
     admin_general, management_fee, real_estate_taxes, insurance, capex,
     data_source)
  VALUES
  (v_deal_id,v_property_id,'2024-05-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-06-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-07-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-08-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-09-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-10-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-11-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2024-12-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2025-01-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2025-02-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2025-03-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed'),
  (v_deal_id,v_property_id,'2025-04-01',true,false, 270,290,0.9310, 464000,1556,420480, 260697,159783, 48000,18000,14000,8000,9500,16819,32000,8000,5464, 'seed')
  ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO NOTHING;

  -- ── Actual rows (is_budget = false) ────────────────────────────────────
  INSERT INTO deal_monthly_actuals
    (deal_id, property_id, report_month, is_budget, is_proforma,
     occupied_units, total_units, occupancy_rate,
     gross_potential_rent, avg_effective_rent, effective_gross_income,
     noi, expenses,
     payroll, repairs_maintenance, utilities, marketing,
     admin_general, management_fee, real_estate_taxes, insurance, capex,
     data_source)
  VALUES
  (v_deal_id,v_property_id,'2024-05-01',false,false, 258,290,0.8897, 464000,1540,397320, 239600,157720, 47200,19400,14800,9200,10100,15893,30400,7800,2930, 'seed'),
  (v_deal_id,v_property_id,'2024-06-01',false,false, 264,290,0.9103, 464000,1558,411312, 251000,160312, 47800,18600,14500,8600,9800,16452,31200,8100,3260, 'seed'),
  (v_deal_id,v_property_id,'2024-07-01',false,false, 272,290,0.9379, 464000,1580,429760, 268500,161260, 48300,17900,14100,8100,9600,17190,31800,8300,3970, 'seed'),
  (v_deal_id,v_property_id,'2024-08-01',false,false, 275,290,0.9483, 464000,1602,440550, 280400,160150, 47900,17200,13900,7800,9400,17622,32200,8400,3628, 'seed'),
  (v_deal_id,v_property_id,'2024-09-01',false,false, 274,290,0.9448, 464000,1614,442236, 281900,160336, 48100,17500,14200,7600,9200,17689,32000,8300,3746, 'seed'),
  (v_deal_id,v_property_id,'2024-10-01',false,false, 277,290,0.9552, 464000,1629,451233, 290100,161133, 47600,16800,13800,7400,9100,18049,32400,8500,3484, 'seed'),
  (v_deal_id,v_property_id,'2024-11-01',false,false, 274,290,0.9448, 464000,1622,444828, 283200,161628, 48200,17300,14100,7700,9300,17793,32100,8400,3634, 'seed'),
  (v_deal_id,v_property_id,'2024-12-01',false,false, 271,290,0.9345, 464000,1618,438278, 276900,161378, 48500,17800,14400,8000,9500,17531,31900,8300,3448, 'seed')
  ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO NOTHING;

  -- ── Traffic funnel rows ────────────────────────────────────────────────
  INSERT INTO traffic_funnel
    (deal_id, period_start, period_end,
     website_visits, ils_clicks, phone_calls, walk_ins, total_leads,
     tours_scheduled, tours_completed, no_shows,
     applications, approved, leases_signed, move_ins,
     projected_leads, projected_move_ins,
     marketing_spend, source)
  VALUES
  (v_deal_id,'2024-05-01','2024-06-01', 2840,320,145,28,493, 118,98,20, 62,55,42,38, 440,32, 14200,'seed'),
  (v_deal_id,'2024-06-01','2024-07-01', 3100,355,158,31,544, 132,109,23, 70,63,51,47, 480,38, 15100,'seed'),
  (v_deal_id,'2024-07-01','2024-08-01', 3420,392,174,36,602, 148,122,26, 78,70,61,57, 520,44, 16400,'seed'),
  (v_deal_id,'2024-08-01','2024-09-01', 3680,418,187,39,644, 158,131,27, 83,75,66,62, 560,50, 17200,'seed'),
  (v_deal_id,'2024-09-01','2024-10-01', 3510,398,178,37,613, 150,124,26, 79,71,62,57, 540,46, 16600,'seed'),
  (v_deal_id,'2024-10-01','2024-11-01', 3240,362,163,33,558, 136,113,23, 72,65,56,53, 500,42, 15800,'seed'),
  (v_deal_id,'2024-11-01','2024-12-01', 2960,330,149,29,508, 121,100,21, 63,57,47,43, 460,36, 14800,'seed'),
  (v_deal_id,'2024-12-01','2025-01-01', 2680,298,134,25,457, 108,89,19, 56,50,41,37, 420,30, 13600,'seed')
  ON CONFLICT (deal_id, period_start) DO NOTHING;

END $$;
