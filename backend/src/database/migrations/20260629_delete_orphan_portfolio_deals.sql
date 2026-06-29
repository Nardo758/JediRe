-- ============================================================
-- ORPHAN PORTFOLIO DEALS — DELETION MIGRATION
-- Generated: 2026-06-29  |  Task: Orphaned portfolio deals triage
-- Status: REVIEW ONLY — uses ROLLBACK, will NOT persist until changed to COMMIT
--
-- Scope: 9 deal_category='portfolio' rows from the Feb 2026 seed batch.
-- Excluded: eaabeb9f (Highlands at Sweetwater Creek) — real owned asset.
--
-- Reference scan summary (docs/audits/ORPHAN_PORTFOLIO_DEALS_TRIAGE.md):
--   Tier 1 (metadata-only)    : fb46a388, 5191737b
--   Tier 2 (+ 1 news row)     : 7235a6f9
--   Tier 3 (+ seeded comp sets): 9ee2bc0c, 451d65eb, 5d738adc, c7a7338a, 1f8e270a
--   Tier 4 (AI analytical data): 8205a985 — Westside Lofts — SEE NOTE BELOW
--
-- Tier 4 NOTE: 8205a985 (Westside Lofts) has 52 underwriting_evidence rows,
-- 3 underwriting snapshots, 1 deal_assumptions row, 35 ai_usage_log rows, and
-- 3 agent_runs. These represent real AI activity. Review before including.
--
-- To execute: change ROLLBACK to COMMIT at the bottom.
-- ============================================================

BEGIN;

-- ── STEP 1: Child tables — underwriting (Westside Lofts only) ───────────────
-- Only 8205a985 has rows in these tables.
-- Review section: if Westside Lofts is excluded from deletion, remove these.

DELETE FROM underwriting_evidence
WHERE deal_id IN (
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid  -- Westside Lofts (52 rows)
);

DELETE FROM deal_underwriting_snapshots
WHERE deal_id IN (
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid  -- Westside Lofts (3 rows)
);

DELETE FROM deal_assumptions
WHERE deal_id IN (
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid  -- Westside Lofts (1 row)
);

DELETE FROM cashflow_projections
WHERE deal_id IN (
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid  -- Westside Lofts (1 row)
);

DELETE FROM agent_runs
WHERE deal_id IN (
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid  -- Westside Lofts (3 rows)
);

DELETE FROM ai_usage_log
WHERE deal_id IN (
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid  -- Westside Lofts (35 rows)
);

-- ── STEP 2: News geo impacts (Tier 2 + Tier 3) ──────────────────────────────

DELETE FROM news_event_geo_impacts
WHERE deal_id IN (
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid, -- Midtown Tower (1 row)
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid, -- Sandy Springs Office Park (1 row)
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid, -- Buckhead Luxury Apartments (1 row)
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid, -- Midtown Mixed-Use Development (3 rows)
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid  -- Buckhead Mixed-Use Development (2 rows)
);

-- ── STEP 3: Comp sets (Tier 3) ───────────────────────────────────────────────

DELETE FROM deal_rent_comp_sets
WHERE deal_id IN (
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid, -- Alpharetta Retail Center (8 rows)
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid, -- Sandy Springs Office Park (15 rows)
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid, -- Buckhead Luxury Apartments (15 rows)
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid, -- Midtown Mixed-Use Development (16 rows)
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid  -- Buckhead Mixed-Use Development (15 rows)
);

-- ── STEP 4: Seeded metadata — all 9 deals ────────────────────────────────────

DELETE FROM jedi_score_history
WHERE deal_id IN (
  'fb46a388-f3b8-44bd-ad12-7ed3250079a2'::uuid, -- College Park Workforce Housing (65 rows)
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid, -- Midtown Tower (65 rows)
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid, -- Westside Lofts (65 rows)
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid, -- Alpharetta Retail Center (65 rows)
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid, -- Sandy Springs Office Park (65 rows)
  '5191737b-79f5-4b8d-b1c0-9c33c919edda'::uuid, -- Downtown Office Conversion (65 rows)
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid, -- Buckhead Luxury Apartments (65 rows)
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid, -- Midtown Mixed-Use Development (65 rows)
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid  -- Buckhead Mixed-Use Development (65 rows)
);

DELETE FROM deal_activity
WHERE deal_id IN (
  'fb46a388-f3b8-44bd-ad12-7ed3250079a2'::uuid,
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid,
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid,
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid,
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid,
  '5191737b-79f5-4b8d-b1c0-9c33c919edda'::uuid,
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid,
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid,
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid
);

