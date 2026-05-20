-- Address normalization helper used to fuzzy-match apartment_supply_pipeline
-- rows against the canonical properties table. Pure / immutable so it can
-- safely sit in a JOIN ON clause and be used in functional indexes later.
--
-- Normalization rules (mirroring deal-property-linker.service.ts):
--   * uppercase
--   * strip periods, commas, hashes
--   * collapse whitespace
--   * drop trailing apt/suite/ste/unit tokens
--   * expand long-form street suffixes (STREET->ST, AVENUE->AVE, ...)
CREATE OR REPLACE FUNCTION normalize_street_address(addr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          regexp_replace(
                            regexp_replace(
                              regexp_replace(
                                regexp_replace(
                                  regexp_replace(upper(coalesce(addr, '')), '[.,#]', '', 'g'),
                                  '\s+(APT|APARTMENT|SUITE|STE|UNIT)\b.*$', '', 'g'
                                ),
                                '\b(STREET|STR)\b', 'ST', 'g'
                              ),
                              '\bAVENUE\b', 'AVE', 'g'
                            ),
                            '\bBOULEVARD\b', 'BLVD', 'g'
                          ),
                          '\bDRIVE\b', 'DR', 'g'
                        ),
                        '\bLANE\b', 'LN', 'g'
                      ),
                      '\bROAD\b', 'RD', 'g'
                    ),
                    '\bCOURT\b', 'CT', 'g'
                  ),
                  '\bPLACE\b', 'PL', 'g'
                ),
                '\bCIRCLE\b', 'CIR', 'g'
              ),
              '\bPARKWAY\b', 'PKWY', 'g'
            ),
            '\bHIGHWAY\b', 'HWY', 'g'
          ),
          '\bTERRACE\b', 'TER', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

-- Functional indexes so the join in /api/v1/supply/pipeline-timeline is fast.
CREATE INDEX IF NOT EXISTS idx_properties_norm_address
  ON properties (normalize_street_address(address_line1), state_code)
  WHERE address_line1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supply_pipeline_norm_address
  ON apartment_supply_pipeline (normalize_street_address(address), state)
  WHERE address IS NOT NULL;
