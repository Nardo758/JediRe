# Traffic Module Audit — Outstanding Items

Logged during the Traffic Module (F6/M07) deep audit series (June 2026).
23 fixes audited across traffic engine, CPI/proforma, cross-tab data flow, and layered growth.
22 of 23 fixes are fully done. One item remains — a vendor activation, not a code gap.

---

## Remaining

### #10 — Veraset cell-phone / mobility data activation

**Status:** Infrastructure-complete. Pending commercial subscription.

**What is built:**
- `backend/src/database/migrations/20260620_veraset_infrastructure.sql` — `veraset_subscriptions` + `veraset_ingest_jobs` tables
- `backend/src/services/veraset-mobility.service.ts` — full ingest service, gated by `is_active`
- `backend/src/inngest/functions/veraset-nightly.ts` — nightly cron at 03:00 UTC (skips when no active subs)
- `backend/src/api/rest/veraset.routes.ts` — admin routes: `/api/v1/veraset/status`, `/:msaId/activate`, `/deactivate`, `/backfill`, `/jobs`
- Coverage panel reads `veraset_subscriptions` dynamically and probes the `mobility_visits_monthly` column
- Atlanta MSA placeholder subscription seeded (inactive)

**What is not built (by design):**
- Nothing. All code is in place.

**What it takes to go live:**
1. Sign Veraset commercial subscription and obtain API key
2. Set `VERASET_API_KEY` secret in the environment
3. Call `POST /api/v1/veraset/:msaId/activate` for each target MSA (e.g. Atlanta)
4. The nightly cron will begin populating `mobility_visits_monthly` on the next 03:00 UTC run

**Blocked by:** Vendor commercial deal — no code change required.

---
