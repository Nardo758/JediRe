-- Task #14: Purge stale AI analysis cache entries for Atlanta
-- The by-right max units calculation was corrected from 294 to 791 (Task #13),
-- but cached AI narratives still referenced the old 294-unit figure.
-- Delete all Atlanta/GA entries so they regenerate with correct metrics.

DELETE FROM zoning_ai_analysis_cache
WHERE UPPER(municipality) = 'ATLANTA'
  AND UPPER(state) = 'GA';
