-- Migration 038: Property Type Strategy Matrix
-- Add comprehensive investment strategy analysis for all property types
-- Supports 4 core strategies: Build-to-Sell, Flip, Rental, Airbnb/STR

-- ===== CREATE TABLES =====

-- Property Type Strategies table
CREATE TABLE IF NOT EXISTS property_type_strategies (
  id SERIAL PRIMARY KEY,
  type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
  strategy_name VARCHAR(50) NOT NULL, -- 'Build-to-Sell', 'Flip', 'Rental', 'Airbnb/STR'
  strength VARCHAR(20) NOT NULL, -- 'Strong', 'Moderate', 'Weak', 'Rare', 'N/A'
  notes TEXT,
  hold_period_min INTEGER, -- in months
  hold_period_max INTEGER, -- in months
  key_metrics JSONB, -- JSON array of key metrics for this strategy
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(type_id, strategy_name)
);

CREATE INDEX idx_property_type_strategies_type_id ON property_type_strategies(type_id);
CREATE INDEX idx_property_type_strategies_strategy_name ON property_type_strategies(strategy_name);
CREATE INDEX idx_property_type_strategies_strength ON property_type_strategies(strength);
CREATE INDEX idx_property_type_strategies_is_primary ON property_type_strategies(is_primary);

-- ===== SEED STRATEGY DATA =====

