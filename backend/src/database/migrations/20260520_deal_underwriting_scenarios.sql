-- Migration: deal_underwriting_scenarios
-- Date: 2026-05-20
-- Module: M40 Scenario Management — Phase 1 Foundation
-- Spec: Scenario Management Module Spec v1.0
--
-- NAMING NOTE: `deal_scenarios` is already used by the Bull/Base/Bear/Stress
-- financial scenario generation engine (030_scenario_generation.sql).
-- This table is a separate, orthogonal concept: named, attributed, versioned
-- underwriting states for `deal_assumptions.year1`.
--
-- Backward compat (Option A from spec Section 3.2):
--   deal_assumptions.year1 remains a trigger-maintained denormalization of
--   the active scenario's year1.  All existing code that reads from
--   deal_assumptions continues to work unchanged.
--
-- API path:  /api/v1/deals/:dealId/underwriting-scenarios

-- ── deal_underwriting_scenarios table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS deal_underwriting_scenarios (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                 UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Identity
  name                    TEXT        NOT NULL,
  description             TEXT,

  -- Attribution
  -- 'agent' = created by a cashflow agent run
  -- 'user'  = created manually by an operator
  created_by              TEXT        NOT NULL CHECK (created_by IN ('agent', 'user')),
  created_by_user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- Intentionally loose FK: agent_runs table name may vary across environments
  created_by_agent_run_id UUID,

  -- Lifecycle
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at             TIMESTAMPTZ,
  deleted_at              TIMESTAMPTZ,

  -- State
  is_active               BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Fork lineage — which scenario was this forked from?
  parent_id               UUID        REFERENCES deal_underwriting_scenarios(id) ON DELETE SET NULL,

  -- Reference to the agent run snapshot that originally produced this scenario's year1.
  -- Intentionally loose FK for same reason as created_by_agent_run_id.
  primary_snapshot_id     UUID,

  -- The scenario's self-contained year1 underwriting state.
  -- Each scenario is a complete copy — no pointer indirection.
  year1                   JSONB       NOT NULL DEFAULT '{}',

  -- Metadata
  tags                    TEXT[],
  notes                   TEXT
);

-- Enforce exactly one active scenario per deal at any time.
-- Activation is done via UPDATE ... SET is_active = TRUE; callers must
-- deactivate the prior active scenario in the same transaction.
CREATE UNIQUE INDEX IF NOT EXISTS udx_underwriting_scenarios_one_active
  ON deal_underwriting_scenarios(deal_id)
  WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_underwriting_scenarios_deal
  ON deal_underwriting_scenarios(deal_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_underwriting_scenarios_active
  ON deal_underwriting_scenarios(deal_id, is_active)
  WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_underwriting_scenarios_created
  ON deal_underwriting_scenarios(deal_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Backward-compatibility trigger ────────────────────────────────────────
-- When any active scenario's year1 is written (INSERT or UPDATE), mirror the
-- change to deal_assumptions.year1 so existing consumers remain unaware of
-- the scenario layer.  This is Option A from spec Section 3.2.
--
-- The trigger is a NO-OP when:
--   - The row being modified is NOT the active scenario  (is_active = FALSE)
--   - The row has been soft-deleted  (deleted_at IS NOT NULL)
-- In both cases no side-effect occurs; RETURN NEW exits immediately.

CREATE OR REPLACE FUNCTION sync_underwriting_scenario_to_deal_assumptions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE AND NEW.deleted_at IS NULL THEN
    UPDATE deal_assumptions
       SET year1      = NEW.year1,
           updated_at = NOW()
     WHERE deal_id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_underwriting_scenario ON deal_underwriting_scenarios;

CREATE TRIGGER trg_sync_underwriting_scenario
  AFTER INSERT OR UPDATE ON deal_underwriting_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_underwriting_scenario_to_deal_assumptions();

-- ── Data migration: bootstrap one scenario per existing deal ──────────────
-- Creates a single 'Initial Underwriting' active scenario from each deal's
-- current deal_assumptions.year1.  Idempotent: skips deals that already have
-- a scenario row.  The trigger fires for each row and writes year1 back to
-- deal_assumptions — which is a no-op since the value came from there.

INSERT INTO deal_underwriting_scenarios (
  deal_id,
  name,
  created_by,
  is_active,
  year1,
  created_at,
  updated_at
)
SELECT
  da.deal_id,
  'Initial Underwriting',
  'user',
  TRUE,
  COALESCE(da.year1, '{}'),
  COALESCE(da.updated_at, NOW()),
  NOW()
FROM deal_assumptions da
WHERE da.year1 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM deal_underwriting_scenarios ds
     WHERE ds.deal_id = da.deal_id
  );
