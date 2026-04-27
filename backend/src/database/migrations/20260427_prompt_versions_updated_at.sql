-- Migration: prompt_versions_updated_at
-- Date: 2026-04-27
-- Description: Add updated_at column to prompt_versions. The seed UPSERT in
--   backend/src/agents/seeds/*.seed.ts references updated_at = NOW() in its
--   ON CONFLICT (id) DO UPDATE branch; without this column, every cold-start
--   agent prompt seed fails with 42703 (column does not exist), aborting
--   server startup via process.exit(1) in index.replit.ts.

ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
