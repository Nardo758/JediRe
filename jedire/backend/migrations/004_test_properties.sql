-- Test Property Data for JEDI RE
-- 30 Atlanta properties with realistic coordinates, lease data, and market info

-- Sample properties across Atlanta neighborhoods
-- Coordinates are real Atlanta locations

INSERT INTO properties (
  address, city, state, zip, lat, lng,
  rent, beds, baths, sqft,
  building_class, year_built,
  lease_expiration_date, current_lease_amount,
  lease_start_date, renewal_status
) VALUES
-- Buckhead (high-end)
('100 Peachtree Hills Ave NE', 'Atlanta', 'GA', '30305', 33.8345, -84.3733, 2100, 2, 2, 1100, 'A', 2018, '2026-04-15', 1950, '2024-04-15', 'expiring'),
('250 Pharr Rd NE', 'Atlanta', 'GA', '30305', 33.8398, -84.3686, 2400, 2, 2, 1250, 'A', 2019, '2026-03-20', 2200, '2024-03-20', 'expiring'),
('150 E Paces Ferry Rd NE', 'Atlanta', 'GA', '30305', 33.8401, -84.3781, 2800, 3, 2, 1500, 'A+', 2020, '2026-07-10', 2600, '2024-07-10', 'renewed'),
('3475 Lenox Rd NE', 'Atlanta', 'GA', '30326', 33.8468, -84.3614, 2200, 2, 2, 1150, 'A', 2017, '2026-05-01', 2000, '2024-05-01', 'expiring'),
('3737 Peachtree Rd NE', 'Atlanta', 'GA', '30319', 33.8550, -84.3645, 2500, 3, 2, 1400, 'A', 2019, '2026-08-15', 2300, '2024-08-15', 'renewed'),

-- Midtown (mixed)
('1065 Peachtree St NE', 'Atlanta', 'GA', '30309', 33.7856, -84.3838, 1800, 1, 1, 850, 'B+', 2015, '2026-03-30', 1650, '2024-03-30', 'expiring'),
('1280 W Peachtree St NW', 'Atlanta', 'GA', '30309', 33.7889, -84.3889, 1900, 2, 2, 950, 'B+', 2016, '2026-04-05', 1750, '2024-04-05', 'expiring'),
('855 Peachtree St NE', 'Atlanta', 'GA', '30308', 33.7778, -84.3843, 2000, 2, 2, 1000, 'A-', 2018, '2026-06-20', 1850, '2024-06-20', 'expiring'),
('620 Peachtree St NE', 'Atlanta', 'GA', '30308', 33.7689, -84.3856, 1700, 1, 1, 800, 'B+', 2014, '2026-02-28', 1600, '2024-02-28', 'expiring'),
('1075 Peachtree Walk NE', 'Atlanta', 'GA', '30309', 33.7867, -84.3820, 2100, 2, 2, 1050, 'A-', 2017, '2026-05-10', 1950, '2024-05-10', 'expiring'),

-- Virginia Highland (trendy)
('1000 N Highland Ave NE', 'Atlanta', 'GA', '30306', 33.7845, -84.3534, 1600, 2, 1, 900, 'B', 2012, '2026-04-01', 1500, '2024-04-01', 'expiring'),
('850 Virginia Ave NE', 'Atlanta', 'GA', '30306', 33.7778, -84.3456, 1550, 2, 1, 875, 'B', 2013, '2026-03-15', 1450, '2024-03-15', 'expiring'),
('1100 Los Angeles Ave NE', 'Atlanta', 'GA', '30306', 33.7890, -84.3489, 1700, 2, 2, 950, 'B+', 2015, '2026-05-20', 1600, '2024-05-20', 'expiring'),
('950 Amsterdam Ave NE', 'Atlanta', 'GA', '30306', 33.7812, -84.3501, 1650, 2, 1, 925, 'B', 2014, '2026-06-01', 1550, '2024-06-01', 'renewed'),

-- Old Fourth Ward (up-and-coming)
('650 North Ave NE', 'Atlanta', 'GA', '30308', 33.7712, -84.3734, 1500, 1, 1, 750, 'B', 2016, '2026-02-15', 1400, '2024-02-15', 'expiring'),
('550 Boulevard NE', 'Atlanta', 'GA', '30308', 33.7689, -84.3623, 1550, 1, 1, 800, 'B', 2017, '2026-03-10', 1450, '2024-03-10', 'expiring'),
('880 Memorial Dr SE', 'Atlanta', 'GA', '30316', 33.7556, -84.3690, 1400, 1, 1, 700, 'C+', 2015, '2026-04-20', 1300, '2024-04-20', 'expiring'),
('770 Edgewood Ave NE', 'Atlanta', 'GA', '30307', 33.7623, -84.3601, 1600, 2, 1, 850, 'B', 2018, '2026-05-05', 1500, '2024-05-05', 'expiring'),

