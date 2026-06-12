-- Migration: M40 Phase 4 — CIE findings per scenario
-- Date: 2026-06-12
-- Module: Scenario Management — CIE integration
--
-- Adds a ci_findings JSONB column to deal_underwriting_scenarios so that
-- Competitive Intelligence Engine findings are scoped to the scenario, not
-- the snapshot. This enables sponsor accept/decline/defer state to persist
-- across CIE re-runs on the same scenario.
--
-- The CIE engine itself (Phase 1) writes findings here after the cashflow
-- post-process completes. The column is nullable — deals without CIE runs
-- simply have NULL.

ALTER TABLE deal_underwriting_scenarios
  ADD COLUMN IF NOT EXISTS ci_findings JSONB;

COMMENT ON COLUMN deal_underwriting_scenarios.ci_findings IS
  'Competitive Intelligence Engine findings scoped to this scenario.
   JSONB array of CompetitiveIntelligenceFinding objects.
   Sponsor accept/decline/defer state persists across re-runs.';
