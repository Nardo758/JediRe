-- DL-192: relabel the legacy congestion-based rows of C_TRAFFIC_GROWTH_INDEX.
--
-- NOT a migration. It is deliberately outside the migrations folders so it
-- never runs at server start. Run it by hand, once, after the DL-192 change
-- is deployed and after Leon approves it.
--
-- What it does
--   The old TrafficGrowthIndexService wrote (factor − 1) × 100 under
--   C_TRAFFIC_GROWTH_INDEX, where factor is Google's travel-time ratio. Those
--   rows are congestion readings, not growth. This script moves them to
--   C_TRAFFIC_CONGESTION_INDEX and converts the value back to the ratio.
--   Rows written by DerivedMetricsService (source = 'derived') are untouched.
--
-- Step 1 — look first. Expect only the two legacy sources below.
SELECT geography_type, source, COUNT(*) AS row_count,
       MIN(period_date) AS first_date, MAX(period_date) AS last_date
FROM metric_time_series
WHERE metric_id = 'C_TRAFFIC_GROWTH_INDEX'
GROUP BY geography_type, source
ORDER BY geography_type, source;

-- Step 2 — relabel inside one transaction. Review the counts, then COMMIT or ROLLBACK.
BEGIN;

-- A congestion row may already exist for the same place and day (written by
-- the new service). Keep the new one and drop the legacy duplicate.
DELETE FROM metric_time_series legacy
USING metric_time_series current_row
WHERE legacy.metric_id = 'C_TRAFFIC_GROWTH_INDEX'
  AND legacy.source LIKE 'Google Realtime + DOT AADT%'
  AND current_row.metric_id = 'C_TRAFFIC_CONGESTION_INDEX'
  AND current_row.geography_type = legacy.geography_type
  AND current_row.geography_id = legacy.geography_id
  AND current_row.period_date = legacy.period_date;

UPDATE metric_time_series
SET metric_id = 'C_TRAFFIC_CONGESTION_INDEX',
    value = ROUND((1 + value / 100.0)::numeric, 3),
    source = 'Google Directions travel-time ratio (relabelled from C_TRAFFIC_GROWTH_INDEX, DL-192)'
WHERE metric_id = 'C_TRAFFIC_GROWTH_INDEX'
  AND source LIKE 'Google Realtime + DOT AADT%';

-- Expect zero legacy rows left; 'derived' rows remain.
SELECT source, COUNT(*) AS remaining
FROM metric_time_series
WHERE metric_id = 'C_TRAFFIC_GROWTH_INDEX'
GROUP BY source;

-- COMMIT;
-- ROLLBACK;
