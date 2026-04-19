-- Migration 010: Agent Platform Foundation
-- Phase 1 of AGENT_PLATFORM_SPEC.md
-- Adds user_type column, agent service accounts, and all agent runtime tables.
-- Applied 2026-04-19 via executeSql during agent platform build.

-- ── users table extension ─────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'human'
    CHECK (user_type IN ('human', 'agent')),
  ADD COLUMN IF NOT EXISTS agent_metadata JSONB;

-- agent_metadata schema when user_type='agent':
-- {
--   "agent_id": "research",
--   "agent_version": "1.0.0",
--   "capabilities": ["read:all", "write:deal_context"]
-- }

CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);

-- ── Agent service account seeds ───────────────────────────────────────────────
-- Five Layer 1 agents only. MetricRecommendation and AgentOrchestrator do NOT
-- get service accounts — they are a service and a runtime component respectively.

INSERT INTO users (id, email, user_type, agent_metadata, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'research@agents.jediplatform.internal', 'agent',
   '{"agent_id":"research","agent_version":"1.0.0","capabilities":["read:all","write:deal_context"]}'::jsonb, NOW()),
  ('00000000-0000-0000-0000-000000000002', 'zoning@agents.jediplatform.internal', 'agent',
   '{"agent_id":"zoning","agent_version":"1.0.0","capabilities":["read:zoning","read:parcels","write:zoning_analysis"]}'::jsonb, NOW()),
  ('00000000-0000-0000-0000-000000000003', 'supply@agents.jediplatform.internal', 'agent',
   '{"agent_id":"supply","agent_version":"1.0.0","capabilities":["read:permits","read:costar","write:supply_analysis"]}'::jsonb, NOW()),
  ('00000000-0000-0000-0000-000000000004', 'cashflow@agents.jediplatform.internal', 'agent',
   '{"agent_id":"cashflow","agent_version":"1.0.0","capabilities":["read:financials","write:projections"]}'::jsonb, NOW()),
  ('00000000-0000-0000-0000-000000000005', 'commentary@agents.jediplatform.internal', 'agent',
   '{"agent_id":"commentary","agent_version":"1.0.0","capabilities":["read:market_data","read:economic","write:market_commentary"]}'::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET agent_metadata = EXCLUDED.agent_metadata;

-- ── agent_runs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  deal_id UUID,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('user', 'event', 'cron')),
  trigger_context JSONB,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','aborted','budget_exceeded')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error TEXT,
  tokens_in BIGINT DEFAULT 0,
  tokens_out BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_deal   ON agent_runs(deal_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent  ON agent_runs(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user   ON agent_runs(user_id, started_at DESC);

-- ── agent_run_steps ───────────────────────────────────────────────────────────
-- One row per tool call / prompt step within a run.

CREATE TABLE IF NOT EXISTS agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('prompt','tool_call','tool_result','output')),
  tool_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  tokens_in INTEGER,
  tokens_out INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_run_steps(agent_run_id, step_index);

-- ── prompt_versions ───────────────────────────────────────────────────────────
-- One active version per agent at any time. Rollbacks are a flag flip.

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  output_schema JSONB NOT NULL DEFAULT '{}',
  tools JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_active
  ON prompt_versions(agent_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent
  ON prompt_versions(agent_id, created_at DESC);

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Single unified table for human + agent + system actions.
-- Deal activity feed reads from: resource_type='deal' AND resource_id=:deal_id

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB,
  agent_run_id UUID REFERENCES agent_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_resource  ON audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON audit_log(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_agent_run ON audit_log(agent_run_id) WHERE agent_run_id IS NOT NULL;

-- ── market_commentary ─────────────────────────────────────────────────────────
-- Output target for the Commentary Agent. 24h cache via cache_expires_at.

CREATE TABLE IF NOT EXISTS market_commentary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('msa', 'submarket', 'property')),
  entity_id TEXT NOT NULL,
  tab_context TEXT,
  commentary JSONB NOT NULL DEFAULT '{}',
  agent_run_id UUID REFERENCES agent_runs(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commentary_lookup
  ON market_commentary(entity_type, entity_id, tab_context, generated_at DESC);

-- ── deal_context_fields ───────────────────────────────────────────────────────
-- Assembly target for Research Agent output. One row per (deal, field_path).
-- Stores layered values produced by agent tool write_dealcontext.
-- field_path is a dot-separated key e.g. "parcel.zoning_code", "market.vacancy_rate".
-- value is JSONB so it can hold any scalar, array, or sub-object.
-- source_label identifies the writing agent/run e.g. "agent:research".
-- agent_run_id links back to agent_runs for auditability.

CREATE TABLE IF NOT EXISTS deal_context_fields (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_path    TEXT        NOT NULL,
  value         JSONB       NOT NULL,
  source_label  TEXT        NOT NULL DEFAULT 'agent:research',
  agent_run_id  UUID        REFERENCES agent_runs(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one value per (deal, field_path) at a time — upsert target
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_context_fields_lookup
  ON deal_context_fields(deal_id, field_path);

CREATE INDEX IF NOT EXISTS idx_deal_context_fields_deal
  ON deal_context_fields(deal_id, updated_at DESC);
