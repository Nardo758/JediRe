-- ============================================================
-- ORPHAN PORTFOLIO DEALS — DELETION MIGRATION
-- Generated: 2026-06-29  |  Task: Orphaned portfolio deals triage
-- Status: NO-OP — empty IN list (see reason below)
--
-- Scope: 9 deal_category='portfolio' rows from the Feb 2026 seed batch.
-- Excluded always: eaabeb9f (Highlands at Sweetwater Creek) — real owned asset.
--
-- WHY THIS IS A NO-OP:
-- Per the triage definition, only rows with ZERO references across all 210
-- scanned tables qualify as "safe-to-delete". All 9 orphan deals have at
-- minimum 5 reference table entries each (deal_activity, state_transitions,
-- deal_properties, jedi_score_history x65, and a linked stub properties row).
-- No row meets the zero-reference threshold. The IN list is intentionally
-- empty until a human decision promotes one or more deals to eligible.
--
-- WHAT HUMAN REVIEW IS NEEDED BEFORE ADDING IDs HERE:
--
-- Tier 1 (2 deals) — metadata-only references (all auto-generated):
--   fb46a388-f3b8-44bd-ad12-7ed3250079a2  College Park Workforce Housing
--   5191737b-79f5-4b8d-b1c0-9c33c919edda  Downtown Office Conversion
--   Decision needed: accept that deal_activity / state_transitions /
--   jedi_score_history (65 rows each) / stub properties will also be deleted.
--   If yes, add these IDs and run cascade cleanup separately first.
--
-- Tier 2 (1 deal) — Tier 1 + 1 auto-matched news row:
--   7235a6f9-c7dc-400e-a982-b89e335dccdf  Midtown Tower
--   Decision needed: same as Tier 1.
--
-- Tier 3 (5 deals) — Tier 1 + seeded comp sets (8–16 deal_rent_comp_sets):
--   9ee2bc0c-a5a2-4fed-930b-12c81040a2b2  Alpharetta Retail Center
--   451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7  Sandy Springs Office Park
--   5d738adc-c4fe-42e9-986b-112e5fb550a8  Buckhead Luxury Apartments
--   c7a7338a-b520-4f76-b15b-5be1b9400fec  Midtown Mixed-Use Development
--   1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d  Buckhead Mixed-Use Development
--   Decision needed: confirm comp sets are seeded detritus, then same as Tier 1.
--
-- Tier 4 (1 deal) — EXPLICIT HUMAN REVIEW REQUIRED before any deletion:
--   8205a985-cd17-4339-a6a4-efb57ce78b08  Westside Lofts
--   Has: 52 underwriting_evidence rows (LLM citations), 3 underwriting
--   snapshots, 1 deal_assumptions row, 35 ai_usage_log entries, 3 agent_runs.
--   See Task #1867 for resolution options.
--
-- HOW TO USE:
-- 1. For each deal you decide to delete, ensure its child references are
--    cleaned up first (cascade order documented in ORPHAN_PORTFOLIO_DEALS_TRIAGE.md).
-- 2. Then add its UUID to the IN list below.
-- 3. Change ROLLBACK to COMMIT when ready to execute.
-- ============================================================

BEGIN;

-- No deals currently qualify as safe-to-delete (zero references).
-- Add UUIDs here after human review per the tier guidance above.
DELETE FROM deals
WHERE id IN (
  -- paste approved deal UUIDs here, one per line
)
AND deal_category = 'portfolio'                                    -- safety guard
AND id != 'eaabeb9f-830e-44f9-a923-56679ad0329d'::uuid;          -- never Highlands

-- Confirm Highlands untouched (run this after switching to COMMIT):
-- SELECT id, name, deal_category FROM deals
-- WHERE id = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

ROLLBACK; -- change to COMMIT when ready to execute
