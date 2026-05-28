# Verification Protocol Runner — L1 + L2 Per-Dispatch Checks

**Task #1418** | Manually triggered after each wave of master plan dispatches.

---

## What this is

A runnable verification script that confirms every master plan dispatch is "done"
by querying the **live database**, hitting **real endpoints**, and comparing numeric
outputs to **authoritative external references** — not by reading the implementer's code.

Two real failures motivated this protocol:
- Wrong TN tax `assessmentRatio` — complete-looking code, wrong value
- `mv_market_rent_benchmarks` reported shipped but never materialized in the DB

---

## How to run

```bash
# All dispatches
cd backend && npx ts-node --transpile-only scripts/verify-protocol-runner.ts

# Single dispatch
cd backend && npx ts-node --transpile-only scripts/verify-protocol-runner.ts --dispatch=D-DEAL-1

# Machine-readable JSON output (writes verification-report.json)
cd backend && npx ts-node --transpile-only scripts/verify-protocol-runner.ts --json

# Stop on first NEEDS REWORK
cd backend && npx ts-node --transpile-only scripts/verify-protocol-runner.ts --fail-fast
```

The script exits 0 when all dispatches are APPROVED, 1 when any are NEEDS REWORK.

---

## Dispatches covered

| Dispatch | Description |
|---|---|
| D-DEAL-1 | `properties.deal_id` backfill — table column + row coverage |
| D-DEAL-2 | Deal creation auto-links a `properties` row |
| D-COMP-1 | `sale_comp_sets` table + expected columns + comp generation endpoint |
| D-COMP-2 | Comp relevance scoring — `relevance_score` column + service call site |
| D-COMP-3 | Comp NOI synthesis per unit vs NMHC benchmark range |
| D-COSTAR-1 | CoStar CSV/XLSX upload endpoint (upload + preview + commit) |
| D-COSTAR-2 | `market_sale_comps` table + sale PPU sanity vs CBRE range |
| D-COSTAR-3 | `market_rent_comps` table + rent sanity vs CoStar national range |
| D-MOD-1 | M11 capital-structure adapter wired + DSCR vs lender floor |
| D-MOD-2 | M20 exit strategy + `exit_strategy_lv` column nullable as spec |
| D-MOD-3 | Formula engine F40–F66 registered + F40 output correctness |
| F9-BATCH-3 | F9 versioning tables + assumptions columns present |
| VALUATION-GRID | `archive_assumption_benchmarks` + `mv_market_rent_benchmarks` + cap rate vs CBRE |

---

## Verdict definitions

| Verdict | Meaning | Required action |
|---|---|---|
| **APPROVED** | L1 object exists; L2 value within authoritative bounds | None — proceed to next dispatch |
| **NEEDS AMENDMENT** | Object exists but output is outside sanity bounds, or thin data | Fix the value/data, re-run runner |
| **NEEDS REWORK** | Object missing from DB, endpoint returns 5xx, or value grossly wrong | Full rework required before proceeding |

---

## L2 authoritative references

| Check | Reference | Source |
|---|---|---|
| Atlanta multifamily cap rate | 5.40% P50 (H2-2024) | CBRE Cap Rate Survey H2-2024 |
| Cap rate tolerance | ±200bps | Analyst judgement (thin archive early-stage) |
| Multifamily sale PPU | $30 000–$600 000/unit | CBRE / RCA national range |
| Comp NOI per unit | $3 000–$25 000/unit/year | NMHC Cost of Renting report |
| Asking rent per unit | $500–$6 000/unit/month | CoStar national multifamily |
| DSCR lender floor | 1.25x | Agency / CMBS standard (Fannie Mae) |
| F40 SeniorDebtSizing | Output ≤ LTV constraint | Deterministic formula validation |
| properties backfill coverage | ≥ 80% of deals linked | Platform completeness target |

---

## Reusable template for future dispatches

When a new dispatch ships, add a new `async function dXxx(): Promise<DispatchResult>`
to the runner following this template:

```typescript
async function dXxx(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // ── L1: Object existence ──────────────────────────────────────────────────
  // 1a. DB object exists
  const tableOk = await dbObjectExists('my_new_table');
  checks.push({
    name: 'my_new_table exists in live DB',
    layer: 'L1',
    verdict: approveIf(tableOk),
  });

  // 1b. Required column exists
  const colOk = await columnExists('my_new_table', 'my_column');
  checks.push({
    name: 'my_new_table.my_column column exists',
    layer: 'L1',
    verdict: approveIf(colOk),
  });

  // 1c. Service file exists and is not orphaned
  const svcOk = fileExists('services/my-new.service.ts');
  checks.push({ name: 'my-new.service.ts exists', layer: 'L1', verdict: approveIf(svcOk) });

  const hasCallSite = grepSrc(/my-new\.service/, 'api/rest');
  checks.push({
    name: 'my-new.service imported at ≥1 call site',
    layer: 'L1',
    verdict: approveIf(hasCallSite, 'NEEDS AMENDMENT'),
  });

  // 1d. Endpoint is reachable
  const resp = await api('GET', `/api/v1/my-endpoint`);
  checks.push({
    name: 'GET /api/v1/my-endpoint returns 200',
    layer: 'L1',
    verdict: approveIf(resp.status === 200, 'NEEDS REWORK'),
    produced: `HTTP ${resp.status}`,
    reference: '200',
  });

  // ── L2: Correctness on real data ─────────────────────────────────────────
  // 2a. Numeric spot-check vs authoritative reference
  const REFERENCE_VALUE = 0.054;   // <-- cite your source in a comment
  const produced = resp.body?.data?.someMetric ?? 0;
  const delta = Math.abs(produced - REFERENCE_VALUE);
  const TOLERANCE = 0.01;

  checks.push({
    name: 'someMetric within ±1% of [Source Name] reference',
    layer: 'L2',
    verdict: delta <= TOLERANCE ? 'APPROVED' : delta <= TOLERANCE * 2 ? 'NEEDS AMENDMENT' : 'NEEDS REWORK',
    produced: produced.toString(),
    reference: `${REFERENCE_VALUE} ([Source Name, Date])`,
    delta: `Δ ${delta.toFixed(4)} vs ±${TOLERANCE} tolerance`,
  });

  return {
    dispatch: 'D-XXX-N',
    description: 'Short description',
    overallVerdict: aggregateVerdict(checks),
    checks,
    ranAt: new Date().toISOString(),
  };
}
```

Then register it in the `DISPATCHES` array at the bottom of `verify-protocol-runner.ts`:

```typescript
['D-XXX-N', dXxx],
```

---

## Out of scope

- **Layer 3 backtest harness** — separate task
- **CI integration** — this is manually triggered
- **Future dispatches** — each defines its own L1/L2 checks using the template above
