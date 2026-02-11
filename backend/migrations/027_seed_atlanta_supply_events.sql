-- Seed 10 Atlanta Construction Projects
-- Mix of permits, under construction, and delivered
-- Realistic project data for testing Supply Signal System

-- Note: Assumes Atlanta MSA = 1 from prior migrations
-- Using realistic Atlanta submarkets and coordinates

-- =====================================================
-- PERMITTED PROJECTS (5)
-- =====================================================

-- 1. The Meridian - Midtown (Luxury High-Rise)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  one_bed_units,
  two_bed_units,
  three_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'multifamily_permit_filed'),
  'The Meridian',
  'Mill Creek Residential',
  '1065 Peachtree St NE, Atlanta, GA 30309',
  385,
  385 * 0.60, -- 60% weight for permit
  85,
  245,
  55,
  2850.00,
  'luxury',
  '2026-01-15',
  '2027-09-01', -- 20 months to delivery
  'permitted',
  33.7849,
  -84.3850,
  1,
  'permit_database',
  85.0,
  '42-story luxury tower, rooftop pool, concierge service'
);

-- 2. Gwinnett Station Apartments (Workforce Housing)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  studio_units,
  one_bed_units,
  two_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'multifamily_permit_filed'),
  'Gwinnett Station Apartments',
  'Wood Partners',
  '2100 Satellite Blvd, Duluth, GA 30097',
  298,
  298 * 0.60,
  45,
  178,
  75,
  1450.00,
  'workforce',
  '2025-12-20',
  '2027-06-15',
  'permitted',
  33.9737,
  -84.1421,
  1,
  'permit_database',
  80.0,
  'Near Gwinnett Place Mall, Amazon fulfillment center proximity'
);

-- 3. Cumberland Yards Phase 2 (Mixed-Use)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  one_bed_units,
  two_bed_units,
  three_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'mixed_use_permit_filed'),
  'Cumberland Yards Phase 2',
  'The Integral Group',
  '1200 Cumberland Pkwy SE, Atlanta, GA 30339',
  420,
  420 * 0.55, -- 55% weight for mixed-use permit
  120,
  240,
  60,
  1980.00,
  'market_rate',
  '2026-02-01',
  '2028-03-01', -- 25 months to delivery
  'permitted',
  33.8676,
  -84.4617,
  1,
  'permit_database',
  75.0,
  'Mixed-use development with retail and office space'
);

-- 4. Decatur Station Lofts (Affordable Housing)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  studio_units,
  one_bed_units,
  two_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'multifamily_permit_filed'),
  'Decatur Station Lofts',
  'Columbia Residential',
  '310 W Trinity Pl, Decatur, GA 30030',
  165,
  165 * 0.60,
  35,
  95,
  35,
  1125.00,
  'affordable',
  '2025-11-10',
  '2027-05-01',
  'permitted',
  33.7748,
  -84.2963,
  1,
  'permit_database',
  82.0,
  '60% affordable housing units, MARTA access'
);

-- 5. Sandy Springs Urban Village (Market Rate)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  one_bed_units,
  two_bed_units,
  three_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'multifamily_permit_filed'),
  'Sandy Springs Urban Village',
  'Gables Residential',
  '6065 Roswell Rd, Sandy Springs, GA 30328',
  312,
  312 * 0.60,
  78,
  189,
  45,
  1785.00,
  'market_rate',
  '2026-01-25',
  '2027-10-15',
  'permitted',
  33.9304,
  -84.3733,
  1,
  'permit_database',
  80.0,
  'Walkable mixed-use area, near corporate offices'
);

-- =====================================================
-- UNDER CONSTRUCTION (3)
-- =====================================================

-- 6. West Midtown Square (Luxury)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  one_bed_units,
  two_bed_units,
  three_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'under_construction'),
  'West Midtown Square',
  'JPI',
  '1100 Huff Rd NW, Atlanta, GA 30318',
  275,
  275 * 0.90, -- 90% weight for under construction
  65,
  165,
  45,
  2450.00,
  'luxury',
  '2025-06-01', -- groundbreaking date
  '2027-03-15', -- 21 months to delivery
  'under_construction',
  33.7878,
  -84.4122,
  1,
  'news',
  90.0,
  'Near Westside Provisions District, tech hub proximity'
);

