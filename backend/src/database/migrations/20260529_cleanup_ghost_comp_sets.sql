-- Task #1505: Clean up ghost sale_comp_sets rows
--
-- A race condition in computeCompAnchoredCapRate + computeSalesCompPPU (run via
-- Promise.all) caused both methods to INSERT a new sale_comp_sets row simultaneously
-- when no stored comp set existed for a deal. The second INSERT completed before the
-- first's members were committed to sale_comp_set_members, leaving "ghost" rows:
-- the header row shows comp_count > 0 but the join table has 0 actual members.
--
-- This migration removes those orphaned rows so the next compute() call generates
-- a clean, single comp set via the serialised pre-fetch introduced in Task #1505.
--
-- Safety: only deletes rows where comp_count > 0 AND the actual member count in
-- sale_comp_set_members is 0 (true ghosts). Rows with comp_count = 0 and 0 members
-- (legitimate empty sets) are also cleaned up to prevent stale cache hits.

DELETE FROM sale_comp_sets
WHERE id IN (
  SELECT scs.id
  FROM sale_comp_sets scs
  LEFT JOIN sale_comp_set_members scm ON scm.comp_set_id = scs.id
  GROUP BY scs.id, scs.comp_count
  HAVING COUNT(scm.id) = 0
     AND scs.comp_count > 0
);
