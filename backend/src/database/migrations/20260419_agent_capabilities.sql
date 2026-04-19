-- Migration: agent_capabilities
-- Date: 2026-04-19
-- Adds capabilities[] tracking to users table for agent service accounts.
--
-- Canonical capability store:
--   users.capabilities (this column) is the authoritative, queryable source of truth
--   for agent service account capabilities. The task spec referenced "agent_metadata"
--   but no such table exists; using users.capabilities is the correct approach since
--   agent service accounts are already rows in the users table.
--
-- JWT runtime:
--   agent-auth.routes.ts reads capability grants from AGENT_JWT_CONFIGS (in-process)
--   and embeds them in JWT payloads. The users.capabilities column is the persisted
--   counterpart for audit, admin tooling, and capability introspection queries.

ALTER TABLE users ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]';

-- Seed agent service account capabilities
UPDATE users SET capabilities = '["read:all","write:deal_context","web:search"]'::jsonb
  WHERE id = '00000000-0000-0000-0000-000000000001'; -- research

UPDATE users SET capabilities = '["read:zoning","read:parcels","write:zoning_analysis","web:search"]'::jsonb
  WHERE id = '00000000-0000-0000-0000-000000000002'; -- zoning

UPDATE users SET capabilities = '["read:permits","read:costar","write:supply_analysis"]'::jsonb
  WHERE id = '00000000-0000-0000-0000-000000000003'; -- supply

UPDATE users SET capabilities = '["read:financials","write:projections"]'::jsonb
  WHERE id = '00000000-0000-0000-0000-000000000004'; -- cashflow

UPDATE users SET capabilities = '["read:market_data","read:economic","write:market_commentary","web:search"]'::jsonb
  WHERE id = '00000000-0000-0000-0000-000000000005'; -- commentary

-- Add metadata JSONB column to deal_context_fields for field-level provenance tracking.
-- When derived_from_search = true, value was obtained via web_search (not structured data).
ALTER TABLE deal_context_fields ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
COMMENT ON COLUMN deal_context_fields.metadata IS
  'Optional provenance metadata. Keys: derived_from_search (bool).';
