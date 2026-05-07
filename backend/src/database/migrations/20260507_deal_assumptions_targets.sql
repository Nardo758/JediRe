-- Migration: 20260507_deal_assumptions_targets
-- Description: Adds operator-set target and disposition assumption columns to deal_assumptions.
--
-- Items 3, 4, 5 from TODO_DEAL_TERMS_FOLLOWUP.md (May 2026):
--   target_irr / target_em / target_coc  — operator return hurdles (Item 3)
--   exit_strategy                         — Sale / Refinance / Hold    (Item 4)
--   selling_costs_pct                     — disposition cost %          (Item 5)
--
-- All nullable. NULL = operator hasn't set a value; consumers fall back to
-- platform defaults (e.g. 2% selling costs, no IRR hurdle).

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS target_irr       NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_em        NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_coc       NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_strategy    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS selling_costs_pct NUMERIC DEFAULT NULL;

COMMENT ON COLUMN deal_assumptions.target_irr        IS 'Operator target levered IRR (decimal, e.g. 0.18 = 18%). Null = no hurdle set.';
COMMENT ON COLUMN deal_assumptions.target_em         IS 'Operator target equity multiple (e.g. 2.0). Null = no hurdle set.';
COMMENT ON COLUMN deal_assumptions.target_coc        IS 'Operator target cash-on-cash Y1 (decimal, e.g. 0.08 = 8%). Null = no hurdle set.';
COMMENT ON COLUMN deal_assumptions.exit_strategy     IS 'Operator exit strategy: Sale | Refinance | Hold. Null = not set.';
COMMENT ON COLUMN deal_assumptions.selling_costs_pct IS 'Operator selling/disposition cost % (decimal, e.g. 0.02 = 2%). Null = platform default 2%.';
