-- ============================================================================
-- NEURAL NETWORK HUB — agent_events + agent_workflow_runs
-- Migration: 20260426_neural_hub_agent_workflow_runs.sql
--
-- Backs the Neural Network Control Hub widget. Two tables:
--   agent_events         — every dispatched platform event (was being written
--                          by event-dispatcher.ts but the table didn't exist,
--                          so all writes were silently swallowed by its
--                          try/catch)
--   agent_workflow_runs  — one row per (event, agent) pair: pending → running
--                          → completed/failed, so the Hub can show "what's
--                          running right now" and "what just finished".
-- ============================================================================

-- ── agent_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR(64) NOT NULL,
  deal_id     UUID,
  user_id     UUID,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_created_at
  ON agent_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_event_type
  ON agent_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_deal_id
  ON agent_events(deal_id, created_at DESC) WHERE deal_id IS NOT NULL;

-- ── agent_workflow_runs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_workflow_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       VARCHAR(64) NOT NULL,
  event_id       UUID REFERENCES agent_events(id) ON DELETE SET NULL,
  deal_id        UUID,
  user_id        UUID,
  trigger_event  VARCHAR(64) NOT NULL,
  status         VARCHAR(16) NOT NULL DEFAULT 'pending',
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  result         JSONB,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_status
  ON agent_workflow_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_created_at
  ON agent_workflow_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_agent_id
  ON agent_workflow_runs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_event_id
  ON agent_workflow_runs(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_deal_id
  ON agent_workflow_runs(deal_id, created_at DESC) WHERE deal_id IS NOT NULL;
