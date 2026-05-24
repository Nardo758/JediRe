-- address_geocode_cache: persistent cache for US Census Geocoder results.
--
-- Keyed by the raw input address (lowercased, trimmed). Multiple intake jobs
-- for the same physical address share one cache entry — once resolved, the
-- Census API is never called again for that address.
--
-- county_fips is the 5-digit FIPS code (state 2 + county 3), e.g. "13121"
-- for Fulton County, GA. Used by the GA municipal-enrichment router to jump
-- directly to the right county adapter without trying all adapters in sequence.
--
-- matched_address is the Census-normalized form of the street address
-- (e.g. "1991 MLK DR SW, ATLANTA, GA, 30310"). Passed to county adapters
-- instead of the raw input so they can match against GIS layer records.
--
-- geocode_failed: true when Census returned no match. Cached so we don't
-- re-call the API on every retry; the adapter chain falls back to raw address.

CREATE TABLE IF NOT EXISTS address_geocode_cache (
  input_address     text        PRIMARY KEY,   -- LOWER(TRIM(raw_input))
  matched_address   text,                      -- Census-normalized address or NULL
  street_only       text,                      -- matched_address street+number only (no city/state/zip)
  county_fips       text,                      -- 5-digit FIPS e.g. "13121", NULL if no county returned
  lat               numeric(10,7),
  lng               numeric(10,7),
  geocode_failed    boolean     NOT NULL DEFAULT false,
  geocoded_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS address_geocode_cache_fips_idx ON address_geocode_cache (county_fips)
  WHERE county_fips IS NOT NULL;
