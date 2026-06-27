# Plan: Custom Metrics Build (Category 7 of Visualization Master Plan)

## Sequencing (from both specs)

1. **Phase 5 (frontend)** — Boundary primitive + periodic rendering in F9 tabs
   - Backend: `GET /financial-model/:dealId/periodic` already exists
   - Frontend: Update F9 tabs to consume periodic series instead of `[0]` flatten
   - Defer: frontend is React/TS, needs frontend build context

2. **Custom Metrics (backend)** — Schema → Evaluator → Rollup → Derivation → UI → Acceptance
   - Self-contained backend work with detailed spec
   - Build first, then wire to frontend

3. **Fast-follows** — After both above: variance overlay, submarket band, event markers

---

## Custom Metrics — Build Order (per spec §9)

### Stage 1: Schema (migration)
- `custom_metrics` table: id, scope, owner_id, name, metric_key, metric_type, formula_ast, rollup, format, unit_basis_field, created_by, created_at
- `custom_metric_values` table: metric_id, deal_id, period_month, value, zone (input-type only)
- `FIELD_WHITELIST` constant: system field keys + other custom metric keys
- `FUNCTION_WHITELIST` constant: {min, max, avg, abs, round}

### Stage 2: Safe Evaluator (security boundary — §4)
- Parser: tokenize formula string → AST nodes
- Validator: walk AST, reject unknown identifiers, unknown functions, property access, dynamic dispatch
- Cycle detector: topological sort across custom_metrics rows
- Division-by-zero/null guard: return null + flagged reason, never NaN/Infinity
- **No `eval()`, no `Function()`, no dynamic dispatch**

### Stage 3: Rollup Engine (correctness boundary — §3)
- Default inference from formula shape: ratio-of-two-sum-fields → rederive; single flow → sum; rate field → avg
- Hard block: `sum` on ratio-shaped formula (rejected at validation time)
- Split transition year: rederive ratios over blended annual inputs; sum flows over all 12
- Annual rollup: sum (Σ), avg (mean), end_of_period (Dec), rederive (formula on annual inputs)

### Stage 4: Derivation + Zone Inheritance + Reconciliation Hook (§5)
- Evaluate derived metric at period t: resolve all input fields at t, apply formula
- Zone inheritance: least-real of inputs (projection dominates — only as real as least-real input)
- Reconciliation hook: when boundary advances and inputs reconcile, log to deal_reconciliation_log with metric_key
- Input-type metrics: read from custom_metric_values like actuals

### Stage 5: Builder UI + Chat-NL Translation (§6)
- Surface 2 (terminal): constrained pickers → AST directly
- Surface 1 (chat): NL → candidate AST → same validator → confirm before save
- Both produce identical custom_metrics row
- Scope: user-level (default across all deals) + deal-level (ad-hoc)

### Stage 6: Live-DB Acceptance (§3/§4/§5/§6)
- Debt Yield (rederive): correct annual = annual NOI ÷ loan; prove Σ-of-monthly-ratios differs; try sum → rejected
- Unknown identifier, self-reference, A→B→A cycle, injection string → all rejected, zero rows written
- Reconciliation: advance boundary, confirm deal_reconciliation_log row with metric_key
- Builder + chat-NL: identical AST, both through same validator

---

## Dependencies

| Stage | Depends on | Status |
|---|---|---|
| 1 (Schema) | — | Ready |
| 2 (Evaluator) | 1 | Ready |
| 3 (Rollup) | 2 | Ready |
| 4 (Derivation) | 3 + Phase 2 periodic model | Ready |
| 5 (UI) | 4 | Frontend (React) |
| 6 (Acceptance) | All above | Needs DB + live deal |

---

## Execution Strategy

Start with Stage 1 (schema) and Stage 2 (safe evaluator) — they are pure backend, no frontend needed. Stage 3 (rollup) and Stage 4 (derivation) follow. Stage 5 (UI) is frontend and may need a separate frontend-focused pass.

Parallelism: Stage 1 and Stage 2 can be built in parallel (schema is SQL, evaluator is TypeScript). Stage 3 depends on Stage 2. Stage 4 depends on Stage 3 + existing periodic model.
