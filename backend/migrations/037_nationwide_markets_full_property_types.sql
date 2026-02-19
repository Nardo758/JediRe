-- Migration 037: Expand to nationwide markets and full CRE property type taxonomy

-- Add category column to property_types
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Clear existing property types and replace with full taxonomy
DELETE FROM property_types;

-- ===== RESIDENTIAL =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('single_family', 'Single-Family Homes', 'Residential', 'Detached single-family residential properties', 'home', 1),
  ('condominiums', 'Condominiums', 'Residential', 'Individual condo units in shared buildings', 'building-2', 2),
  ('townhouses', 'Townhouses', 'Residential', 'Attached row-style residential units', 'house', 3),
  ('duplex_triplex_quad', 'Duplexes / Triplexes / Quadplexes', 'Residential', 'Small multi-unit residential (2-4 units)', 'columns', 4),
  ('manufactured_mobile', 'Manufactured / Mobile Homes', 'Residential', 'Factory-built and mobile home properties', 'caravan', 5),
  ('coops', 'Co-ops', 'Residential', 'Cooperative housing with shared ownership', 'users', 6);

-- ===== MULTIFAMILY =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('garden_apartments', 'Garden-Style Apartments', 'Multifamily', 'Low-rise garden-style apartment communities', 'trees', 10),
  ('midrise_apartments', 'Mid-Rise Apartments', 'Multifamily', 'Mid-rise apartment buildings (4-8 stories)', 'building', 11),
  ('highrise_apartments', 'High-Rise Apartments', 'Multifamily', 'High-rise apartment towers (9+ stories)', 'building-2', 12),
  ('student_housing', 'Student Housing', 'Multifamily', 'Purpose-built student accommodation', 'graduation-cap', 13),
  ('senior_housing', 'Senior / Age-Restricted Housing', 'Multifamily', 'Age-restricted and senior living communities', 'heart-handshake', 14),
  ('affordable_workforce', 'Affordable / Workforce Housing', 'Multifamily', 'Income-restricted and workforce housing', 'shield-check', 15),
  ('build_to_rent', 'Build-to-Rent Communities', 'Multifamily', 'Single-family rental communities built for rent', 'hammer', 16);

-- ===== COMMERCIAL =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('office_class_abc', 'Office (Class A, B, C)', 'Commercial', 'Traditional office space across all classes', 'briefcase', 20),
  ('medical_office', 'Medical Office Buildings', 'Commercial', 'Outpatient medical and dental office facilities', 'stethoscope', 21),
  ('flex_creative_office', 'Flex / Creative Office', 'Commercial', 'Flexible and creative workspace environments', 'palette', 22),
  ('coworking', 'Coworking Spaces', 'Commercial', 'Shared workspace and coworking facilities', 'users', 23);

-- ===== RETAIL =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('strip_centers', 'Strip Centers', 'Retail', 'Small inline retail strip shopping centers', 'store', 30),
  ('neighborhood_centers', 'Neighborhood Centers', 'Retail', 'Grocery-anchored neighborhood shopping centers', 'shopping-bag', 31),
  ('power_centers', 'Power Centers', 'Retail', 'Large-format big-box anchored centers', 'zap', 32),
  ('regional_malls', 'Regional Malls', 'Retail', 'Enclosed regional and super-regional malls', 'shopping-cart', 33),
  ('single_tenant_nnn', 'Single-Tenant Net Lease (NNN)', 'Retail', 'Freestanding single-tenant net lease retail', 'file-signature', 34),
  ('lifestyle_centers', 'Lifestyle Centers', 'Retail', 'Open-air upscale lifestyle retail centers', 'sparkles', 35),
  ('outlet_centers', 'Outlet Centers', 'Retail', 'Factory outlet and discount retail centers', 'tag', 36);

