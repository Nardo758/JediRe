# DISPATCH — STUB GUARD ON PORTFOLIO CONSUMERS (FIX)

**Problem:** three live backend routes read `deal_category='portfolio'` as a "live portfolio deal"
signal and will surface the 9 orphaned synthetic stubs (NULL property name, zero
`deal_monthly_actuals`) as if they were real assets. This is a visible data-quality bug on three
surfaces NOW, not a deferred cleanup. Add an exclusion predicate at each read site.
**Scope:** the three named routes only. No row deletion, no migration, no touching the stub rows.
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-portfolio-stub-guard`, one commit.
**Verification rule (S1-01):** "done" = pasted live API response showing stubs gone from each
endpoint, NOT green tests or grep. Each acceptance item carries a runtime proof.
**Report to:** `docs/audits/PORTFOLIO_STUB_GUARD_VERDICT.md`

---

## THE GUARD PREDICATE — settle it FIRST (one decision, applied three times)

Before editing routes, decide the exclusion condition and confirm it actually separates the 9 stubs
from real portfolio assets. Candidate signals, in order of preference:

1. **`properties.name IS NOT NULL`** — all 9 stubs have NULL name; real assets (Frisco, McKinney,
   Duluth, Highlands) have names. Likely the cleanest discriminator.
2. **presence of ≥1 `deal_monthly_actuals` row** — all 9 stubs have zero; real assets have history.

Run this to confirm whichever you pick cleanly partitions stubs from real:
```sql
-- does name-null cleanly separate the 9 stubs from the real assets?
SELECT p.name IS NULL AS name_null,
       (SELECT COUNT(*) FROM deal_monthly_actuals dma WHERE dma.property_id = p.id) AS actuals_rows,
       COUNT(*) AS n
FROM properties p
WHERE p.ownership_status = 'portfolio' OR p.id IN (
  SELECT property_id FROM deal_properties WHERE deal_id IN (/* the 9 stub deal_ids */)
)
GROUP BY 1, 2
ORDER BY 1, 2;
```
Pick the predicate that puts all 9 stubs on one side and every real asset on the other. Paste the
result and state the chosen predicate. If NO single predicate cleanly separates them, STOP and
report — do not guess.

---

## THE THREE EDITS

Apply the SAME chosen predicate at each read site. For each: cite `file:line`, show the query/filter
before and after.

1. **`portfolio.routes.ts`** — the handler(s) reading `deal_category='portfolio'`. Add the exclusion.
2. **`grid.routes.ts`** — same.
3. **`dashboard.routes.ts`** — same.

If any of the three reaches the data through a shared service/query-builder rather than an inline
query, prefer guarding the shared function ONCE and confirming all three consume it — but verify
that's actually true (all three call it) before centralizing. Do not assume a shared path; trace it.

---

## ACCEPTANCE (each = pasted live API response)

For each of the three endpoints, hit it against the running app and paste the response BEFORE
(showing stubs present, if you captured it) and AFTER (stubs absent):

1. **`portfolio.routes.ts` endpoint** — response no longer includes any of the 9 stub deal/property
   ids; real portfolio assets still present. Paste the asset list.
2. **`grid.routes.ts` endpoint** — same.
3. **`dashboard.routes.ts` endpoint** — same.
4. **Real assets unharmed** — confirm Frisco, McKinney, Duluth, Highlands still appear on all three
   surfaces. A guard that hides stubs by also hiding real assets is a regression. Paste evidence.
5. **Stubs still in DB** — confirm the guard HID them, did not DELETE them:
   ```sql
   SELECT COUNT(*) FROM deals WHERE deal_category = 'portfolio';
   ```
   Expected: still 9 (or your reconciled count). Guard is a read-filter, not a delete.

---

## DO NOT

- Do not delete or modify the 9 stub rows. Read-filter only.
- Do not touch Westside Lofts — it's Open Item #2, separate review.
- Do not write a migration.
- Do not centralize the three guards into one function UNLESS you've traced that all three actually
  share a code path. A false-shared refactor is worse than three explicit predicates.

---

## PR

- Branch `claude/fix-portfolio-stub-guard`, one commit:
  `fix(portfolio): exclude orphaned stub deals from portfolio/grid/dashboard reads`
- PR body: chosen predicate + partition query result, three before/after edits with `file:line`,
  the 5 acceptance proofs pasted inline (live API responses + the count query).

**STOP and report if:** no single predicate cleanly separates the 9 stubs from real assets, or any
of the three routes turns out NOT to read `deal_category='portfolio'` as claimed (re-verify the
triage's consumer list against the running code before editing).
