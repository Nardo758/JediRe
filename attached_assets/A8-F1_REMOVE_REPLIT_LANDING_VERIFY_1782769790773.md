# DISPATCH — A8-F1 REMOVE: LANDING VERIFICATION IN REPLIT (READ-ONLY)

**Mode:** READ-ONLY. Verify the fix is LIVE in the running Replit instance, return a verdict, STOP.
Change nothing. If something didn't land, report it — do not re-apply.
**Target:** the actually-running Replit app (frontend Vite :5000, backend :4000), NOT the repo source.
**Verification rule (S1-01):** "landed" = pasted evidence from the RUNNING instance (rendered UI,
live network call, live DB query). Source diff / commit presence / "I edited the file" are REJECTED.
This is the exact trap from the forceReseed incident: source changed, running behavior unchanged.
**Report to:** `docs/audits/A8-F1_REMOVE_REPLIT_LANDING_VERDICT.md`

---

## THE FAILURE MODE THIS CATCHES

Replit can hold any of these while source looks correct:
- working tree edited but dev server serving a stale build / HMR didn't pick it up
- change committed to repo but the running Repl is on a different checkout
- frontend rebuilt but backend not restarted (or vice versa)
- edit made in a file that isn't the one the running route actually imports

So every check below hits the **running instance**, not the file.

---

## VERDICT TO RETURN (one line)

A8-F1 REMOVE is **[ FULLY LANDED / PARTIALLY LANDED / NOT LANDED ]** in the running Replit instance.

---

## CHECKS — against the running app

**0. Confirm what's actually running.** Paste: the running commit SHA the Repl is serving
(`git rev-parse HEAD` in the Repl's checkout), and confirm frontend + backend processes are up
(`:5000`, `:4000` responding). If the Repl's HEAD ≠ the branch that carried the fix
(`claude/fix-a8f1-remove-path-a` or wherever it merged) → verdict NOT LANDED, stop here and report
the SHA mismatch.

**1. Option gone — in the rendered UI.** Load the create-deal form in the running app. Paste a DOM
dump or screenshot of the `deal_category` control showing **no Portfolio option**. A source grep
showing it removed is NOT sufficient — it must be absent from what the browser renders.

**2. Add Asset repointed — live click.** Click the Dashboard "Add Asset" button in the running app.
Confirm it opens the F3PortfolioView modal and does NOT navigate to `/deals/create`. Paste:
- the resulting URL / rendered modal, and
- the network request fired on submit — must be `POST /api/v1/portfolio/assets`, 2xx, with the
  returned `properties` row id.

**3. Old path is dead — live attempt.** Try to reach the old broken flow in the running app
(construct a create-deal request with `deal_category:'portfolio'` if any surface still allows it).
Expected: no UI path constructs it. If you can still submit it, paste the response — that's a
PARTIAL landing, report it.

**4. No new broken rows — live DB.**
```sql
SELECT id, name, deal_category, status, created_at
FROM deals
WHERE deal_category = 'portfolio'
ORDER BY created_at DESC;
```
Paste result. Any row with `created_at` AFTER the fix deploy = the old path is still live → NOT
LANDED. Pre-existing rows: flag for separate review, do not delete.

**5. Path B still works end-to-end — live.** Create one asset through the repointed Add Asset flow
in the running app. Then:
```sql
SELECT id, ownership_status, is_portfolio_asset, created_at
FROM properties
WHERE id = '<new asset id>';
```
Paste result. Expected: `ownership_status='portfolio'`, `is_portfolio_asset=TRUE`, created just now,
no `deals` row required. (Clean up the test asset after, or flag it.)

---

## DELIVERABLE

- Running SHA + process-up confirmation (check 0)
- One-line verdict (FULLY / PARTIALLY / NOT LANDED)
- 5-row evidence table, each row carrying RUNNING-INSTANCE evidence (rendered UI / live network /
  live DB) — not source citations
- Pasted outputs from checks 2, 4, 5
- **If PARTIAL or NOT LANDED:** name exactly which of the 3 moves is missing from the running app
  and the most likely cause (stale build / wrong checkout / process not restarted / wrong file
  edited) — diagnosis only, no fix.

**STOP at verdict. Do not re-apply or repair. A non-landing result comes back to the human for a
fix dispatch, not an in-place patch.**
