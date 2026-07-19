# TICKET-001: Batch7A — Reconciled $72.9M purchase price with no visible contributing methods
**Severity: P1**  
**File: `backend/src/services/valuation/valuation-grid.service.ts`**  
**Cross-ref: D3 proof run log, Batch7A reconciliation step**

## Finding
During the D3 integration proof run on Bishop (deal_id: `3f32276f-aacd-4da3-b306-317c5109b403`), Batch7A reconciled a **$72,961,291 purchase price** while all ten methods reported **P50=$n/a** (no visible contributing method). The DIVERGENT band was **$55M–$90M**, yet no method surfaced its computed value.

On a $60M deal, a $73M reconciliation without visible method provenance is either:
- **Display gap**: methods computed but not surfaced in the evidence block, OR
- **Value from nothing**: the reconciliation produced a number with no contributing source

## Required Trace
1. In `valuation-grid.service.ts`, trace the reconciliation path for `purchase_price`
2. Identify which of the ten methods actually contributed to the $72.9M value
3. If methods computed but were not surfaced → **display bug** (fix evidence block)
4. If no method contributed → **fabrication pattern** (critical — the reconciliation produced value from nothing)

## Evidence
```
Batch7A reconciled a $72,961,291 purchase price while all ten methods report P50=$n/a.
A reconciled value with a $55M–90M DIVERGENT band and no visible contributing method
is either a display gap or a value from nothing.
```

## Suggested Next Step
Run a trace script in Replit that calls the valuation grid service directly for Bishop and logs every method's computed value before reconciliation. Compare against the reconciled output.

---

# TICKET-002: M11/D-MOD-2 — Financing fields absent from module-authority registry after debt arc
**Severity: P1**  
**Files: `backend/src/services/module-wiring/d-mod-extractors.ts`, `backend/src/services/module-wiring/assumption-module-mapping.config.ts`**  
**Cross-ref: D3 proof run log, M11 module wiring**

## Finding
After the entire debt arc (B2 ProFormaYear1Seed rail built, M11 debt sizing wired), the **D-MOD-2 resolver** reports **no value for `financing.loanAmount` / `interestRate`**. The log shows:
```
M11 has no value for financing.loanAmount/interestRate in the D-MOD-2 resolver
```

This is the **trigger-not-wired class**: B2 built the ProFormaYear1Seed rail, but D-MOD-2's module-authority registry appears to be a **parallel rail** that M11 never registered into. The resolver falls back past the authoritative module.

## Two Possibilities
1. **D-MOD-2 is legacy** → retire it from the field map; M11 is the canonical source
2. **D-MOD-2 is live** → wire M11's publish into D-MOD-2's registry so the resolver picks up financing fields

## Required Trace
1. Check `assumption-module-mapping.config.ts` for the financing field → module mapping
2. Check `d-mod-extractors.ts` for how D-MOD-2 resolves financing fields
3. Determine if M11 publishes to the same registry D-MOD-2 reads from
4. If not, identify the wiring gap

## Suggested Next Step
Add debug logging to D-MOD-2 resolution for financing fields on Bishop, run a build, and inspect the fallback chain.

---

# TICKET-003: Batch6 — `_concessionsOperatorOverride` undefined access silently skips concessions/revenue batch on Bishop
**Severity: P2**  
**File: `backend/src/services/financial-model-engine.service.ts`**  
**Cross-ref: D3 proof run log, Batch6-Revenue step**  
**Cross-link: Rebuild path hydration (same root cause class as buildModel(undefined, ...) bug)**

## Finding
During the D3 proof build on Bishop, Batch6-Revenue emitted:
```
Cannot read properties of undefined (reading '_concessionsOperatorOverride')
```

This is a **warn-level silent skip** — the concessions/revenue batch does not apply to the primary test deal at all. The undefined access means the batch tried to read a property from an object that was not fully hydrated.

## Root Cause Hypothesis
Same species as the rebuild path under-hydration bug: the assumptions object passed to Batch6 is missing the `operatorStance` or `concessionsConfig` sub-object that `_concessionsOperatorOverride` lives on. The `buildAssumptionsFromStore` fix for F5-3/F5-6 only hydrated financing+revenue+expense fields; concessions operator overrides may be in a separate branch.

## Required Trace
1. In `financial-model-engine.service.ts`, find the Batch6/Revenue batch code
2. Trace where `_concessionsOperatorOverride` is read and what object it expects
3. Check if `buildAssumptionsFromStore` or the bridge hydrates the parent object
4. **Do not add `?.` guards** — that buries the structural bug. Fix the hydration.

## Suggested Next Step
Run a script that calls `buildAssumptionsFromStore(BISHOP_DEAL_ID)` and inspects the returned assumptions object for concessions/operator stance fields. Identify the missing branch.

---

# TICKET-004: Logging bugs — mojibake in M26/M27 line + `[object Object]` stringification
**Severity: P3**  
**Files: `backend/src/services/financial-model-engine.service.ts` (M26/M27 logs)**  
**Cross-ref: D3 proof run log**

## Finding
Two logging defects observed in the D3 proof run:

1. **Mojibake in M26/M27 log line**: A log line from the M26/M27 tax enhancer contained garbled/encoded characters instead of clean field values.

2. **`[object Object]` in log output**: A structured log field was stringified as `[object Object]` instead of its JSON representation.

## Fixes
Both are one-liners:
- Mojibake: check the template literal or string concatenation in the M26/M27 enhancer log line; likely a Buffer or encoded string being concatenated raw
- `[object Object]`: replace `+ obj` with `JSON.stringify(obj)` or use the logger's structured field passing (`{ field: obj }` instead of string concatenation)

## Suggested Next Step
Search `financial-model-engine.service.ts` for the M26/M27 log lines and the `[object Object]` pattern. Fix in place — no trace needed, these are cosmetic.
