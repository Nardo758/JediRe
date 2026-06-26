-- Migration: deal_status_enum + lifecycle trigger
-- Phase 6 — Lifecycle State Machine
-- Date: 2026-07-15

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. CREATE ENUM TYPE
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_status') THEN
        CREATE TYPE deal_status AS ENUM (
            'PROSPECT',
            'UNDERWRITING',
            'UNDER_CONTRACT',
            'CLOSED_OWNED',
            'MONITORING',
            'DISPOSITION',
            'SOLD',
            'HISTORICAL_RECORD',
            'PASSED'
        );
    END IF;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ADD acquisition_date COLUMN (safe if Phase 1 already added it)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. ENRICH deal_lifecycle_events with reason column (from guard)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE deal_lifecycle_events
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. BACKFILL non-standard VARCHAR statuses → canonical enum values
--    Maps common legacy values that have accumulated in the free-text column.
--    Any remaining unknowns are promoted to PROSPECT (safe default).
-- ═════════════════════════════════════════════════════════════════════════════
UPDATE deals SET status = 'PROSPECT'      WHERE LOWER(status) IN ('prospect', 'lead', 'new');
UPDATE deals SET status = 'UNDERWRITING'  WHERE LOWER(status) IN ('active', 'screening', 'underwriting', 'analysis');
UPDATE deals SET status = 'UNDER_CONTRACT' WHERE LOWER(status) IN ('loi', 'due_diligence', 'closing', 'under_contract', 'contract');
UPDATE deals SET status = 'CLOSED_OWNED'  WHERE LOWER(status) IN ('portfolio', 'owned', 'closed', 'closed_won', 'won');
UPDATE deals SET status = 'MONITORING'    WHERE LOWER(status) IN ('monitoring', 'operations');
UPDATE deals SET status = 'DISPOSITION'   WHERE LOWER(status) IN ('disposition', 'listing', 'listed');
UPDATE deals SET status = 'SOLD'          WHERE LOWER(status) IN ('sold', 'exited');
UPDATE deals SET status = 'HISTORICAL_RECORD' WHERE LOWER(status) IN ('archived', 'historical_record', 'archive');
UPDATE deals SET status = 'PASSED'        WHERE LOWER(status) IN ('dead', 'passed', 'rejected', 'lost');

-- Safety net: any value that still doesn't match a canonical enum → PROSPECT
UPDATE deals SET status = 'PROSPECT'
WHERE status NOT IN (
    'PROSPECT', 'UNDERWRITING', 'UNDER_CONTRACT', 'CLOSED_OWNED',
    'MONITORING', 'DISPOSITION', 'SOLD', 'HISTORICAL_RECORD', 'PASSED'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. CONVERT deals.status from VARCHAR → deal_status ENUM
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE deals
  ALTER COLUMN status TYPE deal_status
  USING status::deal_status;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. TRIGGER FUNCTION: auto-log every status change on deals
--    Captures from_status, to_status, transitioned_at, and reason (from guard
--    via transaction-local session variable app.lifecycle_reason).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_log_deal_lifecycle_transition()
RETURNS TRIGGER AS $$
DECLARE
    transition_reason TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Read the guard-supplied reason set by the application in the same tx
        transition_reason := current_setting('app.lifecycle_reason', true);

        INSERT INTO deal_lifecycle_events (
            deal_id,
            from_status,
            to_status,
            transitioned_at,
            transitioned_by,
            reason,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status::text,
            NEW.status::text,
            NOW(),
            NULL,  -- transitioned_by is not available in trigger context; filled by app if needed
            transition_reason,
            jsonb_build_object(
                'source', 'auto_trigger',
                'trigger_name', 'trg_log_deal_lifecycle_transition'
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure idempotent trigger installation
DROP TRIGGER IF EXISTS trg_deal_lifecycle_transition ON deals;

CREATE TRIGGER trg_deal_lifecycle_transition
AFTER UPDATE ON deals
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION trg_log_deal_lifecycle_transition();

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. COMMENTS
-- ═════════════════════════════════════════════════════════════════════════════
COMMENT ON TYPE deal_status IS
  'Canonical deal lifecycle states per DEAL_LIFECYCLE_TIMELINE_ALIGNMENT_SPEC.md §1';

COMMENT ON COLUMN deals.acquisition_date IS
  'Date the deal transitioned into CLOSED_OWNED — actuals boundary starts here.';