-- 7. Perimeter Center Plaza (Market Rate)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  one_bed_units,
  two_bed_units,
  three_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'under_construction'),
  'Perimeter Center Plaza',
  'Alliance Residential',
  '225 Perimeter Center Pkwy, Atlanta, GA 30346',
  342,
  342 * 0.90,
  92,
  205,
  45,
  1895.00,
  'market_rate',
  '2025-04-10',
  '2026-12-20', -- 20 months to delivery
  'under_construction',
  33.9297,
  -84.3467,
  1,
  'news',
  88.0,
  'Perimeter Mall area, State Farm campus nearby'
);

-- 8. Old Fourth Ward Commons (Workforce)
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  studio_units,
  one_bed_units,
  two_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'under_construction'),
  'Old Fourth Ward Commons',
  'The Allen Group',
  '470 Glen Iris Dr NE, Atlanta, GA 30308',
  198,
  198 * 0.90,
  42,
  128,
  28,
  1625.00,
  'workforce',
  '2025-08-15',
  '2027-04-01',
  'under_construction',
  33.7648,
  -84.3561,
  1,
  'news',
  85.0,
  'Near BeltLine, Ponce City Market walkable'
);

-- =====================================================
-- RECENTLY DELIVERED (2)
-- =====================================================

-- 9. Buckhead Heights (Luxury) - Delivered 8 months ago
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  one_bed_units,
  two_bed_units,
  three_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  actual_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'delivery'),
  'Buckhead Heights',
  'Sares Regis Group',
  '3478 Peachtree Rd NE, Atlanta, GA 30326',
  225,
  225 * 1.0, -- 100% weight for delivered
  55,
  145,
  25,
  2950.00,
  'luxury',
  '2023-03-01', -- original groundbreaking
  '2025-06-15',
  '2025-06-15', -- delivered on time
  'delivered',
  33.8398,
  -84.3633,
  1,
  'costar',
  95.0,
  'Currently 78% leased, 5 months into lease-up'
);

-- 10. Alpharetta Station (Market Rate) - Delivered 6 months ago
INSERT INTO supply_events (
  supply_event_type_id,
  project_name,
  developer,
  address,
  units,
  weighted_units,
  studio_units,
  one_bed_units,
  two_bed_units,
  avg_rent,
  price_tier,
  event_date,
  expected_delivery_date,
  actual_delivery_date,
  status,
  latitude,
  longitude,
  msa_id,
  source_type,
  data_source_confidence,
  notes
) VALUES (
  (SELECT id FROM supply_event_types WHERE event_type = 'delivery'),
  'Alpharetta Station',
  'AvalonBay Communities',
  '2375 North Point Pkwy, Alpharetta, GA 30022',
  289,
  289 * 1.0,
  58,
  187,
  44,
  1850.00,
  'market_rate',
  '2023-06-01',
  '2025-08-01',
  '2025-08-01',
  'delivered',
  34.0480,
  -84.2944,
  1,
  'costar',
  92.0,
  'Currently 85% leased, near Avalon shopping center'
);

-- =====================================================
-- SUMMARY STATS
-- =====================================================

-- Total Units by Status:
-- Permitted: 1,580 units (weighted: 948)
-- Under Construction: 815 units (weighted: 733.5)
-- Delivered (last 12mo): 514 units (weighted: 514)
-- TOTAL PIPELINE: 2,395 units (weighted: 1,681.5)

-- By Price Tier:
-- Affordable: 165 units (7%)
-- Workforce: 496 units (21%)
-- Market Rate: 1,363 units (57%)
-- Luxury: 885 units (37%)

-- By Location:
-- Midtown: 2 projects
-- Buckhead: 1 project
-- West Midtown: 1 project
-- Decatur: 1 project
-- Sandy Springs: 1 project
-- Perimeter: 1 project
-- Cumberland: 1 project
-- Gwinnett: 1 project
-- Alpharetta: 1 project
-- Old Fourth Ward: 1 project
