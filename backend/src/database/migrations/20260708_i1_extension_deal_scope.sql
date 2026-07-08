-- I1-EXTENSION: Scope the Populated Tables (2026-07-08)
-- Addresses the live CoStar-lineage leak in metric_time_series (23,488 rows,
-- scope_id='GLOBAL', redistribution_restricted=false) and adds structural
-- deal attribution to market_snapshots for future-proofing.
-- Rule: any CoStar-lineage row must be attributable to the deal whose licensed
-- upload created it. A row that cannot answer "whose deal are you?" serves no one.

-- ── E1: metric_time_series — add deal_id ────────────────────────────────────
ALTER TABLE metric_time_series
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mts_deal_id
  ON metric_time_series(deal_id) WHERE deal_id IS NOT NULL;

-- ── E1: market_snapshots — add deal_id + is_restricted ──────────────────────
ALTER TABLE market_snapshots
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

ALTER TABLE market_snapshots
  ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ms_deal_id
  ON market_snapshots(deal_id) WHERE is_restricted = TRUE;

-- ── E2: Backfill metric_time_series CoStar rows ──────────────────────────────
-- All CoStar-lineage rows on this platform were uploaded under Bishop deal
-- 3f32276f-aacd-4da3-b306-317c5109b403 (confirmed by costar_submarket_stats
-- E0 probe: all 125 rows carry that deal_id; it is the only CoStar-uploading
-- deal on this platform). Mark them restricted + attributed.
UPDATE metric_time_series
SET redistribution_restricted = TRUE,
    deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
WHERE source ILIKE '%costar%';

-- ── E1: Write-path guard — prevent future unattributed restricted inserts ────
-- Any metric_time_series row whose source contains 'costar' must have:
--   (a) redistribution_restricted = TRUE
--   (b) deal_id IS NOT NULL
-- A derivation that cannot resolve a single owning deal must not write a
-- CoStar-sourced row at all (derivation-chain rule, operator-ratified 2026-07-08).
CREATE OR REPLACE FUNCTION check_mts_restricted_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source ILIKE '%costar%' THEN
    IF NEW.redistribution_restricted IS NOT TRUE THEN
      RAISE EXCEPTION
        'CoStar-sourced metric_time_series rows must set redistribution_restricted=TRUE '
        '(metric_id=%, source=%)',
        NEW.metric_id, NEW.source;
    END IF;
    IF NEW.deal_id IS NULL THEN
      RAISE EXCEPTION
        'CoStar-sourced metric_time_series rows must have deal_id set — '
        'unattributed restricted data is prohibited (metric_id=%, source=%)',
        NEW.metric_id, NEW.source;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mts_restricted_source_guard ON metric_time_series;
CREATE TRIGGER trg_mts_restricted_source_guard
  BEFORE INSERT OR UPDATE ON metric_time_series
  FOR EACH ROW EXECUTE FUNCTION check_mts_restricted_source();

-- ── Verification counts (run manually to confirm) ────────────────────────────
-- SELECT count(*) FROM metric_time_series WHERE source ILIKE '%costar%' AND redistribution_restricted = FALSE;  -- expect 0
-- SELECT count(*) FROM metric_time_series WHERE source ILIKE '%costar%' AND deal_id IS NULL;                    -- expect 0
-- SELECT count(*) FROM metric_time_series WHERE source ILIKE '%costar%' AND redistribution_restricted = TRUE;   -- expect 23488
