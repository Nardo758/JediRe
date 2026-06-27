---
name: Backend startup crash history
description: Root causes of the cascading startup crashes fixed in June 2026, and the bypass flags used.
---

## What was broken (fixed June 2026)

**Module import depth bugs** (all were pre-existing, surfaced when NODE_ENV changed to development):
- `src/services/veraset-mobility.service.ts` — used `../../database/connection` and `../../utils/logger` (one level too deep for a root-services file; correct: `../`)
- `src/services/ingestion/outcome-panel.service.ts` line 678 — `../database` → `../../database`
- `src/services/proforma/asset-class-spread-backtest.service.ts` — `./proforma/layered-growth/rent-growth` → `./layered-growth/rent-growth`; `../database` → `../../database`
- `src/services/proforma/cycle-pressure-index.service.ts` — `../types/provenanced-value` → `../../types/provenanced-value`
- `src/services/proforma/opex-anchors.service.ts` — `../blueprint/proforma-blueprint` → `./blueprint/proforma-blueprint`
- `src/services/kafka/consumers/m35-event-ingested-consumer.ts` — `../../utils/logger` → `../../../utils/logger` (3 levels deep)
- `src/api/rest/veraset.routes.ts` and `data-macro.routes.ts` — `../middleware/auth`, `../services/`, `../utils/`, `../database/` → all needed `../../`
- `src/inngest/functions/` files importing `'../inngest'` → `'../../lib/inngest'` (inngest client lives in `src/lib/inngest.ts`)
- `src/inngest/functions/veraset-nightly.ts` importing `'../client'` → `'../../lib/inngest'`
- `backend/src/api/rest/veraset.routes.ts` was importing `veraset-mobility.service.ts` which itself had broken imports

**Inngest v4 API break** (inngest upgraded to 4.2.4):
Old 3-arg format `createFunction({id}, {cron:'...'}, handler)` no longer valid.
New format: `createFunction({id, triggers:[{cron:'...'}]}, handler)`.
Affected: `bls-qcew-monthly.ts`, `census-permits-monthly.ts`, `concession-extraction-cron.ts`, `outcome-panel-forward-fill.ts`, `veraset-nightly.ts`

**Missing refresh_tokens table** — login INSERT crashed; created via migration `20260627_refresh_tokens.sql`

**3 failed DB migrations** — `20260619_audit_log.sql`, `20260619_deal_capsules.sql`, `20260715_deal_status_enum.sql` fail with SQL errors. Bypassed with `LENIENT_SCHEMA_CHECK=1` in `backend/.env`. The deal_status_enum migration uses `lower(deal_status)` which fails because deal_status is already a text column, not an enum.

**Why:** All these were latent bugs that never triggered because the server was previously started in a state where they were masked. Once the module resolution chain was traced from scratch, each crash revealed the next.

**How to apply:** If the server refuses to start again, run it directly: `cd backend && timeout 55 npx ts-node --transpile-only src/index.replit.ts 2>&1 | grep "Cannot find module\|Require stack\|- /home"` to find the next broken import in the chain.