-- ===== INDUSTRIAL =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('warehouse_distribution', 'Warehouse / Distribution', 'Industrial', 'Bulk warehouse and distribution centers', 'warehouse', 40),
  ('fulfillment_centers', 'Fulfillment Centers', 'Industrial', 'E-commerce fulfillment and logistics hubs', 'package', 41),
  ('manufacturing', 'Manufacturing Facilities', 'Industrial', 'Production and manufacturing plants', 'factory', 42),
  ('cold_storage', 'Cold Storage', 'Industrial', 'Temperature-controlled storage and freezer facilities', 'snowflake', 43),
  ('data_centers', 'Data Centers', 'Industrial', 'Server farms and data hosting facilities', 'server', 44),
  ('flex_industrial', 'Flex Industrial', 'Industrial', 'Combined office and industrial flex space', 'layout', 45),
  ('last_mile_logistics', 'Last-Mile Logistics', 'Industrial', 'Urban last-mile delivery and sorting facilities', 'truck', 46);

-- ===== HOSPITALITY =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('limited_service_hotels', 'Limited-Service Hotels', 'Hospitality', 'Select-service and economy hotel properties', 'bed', 50),
  ('full_service_hotels', 'Full-Service Hotels', 'Hospitality', 'Full-service and luxury hotel properties', 'hotel', 51),
  ('extended_stay', 'Extended-Stay', 'Hospitality', 'Extended-stay and all-suite hotel properties', 'calendar-clock', 52),
  ('resorts', 'Resorts', 'Hospitality', 'Destination resort and spa properties', 'palm-tree', 53),
  ('short_term_rentals', 'Short-Term Rentals / Airbnb', 'Hospitality', 'Vacation rentals and short-term rental portfolios', 'key', 54);

-- ===== SPECIAL PURPOSE =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('self_storage', 'Self-Storage', 'Special Purpose', 'Self-storage facilities and climate-controlled units', 'archive', 60),
  ('parking', 'Parking Structures / Lots', 'Special Purpose', 'Parking garages, structures, and surface lots', 'car', 61),
  ('healthcare_medical', 'Healthcare / Medical Facilities', 'Special Purpose', 'Hospitals, clinics, and urgent care centers', 'heart-pulse', 62),
  ('life_sciences_lab', 'Life Sciences / Lab Space', 'Special Purpose', 'Research labs and life sciences facilities', 'flask-conical', 63),
  ('entertainment_venues', 'Entertainment Venues', 'Special Purpose', 'Theaters, arenas, and entertainment complexes', 'ticket', 64),
  ('religious', 'Religious Properties', 'Special Purpose', 'Churches, mosques, temples, and worship centers', 'church', 65),
  ('educational', 'Educational Facilities', 'Special Purpose', 'Schools, training centers, and campuses', 'school', 66),
  ('gas_stations_car_washes', 'Gas Stations / Car Washes', 'Special Purpose', 'Fuel stations, convenience stores, and car washes', 'fuel', 67);

-- ===== LAND =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('raw_undeveloped', 'Raw / Undeveloped', 'Land', 'Unimproved raw land parcels', 'mountain', 70),
  ('entitled_approved', 'Entitled / Approved', 'Land', 'Land with entitlements and development approvals', 'file-check', 71),
  ('agricultural', 'Agricultural', 'Land', 'Farmland and agricultural acreage', 'wheat', 72),
  ('infill_parcels', 'Infill Parcels', 'Land', 'Urban infill development sites', 'map-pin', 73);

-- ===== MIXED-USE =====
INSERT INTO property_types (type_key, display_name, category, description, icon, sort_order) VALUES
  ('vertical_mixed_use', 'Vertical Mixed-Use', 'Mixed-Use', 'Vertically stacked residential/retail/office towers', 'layers', 80),
  ('horizontal_mixed_use', 'Horizontal Mixed-Use', 'Mixed-Use', 'Campus-style mixed-use developments', 'layout-grid', 81),
  ('live_work', 'Live-Work Developments', 'Mixed-Use', 'Combined living and working space developments', 'home', 82);

-- ===== NATIONWIDE MARKETS =====
-- Clear existing and insert full nationwide list
DELETE FROM available_markets;

