/**
 * Seed Data: Atlanta Demand Events
 * Realistic employment and university events to test Demand Signal Implementation
 * 
 * Events:
 * 1. Amazon fulfillment center - 4,500 jobs (Gwinnett)
 * 2. Microsoft campus expansion - 2,200 jobs (Sandy Springs)
 * 3. Georgia Tech enrollment growth - 1,500 students (Midtown)
 * 4. Delta Air Lines layoffs - 800 jobs (negative demand, airport area)
 * 5. Google office opening - 1,200 jobs (Midtown)
 * 6. Emory University expansion - 900 students (Decatur)
 * 7. Siemens facility expansion - 650 jobs (Cumberland)
 * 8. Film studio opening - 400 jobs (West Midtown)
 */

-- Step 1: Create fake news events to link demand events to
-- (In production, these would come from the News Intelligence system)

INSERT INTO news_events (
  id, headline, body, source, source_url, published_at, location_raw, event_category, event_type,
  msa_id, submarket_id, geographic_tier, created_at
) VALUES
  -- 1. Amazon Gwinnett
  (
    '01000000-0000-0000-0000-000000000001'::uuid,
    'Amazon to Open Mega Fulfillment Center in Gwinnett, Hiring 4,500',
    'Amazon announced plans to build a 2.5 million sq ft fulfillment center in Gwinnett County, creating 4,500 permanent jobs with benefits. The facility will serve the Southeast region and is expected to open in Q3 2028.',
    'Atlanta Business Chronicle',
    'https://example.com/amazon-gwinnett',
    '2026-02-01 09:00:00',
    'Gwinnett County, GA',
    'employment',
    'facility_announcement',
    1, -- Atlanta MSA
    NULL,
    'metro',
    NOW()
  ),
  
  -- 2. Microsoft Sandy Springs
  (
    '02000000-0000-0000-0000-000000000002'::uuid,
    'Microsoft Expands Atlanta Campus, Adding 2,200 High-Tech Jobs',
    'Microsoft will invest $500M to expand its Sandy Springs campus, adding 2,200 software engineering and cloud computing positions over the next 18 months. Average salary: $145,000.',
    'WSJ',
    'https://example.com/microsoft-atlanta',
    '2026-01-15 14:30:00',
    'Sandy Springs, GA',
    'employment',
    'corporate_expansion',
    1,
    4, -- Sandy Springs submarket
    'area',
    NOW()
  ),
  
  -- 3. Georgia Tech Enrollment
  (
    '03000000-0000-0000-0000-000000000003'::uuid,
    'Georgia Tech Enrollment Surges with New Engineering Programs',
    'Georgia Tech announced 1,500 additional graduate students will enroll in new AI and cybersecurity programs starting Fall 2028. Most will relocate to Atlanta.',
    'Atlanta Journal-Constitution',
    'https://example.com/gatech-enrollment',
    '2026-01-20 10:00:00',
    'Midtown Atlanta',
    'education',
    'enrollment_increase',
    1,
    1, -- Midtown submarket
    'area',
    NOW()
  ),
  
  -- 4. Delta Layoffs (Negative Demand)
  (
    '04000000-0000-0000-0000-000000000004'::uuid,
    'Delta Air Lines Announces 800 Job Cuts Amid Restructuring',
    'Delta will cut 800 positions at Atlanta headquarters as part of operational efficiency measures. Layoffs effective Q2 2028.',
    'Reuters',
    'https://example.com/delta-layoffs',
    '2026-02-05 16:00:00',
    'Atlanta Airport Area',
    'employment',
    'layoffs',
    1,
    NULL,
    'metro',
    NOW()
  ),
  
  -- 5. Google Midtown
  (
    '05000000-0000-0000-0000-000000000005'::uuid,
    'Google Opens New Office in Midtown Atlanta, 1,200 Jobs',
    'Google will open a 10-floor office in Midtown, hiring 1,200 employees for sales, marketing, and engineering roles. Office opening Q4 2027.',
    'TechCrunch',
    'https://example.com/google-midtown',
    '2026-01-25 11:00:00',
    'Midtown Atlanta',
    'employment',
    'facility_announcement',
    1,
    1,
    'area',
    NOW()
  ),
  
  -- 6. Emory Expansion
  (
    '06000000-0000-0000-0000-000000000006'::uuid,
    'Emory University Adds 900 Students to Medical Programs',
    'Emory University will expand its medical and public health programs, adding 900 graduate students over the next 2 years.',
    'Atlanta Magazine',
    'https://example.com/emory-expansion',
    '2026-02-03 09:30:00',
    'Decatur, GA',
    'education',
    'enrollment_increase',
    1,
    5, -- Decatur submarket
    'area',
    NOW()
  ),
  
  -- 7. Siemens Cumberland
  (
    '07000000-0000-0000-0000-000000000007'::uuid,
    'Siemens to Expand Cumberland Facility, Add 650 Manufacturing Jobs',
    'Siemens will invest $180M to expand its Cumberland facility, adding 650 manufacturing and engineering positions.',
    'Manufacturing Today',
    'https://example.com/siemens-cumberland',
    '2026-01-28 13:00:00',
    'Cumberland/Galleria, Atlanta',
    'employment',
    'facility_expansion',
    1,
    7, -- Cumberland submarket
    'area',
    NOW()
  ),
  
  -- 8. Film Studio West Midtown
  (
    '08000000-0000-0000-0000-000000000008'::uuid,
    'Netflix Opens Production Studio in West Midtown, 400 Jobs',
    'Netflix will open a new production studio in West Midtown, creating 400 permanent jobs in production, post-production, and admin.',
    'Hollywood Reporter',
    'https://example.com/netflix-west-midtown',
    '2026-02-07 10:30:00',
    'West Midtown Atlanta',
    'employment',
    'facility_announcement',
    1,
    9, -- West Midtown submarket
    'area',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create demand events from these news events

-- Helper function to get demand event type ID
DO $$
DECLARE
  amazon_type_id INTEGER;
  microsoft_type_id INTEGER;
  gatech_type_id INTEGER;
  delta_type_id INTEGER;
  google_type_id INTEGER;
  emory_type_id INTEGER;
  siemens_type_id INTEGER;
  netflix_type_id INTEGER;
BEGIN
  -- Get type IDs
  SELECT id INTO amazon_type_id FROM demand_event_types WHERE category = 'employment' AND event_type = 'new_facility';
  SELECT id INTO microsoft_type_id FROM demand_event_types WHERE category = 'employment' AND event_type = 'job_creation_high_income';
  SELECT id INTO gatech_type_id FROM demand_event_types WHERE category = 'university' AND event_type = 'enrollment_increase';
  SELECT id INTO delta_type_id FROM demand_event_types WHERE category = 'employment' AND event_type = 'layoffs';
  SELECT id INTO google_type_id FROM demand_event_types WHERE category = 'employment' AND event_type = 'job_creation_high_income';
  SELECT id INTO emory_type_id FROM demand_event_types WHERE category = 'university' AND event_type = 'program_expansion';
  SELECT id INTO siemens_type_id FROM demand_event_types WHERE category = 'employment' AND event_type = 'facility_expansion';
  SELECT id INTO netflix_type_id FROM demand_event_types WHERE category = 'employment' AND event_type = 'job_creation';

  -- 1. Amazon Gwinnett - 4,500 jobs, standard income
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '01000000-0000-0000-0000-000000000001'::uuid,
    amazon_type_id,
    'Amazon to Open Mega Fulfillment Center in Gwinnett, Hiring 4,500',
    'https://example.com/amazon-gwinnett',
    '2026-02-01 09:00:00',
    4500, -- people
    'standard',
    5.00, -- 5% remote
    0.4200, -- new facility conversion rate
    0.85, -- 85% concentration (some workers already in area)
    1613.25, -- 4500 × 0.42 × 0.95 × 0.85 = 1613.25 units
    20.00, -- affordable %
    70.00, -- workforce %
    10.00, -- luxury %
    82.00, -- confidence score
    '{"source_reliability": 85, "data_completeness": 90, "geographic_specificity": 70, "time_freshness": 90}'::jsonb,
    1, NULL, 'metro'
  );

  -- 2. Microsoft Sandy Springs - 2,200 high-income tech jobs
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '02000000-0000-0000-0000-000000000002'::uuid,
    microsoft_type_id,
    'Microsoft Expands Atlanta Campus, Adding 2,200 High-Tech Jobs',
    'https://example.com/microsoft-atlanta',
    '2026-01-15 14:30:00',
    2200,
    'high', -- tech income
    20.00, -- 20% remote/hybrid
    0.5500, -- high-income conversion rate
    0.90, -- 90% concentration
    871.20, -- 2200 × 0.55 × 0.80 × 0.90 = 871.2 units
    5.00,
    40.00,
    55.00,
    88.00,
    '{"source_reliability": 90, "data_completeness": 95, "geographic_specificity": 90, "time_freshness": 90}'::jsonb,
    1, 4, 'area'
  );

  -- 3. Georgia Tech - 1,500 students
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '03000000-0000-0000-0000-000000000003'::uuid,
    gatech_type_id,
    'Georgia Tech Enrollment Surges with New Engineering Programs',
    'https://example.com/gatech-enrollment',
    '2026-01-20 10:00:00',
    1500,
    'standard',
    0.00, -- students need housing
    0.2750, -- student conversion rate
    0.95, -- high concentration near campus
    391.88, -- 1500 × 0.275 × 0.95 = 391.875 units
    40.00,
    60.00,
    0.00,
    80.00,
    '{"source_reliability": 85, "data_completeness": 85, "geographic_specificity": 90, "time_freshness": 90}'::jsonb,
    1, 1, 'area'
  );

  -- 4. Delta Layoffs - 800 jobs (NEGATIVE DEMAND)
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '04000000-0000-0000-0000-000000000004'::uuid,
    delta_type_id,
    'Delta Air Lines Announces 800 Job Cuts Amid Restructuring',
    'https://example.com/delta-layoffs',
    '2026-02-05 16:00:00',
    800,
    'standard',
    0.00,
    0.3500, -- layoff conversion rate
    1.00,
    -280.00, -- NEGATIVE: 800 × 0.35 × 1.0 (will be negated in projections)
    20.00,
    70.00,
    10.00,
    75.00,
    '{"source_reliability": 90, "data_completeness": 80, "geographic_specificity": 50, "time_freshness": 95}'::jsonb,
    1, NULL, 'metro'
  );

  -- 5. Google Midtown - 1,200 high-income jobs
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '05000000-0000-0000-0000-000000000005'::uuid,
    google_type_id,
    'Google Opens New Office in Midtown Atlanta, 1,200 Jobs',
    'https://example.com/google-midtown',
    '2026-01-25 11:00:00',
    1200,
    'high',
    25.00, -- 25% remote
    0.5500,
    0.88,
    435.60, -- 1200 × 0.55 × 0.75 × 0.88 = 435.6 units
    5.00,
    40.00,
    55.00,
    85.00,
    '{"source_reliability": 88, "data_completeness": 90, "geographic_specificity": 90, "time_freshness": 90}'::jsonb,
    1, 1, 'area'
  );

  -- 6. Emory - 900 students
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '06000000-0000-0000-0000-000000000006'::uuid,
    emory_type_id,
    'Emory University Adds 900 Students to Medical Programs',
    'https://example.com/emory-expansion',
    '2026-02-03 09:30:00',
    900,
    'standard',
    0.00,
    0.2500, -- program expansion conversion
    0.92,
    207.00, -- 900 × 0.25 × 0.92 = 207 units
    40.00,
    60.00,
    0.00,
    78.00,
    '{"source_reliability": 82, "data_completeness": 85, "geographic_specificity": 90, "time_freshness": 90}'::jsonb,
    1, 5, 'area'
  );

  -- 7. Siemens Cumberland - 650 manufacturing jobs
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '07000000-0000-0000-0000-000000000007'::uuid,
    siemens_type_id,
    'Siemens to Expand Cumberland Facility, Add 650 Manufacturing Jobs',
    'https://example.com/siemens-cumberland',
    '2026-01-28 13:00:00',
    650,
    'standard',
    2.00, -- minimal remote for manufacturing
    0.3500,
    0.80, -- 80% concentration
    176.96, -- 650 × 0.35 × 0.98 × 0.80 = 176.96 units
    20.00,
    70.00,
    10.00,
    80.00,
    '{"source_reliability": 85, "data_completeness": 88, "geographic_specificity": 90, "time_freshness": 90}'::jsonb,
    1, 7, 'area'
  );

  -- 8. Netflix West Midtown - 400 creative jobs
  INSERT INTO demand_events (
    id, news_event_id, demand_event_type_id, headline, source_url, published_at,
    people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
    total_units, affordable_pct, workforce_pct, luxury_pct,
    confidence_score, confidence_factors,
    msa_id, submarket_id, geographic_tier
  ) VALUES (
    gen_random_uuid(),
    '08000000-0000-0000-0000-000000000008'::uuid,
    netflix_type_id,
    'Netflix Opens Production Studio in West Midtown, 400 Jobs',
    'https://example.com/netflix-west-midtown',
    '2026-02-07 10:30:00',
    400,
    'high', -- entertainment industry pays well
    10.00, -- 10% remote
    0.5250, -- adjusted high-income rate
    0.85,
    159.98, -- 400 × 0.525 × 0.90 × 0.85 = 159.975 units
    5.00,
    45.00,
    50.00,
    82.00,
    '{"source_reliability": 85, "data_completeness": 85, "geographic_specificity": 90, "time_freshness": 95}'::jsonb,
    1, 9, 'area'
  );

END $$;

-- Step 3: Generate quarterly projections for each demand event
-- (This would normally be done automatically by the service, but we'll seed them for testing)

-- Note: The demand-signal.service.ts will auto-generate projections when createDemandEvent() is called.
-- For manual seeding, we can trigger the service or manually insert projections here.

-- Step 4: Calculate initial trade area demand aggregations
-- (Would be triggered by news agent integration or manually via API)

COMMENT ON TABLE demand_events IS 'Test data: 8 Atlanta demand events (7 positive, 1 negative)';

-- Output summary
SELECT 
  de.headline,
  de.people_count,
  de.total_units,
  det.category,
  det.demand_direction,
  de.confidence_score
FROM demand_events de
JOIN demand_event_types det ON det.id = de.demand_event_type_id
ORDER BY de.published_at DESC;
