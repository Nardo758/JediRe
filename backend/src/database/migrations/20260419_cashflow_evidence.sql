-- Migration: cashflow_evidence_system
-- Date: 2026-04-19
-- Description: Creates underwriting_evidence and deal_underwriting_snapshots tables,
--              and adds prompt_type discriminator to prompt_versions.

-- ── underwriting_evidence ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS underwriting_evidence (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  agent_run_id     UUID        REFERENCES agent_runs(id),
  field_path       TEXT        NOT NULL,
  value_numeric    NUMERIC,
  value_text       TEXT,
  primary_tier     INTEGER     NOT NULL,
  data_points      JSONB       NOT NULL DEFAULT '[]',
  reasoning        TEXT        NOT NULL DEFAULT '',
  alternatives     JSONB       NOT NULL DEFAULT '[]',
  collision        JSONB,
  confidence       TEXT        NOT NULL CHECK (confidence IN ('high','medium','low')) DEFAULT 'medium',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_deal_field
  ON underwriting_evidence(deal_id, field_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_run
  ON underwriting_evidence(agent_run_id);

-- ── deal_underwriting_snapshots ───────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_underwriting_snapshots (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  agent_run_id     UUID        REFERENCES agent_runs(id),
  proforma_json    JSONB       NOT NULL DEFAULT '{}',
  evidence_map     JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_deal
  ON deal_underwriting_snapshots(deal_id, created_at DESC);

-- ── prompt_versions.prompt_type column ───────────────────────────
-- Adds a prompt_type discriminator so multiple active prompt rows
-- can exist for the cashflow agent (core + 5 deal-type variants).

ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS prompt_type TEXT NOT NULL DEFAULT 'core';

-- Drop the old unique index that prevented multiple active rows per agent
DROP INDEX IF EXISTS idx_prompt_versions_active;

-- LOAD-BEARING: this partial unique index enforces the invariant that at most
-- one prompt_versions row is active per (agent_id, prompt_type) at any time.
-- The agent runtime queries WHERE active = true and assumes exactly one result.
-- Removing this index would allow silent data corruption if seeders or operator
-- rollback tooling ever write two active rows simultaneously (e.g. INSERT before
-- deactivate — the operation-order bug that caused the zoning seeder crash,
-- May 2026).
-- See: TODO_F9_SIDE_DEBT.md SDB-02, backend/src/agents/seeds/_helpers.ts,
--      docs/architecture/ADR-003-cache-stamp-pattern.md.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_active
  ON prompt_versions(agent_id, prompt_type) WHERE (active = true);
