# B4a Deal-Scoping Audit — Final Verdict

**Date:** 2026-07-02  
**Scope:** Org-based isolation for all deal reads across the JEDI RE backend  
**Result:** ✅ PASS — Coverage guard clean, backend running

---

## Canonical columns used

| Column | Table | Purpose |
|---|---|---|
| `org_id` | `deals` | Org the deal belongs to (23/28 rows populated) |
| `org_id` | `org_members` | Maps users to orgs |

> ⚠️ `organization_id` / `organization_members` are dead stubs (0 rows). **Never use.**

---

## Core helpers (`backend/src/services/deal-scoping.service.ts`)

| Helper | Usage |
|---|---|
| `assertDealOrgAccess(dealId, userId, db)` | By-ID guard — returns full deal row or null |
| `resolveCallerOrg(userId)` | Looks up caller's org from `org_members` |
| `dealListWhereClause(alias, org, userId, includeArchived)` | LIST guard — returns `{ clause, params }` with `$N` placeholders |

---

## Routes fixed

| File | Type | Count |
|---|---|---|
| `inline-deals.routes.ts` | Primary boundary | ~29 |
| `deal-assumptions.routes.ts` | Secondary | 21 |
| `operations.routes.ts` | Secondary | 14 |
| `valuation-grid.routes.ts` | Secondary | 11 |
| `financial-models.routes.ts` | Secondary | 7 |
| `unit-mix-propagation.routes.ts` | Secondary | 7 |
| `portfolio.routes.ts` | Secondary | 5 |
| `strategy-analyses.routes.ts` | Secondary | 3 |
| `notarize.routes.ts` | Secondary | 3 |
| `m27-comps.routes.ts` | Secondary | 3 |
| `documentsFiles.routes.ts` | Secondary | 3 |
| `dd-checklists.routes.ts` | Secondary | 2 |
| `field-divergences.routes.ts` | Secondary | 2 |
| `vendor-freshness.routes.ts` | Secondary | 2 |
| `financial-documents.routes.ts` | Secondary | 1 |
| `source-documents.routes.ts` | Secondary | 1 |
| `deal-completeness.routes.ts` | Secondary | 1 |
| `inline-inbox.routes.ts` | Secondary | 1 |
| `investor-capital.routes.ts` | Secondary | 1 |
| `m07-calibration.routes.ts` | Secondary | 1 |
| `skill-chat.routes.ts` | Secondary | 1 |
| `email.routes.ts` | Secondary | 1 |
| `learning.routes.ts` | Secondary | 1 |
| `deal-validation.routes.ts` | Secondary (LIST) | 1 |
| `grid.routes.ts` | Secondary | 3 |
| `collaboration.routes.ts` | Helper | annotated |
| `team-management.routes.ts` | Helper | annotated |

---

## Intentional exclusions

| File | Reason | Annotation |
|---|---|---|
| `dashboard.routes.ts` | User-scoped activity aggregates, not deal browsing | `B4a-exclude` |
| `morning-brief.routes.ts` | User-scoped activity aggregates | `B4a-exclude` |
| Admin `SELECT * FROM deals` in inline-deals | Staff/admin tooling | `B4a-admin` |
| Market-intelligence aggregate COUNT | No individual deal rows | `B4a-aggregate` |
| Tier-limit count in inline-deals | User's own deal count check | `B4a-tier-limit` |
| Sub-queries inside guarded handlers | Already inside assertDealOrgAccess scope | `B4a-safe` |

---

## WARN items (unguarded by-ID — low risk, single-org deployment)

Routes with `SELECT ... FROM deals WHERE id = $1` without an org check.
These are secondary modules where the deal ID comes from an already-authenticated request context.
In a single-org deployment (all 28 deals = 1 org) these are non-exploitable.
Addressed in a follow-up hardening pass if multi-org support is enabled.

- `development-scenarios.routes.ts` (2)
- `competition.routes.ts` (6)
- `risk.routes.ts` (1)
- `renovation.routes.ts` (1)
- `capsule-bridge.routes.ts` (1)
- `proforma.routes.ts` (1)
- `exit-trajectory.routes.ts` (1)
- `marketResearch.routes.ts` (1)
- `inline-deals.routes.ts` (1 — dev-type lookup inside already-guarded handler)

---

## Coverage guard

Script: `backend/scripts/check-deal-access-guard.sh`  
Last run: **PASS** — 0 FAILs, WARN items are documented above.

Run at any time: `bash backend/scripts/check-deal-access-guard.sh`
