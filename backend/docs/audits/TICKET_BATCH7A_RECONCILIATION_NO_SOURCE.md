# TICKET: Batch7A — $72.9M reconciliation with P50=n/a across all methods

**Severity:** P0 — potential value-from-nothing fabrication
**Discovered:** 2026-07-18 during D3 integration proof run
**File:** `financial-model-engine.service.ts` (Batch7A purchase-price reconciliation)

## Symptom
Log line during Bishop build:
```
[info] [Batch7A] Reconciled purchase price for 3f32276f-aacd-4da3-b306-317c5109b403: 
$72,961,291 (DIVERGENT, P50=n/a)
[info] [Batch7A] Methods: om=$n/a, t12=$n/a, agent=$n/a, broker=$n/a, 
costar=$n/a, appraisal=$n/a, bpo=$n/a, tax=$n/a, user=$n/a, market=$n/a
```

## Impact
A reconciled value of $72,961,291 was produced while all ten methods report `P50=$n/a` (no visible contributing method). On a $60M deal, a $73M reconciliation with no traceable source is either:
- A display gap (methods computed but not surfaced in the log), or
- A value-from-nothing — the fabrication pattern's signature.

## Questions to Answer
1. Which method(s) actually contributed to the $72.9M figure? If none, where did it come from?
2. Is the P50=n/a in the log a formatting bug (values exist but aren't stringified), or are the methods genuinely absent?
3. Does the reconciliation algorithm have a fallback that fabricates when all methods are absent?

## Fix Direction
Trace the reconciliation path in Batch7A. If the value is real, document which method produced it. If the value is fabricated, remove the fallback or require at least one method with non-null P50.

## Acceptance
- [ ] Re-run Bishop build; either (a) the log shows the actual contributing method(s), or (b) the reconciliation throws/returns null when no methods have data
- [ ] If $72.9M was correct, the source method is named in the log
