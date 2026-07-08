# DISPATCH — QW-1: Capital-Structure Mock-Data Fix

**#1 of 6. GATE: none — execute immediately. Type: code fix, fast.**
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Finding source:** `SOURCE_TO_CAPSULE_PIPELINE_AUDIT.md` Part E, `DEAL_CREATION_PIPELINE_AUDIT.md` P3.
**Standing rules:** S1-01 live evidence · frontend-only diff · no backend/engine contact.

## The bug
`CapitalStructureSection.tsx:108` — `stack = defaultCapitalStack` is HARDWIRED (not just a useState initial value per the deeper Part E read). `DebtTab.tsx:72` uses `defaultCapitalStack` as useState initial. On a real deal, if the live fetch fails silently or isn't wired, the surface renders MOCK capital structure — the recurring false-green class, and it's LIVE (users may see fabricated debt/equity today).

## Fix
1. **Confirm the live source first:** what endpoint/store should feed capital structure? (Post-D2b/R3 this should be the built model's `sourcesAndUses` / `debtMetrics`, not a mock constant.) file:line the intended live path.
2. `CapitalStructureSection:108` and `DebtTab:72`: replace the hardwired/initial `defaultCapitalStack` with the live fetch; mock becomes a LAST-RESORT fallback ONLY, and when it engages it must be VISIBLE (a "no model data — showing placeholder" state), never silent.
3. If no model exists on the deal (fresh/unbuilt): show honest empty/`modelNotBuilt` state, not mock numbers.

## Acceptance
1. Bishop (built): capital-structure surface shows his real $21M loan / $39.37M equity from the model payload — pasted screenshot + the payload fields beside it.
2. A deal with no build: shows honest-absence, NOT `defaultCapitalStack` mock values.
3. `git diff --stat` frontend-only.
4. Grep proof: `defaultCapitalStack` no longer reachable as a silent default on any live render path (only as a visible-fallback or removed).

## OUT OF SCOPE
Backend/engine · the create-path gaps (CREATE-1) · anything not touching these two mock-interception sites.