INSERT INTO available_markets (name, display_name, state, metro_area, coverage_status, property_count, data_freshness) VALUES
  -- SOUTHEAST (Active - primary coverage)
  ('atlanta', 'Atlanta', 'GA', 'Atlanta-Sandy Springs-Roswell', 'active', 3240, 'daily'),
  ('charlotte', 'Charlotte', 'NC', 'Charlotte-Concord-Gastonia', 'active', 1820, 'weekly'),
  ('nashville', 'Nashville', 'TN', 'Nashville-Davidson-Murfreesboro', 'active', 1650, 'weekly'),
  ('tampa', 'Tampa Bay', 'FL', 'Tampa-St. Petersburg-Clearwater', 'active', 2310, 'weekly'),
  ('raleigh', 'Raleigh-Durham', 'NC', 'Raleigh-Cary', 'active', 1280, 'weekly'),
  ('miami', 'Miami', 'FL', 'Miami-Fort Lauderdale-Pompano Beach', 'active', 3560, 'daily'),
  ('orlando', 'Orlando', 'FL', 'Orlando-Kissimmee-Sanford', 'active', 1740, 'weekly'),
  ('jacksonville', 'Jacksonville', 'FL', 'Jacksonville', 'active', 980, 'weekly'),
  ('charleston', 'Charleston', 'SC', 'Charleston-North Charleston', 'active', 720, 'weekly'),
  ('richmond', 'Richmond', 'VA', 'Richmond', 'active', 890, 'weekly'),
  ('birmingham', 'Birmingham', 'AL', 'Birmingham-Hoover', 'active', 640, 'weekly'),
  ('savannah', 'Savannah', 'GA', 'Savannah-Hinesville-Statesboro', 'active', 410, 'weekly'),
  ('greenville', 'Greenville', 'SC', 'Greenville-Anderson', 'active', 530, 'weekly'),
  ('knoxville', 'Knoxville', 'TN', 'Knoxville', 'active', 480, 'weekly'),
  ('memphis', 'Memphis', 'TN', 'Memphis', 'active', 720, 'weekly'),
  ('new_orleans', 'New Orleans', 'LA', 'New Orleans-Metairie', 'active', 860, 'weekly'),
  ('virginia_beach', 'Virginia Beach / Norfolk', 'VA', 'Virginia Beach-Norfolk-Newport News', 'active', 750, 'weekly'),

  -- TEXAS (Active)
  ('dallas', 'Dallas-Fort Worth', 'TX', 'Dallas-Fort Worth-Arlington', 'active', 4150, 'daily'),
  ('houston', 'Houston', 'TX', 'Houston-The Woodlands-Sugar Land', 'active', 3890, 'daily'),
  ('austin', 'Austin', 'TX', 'Austin-Round Rock-Georgetown', 'active', 1540, 'weekly'),
  ('san_antonio', 'San Antonio', 'TX', 'San Antonio-New Braunfels', 'active', 1320, 'weekly'),

  -- WEST (Active/Beta)
  ('phoenix', 'Phoenix', 'AZ', 'Phoenix-Mesa-Chandler', 'active', 2780, 'weekly'),
  ('denver', 'Denver', 'CO', 'Denver-Aurora-Lakewood', 'active', 1920, 'weekly'),
  ('las_vegas', 'Las Vegas', 'NV', 'Las Vegas-Henderson-Paradise', 'active', 1850, 'weekly'),
  ('los_angeles', 'Los Angeles', 'CA', 'Los Angeles-Long Beach-Anaheim', 'active', 5200, 'daily'),
  ('san_francisco', 'San Francisco Bay Area', 'CA', 'San Francisco-Oakland-Berkeley', 'active', 2890, 'daily'),
  ('san_diego', 'San Diego', 'CA', 'San Diego-Chula Vista-Carlsbad', 'active', 1680, 'weekly'),
  ('seattle', 'Seattle', 'WA', 'Seattle-Tacoma-Bellevue', 'active', 2340, 'daily'),
  ('portland', 'Portland', 'OR', 'Portland-Vancouver-Hillsboro', 'active', 1420, 'weekly'),
  ('salt_lake_city', 'Salt Lake City', 'UT', 'Salt Lake City-Provo-Orem', 'active', 1050, 'weekly'),
  ('boise', 'Boise', 'ID', 'Boise City-Nampa', 'beta', 520, 'weekly'),
  ('tucson', 'Tucson', 'AZ', 'Tucson', 'beta', 480, 'weekly'),
  ('sacramento', 'Sacramento', 'CA', 'Sacramento-Roseville-Folsom', 'active', 1120, 'weekly'),
  ('riverside', 'Inland Empire', 'CA', 'Riverside-San Bernardino-Ontario', 'active', 1540, 'weekly'),
  ('honolulu', 'Honolulu', 'HI', 'Urban Honolulu', 'beta', 380, 'monthly'),
  ('albuquerque', 'Albuquerque', 'NM', 'Albuquerque', 'beta', 420, 'monthly'),
  ('colorado_springs', 'Colorado Springs', 'CO', 'Colorado Springs', 'beta', 460, 'weekly'),
  ('reno', 'Reno', 'NV', 'Reno-Sparks', 'beta', 340, 'monthly'),

  -- MIDWEST
  ('chicago', 'Chicago', 'IL', 'Chicago-Naperville-Elgin', 'active', 4380, 'daily'),
  ('minneapolis', 'Minneapolis-St. Paul', 'MN', 'Minneapolis-St. Paul-Bloomington', 'active', 1760, 'weekly'),
  ('columbus', 'Columbus', 'OH', 'Columbus', 'active', 1180, 'weekly'),
  ('indianapolis', 'Indianapolis', 'IN', 'Indianapolis-Carmel-Anderson', 'active', 1090, 'weekly'),
  ('kansas_city', 'Kansas City', 'MO', 'Kansas City', 'active', 980, 'weekly'),
  ('st_louis', 'St. Louis', 'MO', 'St. Louis', 'active', 1150, 'weekly'),
  ('cincinnati', 'Cincinnati', 'OH', 'Cincinnati', 'active', 860, 'weekly'),
  ('detroit', 'Detroit', 'MI', 'Detroit-Warren-Dearborn', 'active', 1420, 'weekly'),
  ('milwaukee', 'Milwaukee', 'WI', 'Milwaukee-Waukesha', 'beta', 680, 'weekly'),
  ('cleveland', 'Cleveland', 'OH', 'Cleveland-Elyria', 'beta', 780, 'weekly'),
  ('des_moines', 'Des Moines', 'IA', 'Des Moines-West Des Moines', 'beta', 420, 'monthly'),
  ('omaha', 'Omaha', 'NE', 'Omaha-Council Bluffs', 'beta', 480, 'monthly'),
  ('madison', 'Madison', 'WI', 'Madison', 'beta', 350, 'monthly'),

  -- NORTHEAST
  ('new_york', 'New York', 'NY', 'New York-Newark-Jersey City', 'active', 6800, 'daily'),
  ('boston', 'Boston', 'MA', 'Boston-Cambridge-Newton', 'active', 2650, 'daily'),
  ('philadelphia', 'Philadelphia', 'PA', 'Philadelphia-Camden-Wilmington', 'active', 2180, 'weekly'),
  ('washington_dc', 'Washington D.C.', 'DC', 'Washington-Arlington-Alexandria', 'active', 3120, 'daily'),
  ('baltimore', 'Baltimore', 'MD', 'Baltimore-Columbia-Towson', 'active', 1280, 'weekly'),
  ('pittsburgh', 'Pittsburgh', 'PA', 'Pittsburgh', 'active', 890, 'weekly'),
  ('hartford', 'Hartford', 'CT', 'Hartford-East Hartford-Middletown', 'beta', 520, 'weekly'),
  ('providence', 'Providence', 'RI', 'Providence-Warwick', 'beta', 440, 'monthly'),
  ('albany', 'Albany', 'NY', 'Albany-Schenectady-Troy', 'beta', 380, 'monthly'),
  ('buffalo', 'Buffalo', 'NY', 'Buffalo-Cheektowaga', 'beta', 360, 'monthly')

ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  state = EXCLUDED.state,
  metro_area = EXCLUDED.metro_area,
  coverage_status = EXCLUDED.coverage_status,
  property_count = EXCLUDED.property_count,
  data_freshness = EXCLUDED.data_freshness;