-- Downtown (mixed use)
('100 Marietta St NW', 'Atlanta', 'GA', '30303', 33.7590, -84.3923, 1350, 1, 1, 650, 'B-', 2010, '2026-02-20', 1250, '2024-02-20', 'expiring'),
('250 Piedmont Ave NE', 'Atlanta', 'GA', '30308', 33.7645, -84.3812, 1450, 1, 1, 700, 'B', 2012, '2026-03-25', 1350, '2024-03-25', 'expiring'),
('300 Peachtree St NE', 'Atlanta', 'GA', '30308', 33.7578, -84.3867, 1550, 2, 1, 850, 'B', 2014, '2026-04-30', 1450, '2024-04-30', 'expiring'),

-- West Midtown (industrial chic)
('1000 Howell Mill Rd NW', 'Atlanta', 'GA', '30318', 33.7845, -84.4123, 1750, 2, 2, 950, 'B+', 2016, '2026-05-15', 1650, '2024-05-15', 'expiring'),
('1100 Huff Rd NW', 'Atlanta', 'GA', '30318', 33.7889, -84.4178, 1800, 2, 2, 1000, 'B+', 2017, '2026-06-10', 1700, '2024-06-10', 'renewed'),
('850 Marietta St NW', 'Atlanta', 'GA', '30318', 33.7778, -84.4089, 1650, 1, 1, 850, 'B', 2015, '2026-03-05', 1550, '2024-03-05', 'expiring'),

-- East Atlanta (affordable)
('1200 Flat Shoals Ave SE', 'Atlanta', 'GA', '30316', 33.7345, -84.3456, 1200, 2, 1, 800, 'C+', 2013, '2026-02-10', 1100, '2024-02-10', 'expiring'),
('950 Glenwood Ave SE', 'Atlanta', 'GA', '30316', 33.7267, -84.3534, 1250, 2, 1, 825, 'C+', 2014, '2026-03-18', 1150, '2024-03-18', 'expiring'),
('1050 Memorial Dr SE', 'Atlanta', 'GA', '30317', 33.7445, -84.3389, 1300, 2, 1, 850, 'B-', 2015, '2026-04-12', 1200, '2024-04-12', 'expiring'),

-- Ponce Corridor (vibrant)
('850 Ponce De Leon Ave NE', 'Atlanta', 'GA', '30306', 33.7712, -84.3578, 1500, 1, 1, 750, 'B', 2015, '2026-05-25', 1400, '2024-05-25', 'expiring'),
('950 Ponce De Leon Ave NE', 'Atlanta', 'GA', '30306', 33.7734, -84.3545, 1600, 2, 1, 875, 'B', 2016, '2026-06-15', 1500, '2024-06-15', 'renewed'),
('750 Briarcliff Rd NE', 'Atlanta', 'GA', '30306', 33.7890, -84.3401, 1550, 2, 1, 850, 'B', 2014, '2026-04-08', 1450, '2024-04-08', 'expiring')

ON CONFLICT (address) DO UPDATE SET
  rent = EXCLUDED.rent,
  lease_expiration_date = EXCLUDED.lease_expiration_date,
  current_lease_amount = EXCLUDED.current_lease_amount,
  lease_start_date = EXCLUDED.lease_start_date,
  renewal_status = EXCLUDED.renewal_status;

-- Verify insert
SELECT 
  COUNT(*) as total_properties,
  COUNT(CASE WHEN lease_expiration_date IS NOT NULL THEN 1 END) as with_lease_data,
  COUNT(CASE WHEN lease_expiration_date < NOW() + INTERVAL '60 days' THEN 1 END) as expiring_soon
FROM properties 
WHERE city = 'Atlanta';

-- Sample query: Properties expiring in next 30 days
SELECT 
  address,
  rent,
  current_lease_amount,
  lease_expiration_date,
  DATE_PART('day', lease_expiration_date - NOW()) as days_until_expiration
FROM properties
WHERE lease_expiration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY lease_expiration_date;
