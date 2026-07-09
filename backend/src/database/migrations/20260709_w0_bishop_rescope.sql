-- W0: Re-scope Bishop's redistribution_restricted rows from scope_id='GLOBAL'
-- to scope_id='deal:3f32276f-aacd-4da3-b306-317c5109b403'.
--
-- A row owned by one deal must not wear GLOBAL scope. Before this migration,
-- Bishop's CoStar metric_time_series rows carried scope_id='GLOBAL' AND
-- redistribution_restricted=TRUE — two contradictory truths. After this:
--   - scope_id and redistribution_restricted agree (both signal "deal-owned")
--   - GLOBAL-scope readers (e.g. metric-projection.service.ts) exclude them by scope_id
--   - Deal-scoped sweep still finds them (scope_id IN ('GLOBAL','deal:<id>') clause
--     in correlationEngine is satisfied by scope_id='deal:<id>')
--   - redistribution_restricted=TRUE remains as the belt-and-suspenders flag

UPDATE metric_time_series
   SET scope_id = 'deal:3f32276f-aacd-4da3-b306-317c5109b403'
 WHERE redistribution_restricted = TRUE
   AND deal_id = '3f32276f-aacd-4da3-b306-317c5109b403';
