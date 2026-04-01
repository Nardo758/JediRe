ALTER TABLE metric_correlations
  ADD COLUMN IF NOT EXISTS observation_start DATE,
  ADD COLUMN IF NOT EXISTS observation_end DATE;

UPDATE metric_correlations
SET observation_start = computed_at - (window_months || ' months')::interval,
    observation_end = computed_at::date
WHERE observation_start IS NULL;
