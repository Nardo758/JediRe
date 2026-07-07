-- F-P1 / B7: Drop four deal_assumptions scalar columns retired in the Phase 2B dispatch.
--
-- Columns removed:
--   rent_growth_yr1   → repointed to year1 JSONB (fetch_assumptions, proforma-adjustment,
--                        roadmap-engine, cashflow.postprocess)
--   noi_stabilized    → repointed to year1 JSONB (cashflow.postprocess step 3 removed)
--   irr_levered       → zero active SELECT readers (metrics live in snapshot JSON)
--   equity_multiple   → zero active SELECT readers (metrics live in snapshot JSON)
--
-- v_deal_summary references irr_levered and equity_multiple.  Drop and recreate without them.

-- Step 1: Drop the dependent view.
DROP VIEW IF EXISTS v_deal_summary;

-- Step 2: Drop the retired scalar columns.
ALTER TABLE deal_assumptions
  DROP COLUMN IF EXISTS rent_growth_yr1,
  DROP COLUMN IF EXISTS noi_stabilized,
  DROP COLUMN IF EXISTS irr_levered,
  DROP COLUMN IF EXISTS equity_multiple;

-- Step 3: Recreate v_deal_summary without the retired columns.
--   irr / equity_multiple metrics are available in deal_agent_underwriting_snapshots.proforma_json.
CREATE VIEW v_deal_summary AS
  SELECT
    d.id,
    d.name,
    d.development_type,
    d.target_units,
    d.budget,
    p.lot_size_acres,
    p.zoning_code,
    p.max_units               AS zoning_max_units,
    a.land_cost,
    a.tdc,
    a.tdc_per_unit,
    a.avg_rent_per_unit,
    a.exit_cap,
    a.yield_on_cost,
    m.submarket_name,
    m.comp_avg_rent,
    m.submarket_occupancy
  FROM deals d
  LEFT JOIN deal_properties dp ON dp.deal_id = d.id
  LEFT JOIN properties p       ON p.id = dp.property_id
  LEFT JOIN deal_assumptions a ON a.deal_id = d.id
  LEFT JOIN deal_market_data m ON m.deal_id = d.id;