DELETE FROM state_transitions
WHERE deal_id IN (
  'fb46a388-f3b8-44bd-ad12-7ed3250079a2'::uuid,
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid,
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid,
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid,
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid,
  '5191737b-79f5-4b8d-b1c0-9c33c919edda'::uuid,
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid,
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid,
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid
);

-- ── STEP 5: deal_properties junction (unlinking deals from stub properties) ──

DELETE FROM deal_properties
WHERE deal_id IN (
  'fb46a388-f3b8-44bd-ad12-7ed3250079a2'::uuid,
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid,
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid,
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid,
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid,
  '5191737b-79f5-4b8d-b1c0-9c33c919edda'::uuid,
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid,
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid,
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid
);

-- ── STEP 6: Stub properties rows (name=NULL, no independent downstream data) ─
-- IDs confirmed by scan: all have name=NULL, zero property_id refs outside
-- deal_properties and deals themselves.

DELETE FROM properties
WHERE id IN (
  'ca8f78e5-4f59-4a17-ba16-dce28ae5c037'::uuid, -- stub for fb46a388 College Park
  '1e804422-0620-46af-bff1-7f31133bbe8c'::uuid, -- stub for 7235a6f9 Midtown Tower
  '32d68002-274e-48d9-8b5c-052e38b25ad2'::uuid, -- stub for 8205a985 Westside Lofts
  '1b0b66b2-7dff-4f40-9c3a-e42195371f93'::uuid, -- stub for 9ee2bc0c Alpharetta
  '1222a2c1-4640-4374-a2bd-5ec945c47c93'::uuid, -- stub for 451d65eb Sandy Springs
  '340e87dc-0d46-4621-84e0-5ecdc2dfaa70'::uuid, -- stub for 5191737b Downtown OC
  '55ee8abc-69f0-4b04-9efa-3f8ca90c3bb9'::uuid, -- stub for 5d738adc Buckhead Lux
  '4b3cc51f-945d-47ca-b214-85c0f5f05ff6'::uuid, -- stub for c7a7338a Midtown MU
  'cec62230-6c7c-4bff-8032-e19cc3f4bdfc'::uuid  -- stub for 1f8e270a Buckhead MU
)
AND name IS NULL  -- safety guard: only delete confirmed stubs
AND deal_id IN (
  'fb46a388-f3b8-44bd-ad12-7ed3250079a2'::uuid,
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid,
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid,
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid,
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid,
  '5191737b-79f5-4b8d-b1c0-9c33c919edda'::uuid,
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid,
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid,
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid
);

-- ── STEP 7: The deal rows themselves ─────────────────────────────────────────

DELETE FROM deals
WHERE id IN (
  'fb46a388-f3b8-44bd-ad12-7ed3250079a2'::uuid, -- College Park Workforce Housing  (Tier 1)
  '7235a6f9-c7dc-400e-a982-b89e335dccdf'::uuid, -- Midtown Tower                   (Tier 2)
  '8205a985-cd17-4339-a6a4-efb57ce78b08'::uuid, -- Westside Lofts                  (Tier 4 — REVIEW)
  '9ee2bc0c-a5a2-4fed-930b-12c81040a2b2'::uuid, -- Alpharetta Retail Center         (Tier 3)
  '451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7'::uuid, -- Sandy Springs Office Park        (Tier 3)
  '5191737b-79f5-4b8d-b1c0-9c33c919edda'::uuid, -- Downtown Office Conversion       (Tier 1)
  '5d738adc-c4fe-42e9-986b-112e5fb550a8'::uuid, -- Buckhead Luxury Apartments       (Tier 3)
  'c7a7338a-b520-4f76-b15b-5be1b9400fec'::uuid, -- Midtown Mixed-Use Development    (Tier 3)
  '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d'::uuid  -- Buckhead Mixed-Use Development   (Tier 3)
)
AND deal_category = 'portfolio'  -- safety guard: only orphan portfolio deals
AND id != 'eaabeb9f-830e-44f9-a923-56679ad0329d'::uuid; -- safety: never touch Highlands

-- ── VERIFY (run before committing) ───────────────────────────────────────────
-- Confirm 0 rows remain for the 9 deal IDs:
-- SELECT id, name, deal_category FROM deals WHERE id IN (...);
-- Confirm Highlands is untouched:
-- SELECT id, name FROM deals WHERE id = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

-- ============================================================
-- CHANGE THIS LINE TO COMMIT WHEN READY TO EXECUTE
ROLLBACK;
-- ============================================================
