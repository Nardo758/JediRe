-- Migration 008: rename playbook_backtest_results columns to match task spec naming
-- actual_value→actual_delta, forecast_median→forecast_delta,
-- hit_within_ci→within_ci, data_coverage→data_coverage_pct

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='playbook_backtest_results' AND column_name='actual_value'
  ) THEN
    ALTER TABLE playbook_backtest_results RENAME COLUMN actual_value    TO actual_delta;
    ALTER TABLE playbook_backtest_results RENAME COLUMN forecast_median TO forecast_delta;
    ALTER TABLE playbook_backtest_results RENAME COLUMN hit_within_ci   TO within_ci;
    ALTER TABLE playbook_backtest_results RENAME COLUMN data_coverage   TO data_coverage_pct;
  END IF;
END $$;
