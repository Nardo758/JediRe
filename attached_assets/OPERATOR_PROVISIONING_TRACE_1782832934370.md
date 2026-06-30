# DISPATCH — OPERATOR PROVISIONING PATH TRACE (READ-ONLY)

**Mode:** READ-ONLY. Find how `operator` UCB rows get created/updated and whether those paths set
`automation_level`. Diagnose the anomaly. Fix nothing, backfill nothing.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** every provisioning path claim carries `file:line` of the write, and the
anomaly claims carry pasted live DB output.
**Report to:** `docs/audits/OPERATOR_PROVISIONING_TRACE_VERDICT.md`

---

## THE ANOMALY (what we're explaining)

F2/F3 reverify found: both live `operator` UCB rows have `automation_level = 1`, but
TIER_CONFIG says operator `maxAutomationLevel = 2`. Meanwhile `updateTier` (`creditService.ts:287`)
provably sets automation_level to the tier max when called. So the handler is correct AND the live
rows are wrong — which is only possible if some path reaches `operator` WITHOUT calling `updateTier`,
or did so before line 287 existed.

**The question:** is this a stale-data artifact (rows provisioned before the fix, harmless once
backfilled) or a LIVE wiring gap (a current path still provisions operator without raising
automation_level, so the next operator user also lands wrong)? The backfill is only safe under the
first; under the second it papers over a recurring bug.

---

## TRACE — find every writer of operator-tier UCB rows

**1. Enumerate writers.** Grep every site that writes `user_credit_balances.subscription_tier` or
   `automation_level`:
   ```
   grep -rniE "subscription_tier|automation_level" backend/src --include=*.ts | grep -iE "update|insert|set|\.values\(|upsert"
   ```
   For each writer, record `file:line` and whether it sets `automation_level` alongside the tier.
   The ones that set tier but NOT automation_level are the suspects.

**2. Classify each tier-writer:**
   | writer | `file:line` | sets automation_level? | how tier reached | reachable now? |
   The columns that matter: does it set automation_level, and is it a LIVE path (mounted route /
   active webhook / running job) vs dead/seed code.

**3. The signup/provisioning path.** How does a user first GET a UCB row, and at what tier/
   automation_level? Trace initial provisioning (signup, first subscription, free-tier default).
   `file:line`. If initial provisioning sets automation_level from a default/literal (e.g. hardcoded
   `1`) rather than from TIER_CONFIG, that's a candidate cause — anyone provisioned straight to
   operator (or migrated) without going through `updateTier` lands at the default.

**4. The two operator rows — provenance.**
   ```sql
   SELECT user_id, subscription_tier, automation_level, created_at, updated_at
   FROM user_credit_balances
   WHERE subscription_tier = 'operator';
   ```
   Paste it. Then: do `created_at` / `updated_at` predate the `creditService.ts:287` fix commit
   (check the commit date)? If both rows predate the fix and nothing has updated them since → stale
   artifact. If either was created/updated AFTER the fix and still shows automation_level=1 → a live
   path is provisioning operator wrong → wiring gap.

**5. Did these two rows ever pass through updateTier?** If there's an audit/log trail
   (`ai_usage_log`, a tier-change log, updated_at vs created_at divergence), determine whether
   `updateTier` ever ran for these users. If created_at == updated_at, the row was written once and
   never updated → it never went through the upgrade handler.

---

## VERDICT TO RETURN (one line)

Operator automation_level anomaly is **[ STALE ARTIFACT — rows predate fix, no live path reproduces / LIVE WIRING GAP — a current path provisions operator without setting automation_level / MIXED ]**.

---

## DELIVERABLE

- SHA + READ-ONLY header
- Writer enumeration table (every tier/automation_level writer, which set automation_level, which are live)
- The two operator rows with timestamps, vs the fix commit date
- One-line verdict: STALE / LIVE GAP / MIXED
- **If STALE:** backfill is safe — state that, but the backfill itself is a separate human-approved
  dispatch (it's a production data write).
- **If LIVE GAP:** name the exact path (`file:line`) that provisions operator without automation_level.
  THAT becomes the fix target — and backfill alone would NOT close it (next operator user repeats the bug).
- **Implication for F3:** does this change F3's status? (F3 handler is confirmed; if a non-handler
  provisioning path exists, F3's "automation rises on tier change" guarantee has a hole independent
  of the Stripe wiring question.)

**STOP at verdict. No backfill, no fix. Backfill and any wiring fix are separate, each
human-approved, each verified against live data — a tier/automation write changes entitlements and
is not batch-applied.**
