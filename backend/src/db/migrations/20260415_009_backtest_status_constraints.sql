-- Migration 009: add CHECK constraints for status columns in backtest tables

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='playbook_backtest_results' AND constraint_name='chk_pbr_status'
  ) THEN
    ALTER TABLE playbook_backtest_results
      ADD CONSTRAINT chk_pbr_status CHECK (status IN ('evaluated', 'insufficient_data', 'pending'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='regime_shift_alerts' AND constraint_name='chk_rsa_status'
  ) THEN
    ALTER TABLE regime_shift_alerts
      ADD CONSTRAINT chk_rsa_status CHECK (status IN ('open', 'acknowledged'));
  END IF;
END $$;
