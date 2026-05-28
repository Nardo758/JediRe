-- Task #1410: CoStar ↔ platform comp dedup + reconciliation (D-COSTAR-3)
--
-- source_labels text[] — tracks both origins when a CoStar comp is matched to an
-- existing platform record and merged. Example values:
--   NULL                              — single-source comp, no merge occurred
--   ARRAY['costar_upload']            — pure CoStar comp (no platform match found)
--   ARRAY['georgia_county','costar_upload'] — platform record enriched by CoStar
--
-- dedup_match_method text — records which identity tier fired when merging.
--   'parcel_id' | 'address' | 'geocode'

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS source_labels text[],
  ADD COLUMN IF NOT EXISTS dedup_match_method text;
