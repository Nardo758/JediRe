-- Task 1656: Mark the 3 seeded owned-portfolio properties with ownership_status='portfolio'
-- so they are returned by GET /portfolio/assets even before actuals are loaded
-- (the query now uses LEFT JOIN + WHERE ownership_status='portfolio' OR EXISTS actuals).
-- Safe to re-run: only touches rows where ownership_status IS NULL.

UPDATE properties
SET ownership_status = 'portfolio'
WHERE id IN (
  'a1000001-0000-0000-0000-000000000001'::uuid,
  'a1000001-0000-0000-0000-000000000002'::uuid,
  '7ea31caf-f070-43eb-9fd1-fe08f7123701'::uuid
)
AND (ownership_status IS NULL OR ownership_status != 'portfolio');
