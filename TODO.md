# JEDI RE — Global TODO List

Single source of truth for all open side-debt, deferred work, and vendor-blocked items.
Consolidated from per-feature TODO files (June 2026). Closed items omitted.

---

## Traffic / M07

### T-01 — Veraset cell-phone / mobility data activation
**Area:** Traffic Engine (M07) · **Effort:** 0 (code-complete) · **Blocked by:** Vendor deal

Infrastructure is 100% built. Nothing left to code.

Steps to activate once the commercial subscription is signed:
1. Set `VERASET_API_KEY` secret in the environment
2. `POST /api/v1/veraset/:msaId/activate` for each target MSA (start with Atlanta)
3. Nightly cron (`veraset-nightly.ts`, 03:00 UTC) begins populating `mobility_visits_monthly`

Relevant files: `veraset-mobility.service.ts`, `veraset.routes.ts`, `veraset-nightly.ts`,
migration `20260620_veraset_infrastructure.sql`

---

### T-02 — M07 calibration confidence bands on `trafficProjection.yearly`
**Area:** Traffic Engine (M07) · **Effort:** M · **Blocked by:** M07 backend bandwidth

Surface asymmetric percentile bands (P10/P25/P75/P90) on each `F9TrafficYear` entry for
`vacancyPct`, `effRent`, and `rentGrowthPct`. Frontend placeholder ("Pending M07 backend
wiring") is already in place in `TrafficFunnelPanel` inside `ProjectionsTab.tsx`.

Schema extension needed on `F9TrafficYear` in `types.ts`:
```typescript
bands?: {
  vacancyPct?:    { p10: number; p25: number; p75: number; p90: number };
  effRent?:       { p10: number; p25: number; p75: number; p90: number };
  rentGrowthPct?: { p10: number; p25: number; p75: number; p90: number };
};
```

Ref: `docs/architecture/TODO_F9_DATA_FLOW.md` M07 section · Task #633

---

## F9 / Proforma

### F-01 — Unit-mix-as-GPR-source feature flag activation
**Area:** F9 Pro Forma · **Effort:** M · **Blocked by:** Reconciliation audit on existing deals

`da:use_unit_mix_for_gpr` flag exists at `financials-composer.service.ts:286` but is not set
on existing deals → unit_mix edits are silent no-ops on GPR.

Work needed:
1. Identify deals where `sum(unit_mix[].count × rent × 12)` diverges from stored
   `gprDecomposition.resolvedAnnual` — those need reconciliation before the flag is enabled
2. Decide activation model: per-deal opt-in toggle in UnitMixTab (safest) vs. global default
   for new deals only
3. Add UI toggle in `UnitMixTab` that writes `da:use_unit_mix_for_gpr` via
   `PATCH /financials/override`; show current source as a labeled badge on the GPR row

---

### F-02 — LP-GP split user-facing write path
**Area:** F9 Capital · **Effort:** S (backend) + M (frontend) · **Blocked by:** Surface ownership decision

`wf:lpShare` / `wf:gpShare` are readable at `proforma-adjustment.service.ts:2943` and default
to 90/10. Write path exists via `PATCH /financials/override` but there is no UI dial.

Work needed:
1. Decide canonical surface: F9 Capital tab waterfall section vs. Deal Terms §4
2. Add LP-GP split row wired to `PATCH /financials/override` with `field: 'wf:lpShare'`
   (auto-compute `gpShare = 1 - lpShare`)
3. Confirm whether M11 Debt Advisor waterfall tab also needs to respect this value

Cross-ref: `TODO_DEAL_TERMS_FOLLOWUP.md` §4 deferral note

---

### F-03 — Ancillary breakdown → `other_income_per_unit` rollup verification
**Area:** F9 Pro Forma · **Effort:** S (investigation) · **Blocked by:** Nothing — pick a deal and query

Unknown whether the `other_income_per_unit` seed properly sums all ancillary extraction
buckets (parking + RUBS + pet + fees) or whether those buckets land in the display-only path.

Steps:
1. Pick a deal with known parking/RUBS extraction data
2. Compare `sum(parking_income + rubs_income + pet_rent + late_fees + other_income)` from
   raw extraction vs. `other_income_per_unit × totalUnits × 12`
3. If diverged: fix seeder (`proforma-seeder.service.ts`) to roll all ancillary categories into
   `other_income_per_unit`, or fix compositor to sum the breakdown directly
4. **Note:** validation query must include `other_income_user_lines` — omitting it caused a
   false mismatch in the May 2026 audit (464 Bishop flagged incorrectly)

---

### F-04 — Post-fix: audit Claude narratives generated pre-pct-unit-break fix
**Area:** AI Narratives · **Effort:** S · **Blocked by:** Need to confirm whether `deals.ai_narrative` is written

Before May 2026 fix (commit b86c537), Cashflow Agent and Coordinator prompts received
"350% rent growth / 550% exit cap / 500% vacancy" values due to raw-pct pass-through.
In-memory `narrativeCache` auto-expires on restart (already done). Explicit sweep only needed
if stale narratives were persisted to `deals.ai_narrative` column.

Steps:
1. Check whether `deals.ai_narrative` is written post-generation (if not, this is already closed)
2. If yes: regenerate AI commentary for deals where
   `last_viewed_at > 2026-04-01 AND last_ai_narrative_at < <fix_deploy_timestamp>`

---

### F-05 — Post-fix: LP deliverable audit — pre-fix Excel exports had 100× understated gross-sale-value
**Area:** Excel Export · **Effort:** XS (audit) · **Blocked by:** Need to check if any LP exports were sent

Before May 2026 fix (commit b86c537), `f9-financial-export.service.ts:220` computed
`exitNoi / 5.5` instead of `exitNoi / 0.055` → gross sale proceeds were ~1.8% of correct.

Steps:
1. Check export audit log / sales pipeline for any Excel exports sent pre-fix
2. If LP deliverables are in circulation: communicate correction and re-send updated workbook
3. If platform is pre-revenue or no LP exports have been sent: mark closed immediately

---

### F-06 — Post-fix: audit for dormant seeder improvements not propagated to existing deals
**Area:** Proforma Seeder · **Effort:** M (depends on findings)

The seeder is write-once. Any logic improvement shipped before the `forceReseed` mechanism
existed may not have propagated to pre-existing deals.

Steps:
1. Grep `proforma-seeder.service.ts` for write-time logic that depends on extraction data
2. Cross-reference against task history for any "seeder improvement" tasks shipped before
   the `forceReseed` extraction hook
3. For each finding: decide backfill needed vs. new-deal-only by design

---

## Deal Creation / Inline Deals

### D-01 — Deal creation one-sided writer (Task #623)
**Area:** `inline-deals.routes.ts` · **Effort:** XS · **File:** `backend/src/api/rest/inline-deals.routes.ts:334-358`

`POST /` writes `budget` to `deals.budget` only. Does NOT merge into
`deal_data.purchase_price` at creation time. For new deals with no prior DEAL TERMS edit,
the financial composer falls back to `deals.budget` correctly — but any subsequent targeted
PATCH to either column alone will cause divergence.

Fix: merge `deal_data = deal_data || jsonb_build_object('purchase_price', budget)` when
`budget` is non-null in the POST body.

---

### D-02 — Deal update one-sided writer (Task #624)
**Area:** `inline-deals.routes.ts` · **Effort:** XS · **File:** `backend/src/api/rest/inline-deals.routes.ts:510-554`

`PATCH /:id` accepts `budget` in `allowedFields` and writes to `deals.budget` only.
If an operator edits budget via this path after `deal_data.purchase_price` has been set by
the DEAL TERMS endpoint, the financial model shows the DEAL TERMS value while the pipeline
view shows the new budget — visible divergence.

Fix: when `budget` is in the PATCH body, also merge it into `deal_data.purchase_price`.

---

## Agent Infrastructure

### A-01 — Consolidate agent seeders to shared `upsertAgentPrompt` helper
**Area:** Agent Seeds · **Effort:** S · **File:** `backend/src/agents/seeds/`

All 5 agent seeders (cashflow, commentary, research, supply, zoning) hand-write the
deactivate-then-insert pattern independently. Three of the five historically had the
operations in the wrong order (INSERT before deactivate), causing the zoning seeder startup
crash (May 2026).

Fix: extract a single helper at `backend/src/agents/seeds/_helpers.ts`:
```typescript
export async function upsertAgentPrompt(params: {
  id: string; agentId: string; version: string;
  promptType: string; systemPrompt: string;
  outputSchema: Record<string, unknown>;
}): Promise<void> {
  // 1. Deactivate first (satisfies idx_prompt_versions_active)
  await query(`UPDATE prompt_versions SET active = false
               WHERE agent_id = $1 AND prompt_type = $2 AND active = true`,
    [params.agentId, params.promptType]);
  // 2. Insert new active row
  await query(`INSERT INTO prompt_versions (...) VALUES (...)
               ON CONFLICT (id) DO UPDATE SET active = true, ...`, [...]);
}
```

All five seed functions collapse to a single call. Order divergence becomes structurally
impossible.

---

### A-02 — Document `idx_prompt_versions_active` as load-bearing in migration
**Area:** DB Migrations · **Effort:** XS

`idx_prompt_versions_active` is a partial unique index on `(agent_id, prompt_type) WHERE
active = true`. It is the enforcement layer preventing two prompts from being simultaneously
active. Without it, a seeder bug or race condition silently corrupts the active-prompt table.

Fix: add a comment to the migration that created this index explaining its load-bearing role.
Also reference it in ADR-003 (agent prompt versioning, #638):
```sql
-- LOAD-BEARING: enforces at-most-one active prompt_versions row per (agent_id, prompt_type).
-- Do not remove. See: zoning seeder crash May 2026, TODO.md A-02.
```

---

## Operator Stance

### O-01 — Frontend types mirror gap (Phase 3)
**Area:** OperatorStance · **Effort:** XS · **Phase gate:** Phase 3

`frontend/src/stores/dealContext.types.ts` (line 751+) carries the frontend mirror of
`OperatorStance`. A comment at line 5 says a separate
`frontend/src/types/operator-stance.ts` file should exist and be kept in sync — it doesn't.
`StanceTab.tsx` imports from `dealContext.types.ts` so the risk is low today.

Fix (Phase 3): create `frontend/src/types/operator-stance.ts` as the canonical frontend type
file and update `dealContext.types.ts` to re-export from it (single source of truth).

---

## Deal Journey (F9 Header)

### J-01 — Deal Journey pending phases (M36, M07, M35, M38)
**Area:** Deal Journey Overlay · **Effort:** varies · **Phase gate:** Phase 2+

The following Deal Journey items are PENDING per `docs/architecture/deal-journey-framework.md`:
- **M36** — aggressiveness dial integration
- **M07** — confidence bands (see T-02 above)
- **M35** — event path visualization
- **M38** — calibration integration

Phase 1 is LOCKED. These are Phase 2+ scope.

---
