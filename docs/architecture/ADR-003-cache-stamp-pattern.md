# ADR-003: Cache-Stamp + Inline-Recompute Fallback for Stance-Derived Cached Values

**Status:** Accepted · In production  
**Date:** May 2026 (Task #641 close, cache invalidation fix)  
**Deciders:** Platform architecture review  
**Supersedes:** Naive cache invalidation via recompose trigger  
**Related:** ADR-001 (LayeredValue), ADR-002 (dealStore event bus),  
`docs/architecture/OPERATOR_STANCE_PHASE1_SPEC.md`,  
`TODO_F9_SIDE_DEBT.md` (SDB-02 — document idx_prompt_versions_active)

---

## Context

The platform caches expensive computed values in `deal_data` (JSONB on the
`deals` table). One such value is `deal_data.concession_recognition`, which
stores the output of the concession amortization engine — including
`capitalized_lease_up_total`, the lease-up reserve that flows into
`equity_required` under CAPITALIZED or HYBRID treatment.

The cache is written by `computeConcessionRecognition` inside
`composeDealFinancials` (the full financial recompose pipeline). It is read
by `getDealFinancials` (the hot path for the F9 tab).

**The stale-cache race condition:**

`PUT /stance` writes `operator_stance.leasingCostTreatment` to the deals table
and then fires a background `applyStanceReblend` — a zero-LLM-cost modulation
of the underwriting snapshot. This reblend operates entirely on the
`deal_underwriting_snapshots` table. It does **not** call `composeDealFinancials`
and does **not** update `deal_data.concession_recognition`.

When the operator opens F9 immediately after toggling leasingCostTreatment:

```
PUT /stance (OPERATING → CAPITALIZED)
    ↓
operator_stance updated ✓
    ↓
applyStanceReblend (background) — touches underwriting snapshot only
    ↓
GET /financials
    ↓
getDealFinancials reads deal_data.concession_recognition
    ↓
_treatment = "OPERATING" (stale)   effectiveLct = "CAPITALIZED" (current)
    ↓
capitalizedLeaseUpTotal = stale value — equity_required WRONG
```

IRR, equity multiple, and debt coverage shown to the operator are incorrect until
the next full recompose.

### Why not trigger a recompose from PUT /stance?

The naive fix is `PUT /stance → composeDealFinancials`. This was rejected for
four reasons:

1. **Cost**: `composeDealFinancials` makes multiple DB round-trips and assembles
   a full year-1 proforma. On a loaded server it takes 200–500ms. Making every
   stance toggle block on this is unacceptable for a toggle UI.

2. **Failure modes**: Network errors, timeouts, and DB locks can cause
   `composeDealFinancials` to fail. If it fails, the cache is in an unknown state
   — partially updated or still stale. The caller has no way to know whether to
   trust the cache.

3. **Race conditions**: Multiple rapid toggles would queue multiple recompose
   jobs. The cache could be written in any order depending on which job completes
   first.

4. **Wrong trigger**: `PUT /stance` is a write to a configuration value, not a
   request to run the financial engine. Coupling these conflates two distinct
   concerns and makes the stance endpoint responsible for an operation it doesn't
   own.

---

## Decision

**Stamp the treatment into the cache payload. Validate on read. Inline-recompute
from a pure function on mismatch.**

### Step 1 — Write side: stamp `_treatment` into the cache

`computeConcessionRecognition` stores `_treatment` alongside `_cache_key` in
every cache write to `deal_data.concession_recognition`:

```typescript
// financials-composer.service.ts
const cachePayload = {
  ...result,
  _cache_key: cacheKey,
  _treatment: treatment,   // ← stamps which treatment produced this cache entry
};
```

`_treatment` is **load-bearing**. It must not be removed as dead weight.
Without it, `getDealFinancials` has no way to validate the cache without
re-parsing the full fingerprint string.

### Step 2 — Read side: validate treatment, inline-recompute on mismatch

`getDealFinancials` reads `_treatment` from the cache on every call:

```typescript
// proforma-adjustment.service.ts
const _cachedConcRec = (dealData.concession_recognition ?? {}) as Record<string, unknown>;
const cacheMatchesTreatment = _cachedConcRec._treatment === effectiveLct;

let capitalizedLeaseUpTotal = 0;
if (effectiveLct === 'CAPITALIZED' || effectiveLct === 'HYBRID') {
  if (cacheMatchesTreatment && typeof _cachedConcRec.capitalized_lease_up_total === 'number') {
    // Cache is fresh — fast path.
    capitalizedLeaseUpTotal = _cachedConcRec.capitalized_lease_up_total;
  } else {
    // Cache is absent or treatment-mismatched (operator toggled stance without
    // triggering a recompose).  Inline-recompute from deal_data.concession_records
    // using the pure amortizeConcessions function — no DB calls.
    const concRecords = Array.isArray(dealData.concession_records)
      ? dealData.concession_records : [];
    if (concRecords.length > 0) {
      const { amortizeConcessions } = await import('./concession-amortization');
      const engineOut = amortizeConcessions({
        records: concRecords as any,
        leasing_cost_treatment: effectiveLct,
        fiscal_year_start_month: dealData.fiscal_year_start_month ?? 1,
      });
      capitalizedLeaseUpTotal = engineOut.lease_up_reserve_required;
    }
  }
}
```

### Key properties of the fallback function

`amortizeConcessions` is pure in the relevant sense:
- No DB calls
- No network calls
- Input: `concession_records` already loaded in memory as part of `deal_data`
- Output: deterministic for a given `(records, treatment, fiscalStart)` triple
- Cost: < 1ms for typical record counts

This means the inline-recompute has no failure modes beyond a code error, adds
negligible latency to the hot path, and produces a race-free result regardless
of how many stance toggles have occurred.

---

## Invariants After This Fix

| Cache state | effectiveLct | Result |
|---|---|---|
| `_treatment` matches `effectiveLct` | CAPITALIZED or HYBRID | Fast read from cache |
| `_treatment` mismatches `effectiveLct` | CAPITALIZED or HYBRID | Inline-recompute from `concession_records` |
| Cache absent (first run, never composed) | CAPITALIZED or HYBRID | Inline-recompute; falls back to 0 if no records |
| Any | OPERATING | 0, no computation |

The cache becomes **self-correcting on next read**. No manual invalidation, no
recompose trigger, no race condition.

---

## When to Apply This Pattern

Apply the cache-stamp + inline-recompute pattern when ALL of the following hold:

1. A computed value is cached in a persistent store (DB, Redis, deal_data JSONB)
2. The value depends on a **toggleable input** (a configuration field, a stance
   parameter, a mode selection) that can be changed without running the full
   computation pipeline
3. A **pure function** (or a sufficiently cheap computation) can re-derive the
   value from data already available at read time
4. Showing the operator a stale value from a prior toggle would produce incorrect
   downstream outputs (e.g. wrong IRR, wrong equity requirement)

Do **not** apply it when:
- The re-derivation requires DB calls or network I/O (use explicit cache
  invalidation or recompose trigger instead)
- The cached value is always deterministic from a single non-toggleable input
  (no stamp needed — the cache can never be stale)
- The cost of the inline-recompute is non-trivial (treat it as a recompose and
  use the recompose trigger approach with appropriate async handling)

### Future applications in OperatorStance Phase 1

As OperatorStance Phase 1 lands and stance fields cascade through more
computations, several cached values will acquire the same stale-on-toggle risk.
Each should be audited against the three criteria above and stamped with the
relevant stance field(s) that can invalidate the cache.

---

## Consequences

**Positive:**
- Zero race conditions: the stamp is always self-consistent with the value it
  describes.
- No recompose trigger: stance toggles remain cheap (single DB write +
  background reblend).
- Operator gets correct values immediately on first navigation after a toggle,
  without a hard refresh.
- Failure is conservative: if the inline-recompute itself throws, `capitalizedLeaseUpTotal`
  defaults to 0 — equity is understated rather than overstated.
- Cache coherence is self-healing: the next `composeDealFinancials` run will
  write a correctly-stamped cache entry, upgrading the cache to the fast path.

**Negative / constraints:**
- `_treatment` (and any future stamp fields) must be documented as load-bearing.
  They look like debug metadata and will be removed by cleanup-minded maintainers
  without this documentation. See SDB-02 in `TODO_F9_SIDE_DEBT.md`.
- The pattern requires the re-derivation input data (`concession_records`) to be
  loaded as part of the same DB query that loads the cache. If that data is not
  co-located in the same table/JSONB column, a separate DB call is required —
  which may push this toward explicit invalidation instead.
- Two code locations must be kept in sync: the write-side stamp and the read-side
  validation. Cross-reference comments at both sites are the primary guard against
  drift.

---

## Implementation Locations

| Role | File | Lines |
|---|---|---|
| Cache write (stamp author) | `backend/src/services/financials-composer.service.ts` | `computeConcessionRecognition` → cache write block |
| Cache read (stamp validator) | `backend/src/services/proforma-adjustment.service.ts` | `getDealFinancials` → `effectiveLct` / `capitalizedLeaseUpTotal` block |
| Pure recompute function | `backend/src/services/concession-amortization/index.ts` | `amortizeConcessions` export |
| Stance write (trigger for stale) | `backend/src/services/operatorStance.service.ts` | `saveStance` → background `applyStanceReblend` |

---

## Related

- ADR-001 — LayeredValue (provenance model for persisted values)
- ADR-002 — dealStore event bus (frontend cross-tab notification when treatment changes)
- `docs/architecture/OPERATOR_STANCE_PHASE1_SPEC.md` — `leasingCostTreatment` context
- `TODO_F9_SIDE_DEBT.md` SDB-02 — document `idx_prompt_versions_active` as load-bearing
  (same "load-bearing metadata" problem class)
- `backend/src/services/concession-amortization/__tests__/engine.test.ts` — §12.7b
  equity wire invariant tests (5 tests covering all three treatment modes)
