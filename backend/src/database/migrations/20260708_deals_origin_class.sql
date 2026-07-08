-- QW-2: Add origin_class column to deals table
-- Values: platform_underwritten | owned_import | archive_import | NULL (unclassifiable pending operator ruling)
-- Additive column only — no existing data moved, no behavior changed.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS origin_class TEXT
  CONSTRAINT deals_origin_class_check
    CHECK (origin_class IN ('platform_underwritten', 'owned_import', 'archive_import'));

COMMENT ON COLUMN deals.origin_class IS
  'How this deal entered the system. '
  'platform_underwritten = created/underwritten in JEDI RE directly; '
  'owned_import = imported from an existing owned/operating asset; '
  'archive_import = loaded from historical archive (pre-platform actuals). '
  'NULL = unclassifiable — requires operator ruling. See QW-2 acceptance report.';

-- -----------------------------------------------------------------------
-- BACKFILL: Established doctrine (both confirmed via audit + actuals query)
-- -----------------------------------------------------------------------

UPDATE deals
  SET origin_class = 'archive_import'
  WHERE id = '3f32276f-aacd-4da3-b306-317c5109b403'; -- 464 Bishop (24 actuals, 205 builds)

UPDATE deals
  SET origin_class = 'owned_import'
  WHERE id = 'eaabeb9f-830e-44f9-a923-56679ad0329d'; -- Highlands at Satellite (93 actuals, 16 builds)

-- -----------------------------------------------------------------------
-- BACKFILL: Classifiable by evidence rule
-- Rule: pipeline + model_builds > 0 + actuals_rows = 0 → platform_underwritten
-- -----------------------------------------------------------------------

UPDATE deals
  SET origin_class = 'platform_underwritten'
  WHERE id IN (
    '12eb9e11-3b2d-44d5-9f59-877a76344c18',  -- Updated Deal Name (5 builds, 0 actuals)
    'e044db04-439b-4442-82df-b36a840f2fd8'   -- Smoke Test Update (1 build, 0 actuals)
  );

-- Sentosa Epperson: pipeline deal, 1 model build, 12 actuals (uploaded T12 docs)
-- Evidence: pipeline deal_category + active model build = platform_underwritten
UPDATE deals
  SET origin_class = 'platform_underwritten'
  WHERE id = '3d96f62d-d986-448f-8ea4-10853021a8cb'; -- Sentosa Epperson

-- -----------------------------------------------------------------------
-- UNCLASSIFIABLE — remaining 29 deals stay NULL (see QW-2 acceptance report)
-- -----------------------------------------------------------------------
-- Feb-2026 portfolio stubs (Buckhead, Midtown Tower, etc.): 0 actuals, 0 builds
--   → cannot distinguish seeded-test from abandoned-pipeline; operator must rule.
-- Feb-2026 pipeline stubs (Inman Park, Westside Retail, etc.): 0 actuals, 0 builds
--   → same ambiguity; operator must rule.
-- S1 Gold Set deals (Jacksonville 2018, Atlanta 2020/2022): 0 actuals, 0 builds
--   → named with archive-era vintage but no ingested data; cannot confirm archive_import.
-- CS-AUDIT deals, Credit Verify Test, F2-reverify: 0 actuals, 0 builds
--   → purpose-specific test deals; operator must rule.
-- Other pipeline stubs (hhnjnjnj, vdvvdv, Jaguar, JLR, etc.): 0 actuals, 0 builds
--   → operator must rule.
