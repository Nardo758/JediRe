-- Migration: D3-W0 — Re-scope Bishop's metric_time_series rows from GLOBAL to deal-scoped
--
-- Problem: Bishop's deal (3f32276f-aacd-4da3-b306-317c5109b403) has metric_time_series rows
-- with scope_id = 'GLOBAL' AND redistribution_restricted = true — contradictory.
-- Fix: Re-scope these rows to deal:<deal_id> so scope and flag agree.
--
-- Safety: No SCOPE-ONLY readers were found in the audit. correlationEngine.service.ts
-- already pairs scope_id with redistribution_restricted checks. Route-level queries
-- that don't filter by scope_id will continue to see the rows (broader governance
-- concern, not a blocker).

BEGIN;

UPDATE metric_time_series
   SET scope_id = 'deal:3f32276f-aacd-4da3-b306-317c5109b403',
       updated_at = NOW()
 WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
   AND scope_id = 'GLOBAL'
   AND redistribution_restricted = TRUE;

COMMIT;