-- Helper function to insert strategy
CREATE OR REPLACE FUNCTION insert_strategy(
  p_type_key VARCHAR,
  p_strategy_name VARCHAR,
  p_strength VARCHAR,
  p_notes TEXT,
  p_hold_min INTEGER,
  p_hold_max INTEGER,
  p_metrics JSONB,
  p_is_primary BOOLEAN DEFAULT false,
  p_sort_order INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO property_type_strategies (
    type_id, strategy_name, strength, notes, 
    hold_period_min, hold_period_max, key_metrics, 
    is_primary, sort_order
  )
  SELECT 
    pt.id, p_strategy_name, p_strength, p_notes,
    p_hold_min, p_hold_max, p_metrics,
    p_is_primary, p_sort_order
  FROM property_types pt
  WHERE pt.type_key = p_type_key;
END;
$$ LANGUAGE plpgsql;

-- ===== RESIDENTIAL STRATEGIES =====

-- Single-Family Homes
PERFORM insert_strategy('single_family', 'Build-to-Sell', 'Strong', 
  'New construction or major renovation for immediate sale. High demand in suburban markets.',
  12, 24, '["Sale Price/SF", "Construction Cost/SF", "Gross Margin %"]'::jsonb, false, 1);
PERFORM insert_strategy('single_family', 'Flip', 'Strong',
  'Short-term cosmetic/medium renovations. Fast turnover, strong returns in appreciating markets.',
  3, 9, '["Purchase Price", "Renovation Cost", "ARV", "ROI %"]'::jsonb, true, 2);
PERFORM insert_strategy('single_family', 'Rental', 'Strong',
  'Long-term buy-and-hold. Stable cash flow, appreciation, tax benefits.',
  60, 360, '["Monthly Rent", "Cap Rate", "Cash-on-Cash", "Rent/SF"]'::jsonb, false, 3);
PERFORM insert_strategy('single_family', 'Airbnb/STR', 'Moderate',
  'Short-term rental in tourist/corporate areas. Higher returns but more management intensive.',
  12, 60, '["ADR", "Occupancy Rate", "RevPAR", "Monthly Revenue"]'::jsonb, false, 4);

-- Condominiums
PERFORM insert_strategy('condominiums', 'Build-to-Sell', 'Moderate',
  'Urban high-rise condo development. Strong in gateway cities, limited by HOA restrictions.',
  18, 36, '["Price/SF", "HOA Fees", "Amenity Premium"]'::jsonb, false, 1);
PERFORM insert_strategy('condominiums', 'Flip', 'Strong',
  'Interior upgrades in desirable buildings. Quick flips in hot urban markets.',
  3, 6, '["Purchase Price", "Renovation Cost", "Comparable Sales", "Days on Market"]'::jsonb, true, 2);
PERFORM insert_strategy('condominiums', 'Rental', 'Moderate',
  'Long-term rental, but HOA fees reduce cash flow. Better for appreciation play.',
  36, 120, '["Monthly Rent", "HOA Fees", "Cap Rate", "Net Cash Flow"]'::jsonb, false, 3);
PERFORM insert_strategy('condominiums', 'Airbnb/STR', 'Weak',
  'Many condos prohibit STR. Check HOA rules carefully before pursuing.',
  12, 60, '["ADR", "Occupancy", "HOA Restrictions"]'::jsonb, false, 4);

-- Townhouses
PERFORM insert_strategy('townhouses', 'Build-to-Sell', 'Strong',
  'Popular first-time homebuyer product. Strong demand in suburban infill.',
  12, 24, '["Sale Price", "Cost/SF", "Profit Margin"]'::jsonb, true, 1);
PERFORM insert_strategy('townhouses', 'Flip', 'Strong',
  'Renovation and flip similar to single-family. Good balance of price point and returns.',
  4, 8, '["Purchase Price", "Reno Budget", "ARV", "Profit"]'::jsonb, false, 2);
PERFORM insert_strategy('townhouses', 'Rental', 'Moderate',
  'Rental yields moderate due to HOA fees. Better appreciation than cash flow.',
  36, 120, '["Monthly Rent", "HOA Fees", "Cap Rate"]'::jsonb, false, 3);
PERFORM insert_strategy('townhouses', 'Airbnb/STR', 'Weak',
  'Limited by HOA restrictions in most townhome communities.',
  12, 60, '["ADR", "HOA Rules", "Occupancy"]'::jsonb, false, 4);

-- Duplexes / Triplexes / Quadplexes
PERFORM insert_strategy('duplex_triplex_quad', 'Build-to-Sell', 'Moderate',
  'Small multifamily development. Good for investors, smaller buyer pool than SFR.',
  12, 24, '["Price per Unit", "Construction Cost", "Cap Rate on Exit"]'::jsonb, false, 1);
PERFORM insert_strategy('duplex_triplex_quad', 'Flip', 'Moderate',
  'Value-add renovation. Good for investors but slower sales cycle.',
  4, 10, '["Purchase Price", "Per-Unit Reno", "Exit Cap Rate", "GRM"]'::jsonb, false, 2);
PERFORM insert_strategy('duplex_triplex_quad', 'Rental', 'Strong',
  'Excellent rental income. House hacking opportunity. Strong cash flow.',
  60, 240, '["Rent per Unit", "Total Monthly Rent", "Cap Rate", "Cash-on-Cash"]'::jsonb, true, 3);
PERFORM insert_strategy('duplex_triplex_quad', 'Airbnb/STR', 'Moderate',
  'Multi-unit STR can work in tourist areas. Requires active management.',
  24, 120, '["ADR per Unit", "Total Monthly Revenue", "Occupancy"]'::jsonb, false, 4);

-- Manufactured / Mobile Homes
PERFORM insert_strategy('manufactured_mobile', 'Build-to-Sell', 'Rare',
  'Limited new construction opportunities. Most are factory-built and placed.',
  6, 12, '["Sale Price", "Land Cost", "Setup Cost"]'::jsonb, false, 1);
PERFORM insert_strategy('manufactured_mobile', 'Flip', 'Weak',
  'Limited appreciation potential. Small flip margins. Niche market.',
  3, 6, '["Purchase Price", "Rehab Cost", "Resale Value"]'::jsonb, false, 2);
PERFORM insert_strategy('manufactured_mobile', 'Rental', 'Strong',
  'Strong cash flow in mobile home parks. Affordable housing demand.',
  36, 120, '["Monthly Lot Rent", "Unit Rent", "Cash Flow", "Cap Rate"]'::jsonb, true, 3);
PERFORM insert_strategy('manufactured_mobile', 'Airbnb/STR', 'Rare',
  'Very limited market. Mostly seasonal/RV park scenarios.',
  12, 36, '["Daily Rate", "Seasonal Occupancy"]'::jsonb, false, 4);

-- Co-ops
PERFORM insert_strategy('coops', 'Build-to-Sell', 'N/A',
  'Co-ops are existing structures with share ownership. No new construction.',
  NULL, NULL, '[]'::jsonb, false, 1);
PERFORM insert_strategy('coops', 'Flip', 'Weak',
  'Difficult to flip. Strict board approvals, limited buyer pool.',
  6, 18, '["Share Price", "Monthly Maintenance", "Board Approval Time"]'::jsonb, false, 2);
PERFORM insert_strategy('coops', 'Rental', 'Weak',
  'Most co-ops prohibit or heavily restrict rentals. Check bylaws.',
  36, 120, '["Monthly Rent", "Maintenance Fee", "Rental Restrictions"]'::jsonb, false, 3);
PERFORM insert_strategy('coops', 'Airbnb/STR', 'N/A',
  'Virtually all co-ops prohibit short-term rentals.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- ===== MULTIFAMILY STRATEGIES =====

-- Garden-Style Apartments
PERFORM insert_strategy('garden_apartments', 'Build-to-Sell', 'Strong',
  'New construction in suburban submarkets. Strong institutional buyer demand.',
  18, 36, '["Price per Unit", "Cost per Unit", "Exit Cap Rate"]'::jsonb, false, 1);
PERFORM insert_strategy('garden_apartments', 'Flip', 'Rare',
  'Multifamily typically not flipped in short-term. Value-add is longer play.',
  12, 24, '["Purchase Price per Unit", "Renovation per Unit", "Exit Cap"]'::jsonb, false, 2);
PERFORM insert_strategy('garden_apartments', 'Rental', 'Strong',
  'Core multifamily strategy. Stabilized NOI, institutional capital target.',
  36, 120, '["Rent per Unit", "Rent per SF", "Cap Rate", "Occupancy %"]'::jsonb, true, 3);
PERFORM insert_strategy('garden_apartments', 'Airbnb/STR', 'Weak',
  'Zoning and operational challenges for multifamily STR. Limited markets.',
  12, 60, '["ADR", "Blended Occupancy", "Operating Cost per Unit"]'::jsonb, false, 4);

-- Mid-Rise Apartments
PERFORM insert_strategy('midrise_apartments', 'Build-to-Sell', 'Strong',
  'Urban/suburban infill development. Strong demand from REITs and institutions.',
  24, 48, '["Price per Unit", "Construction Cost per SF", "Exit Cap Rate"]'::jsonb, false, 1);
PERFORM insert_strategy('midrise_apartments', 'Flip', 'Rare',
  'Not typical for mid-rise. Too large for quick flip, better as value-add hold.',
  24, 36, '["Purchase per Unit", "Renovation per Unit", "Exit Cap"]'::jsonb, false, 2);
PERFORM insert_strategy('midrise_apartments', 'Rental', 'Strong',
  'Prime institutional asset class. Core/Core+ hold strategy.',
  120, 240, '["Rent per Unit", "Rent per SF", "Cap Rate", "NOI", "Occupancy"]'::jsonb, true, 3);
PERFORM insert_strategy('midrise_apartments', 'Airbnb/STR', 'N/A',
  'Not feasible for conventional mid-rise multifamily. Operational and regulatory issues.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- High-Rise Apartments
PERFORM insert_strategy('highrise_apartments', 'Build-to-Sell', 'Strong',
  'Luxury high-rise development in gateway cities. Long development cycle, high-value exits.',
  36, 60, '["Price per Unit", "Price per SF", "Exit Cap Rate", "Amenity Premium"]'::jsonb, true, 1);
PERFORM insert_strategy('highrise_apartments', 'Flip', 'N/A',
  'Not applicable. High-rise is long-term institutional play.',
  NULL, NULL, '[]'::jsonb, false, 2);
PERFORM insert_strategy('highrise_apartments', 'Rental', 'Strong',
  'Core institutional hold. Gateway cities, strong demographics.',
  120, 360, '["Rent per Unit", "Rent per SF", "Cap Rate", "NOI Growth", "Occupancy"]'::jsonb, false, 3);
PERFORM insert_strategy('highrise_apartments', 'Airbnb/STR', 'N/A',
  'Not feasible. Regulatory, operational, and financing constraints.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Student Housing
PERFORM insert_strategy('student_housing', 'Build-to-Sell', 'Moderate',
  'Purpose-built student housing near universities. Niche buyer pool (REITs, specialized funds).',
  24, 48, '["Price per Bed", "Construction Cost per Bed", "Exit Cap Rate"]'::jsonb, false, 1);
PERFORM insert_strategy('student_housing', 'Flip', 'Weak',
  'Not typical. Long lease-up cycles and specialized operations.',
  18, 36, '["Purchase per Bed", "Renovation per Bed", "Lease-Up Time"]'::jsonb, false, 2);
PERFORM insert_strategy('student_housing', 'Rental', 'Strong',
  'Core strategy. Stable enrollment = stable demand. Parental guarantees reduce risk.',
  60, 180, '["Rent per Bed", "Occupancy %", "Pre-Lease %", "Cap Rate"]'::jsonb, true, 3);
PERFORM insert_strategy('student_housing', 'Airbnb/STR', 'Weak',
  'Summer sublet opportunities exist but operationally complex. Most units empty in summer.',
  9, 36, '["Academic Year Rate", "Summer Rate", "Blended Occupancy"]'::jsonb, false, 4);

-- Senior / Age-Restricted Housing
PERFORM insert_strategy('senior_housing', 'Build-to-Sell', 'Moderate',
  'Growing demand with aging demographics. Specialized buyers (healthcare REITs).',
  24, 48, '["Price per Unit", "Cost per Unit", "Exit Cap", "Acuity Level"]'::jsonb, false, 1);
PERFORM insert_strategy('senior_housing', 'Flip', 'Rare',
  'Not common. Specialized operations require long-term holds.',
  24, 48, '["Purchase per Unit", "Renovation per Unit", "Licensing"]'::jsonb, false, 2);
PERFORM insert_strategy('senior_housing', 'Rental', 'Strong',
  'Age-restricted and senior housing have stable, long-term tenancy.',
  60, 180, '["Rent per Unit", "Occupancy", "Average Age", "Length of Stay"]'::jsonb, true, 3);
PERFORM insert_strategy('senior_housing', 'Airbnb/STR', 'N/A',
  'Not applicable for senior/age-restricted housing.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Affordable / Workforce Housing
PERFORM insert_strategy('affordable_workforce', 'Build-to-Sell', 'Moderate',
  'Tax credit and workforce housing development. Mission-driven buyers, government programs.',
  24, 60, '["Price per Unit", "LIHTC Value", "Exit Cap", "Affordability Period"]'::jsonb, false, 1);
PERFORM insert_strategy('affordable_workforce', 'Flip', 'Rare',
  'Not typical. Restrictions and compliance requirements limit flipping.',
  24, 48, '["Purchase per Unit", "Renovation per Unit", "Compliance Cost"]'::jsonb, false, 2);
PERFORM insert_strategy('affordable_workforce', 'Rental', 'Strong',
  'Long-term hold for tax credits and mission-driven investors. Stable, subsidized income.',
  120, 360, '["Rent per Unit", "AMI %", "Cap Rate", "Tax Credit Value", "Occupancy"]'::jsonb, true, 3);
PERFORM insert_strategy('affordable_workforce', 'Airbnb/STR', 'N/A',
  'Not allowed under affordable housing programs.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Build-to-Rent Communities
PERFORM insert_strategy('build_to_rent', 'Build-to-Sell', 'Strong',
  'Purpose-built rental communities. Emerging institutional asset class.',
  24, 48, '["Price per Unit", "Construction Cost", "Rent Premiums", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('build_to_rent', 'Flip', 'Weak',
  'Not designed for flipping. Built for institutional long-term holds.',
  18, 36, '["Purchase per Unit", "Lease-Up Status", "Exit Cap"]'::jsonb, false, 2);
PERFORM insert_strategy('build_to_rent', 'Rental', 'Strong',
  'Core strategy. Single-family living with rental flexibility. Strong institutional demand.',
  60, 180, '["Rent per Unit", "Rent Premium vs Apartments", "Occupancy", "Cap Rate"]'::jsonb, false, 3);
PERFORM insert_strategy('build_to_rent', 'Airbnb/STR', 'Weak',
  'HOA restrictions typically prohibit STR. Designed for long-term rentals.',
  12, 60, '["STR Restrictions", "HOA Rules"]'::jsonb, false, 4);

-- ===== COMMERCIAL (OFFICE) STRATEGIES =====

-- Office (Class A, B, C)
PERFORM insert_strategy('office_class_abc', 'Build-to-Sell', 'Strong',
  'Ground-up office development or major repositioning. Pre-lease critical for exit.',
  36, 84, '["Price per SF", "Construction Cost per SF", "Lease %", "Exit Cap", "WAL"]'::jsonb, true, 1);
PERFORM insert_strategy('office_class_abc', 'Flip', 'Weak',
  'Office is long-term hold asset. Lease-up cycles too slow for quick flip.',
  24, 48, '["Purchase per SF", "Tenant Improvement", "Lease-Up Time"]'::jsonb, false, 2);
PERFORM insert_strategy('office_class_abc', 'Rental', 'Strong',
  'Core office strategy. Triple-net or gross leases. Focus on credit tenants and WAL.',
  120, 240, '["Rent per SF", "Occupancy %", "WAL (Weighted Avg Lease)", "Cap Rate", "TI Allowance"]'::jsonb, false, 3);
PERFORM insert_strategy('office_class_abc', 'Airbnb/STR', 'N/A',
  'Not applicable to office buildings.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Medical Office Buildings
PERFORM insert_strategy('medical_office', 'Build-to-Sell', 'Strong',
  'Specialized medical office development near hospitals. Credit tenant demand.',
  24, 48, '["Price per SF", "Construction Cost per SF", "Proximity to Hospital", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('medical_office', 'Flip', 'Weak',
  'Not typical. Medical office requires long leases and tenant build-out.',
  24, 48, '["Purchase per SF", "Tenant Improvements", "Medical Licensing"]'::jsonb, false, 2);
PERFORM insert_strategy('medical_office', 'Rental', 'Strong',
  'Excellent long-term hold. Sticky tenants, specialized build-outs. Low turnover.',
  120, 360, '["Rent per SF", "Tenant Credit", "Lease Term", "Cap Rate", "Healthcare Proximity"]'::jsonb, true, 3);
PERFORM insert_strategy('medical_office', 'Airbnb/STR', 'N/A',
  'Not applicable to medical office.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Flex / Creative Office
PERFORM insert_strategy('flex_creative_office', 'Build-to-Sell', 'Moderate',
  'Adaptive reuse or new flex space. Strong in tech hubs and creative districts.',
  18, 36, '["Price per SF", "Conversion Cost", "Amenity Premium", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('flex_creative_office', 'Flip', 'Moderate',
  'Repositioning and lease-up can work. Shorter lease-up than traditional office.',
  12, 24, '["Purchase per SF", "Renovation per SF", "Lease Velocity"]'::jsonb, false, 2);
PERFORM insert_strategy('flex_creative_office', 'Rental', 'Strong',
  'Flexible terms, creative amenities. Popular with startups and tech companies.',
  60, 180, '["Rent per SF", "Amenity Premium", "Occupancy", "Average Lease Term"]'::jsonb, true, 3);
PERFORM insert_strategy('flex_creative_office', 'Airbnb/STR', 'Weak',
  'Some short-term office rental models exist but niche.',
  6, 36, '["Daily/Weekly Rate", "Coworking Competitors"]'::jsonb, false, 4);

-- Coworking Spaces
PERFORM insert_strategy('coworking', 'Build-to-Sell', 'Weak',
  'Limited buyer pool. Coworking is operational business, not pure real estate.',
  12, 36, '["Price per Desk", "Membership Base", "Revenue Multiple"]'::jsonb, false, 1);
PERFORM insert_strategy('coworking', 'Flip', 'Weak',
  'Not typical. Coworking is membership-based business model.',
  12, 24, '["Purchase Price", "Membership Growth", "Revenue Run Rate"]'::jsonb, false, 2);
PERFORM insert_strategy('coworking', 'Rental', 'Moderate',
  'Operational business more than real estate. Membership revenue model.',
  24, 84, '["Revenue per Desk", "Occupancy Rate", "Membership Count", "Churn Rate"]'::jsonb, true, 3);
PERFORM insert_strategy('coworking', 'Airbnb/STR', 'Moderate',
  'By nature, coworking is short-term flexible space. Similar to STR concept.',
  6, 60, '["Daily Pass Revenue", "Monthly Membership", "Hot Desk vs Dedicated"]'::jsonb, false, 4);

-- ===== RETAIL STRATEGIES =====

-- Strip Centers
PERFORM insert_strategy('strip_centers', 'Build-to-Sell', 'Moderate',
  'Small strip center development. Typically sold to local/regional investors.',
  18, 36, '["Price per SF", "Construction Cost per SF", "Anchor Tenant", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('strip_centers', 'Flip', 'Weak',
  'Retail is slow to lease. Flipping requires stabilized tenancy.',
  18, 36, '["Purchase per SF", "Lease-Up Cost", "Occupancy at Exit"]'::jsonb, false, 2);
PERFORM insert_strategy('strip_centers', 'Rental', 'Strong',
  'Core retail strategy. Focus on credit tenants, lease length, and traffic counts.',
  60, 240, '["Rent per SF", "Anchor Tenant Credit", "Occupancy %", "Cap Rate", "Traffic Count"]'::jsonb, true, 3);
PERFORM insert_strategy('strip_centers', 'Airbnb/STR', 'N/A',
  'Not applicable to retail properties.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Neighborhood Centers
PERFORM insert_strategy('neighborhood_centers', 'Build-to-Sell', 'Moderate',
  'Grocery-anchored centers. Institutional buyers seek stable, grocery-anchored assets.',
  24, 48, '["Price per SF", "Anchor Lease Term", "Exit Cap", "Population Density"]'::jsonb, false, 1);
PERFORM insert_strategy('neighborhood_centers', 'Flip', 'Weak',
  'Long lease-up cycles. Not suitable for quick flips.',
  24, 48, '["Purchase per SF", "Re-Tenanting Cost", "Anchor Credit"]'::jsonb, false, 2);
PERFORM insert_strategy('neighborhood_centers', 'Rental', 'Strong',
  'Grocery-anchored centers provide stable cash flow. Essential retail.',
  120, 360, '["Rent per SF", "Anchor Sales per SF", "Occupancy", "Cap Rate", "Co-Tenancy"]'::jsonb, true, 3);
PERFORM insert_strategy('neighborhood_centers', 'Airbnb/STR', 'N/A',
  'Not applicable to retail.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Power Centers
PERFORM insert_strategy('power_centers', 'Build-to-Sell', 'Moderate',
  'Big-box anchored development. Institutional and REIT buyers.',
  24, 48, '["Price per SF", "Anchor Tenant Credit", "Shadow Anchor", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('power_centers', 'Flip', 'Weak',
  'Not suitable for quick flips. Requires stabilized anchor tenants.',
  24, 48, '["Purchase per SF", "Re-Anchor Cost", "Lease-Up Time"]'::jsonb, false, 2);
PERFORM insert_strategy('power_centers', 'Rental', 'Strong',
  'Strong cash flow with credit anchors. Amazon-proof anchors (home improvement, grocery).',
  120, 360, '["Rent per SF", "Anchor Credit Rating", "Occupancy", "Cap Rate", "E-Commerce Risk"]'::jsonb, true, 3);
PERFORM insert_strategy('power_centers', 'Airbnb/STR', 'N/A',
  'Not applicable to retail.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Regional Malls
PERFORM insert_strategy('regional_malls', 'Build-to-Sell', 'Weak',
  'Very few new mall developments. Oversupply and e-commerce disruption.',
  48, 84, '["Price per SF", "Anchor Health", "Exit Cap", "Redevelopment Potential"]'::jsonb, false, 1);
PERFORM insert_strategy('regional_malls', 'Flip', 'Rare',
  'Not feasible. Malls require long-term capital and repositioning.',
  36, 72, '["Purchase per SF", "Redevelopment Cost", "Mixed-Use Conversion"]'::jsonb, false, 2);
PERFORM insert_strategy('regional_malls', 'Rental', 'Weak',
  'Declining asset class. E-commerce pressure. Focus on A-malls only.',
  120, 360, '["Sales per SF", "Occupancy Cost Ratio", "Anchor Health", "Foot Traffic"]'::jsonb, false, 3);
PERFORM insert_strategy('regional_malls', 'Airbnb/STR', 'N/A',
  'Not applicable to malls.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Single-Tenant Net Lease (NNN)
PERFORM insert_strategy('single_tenant_nnn', 'Build-to-Sell', 'Strong',
  'Build-to-suit for credit tenants. Pre-sold to 1031 buyers and NNN investors.',
  12, 24, '["Price per SF", "Cap Rate", "Tenant Credit", "Lease Term", "Rent Bumps"]'::jsonb, true, 1);
PERFORM insert_strategy('single_tenant_nnn', 'Flip', 'Weak',
  'NNN properties trade based on lease terms. Limited value-add flip opportunities.',
  12, 24, '["Purchase Cap Rate", "Exit Cap Rate", "Remaining Lease Term"]'::jsonb, false, 2);
PERFORM insert_strategy('single_tenant_nnn', 'Rental', 'Strong',
  'Passive income. Tenant pays all expenses. Long lease terms with credit tenants.',
  120, 360, '["Cap Rate", "Tenant Credit Rating", "Lease Term Remaining", "Rent Escalations"]'::jsonb, false, 3);
PERFORM insert_strategy('single_tenant_nnn', 'Airbnb/STR', 'N/A',
  'Not applicable to NNN retail.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Lifestyle Centers
PERFORM insert_strategy('lifestyle_centers', 'Build-to-Sell', 'Moderate',
  'Open-air upscale retail. Experiential retail focus. Institutional buyers.',
  24, 48, '["Price per SF", "Tenant Mix", "Co-Tenancy", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('lifestyle_centers', 'Flip', 'Weak',
  'Long lease-up and tenant mix curation required.',
  24, 48, '["Purchase per SF", "Re-Tenanting", "Experiential Mix"]'::jsonb, false, 2);
PERFORM insert_strategy('lifestyle_centers', 'Rental', 'Moderate',
  'Experiential retail and dining focus. Better insulated from e-commerce than traditional retail.',
  60, 240, '["Rent per SF", "Restaurant %", "Entertainment Mix", "Foot Traffic"]'::jsonb, true, 3);
PERFORM insert_strategy('lifestyle_centers', 'Airbnb/STR', 'N/A',
  'Not applicable to retail.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Outlet Centers
PERFORM insert_strategy('outlet_centers', 'Build-to-Sell', 'Weak',
  'Few new outlet developments. Highly competitive market.',
  36, 60, '["Price per SF", "Brand Mix", "Tourist Draw", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('outlet_centers', 'Flip', 'Rare',
  'Not typical. Specialized retail format requires long-term repositioning.',
  36, 60, '["Purchase per SF", "Brand Curation", "Tourism Access"]'::jsonb, false, 2);
PERFORM insert_strategy('outlet_centers', 'Rental', 'Moderate',
  'Destination shopping. Strong in tourist markets. Sales per SF and brand mix critical.',
  120, 360, '["Sales per SF", "Tourist Traffic", "Brand Strength", "Cap Rate"]'::jsonb, true, 3);
PERFORM insert_strategy('outlet_centers', 'Airbnb/STR', 'N/A',
  'Not applicable to retail.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- ===== INDUSTRIAL STRATEGIES =====

-- Warehouse / Distribution
PERFORM insert_strategy('warehouse_distribution', 'Build-to-Sell', 'Strong',
  'Spec warehouse development. Institutional demand. E-commerce tailwinds.',
  18, 36, '["Price per SF", "Clear Height", "Truck Doors", "Exit Cap", "Rail Access"]'::jsonb, true, 1);
PERFORM insert_strategy('warehouse_distribution', 'Flip', 'Weak',
  'Industrial flips less common. Better as value-add lease-up strategy.',
  12, 24, '["Purchase per SF", "Renovation per SF", "Lease-Up"]'::jsonb, false, 2);
PERFORM insert_strategy('warehouse_distribution', 'Rental', 'Strong',
  'Core industrial. E-commerce driving demand. Long lease terms, stable income.',
  60, 240, '["Rent per SF", "Clear Height", "Dock Doors", "Cap Rate", "Tenant Credit"]'::jsonb, false, 3);
PERFORM insert_strategy('warehouse_distribution', 'Airbnb/STR', 'N/A',
  'Not applicable to warehouse.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Fulfillment Centers
PERFORM insert_strategy('fulfillment_centers', 'Build-to-Sell', 'Strong',
  'Amazon effect driving demand. Large institutional transactions.',
  24, 48, '["Price per SF", "Automation-Ready", "Last-Mile vs Regional", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('fulfillment_centers', 'Flip', 'Rare',
  'Not typical. Large-scale assets require long-term capital.',
  18, 36, '["Purchase per SF", "Tenant Credit", "Lease Term"]'::jsonb, false, 2);
PERFORM insert_strategy('fulfillment_centers', 'Rental', 'Strong',
  'E-commerce backbone. Amazon, FedEx, UPS demand. High clear heights, automation.',
  120, 240, '["Rent per SF", "Clear Height", "Automation", "Tenant Credit", "Lease Term"]'::jsonb, false, 3);
PERFORM insert_strategy('fulfillment_centers', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Manufacturing Facilities
PERFORM insert_strategy('manufacturing', 'Build-to-Sell', 'Moderate',
  'Build-to-suit manufacturing. Tenant-specific improvements limit resale pool.',
  24, 48, '["Price per SF", "Specialized Equipment", "Power/Utilities", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('manufacturing', 'Flip', 'Weak',
  'Highly specialized. Tenant improvements make flipping difficult.',
  18, 36, '["Purchase per SF", "Decommissioning Cost", "Adaptive Reuse"]'::jsonb, false, 2);
PERFORM insert_strategy('manufacturing', 'Rental', 'Strong',
  'Long-term leases with credit manufacturing tenants. Tenant pays for specialized improvements.',
  120, 360, '["Rent per SF", "Tenant Credit", "Specialized Systems", "Lease Term"]'::jsonb, true, 3);
PERFORM insert_strategy('manufacturing', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Cold Storage
PERFORM insert_strategy('cold_storage', 'Build-to-Sell', 'Strong',
  'High-demand specialized industrial. Food supply chain critical infrastructure.',
  24, 48, '["Price per SF", "Temperature Zones", "Power Cost", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('cold_storage', 'Flip', 'Rare',
  'Highly specialized. Not suitable for flipping.',
  18, 36, '["Purchase per SF", "Temperature Systems", "Energy Cost"]'::jsonb, false, 2);
PERFORM insert_strategy('cold_storage', 'Rental', 'Strong',
  'Strong demand. Food distribution growth. High barriers to entry. Specialized tenants.',
  120, 240, '["Rent per SF", "Temperature Capability", "Tenant Credit", "Lease Term"]'::jsonb, false, 3);
PERFORM insert_strategy('cold_storage', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Data Centers
PERFORM insert_strategy('data_centers', 'Build-to-Sell', 'Strong',
  'Mission-critical infrastructure. REITs and tech companies as buyers.',
  24, 48, '["Price per MW", "Power Cost", "Fiber Connectivity", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('data_centers', 'Flip', 'Rare',
  'Highly specialized. Not suitable for flipping.',
  24, 48, '["Purchase Price", "Power Infrastructure", "Tenant Credit"]'::jsonb, false, 2);
PERFORM insert_strategy('data_centers', 'Rental', 'Strong',
  'Cloud computing demand. Sticky tenants. Power and connectivity critical.',
  120, 360, '["MRR per Rack", "Power Cost per MW", "Uptime SLA", "Tenant Credit"]'::jsonb, false, 3);
PERFORM insert_strategy('data_centers', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Flex Industrial
PERFORM insert_strategy('flex_industrial', 'Build-to-Sell', 'Moderate',
  'Flexible office/warehouse combination. Appeals to diverse tenant base.',
  18, 36, '["Price per SF", "Office %", "Warehouse Clear Height", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('flex_industrial', 'Flip', 'Moderate',
  'Some flip potential with tenant improvements and repositioning.',
  12, 24, '["Purchase per SF", "TI Cost", "Lease-Up"]'::jsonb, false, 2);
PERFORM insert_strategy('flex_industrial', 'Rental', 'Strong',
  'Flexible use attracts wide tenant base. Lower rents than pure office, higher than warehouse.',
  60, 180, '["Rent per SF", "Office/Warehouse Ratio", "Tenant Mix", "Cap Rate"]'::jsonb, true, 3);
PERFORM insert_strategy('flex_industrial', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Last-Mile Logistics
PERFORM insert_strategy('last_mile_logistics', 'Build-to-Sell', 'Strong',
  'Urban infill logistics. E-commerce last-mile delivery demand.',
  18, 36, '["Price per SF", "Urban Location", "Loading", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('last_mile_logistics', 'Flip', 'Weak',
  'Better as lease-up value-add play than quick flip.',
  12, 24, '["Purchase per SF", "Lease-Up", "Tenant Credit"]'::jsonb, false, 2);
PERFORM insert_strategy('last_mile_logistics', 'Rental', 'Strong',
  'Amazon, FedEx, UPS last-mile demand. Urban proximity premium.',
  60, 180, '["Rent per SF", "Urban Access", "Loading Capacity", "Tenant Credit"]'::jsonb, false, 3);
PERFORM insert_strategy('last_mile_logistics', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- ===== HOSPITALITY STRATEGIES =====

-- Limited-Service Hotels
PERFORM insert_strategy('limited_service_hotels', 'Build-to-Sell', 'Moderate',
  'Flag franchises (Hampton, Fairfield). Sold to local hotel operators.',
  18, 36, '["Price per Key", "RevPAR", "Flag", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('limited_service_hotels', 'Flip', 'Weak',
  'Hotels require operational expertise. Not typical flip play.',
  12, 24, '["Purchase per Key", "Renovation per Key", "RevPAR Growth"]'::jsonb, false, 2);
PERFORM insert_strategy('limited_service_hotels', 'Rental', 'Moderate',
  'Operationally intensive. Management company or owner-operated.',
  60, 180, '["RevPAR", "Occupancy", "ADR", "NOI Margin", "Flag"]'::jsonb, true, 3);
PERFORM insert_strategy('limited_service_hotels', 'Airbnb/STR', 'N/A',
  'Hotels already operate as short-term accommodations.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Full-Service Hotels
PERFORM insert_strategy('full_service_hotels', 'Build-to-Sell', 'Moderate',
  'Major flag brands (Marriott, Hilton). Sold to REITs or large operators.',
  24, 48, '["Price per Key", "Brand", "Meeting Space SF", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('full_service_hotels', 'Flip', 'Rare',
  'Not typical. Hotels are operational businesses requiring long holds.',
  18, 36, '["Purchase per Key", "Renovation per Key", "Brand Conversion"]'::jsonb, false, 2);
PERFORM insert_strategy('full_service_hotels', 'Rental', 'Moderate',
  'Third-party management typical. F&B and meeting space add complexity.',
  120, 240, '["RevPAR", "Total RevPAR", "NOI Margin", "Brand", "Market Segmentation"]'::jsonb, true, 3);
PERFORM insert_strategy('full_service_hotels', 'Airbnb/STR', 'N/A',
  'Hotels already operate as short-term accommodations.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Extended-Stay
PERFORM insert_strategy('extended_stay', 'Build-to-Sell', 'Moderate',
  'Extended Stay America, Residence Inn, etc. Stable demand.',
  18, 36, '["Price per Key", "RevPAR", "Average Length of Stay", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('extended_stay', 'Flip', 'Weak',
  'Operationally intensive. Not suitable for quick flips.',
  12, 24, '["Purchase per Key", "Renovation per Key", "Flag"]'::jsonb, false, 2);
PERFORM insert_strategy('extended_stay', 'Rental', 'Strong',
  'Lower operating costs than traditional hotels. Stable occupancy. Corporate demand.',
  60, 180, '["RevPAR", "Average Stay Length", "Occupancy", "Corporate %"]'::jsonb, true, 3);
PERFORM insert_strategy('extended_stay', 'Airbnb/STR', 'N/A',
  'Hotels already operate as short-term accommodations.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Resorts
PERFORM insert_strategy('resorts', 'Build-to-Sell', 'Weak',
  'Highly specialized. Limited buyer pool. Destination markets only.',
  36, 84, '["Price per Key", "Amenity Premium", "Destination Market", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('resorts', 'Flip', 'Rare',
  'Not suitable. Resorts require long-term repositioning and capital.',
  36, 72, '["Purchase per Key", "Repositioning Cost", "Brand"]'::jsonb, false, 2);
PERFORM insert_strategy('resorts', 'Rental', 'Moderate',
  'Destination markets. Seasonal occupancy. High CapEx. Amenity-driven.',
  120, 360, '["RevPAR", "Peak/Off-Peak Mix", "Amenity Revenue", "Brand"]'::jsonb, true, 3);
PERFORM insert_strategy('resorts', 'Airbnb/STR', 'N/A',
  'Resorts already operate as short-term accommodations.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Short-Term Rentals / Airbnb
PERFORM insert_strategy('short_term_rentals', 'Build-to-Sell', 'Weak',
  'STR portfolio sale. Limited buyer pool. Regulatory risk.',
  12, 24, '["Price per Unit", "Revenue Multiple", "Regulatory Risk"]'::jsonb, false, 1);
PERFORM insert_strategy('short_term_rentals', 'Flip', 'Moderate',
  'Buy and optimize STR operations for sale. Focus on proven markets.',
  6, 18, '["Purchase Price", "Design/Furnishing", "Revenue Growth"]'::jsonb, false, 2);
PERFORM insert_strategy('short_term_rentals', 'Rental', 'Weak',
  'Long-term rental not the goal for STR properties.',
  12, 60, '["Monthly LTR Rent vs STR Revenue"]'::jsonb, false, 3);
PERFORM insert_strategy('short_term_rentals', 'Airbnb/STR', 'Strong',
  'Core STR strategy. Tourism and corporate travel markets. Regulatory compliance critical.',
  12, 120, '["ADR", "Occupancy Rate", "RevPAR", "Monthly Revenue", "Regulation Compliance"]'::jsonb, true, 4);

-- ===== SPECIAL PURPOSE STRATEGIES =====

-- Self-Storage
PERFORM insert_strategy('self_storage', 'Build-to-Sell', 'Strong',
  'Recession-resistant. Strong institutional buyer demand. REITs active.',
  18, 36, '["Price per SF", "Occupancy at Stabilization", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('self_storage', 'Flip', 'Weak',
  'Long lease-up period (3-5 years to stabilization). Not suitable for flips.',
  24, 48, '["Purchase per SF", "Lease-Up Cost", "Occupancy"]'::jsonb, false, 2);
PERFORM insert_strategy('self_storage', 'Rental', 'Strong',
  'Recurring revenue, low operating costs, high margins. Excellent cash flow.',
  60, 240, '["Revenue per SF", "Occupancy %", "Rate per SF", "Operating Margin"]'::jsonb, false, 3);
PERFORM insert_strategy('self_storage', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Parking Structures / Lots
PERFORM insert_strategy('parking', 'Build-to-Sell', 'Moderate',
  'Urban infill parking. Value tied to adjacent development potential.',
  12, 36, '["Price per Space", "Urban Location", "Redevelopment Potential", "Exit Cap"]'::jsonb, false, 1);
PERFORM insert_strategy('parking', 'Flip', 'Weak',
  'Limited value-add beyond paving and striping. Better as land hold.',
  6, 18, '["Purchase per Space", "Improvement Cost", "Utilization"]'::jsonb, false, 2);
PERFORM insert_strategy('parking', 'Rental', 'Moderate',
  'Stable cash flow in urban areas. Low operating costs. Automated payment systems.',
  36, 180, '["Revenue per Space", "Utilization %", "Monthly vs Transient", "Operating Margin"]'::jsonb, true, 3);
PERFORM insert_strategy('parking', 'Airbnb/STR', 'Weak',
  'Some app-based hourly parking platforms exist (SpotHero, ParkWhiz).',
  12, 60, '["Hourly Rate", "Platform Revenue Share"]'::jsonb, false, 4);

-- Healthcare / Medical Facilities
PERFORM insert_strategy('healthcare_medical', 'Build-to-Sell', 'Moderate',
  'Specialized facilities (surgery centers, urgent care). Healthcare REIT buyers.',
  24, 48, '["Price per SF", "Healthcare License", "Exit Cap", "Tenant Credit"]'::jsonb, false, 1);
PERFORM insert_strategy('healthcare_medical', 'Flip', 'Rare',
  'Highly specialized build-outs. Not suitable for flipping.',
  24, 48, '["Purchase per SF", "Medical Equipment", "Licensing"]'::jsonb, false, 2);
PERFORM insert_strategy('healthcare_medical', 'Rental', 'Strong',
  'Sticky tenants, specialized build-outs. Long lease terms. Healthcare REITs.',
  120, 360, '["Rent per SF", "Tenant Credit", "License Type", "Hospital Proximity"]'::jsonb, true, 3);
PERFORM insert_strategy('healthcare_medical', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Life Sciences / Lab Space
PERFORM insert_strategy('life_sciences_lab', 'Build-to-Sell', 'Strong',
  'Biotech and pharma demand. Highly specialized. Premium pricing.',
  24, 48, '["Price per SF", "Lab Certification", "Power/HVAC", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('life_sciences_lab', 'Flip', 'Rare',
  'Extremely specialized. Not suitable for flipping.',
  24, 48, '["Purchase per SF", "Lab Systems", "Certification Cost"]'::jsonb, false, 2);
PERFORM insert_strategy('life_sciences_lab', 'Rental', 'Strong',
  'Biotech clusters (Boston, SF, San Diego). High barriers to entry. Premium rents.',
  120, 240, '["Rent per SF", "Lab Certification", "Tenant Credit", "Cluster Proximity"]'::jsonb, false, 3);
PERFORM insert_strategy('life_sciences_lab', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Entertainment Venues
PERFORM insert_strategy('entertainment_venues', 'Build-to-Sell', 'Weak',
  'Highly specialized. Limited buyer pool. Operational complexity.',
  24, 60, '["Price", "Revenue Multiple", "Location", "License"]'::jsonb, false, 1);
PERFORM insert_strategy('entertainment_venues', 'Flip', 'Rare',
  'Not typical. Operational business more than real estate.',
  18, 48, '["Purchase Price", "Renovation", "Revenue Run Rate"]'::jsonb, false, 2);
PERFORM insert_strategy('entertainment_venues', 'Rental', 'Weak',
  'Operationally intensive. Revenue-based, not rent-based.',
  60, 180, '["Revenue per Event", "Event Count", "Operating Margin"]'::jsonb, true, 3);
PERFORM insert_strategy('entertainment_venues', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Religious Properties
PERFORM insert_strategy('religious', 'Build-to-Sell', 'Weak',
  'Very limited market. Typically sold to other congregations.',
  12, 36, '["Purchase Price", "Seating Capacity", "Location"]'::jsonb, false, 1);
PERFORM insert_strategy('religious', 'Flip', 'Weak',
  'Adaptive reuse to residential/mixed-use. Historic preservation issues.',
  12, 36, '["Purchase Price", "Conversion Cost", "Zoning"]'::jsonb, false, 2);
PERFORM insert_strategy('religious', 'Rental', 'Weak',
  'Some rental to other denominations or community groups. Limited revenue.',
  24, 120, '["Monthly Rent", "Multi-Denomination Use"]'::jsonb, false, 3);
PERFORM insert_strategy('religious', 'Airbnb/STR', 'Rare',
  'Adaptive reuse to event space or unique lodging (church conversions).',
  12, 60, '["Event Revenue", "Unique Lodging Premium"]'::jsonb, false, 4);

-- Educational Facilities
PERFORM insert_strategy('educational', 'Build-to-Sell', 'Weak',
  'Limited buyer pool. Typically institutional or charter school buyers.',
  18, 48, '["Price per Student Capacity", "License", "Location"]'::jsonb, false, 1);
PERFORM insert_strategy('educational', 'Flip', 'Weak',
  'Adaptive reuse to office/residential. Zoning and renovation challenges.',
  18, 48, '["Purchase Price", "Conversion Cost", "Zoning"]'::jsonb, false, 2);
PERFORM insert_strategy('educational', 'Rental', 'Moderate',
  'Charter schools, trade schools, daycare. Long-term leases.',
  60, 240, '["Rent per SF", "Tenant Credit", "Student Capacity", "Parking"]'::jsonb, true, 3);
PERFORM insert_strategy('educational', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Gas Stations / Car Washes
PERFORM insert_strategy('gas_stations_car_washes', 'Build-to-Sell', 'Moderate',
  'Build-to-suit for major brands. NNN lease structure. 1031 buyer demand.',
  12, 24, '["Price", "Cap Rate", "Brand", "Lease Term"]'::jsonb, true, 1);
PERFORM insert_strategy('gas_stations_car_washes', 'Flip', 'Weak',
  'Environmental issues (USTs). Limited flip potential.',
  12, 24, '["Purchase Price", "Environmental Cleanup", "Brand"]'::jsonb, false, 2);
PERFORM insert_strategy('gas_stations_car_washes', 'Rental', 'Moderate',
  'NNN leases to major brands (Shell, BP, Chevron). Long lease terms.',
  120, 360, '["Cap Rate", "Brand", "Lease Term", "Environmental Status"]'::jsonb, false, 3);
PERFORM insert_strategy('gas_stations_car_washes', 'Airbnb/STR', 'N/A',
  'Not applicable.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- ===== LAND STRATEGIES =====

-- Raw / Undeveloped
PERFORM insert_strategy('raw_undeveloped', 'Build-to-Sell', 'Strong',
  'Entitlement and development. Sell to builder/developer.',
  24, 120, '["Sale Price per Acre", "Entitlement Value", "Density", "Exit Strategy"]'::jsonb, true, 1);
PERFORM insert_strategy('raw_undeveloped', 'Flip', 'Moderate',
  'Land banking and entitlement. Speculative. Hold for appreciation.',
  12, 60, '["Purchase per Acre", "Appreciation Rate", "Path of Growth"]'::jsonb, false, 2);
PERFORM insert_strategy('raw_undeveloped', 'Rental', 'Weak',
  'Lease for agriculture, solar, billboards. Low revenue.',
  12, 240, '["Lease Revenue per Acre", "Agricultural Use", "Billboard Revenue"]'::jsonb, false, 3);
PERFORM insert_strategy('raw_undeveloped', 'Airbnb/STR', 'Rare',
  'Glamping or RV sites in scenic areas. Very niche.',
  12, 60, '["Site Revenue", "Seasonal Demand", "Infrastructure Cost"]'::jsonb, false, 4);

-- Entitled / Approved
PERFORM insert_strategy('entitled_approved', 'Build-to-Sell', 'Strong',
  'Shovel-ready sites. Premium pricing. Sold to builders/developers.',
  12, 60, '["Price per Entitled Unit/SF", "Approval Status", "Impact Fees Paid"]'::jsonb, true, 1);
PERFORM insert_strategy('entitled_approved', 'Flip', 'Strong',
  'Entitlement adds significant value. Flip to builders.',
  6, 36, '["Purchase per Acre", "Entitlement Cost", "Exit Price per Unit"]'::jsonb, false, 2);
PERFORM insert_strategy('entitled_approved', 'Rental', 'Weak',
  'Hold for ground lease to developer or build yourself.',
  12, 120, '["Ground Lease Rate", "Development Timeline"]'::jsonb, false, 3);
PERFORM insert_strategy('entitled_approved', 'Airbnb/STR', 'N/A',
  'Not applicable to entitled land.',
  NULL, NULL, '[]'::jsonb, false, 4);

-- Agricultural
PERFORM insert_strategy('agricultural', 'Build-to-Sell', 'Moderate',
  'Farmland investment. Sell to farmers, investors, or developers (if rezone).',
  60, 240, '["Price per Acre", "Crop Revenue", "Water Rights", "Development Potential"]'::jsonb, false, 1);
PERFORM insert_strategy('agricultural', 'Flip', 'Weak',
  'Long-term appreciation play. Not quick flip.',
  36, 120, '["Purchase per Acre", "Rezoning Potential", "Path of Growth"]'::jsonb, false, 2);
PERFORM insert_strategy('agricultural', 'Rental', 'Strong',
  'Lease to farmers. Crop revenue. Stable, long-term income.',
  36, 360, '["Lease Revenue per Acre", "Crop Type", "Water Rights", "Soil Quality"]'::jsonb, true, 3);
PERFORM insert_strategy('agricultural', 'Airbnb/STR', 'Rare',
  'Agritourism, farm stays. Very niche market.',
  12, 60, '["Nightly Rate", "Seasonal Demand", "Agritourism Appeal"]'::jsonb, false, 4);

-- Infill Parcels
PERFORM insert_strategy('infill_parcels', 'Build-to-Sell', 'Strong',
  'Urban infill development. Sell to developers or build-to-suit.',
  12, 48, '["Price per SF", "Zoning", "Density", "Exit Strategy"]'::jsonb, true, 1);
PERFORM insert_strategy('infill_parcels', 'Flip', 'Strong',
  'Assemble parcels and flip to developers. Strong demand in urban markets.',
  6, 24, '["Purchase per SF", "Assembly Cost", "Developer Exit Price"]'::jsonb, false, 2);
PERFORM insert_strategy('infill_parcels', 'Rental', 'Moderate',
  'Interim use (parking, storage). Hold for development.',
  12, 120, '["Interim Revenue", "Development Timeline"]'::jsonb, false, 3);
PERFORM insert_strategy('infill_parcels', 'Airbnb/STR', 'Rare',
  'Temporary uses only. Not typical.',
  6, 36, '["Pop-Up Event Revenue"]'::jsonb, false, 4);

-- ===== MIXED-USE STRATEGIES =====

-- Vertical Mixed-Use
PERFORM insert_strategy('vertical_mixed_use', 'Build-to-Sell', 'Strong',
  'Urban towers with retail/office/residential. Institutional buyers.',
  36, 84, '["Price per SF Blended", "Residential Price per Unit", "Retail/Office Cap Rate"]'::jsonb, true, 1);
PERFORM insert_strategy('vertical_mixed_use', 'Flip', 'Rare',
  'Too large and complex for flipping. Long-term value-add holds only.',
  36, 72, '["Purchase Price", "Lease-Up Cost", "Blended NOI"]'::jsonb, false, 2);
PERFORM insert_strategy('vertical_mixed_use', 'Rental', 'Strong',
  'Diversified income streams. Retail + Office + Residential. Complex management.',
  120, 360, '["Blended Rent per SF", "Retail Cap Rate", "Residential Rent per Unit", "Office Occupancy"]'::jsonb, false, 3);
PERFORM insert_strategy('vertical_mixed_use', 'Airbnb/STR', 'Weak',
  'Residential component may allow STR in some markets. Check local regulations.',
  12, 60, '["Residential STR Potential", "Condo/Apartment Restrictions"]'::jsonb, false, 4);

-- Horizontal Mixed-Use
PERFORM insert_strategy('horizontal_mixed_use', 'Build-to-Sell', 'Strong',
  'Campus-style developments. Residential + Retail + Office in separate buildings.',
  36, 84, '["Price per Acre", "Blended Use", "Phasing", "Exit Cap"]'::jsonb, true, 1);
PERFORM insert_strategy('horizontal_mixed_use', 'Flip', 'Weak',
  'Too large for flipping. Long development and lease-up timelines.',
  36, 72, '["Purchase Price", "Phasing Strategy", "Partial Exit"]'::jsonb, false, 2);
PERFORM insert_strategy('horizontal_mixed_use', 'Rental', 'Strong',
  'Diversified income. Can sell phases separately to different buyer types.',
  120, 360, '["Blended NOI", "Retail Cap Rate", "Residential Rent", "Office Rent per SF"]'::jsonb, false, 3);
PERFORM insert_strategy('horizontal_mixed_use', 'Airbnb/STR', 'Weak',
  'Residential component may allow STR. Check master plan restrictions.',
  12, 60, '["Residential STR Potential", "Master Plan Restrictions"]'::jsonb, false, 4);

-- Live-Work Developments
PERFORM insert_strategy('live_work', 'Build-to-Sell', 'Moderate',
  'Niche product. Sold to investors or owner-occupants.',
  18, 36, '["Price per Unit", "Work Space SF", "Residential SF", "Zoning"]'::jsonb, false, 1);
PERFORM insert_strategy('live_work', 'Flip', 'Moderate',
  'Renovation and flip to artists/creative professionals. Niche market.',
  6, 18, '["Purchase Price", "Renovation Cost", "Target Buyer"]'::jsonb, false, 2);
PERFORM insert_strategy('live_work', 'Rental', 'Strong',
  'Rent to small business owners, artists, creatives. Premium for live-work setup.',
  36, 120, '["Monthly Rent", "Work Space Premium", "Tenant Type", "Occupancy"]'::jsonb, true, 3);
PERFORM insert_strategy('live_work', 'Airbnb/STR', 'Moderate',
  'Some markets allow STR. Work space adds unique appeal.',
  12, 60, '["ADR", "Work Space Appeal", "Creative Market Demand"]'::jsonb, false, 4);

-- Clean up helper function
DROP FUNCTION insert_strategy;

-- Create view for strategy summary
CREATE OR REPLACE VIEW property_type_strategy_summary AS
SELECT 
  pt.id AS property_type_id,
  pt.type_key,
  pt.display_name AS property_type_name,
  pt.category,
  COUNT(pts.id) AS strategy_count,
  SUM(CASE WHEN pts.is_primary THEN 1 ELSE 0 END) AS primary_strategy_count,
  json_agg(
    json_build_object(
      'strategy_name', pts.strategy_name,
      'strength', pts.strength,
      'is_primary', pts.is_primary,
      'hold_period', CASE 
        WHEN pts.hold_period_min IS NOT NULL AND pts.hold_period_max IS NOT NULL 
        THEN concat(pts.hold_period_min/12, '-', pts.hold_period_max/12, ' years')
        ELSE 'N/A'
      END
    ) ORDER BY pts.sort_order
  ) AS strategies
FROM property_types pt
LEFT JOIN property_type_strategies pts ON pt.id = pts.type_id
GROUP BY pt.id, pt.type_key, pt.display_name, pt.category
ORDER BY pt.category, pt.sort_order;

-- Add comments
COMMENT ON TABLE property_type_strategies IS 'Investment strategy matrix for all property types. Links strategies (Build-to-Sell, Flip, Rental, Airbnb/STR) to property types with strength ratings, hold periods, and key metrics.';
COMMENT ON COLUMN property_type_strategies.strength IS 'Strategy viability: Strong, Moderate, Weak, Rare, N/A';
COMMENT ON COLUMN property_type_strategies.hold_period_min IS 'Minimum hold period in months';
COMMENT ON COLUMN property_type_strategies.hold_period_max IS 'Maximum hold period in months';
COMMENT ON COLUMN property_type_strategies.key_metrics IS 'JSON array of key metrics for this property type + strategy combination (e.g., ["Cap Rate", "Rent/SF", "ADR"])';
COMMENT ON COLUMN property_type_strategies.is_primary IS 'Flag indicating if this is the primary/recommended strategy for this property type';

-- Summary stats
DO $$
DECLARE
  total_property_types INTEGER;
  total_strategies INTEGER;
  avg_strategies_per_type NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_property_types FROM property_types;
  SELECT COUNT(*) INTO total_strategies FROM property_type_strategies;
  SELECT AVG(strategy_count)::NUMERIC(10,2) INTO avg_strategies_per_type 
  FROM (SELECT COUNT(*) AS strategy_count FROM property_type_strategies GROUP BY type_id) AS counts;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Property Type Strategy Matrix Loaded';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Property Types: %', total_property_types;
  RAISE NOTICE 'Total Strategies: %', total_strategies;
  RAISE NOTICE 'Avg Strategies per Type: %', avg_strategies_per_type;
  RAISE NOTICE '========================================';
END $$;
