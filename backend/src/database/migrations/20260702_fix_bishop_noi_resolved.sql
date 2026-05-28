-- Migration: Fix 464 Bishop Year 1 NOI resolved value
-- Task #1447
--
-- Root cause:
--   1. management_fee_pct.resolved = 0.1142 (11.42%, from T-12) was used by the seeder
--      to compute mgmtFeeDollar = EGI × 11.42% = $531,970 instead of the correct
--      OM rate of 2.75% = $128,049. This alone inflated total_opex by ~$404K.
--   2. customOpexTotal ($1,067,355 in granular T-12 line items) double-counts categories
--      already present in standard fields (insurance, utilities, management, payroll).
--      Combined, total_opex_resolved was ~$3.28M vs the platform figure of $1.08M.
--   3. noi.resolved = $367,640 is a stale value from an earlier seeding run with
--      different inputs; even current EGI ($4,656,330) - stored total_opex ($3,283,812)
--      = $1,372,517, which itself does not match the stale stored figure.
--
-- Fix:
--   a. Correct management_fee_pct.resolved to the OM value (2.75%) so that future
--      re-derives compute the correct mgmtFeeDollar = ~$128K instead of ~$532K.
--   b. Set noi.resolved to the OM value ($2,999,564) with resolution = 'om'.
--   c. Set total_opex.resolved to the OM-implied value (EGI - NOI_OM = $1,656,766)
--      so the EGI − total_opex = NOI identity holds.
--
-- Deal: 464 Bishop Street NW, Atlanta GA
-- deal_id: 3f32276f-aacd-4da3-b306-317c5109b403
-- deal_assumptions.id: afaf1c29-6923-4b94-a97e-8187ed3d8623

UPDATE deal_assumptions
SET year1 = jsonb_set(
  jsonb_set(
    jsonb_set(
      year1,
      '{management_fee_pct}',
      year1->'management_fee_pct'
        || jsonb_build_object(
            'resolved',   0.0275,
            'resolution', 'om',
            'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           )
    ),
    '{total_opex}',
    year1->'total_opex'
      || jsonb_build_object(
          'resolved',   1656766,
          'resolution', 'om',
          'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         )
  ),
  '{noi}',
  year1->'noi'
    || jsonb_build_object(
        'resolved',   2999564,
        'resolution', 'om',
        'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       )
),
updated_at = now()
WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403';
