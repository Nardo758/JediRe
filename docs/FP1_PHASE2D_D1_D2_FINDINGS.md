# F-P1 Phase 2D — D1/D2 Findings (Access Constraints)

**Date:** 2026-07-07
**Executor:** main agent (current session)
**Status:** D1 UNPROVABLE (no DB access); D2 PARTIAL (code-diff only, no screenshots); D3 IN PROGRESS

---

## D1 · C0-REAL — Equivalence Forensic: UNPROVABLE

### What was requested

Pull the `assumptions` snapshot from a PRE-RETIREMENT `deal_financial_models` row (a real client-shipped body, frozen before B1 landed) for Bishop and Highlands. Diff it field-by-field against the current server-fetch body.

### What was found

**No DB access available in this session.** The `DATABASE_URL` is not configured in the local workspace, and the `.env.replit` file contains secrets that cannot be read without explicit permission.

### Evidence checked

1. **Git history:** Commit `0c0fe5275` (B1 retirement) and its parent `0c0fe5275^` show the code state before and after B1. The pre-B1 code had both client and server-fetch paths active. But git does not contain the actual DB rows.

2. **Saved files in repo:** No pre-retirement `deal_financial_models` snapshots were found in the repo. The `construct-build-body.ts` script (used for capture) constructs bodies from DB state on-the-fly and writes to `/tmp/` (non-persistent).

3. **Bishop fixture `rawAssumptions`:** This is a "best-effort reconstruction from deal DB row + capture context" (per fixture comment), not a frozen client-shipped body. It was constructed by `construct-build-body.ts` from `deal_assumptions` + `proforma_assumptions` + `deals` rows.

4. **Attached assets:** No assumption JSON files found in `attached_assets/`.

### Verdict

**F-P1-A equivalence stands UNPROVEN — logged as a permanent gap, not a pass.**

The Phase-2A checkpoint's claim of equivalence was a self-comparison (same blob from same DB row read twice). It did not compare the client-shipped body against the server-fetch body. The client path was retired in B1 without this proof.

**To prove equivalence retroactively:**
- Need a DB backup or snapshot from before 2026-07-07 (B1 commit date)
- Or need a `deal_financial_models` row with `created_at` before B1 that contains the client body
- The `construct-build-body.ts` script (commit `00f74d998`) was created specifically to handle the case where the build endpoint required client bodies — this implies the server-fetch path was NOT always returning the same body as the client would have sent

### Finding logged

| ID | Description | Severity | Owner | Resolution |
|---|---|---|---|---|
| F-P1-D1-1 | F-P1-A equivalence never proven — client body vs server-fetch body diff unavailable | Medium | Operator | DB snapshot required; or accept as assumed equivalence |

---

## D2 · C2-REAL — TS-2 Acceptance Artifacts: PARTIAL

### What was requested

1. `git diff --stat` — frontend-only (paste)
2. Screenshots of BOTH deals' ProForma showing floor badge in actual per-period state
3. Resolve suspicious "floorBinding true for both deals"
4. Occupancy row (T3) visible in grid, value spot-checked

### What was done

#### 1. Git diff — frontend-only

```
frontend/src/components/deal/sections/FinancialDashboard.tsx  |  3 +-
frontend/src/components/deal/sections/ProFormaTab.tsx        | 62 +++++++++++++++++++---
frontend/src/pages/development/FinancialEnginePage.tsx       | 14 ++---
3 files changed, 61 insertions(+), 18 deletions(-)
```

#### 2. Screenshots: NOT AVAILABLE

**No browser automation available in this session.** The `kimi-webbridge` skill is not loaded. Screenshots require:
- Replit frontend running on port 3000 (or similar)
- Navigate to Bishop deal → Pro Forma tab
- Navigate to Highlands deal → Pro Forma tab
- Capture T2 floor badge and T3 occupancy row

#### 3. Floor badge state analysis (code-level)

From `ProFormaTab.tsx` (B8 changes, commit `0c0fe5275`):

```typescript
// MonthlyProjectionRow interface added
interface MonthlyProjectionRow {
  month: number;
  year: number;
  occupancy: number;
  effectiveVacancy: number;
  floorBinding: boolean;
  noi: number;
}

// Badge rendering: amber ⚑ when floorBinding === true
{monthlyProjection.floorBinding && (
  <Badge variant="amber">⚑ Floor</Badge>
)}
```

**The badge reads `monthlyProjection.floorBinding` from the payload.** This is a PER-ROW field, not an aggregate. However, the Phase-2B identity checkpoint reported `floorBinding: true` as an aggregate for both deals (see `FP1_PHASE2B_ARC_CLOSE.md`).

**Suspicious finding:** The checkpoint says "both deals show `floorBinding: true` in post-2B identity checkpoint output." If the checkpoint is reading an aggregate boolean (e.g., `any monthly row has floorBinding`), then:
- **Bishop** (lease-up, 70% occupied): Early months have physical vacancy > 5% floor → floorBinding should be `false` for those months. Later months might show `true` if physical vacancy drops below 5%.
- **Highlands** (steady-state, 100% occupied): Physical vacancy ~0% < 5% floor → floorBinding should be `true` for all months.

**The checkpoint's aggregate `floorBinding: true` for Bishop is suspicious.** It might mean "at least one month binds" rather than "all months bind." Or it might be a single boolean in the payload that is incorrectly set.

**Code inspection of payload:** The `monthlyProjection` is an array of rows. The `floorBinding` field is per-row. The frontend renders it per-row. The checkpoint's `floorBinding: true` is likely a summary flag from the backend, not a per-row array.

**To verify:** Run the build for Bishop and inspect the actual `monthlyProjection` array. Check if `floorBinding` is `false` for early months and `true` for later months. This requires a build run (or DB access to `deal_financial_models.results`).

#### 4. Occupancy row: NOT VERIFIED

The T3 occupancy row was added to `ProFormaTab.tsx` but was not visually verified due to no browser access.

### Verdict

| Item | Status | Evidence |
|------|--------|----------|
| Git diff | ✅ Done | 3 files, 61 insertions, 18 deletions |
| Screenshots | ⬜ BLOCKED | No browser access |
| Floor badge resolution | ⬜ INVESTIGATION NEEDED | Code suggests per-row rendering; aggregate checkpoint value suspicious |
| Occupancy row | ⬜ NOT VERIFIED | No browser access |

### Finding logged

| ID | Description | Severity | Owner | Resolution |
|---|---|---|---|---|
| F-P1-D2-1 | TS-2 visual acceptance incomplete — screenshots blocked | Medium | Operator | Run frontend on Replit, capture screenshots |
| F-P1-D2-2 | Bishop floorBinding aggregate suspicious — needs per-month inspection | Medium | Next session | Run build, inspect monthlyProjection array |

---

## Next: D3 · C6 — Scenario Decomposition (keystone)

Proceeding to implement D3. D1/D2 findings logged but do not block D3 code work.

