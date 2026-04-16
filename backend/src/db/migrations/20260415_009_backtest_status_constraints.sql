-- Migration 009: add CHECK constraints for status columns in backtest tables
-- playbook_backtest_results.status: 'evaluated' | 'insufficient_data' (spec-defined values only)
-- regime_shift_alerts.status:       'open' | 'acknowledged'

DO $$ BEGIN
  -- Drop first to allow idempotent re-application with corrected allowed values
  ALTER TABLE playbook_backtest_results DROP CONSTRAINT IF EXISTS chk_pbr_status;
  ALTER TABLE playbook_backtest_results
    ADD CONSTRAINT chk_pbr_status CHECK (status IN ('evaluated', 'insufficient_data'));

  ALTER TABLE regime_shift_alerts DROP CONSTRAINT IF EXISTS chk_rsa_status;
  ALTER TABLE regime_shift_alerts
    ADD CONSTRAINT chk_rsa_status CHECK (status IN ('open', 'acknowledged'));
END $$;
