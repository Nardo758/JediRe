-- Migration 008: rename playbook_backtest_results columns to match task spec naming
-- Each column is renamed independently so partial-migration states are tolerated.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='playbook_backtest_results' AND column_name='actual_value'
  ) THEN
    ALTER TABLE playbook_backtest_results RENAME COLUMN actual_value TO actual_delta;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='playbook_backtest_results' AND column_name='forecast_median'
  ) THEN
    ALTER TABLE playbook_backtest_results RENAME COLUMN forecast_median TO forecast_delta;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='playbook_backtest_results' AND column_name='hit_within_ci'
  ) THEN
    ALTER TABLE playbook_backtest_results RENAME COLUMN hit_within_ci TO within_ci;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='playbook_backtest_results' AND column_name='data_coverage'
  ) THEN
    ALTER TABLE playbook_backtest_results RENAME COLUMN data_coverage TO data_coverage_pct;
  END IF;
END $$;
