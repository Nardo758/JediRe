# W5 Cleanup Log — Engine Arc Remaining Items

**Generated:** 2026-07-06  
**Engine Arc Status:** W5 engine fixes COMPLETE. These items are logged for subsequent arcs, NOT to be fixed in W5.  
**Next Arcs:** TS-1 (Thin Surfacing Pass), F-P1 (Full Pipeline Integration), S3 (Source Tier / Doc Request)

---

## Item 1: integrityChecks Phase Labeling

**Location:** `backend/src/services/deterministic/deterministic-model-runner.ts` + `financial-model-engine.service.ts`  
**Severity:** Medium  
**Description:** The `integrityChecks` array in the final payload contains:
- The pass-1 informational block (pre-optimization checks from `runIntegrityChecks` on raw assumptions)
- The final verdict merged unlabeled (from `runFullModel`'s final-state checks)
- The `dscr_floor_binds` singleton warning

These are merged without phase labels, so consumers cannot distinguish pre-optimization informational results from authoritative final-state results. The `buildModel()` service shell merges them at lines ~1637:
```typescript
result.integrityChecks = [...(result.integrityChecks ?? []), ...full.integrityChecks, ...full.m11Warnings];
```

**Fix:** Add `phase: 'preOptimization' | 'final'` labels to each check, or dedupe so consumers don't double-count.  
**Ticket:** F-P1-adjacent cleanup  
**Blocked by:** None — can be done independently

---

## Item 2: DSCR Absent from Summary

**Location:** `backend/src/services/deterministic/deterministic-model-runner.ts` + `run-full-model.ts`  
**Severity:** Medium  
**Description:** DSCR lives only at `debtMetrics.dscr` (and `debtMetrics.coverage.dscrY1`). It is not present in the top-level `summary` object. The `BuildExpected` shape includes `dscrY1`, but the F9 UI and consumers expect it in `summary.dscr` or `summary.dscrByYear[0]`.

**Fix:** Decide whether `summary` should carry DSCR per the assemble-once contract. Add `summary.dscrY1` or ensure `summary.dscrByYear[0]` is always populated.  
**Ticket:** Same cleanup ticket as Item 1  
**Blocked by:** None

---

## Item 3: Service-Shell Test Hardening

**Location:** `backend/tests/deterministic/buildmodel-integrity.integration.test.ts`  
**Severity:** Medium  
**Description:** The rewritten integration tests (post-pre-optimization demotion) assert only:
- `resolves.toBeDefined()` (no throw)
- `status = complete` in DB

They do NOT assert the output state:
- loan == resized value (~$21M)
- equity == acqCost − loan (~$39M)
- `ALL_INVARIANTS` present in payload
- INV-6 absent from final checks (M11 resolved it)

**Fix:** Upgrade tests to assert output state, not just non-throw.  
**Ticket:** test-hardening ticket  
**Blocked by:** None

---

## Item 4: INV-6 Pass-Record Emission

**Location:** `backend/src/services/deterministic/deterministic-model-runner.ts:1544-1558`  
**Severity:** Low  
**Description:** INV-6 only emits on failure or unseeded warning. It never pushes a `'pass'` record:
```typescript
if (Math.abs(sum.totalEquity - expectedResidual) > 1) {
  checks.push({ id: 'INV-6', status: 'error', message: ... });
}
// No else branch — silent on pass
```
The `ALL_INVARIANTS` blanket pass at line 1696 covers the summary level, but per-check pass records are absent. The pre-registered prediction of "INV-6 present, passing, in-payload" does not match the implementation.

**Fix:** Add `else { checks.push({ id: 'INV-6', status: 'pass', message: 'totalEquity reconciles to totalAcqCost − loanAmount' }) }`  
**Ticket:** Minor runner cleanup  
**Blocked by:** None

---

## Item 5: LOW_CONFIDENCE_MODEL Flag

**Location:** `backend/src/services/deterministic/deterministic-model-runner.ts`  
**Severity:** Informational  
**Description:** The engine surfaced `LOW_CONFIDENCE_MODEL: 63% of evidence KPI fields LOW confidence` on Bishop. This is an honest flag indicating the deal's source data is thin.

**Implication:** Feeds the S3 source-tier/doc-request arc. The doc-upgrade loop has real demand for this deal.  
**Action:** No code change needed. Use as evidence when prioritizing doc-request automation.  
**Ticket:** S3 arc input

---

## Item 6: Vendor-Pipeline Workflow Failure

**Location:** `backend/src/services/ingestion/` (TBD)  
**Severity:** Unknown  
**Description:** Still parked, untriaged. No further information available.

**Action:** Needs dedicated investigation arc.  
**Ticket:** Separate dispatch

---

## Item 7: OneDrive Folder Cleanup (Operator Action Required)

**Location:** `C:\Users\Leons' Computer 2\OneDrive - Myers Apartment Group\Documents\JediRe`  
**Status:** Empty folder still present, locked by OneDrive sync  
**Action Required:**
1. Pause OneDrive syncing (system tray → Pause)
2. Delete `JediRe` folder from OneDrive
3. Check OneDrive cloud recycle bin at onedrive.live.com
4. Resume syncing

**Local Copy:** `C:\Users\Leons' Computer 2\Documents\JediRe` (verified, complete)

---

## Execution Order for Next Arcs

1. **TS-1:** Thin Surfacing Pass — gate satisfied on W5 close-out green
2. **F-P1:** Full Pipeline Integration — Items 1+2 above
3. **S3:** Source Tier / Doc Request — Item 5 above
4. **Excel Parity:** Operator-gated — `docs/EXCEL_PARITY_ORACLE_REQUEST.md` fill-in

---

*This log is append-only. Do not delete items — mark them DONE with date and commit when resolved.*
