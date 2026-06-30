# DISPATCH — BACKFILL UNDER-PROVISIONED automation_level (TWO-PHASE, GATED)

**Shape:** PHASE 1 is READ-ONLY — scope the affected population, paste the exact set and count, STOP.
PHASE 2 (the UPDATE) does NOT run until the human approves the Phase 1 count. One dispatch, hard gate
in the middle.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Verification rule (S1-01):** the corrected rows are proven by live before/after DB queries, not by
the UPDATE's reported row count alone.
**Report to:** `docs/audits/AUTOMATION_LEVEL_BACKFILL_VERDICT.md`

**Precondition (confirm before anything):** the `provisionUser` fix
(`fix(billing): provision automation_level from tier config`) is merged AND live on the running
instance. If it is NOT deployed, STOP — backfilling before the writer is fixed lets the next
`.created` event re-break rows. Paste the running SHA and confirm the fix commit is in its ancestry.

---

## PHASE 1 — SCOPE (READ-ONLY, STOP AT THE COUNT)

Find every UCB row whose `automation_level` is BELOW its tier's `maxAutomationLevel`. This is the
affected population — wider than the two operator rows; includes any tier-above-scout user
provisioned through `.created` who never fired `.updated`.

**1. The affected set.** TIER_CONFIG maxAutomationLevel per tier (confirm the live values, paste
them): scout=1, operator=2, principal=3, institutional=? (read it, don't assume). Then:
```sql
SELECT user_id, subscription_tier, automation_level
FROM user_credit_balances
WHERE (subscription_tier = 'operator'       AND automation_level < 2)
   OR (subscription_tier = 'principal'      AND automation_level < 3)
   OR (subscription_tier = 'institutional'  AND automation_level < <institutional_max>)
ORDER BY subscription_tier, automation_level;
```
Paste the FULL result and a COUNT by tier. (Scout excluded — its max is 1, nothing to raise. Confirm
no scout row has automation_level < 1 / null, just in case.)

**2. Sanity checks before proposing any write:**
   - Any row with `automation_level` ABOVE its tier max? (Over-provisioned — out of scope, but flag
     it; it implies a different bug.)
   - Any NULL automation_level? (Handle explicitly — NULL < n may not behave as expected in the
     predicate; surface these separately.)
   - Any tier value not in TIER_CONFIG? (Legacy/unknown tier — flag, do not touch.)

**3. Proposed UPDATE — write it out, do NOT run it:**
```sql
-- FOR HUMAN APPROVAL — not executed in Phase 1
UPDATE user_credit_balances
SET automation_level = <tier max>
WHERE <exact predicate matching the affected set above>;
```
State the exact predicate and the expected affected row count (must equal the Phase 1 count).

**=== HARD STOP. Phase 1 deliverable = the affected set, the count by tier, the sanity-check
results, and the proposed UPDATE. Do NOT proceed to Phase 2 without explicit human approval of the
count. ===**

---

## PHASE 2 — APPLY (ONLY AFTER HUMAN APPROVES THE COUNT)

Do not begin until the human has seen the Phase 1 count and said go.

1. **Snapshot before.** Capture the affected rows' current state (the Phase 1 query result IS the
   before-snapshot — confirm it's unchanged since Phase 1 by re-running it; if the count moved,
   STOP and re-scope, something provisioned in between).
2. **Run the approved UPDATE.** Per-tier or single predicate — paste the statement run and the rows-
   affected count.
3. **Verify after.** Re-run the Phase 1 scoping query. Expected: **zero rows** (everyone now at or
   above tier max). Paste it. A non-empty result = backfill incomplete, report.
4. **Confirm no over-correction.** Verify no row was pushed ABOVE its tier max by the UPDATE:
   ```sql
   SELECT user_id, subscription_tier, automation_level FROM user_credit_balances
   WHERE (subscription_tier='operator' AND automation_level>2)
      OR (subscription_tier='principal' AND automation_level>3)
      OR (subscription_tier='institutional' AND automation_level><inst_max>);
   ```
   Expected: zero. Paste it.

---

## DELIVERABLE

- SHA + precondition confirmation (provisionUser fix is live)
- **Phase 1:** affected set, count by tier, sanity-check findings, proposed UPDATE — then STOP
- **Phase 2 (post-approval):** statement run, rows affected, after-verification showing zero
  remaining under-provisioned, zero over-provisioned
- One-line status: N rows backfilled across M tiers, zero remaining under/over

---

## OUT OF SCOPE

- The Stripe test-event verification (F3's last item — `.created`/`.updated` real-event wiring).
  Separate dispatch.
- Any change to provisioning or updateTier code — both are fixed; this is data only.
- Over-provisioned rows (if any surface) — flag for separate review, do not "correct" downward
  without understanding how they got there.

**Phase 1 is read-only and ends at a STOP. Phase 2 is a production entitlement write and runs only
on explicit approval of the Phase 1 count.**
