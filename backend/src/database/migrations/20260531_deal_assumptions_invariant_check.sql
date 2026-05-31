-- invariant_check_result — formula consistency invariant check result from the Cashflow Agent
-- Block 7e: verifies pre-stab formula and at-stab formula agree at the boundary year (< 5% delta).
-- Shape: { status: 'PASSED'|'FAILED'|'SKIPPED', pre_stab_noi, stab_noi, delta_pct, reason }

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_assumptions' AND column_name = 'invariant_check_result'
  ) THEN
    ALTER TABLE deal_assumptions
      ADD COLUMN invariant_check_result JSONB;

    COMMENT ON COLUMN deal_assumptions.invariant_check_result IS
      'Cashflow Agent Block 7e invariant check result. '
      'Shape: { status: PASSED|FAILED|SKIPPED, pre_stab_noi: number|null, stab_noi: number|null, '
      'delta_pct: number|null, reason: string }. '
      'Written after each pipeline run alongside stabilization_year. '
      'Null until the agent has run at least once.';
  END IF;
END $$;
