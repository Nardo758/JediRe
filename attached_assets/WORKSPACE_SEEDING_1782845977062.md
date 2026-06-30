# DISPATCH — STEP 1: DEFAULT WORKSPACE SEEDING (TWO-PHASE, GATED)

**Shape:** PHASE 1 READ-ONLY — scope exactly who/what is orgless, propose the seeding plan, STOP.
PHASE 2 (the writes) runs only on explicit human approval of the Phase 1 counts. One dispatch, hard
gate in the middle.
**Goal:** every user belongs to at least one org, so later steps (org_id-required, null-row
backfill, read-scoping) have a foundation. This step does NOT touch properties, does NOT add the
properties org_id column, does NOT scope any reads — those are later sequenced dispatches.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Verification rule (S1-01):** seeded rows proven by live before/after DB queries, not by reported
write counts.
**Report to:** `docs/audits/WORKSPACE_SEEDING_VERDICT.md`

---

## CONTEXT (from the readiness trace — not re-litigated)

- Membership is a live join table `org_members(id, org_id, user_id, role, invited_by, joined_at, updated_at)`.
- 17 users total; only 5 in `org_members`; **12 users have no org at all**.
- 6 deal rows have null `org_id`.
- Deal creation looks up "first org membership LIMIT 1" → users with no org get null. Seeding fixes
  the root cause for those 12.
- One user (`6253ba3f`) is in 34 orgs — DO NOT seed them a new org; they're over-covered, not under.

This dispatch only gives the 12 orgless users a home workspace. The 6 null-org deals are scoped here
but backfilled in PHASE 2 only if their owner's org becomes unambiguous after seeding.

---

## PHASE 1 — SCOPE (READ-ONLY, STOP AT THE COUNTS)

**1. The 12 orgless users — exact list.**
```sql
SELECT u.id, u.email, u.created_at
FROM users u
LEFT JOIN org_members m ON m.user_id = u.id
WHERE m.user_id IS NULL
ORDER BY u.created_at;
```
Paste the full list. Confirm the count is 12 (reconcile against the trace; if it moved, note it).

**2. The 6 null-org deals — whose are they?**
```sql
SELECT d.id, d.name, d.created_by, d.org_id, d.created_at,
       (SELECT COUNT(*) FROM org_members m WHERE m.user_id = d.created_by) AS owner_org_count
FROM deals d
WHERE d.org_id IS NULL
ORDER BY d.created_at;
```
Paste it. For each null-org deal, the `owner_org_count` tells us the backfill story:
   - owner has exactly 1 org (after seeding) → deal backfills to that org unambiguously
   - owner has 0 orgs now → will have 1 after seeding → backfills to the seeded org
   - owner has >1 org (e.g. the 34-org user) → AMBIGUOUS, cannot auto-assign, flag for manual decision

**3. Decide the seeding shape (propose, do not run):**
   - One default org PER orgless user (personal workspace each), named e.g. `"<email>'s Workspace"`,
     with that user as `org_members.role = 'owner'` (confirm the valid `role` enum values first —
     query the role column's allowed set; do not guess the owner label).
   - State the exact INSERTs that would run: N org rows + N org_members rows (N = 12, or the
     reconciled count).
   - State the deal-backfill plan: which of the 6 null-org deals become unambiguous after seeding
     (auto-assignable) and which stay AMBIGUOUS (the 34-org user's deals — leave null, flag).

**4. Confirm the role vocabulary** before proposing membership rows:
```sql
SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
WHERE t.typname ILIKE '%role%' ORDER BY e.enumsortorder;
-- or, if role is text:
SELECT DISTINCT role FROM org_members;
```
Use a valid existing role value for the workspace owner. Paste what you found.

**=== HARD STOP. Phase 1 deliverable = the 12-user list, the 6-deal ownership breakdown, the valid
role value, and the proposed INSERTs + backfill plan with auto-assignable vs ambiguous split. Do NOT
run Phase 2 without explicit approval of these counts. ===**

---

## PHASE 2 — SEED (ONLY AFTER HUMAN APPROVES)

1. **Re-confirm counts unchanged** since Phase 1 (re-run query 1; if the orgless count moved, STOP
   and re-scope — someone signed up in between).
2. **Create one workspace per orgless user** + the matching `org_members` row (user as owner). Paste
   the INSERTs run and row counts.
3. **Verify every user now has an org:**
   ```sql
   SELECT COUNT(*) FROM users u LEFT JOIN org_members m ON m.user_id=u.id WHERE m.user_id IS NULL;
   ```
   Expected: **0**. Paste it.
4. **Backfill the auto-assignable null-org deals** (owners now with exactly 1 org). Paste the UPDATE
   and the after-state. Leave the AMBIGUOUS deals (multi-org owner) null — do NOT guess their org.
5. **Report remaining null-org deals** and why each is still null (the ambiguous ones), as a flagged
   open item for the multi-org current-workspace decision (a separate product question).

---

## DELIVERABLE

- SHA + Phase 1 scope (12 users, 6 deals broken down, valid role value, proposed plan) → STOP
- Phase 2 (post-approval): seeded orgs/members, "0 orgless users" verification, deals backfilled vs
  left-ambiguous
- One-line status: N workspaces seeded, 0 orgless users remain, M deals backfilled, K left ambiguous

---

## OUT OF SCOPE — do NOT do these here

- Properties org_id column-add (Step 2, structural, separate dispatch — it's the next one).
- Read-scoping the deals list / deal-access checks (Step 4, the large mechanical pass).
- The multi-org "current workspace" selection bug (the 34-org user's deal-creation ambiguity) — a
  product decision the read-scoping pass will force; flag, don't solve.
- The 34-org user — do NOT seed them anything; investigate whether those 34 are real vs test is a
  SEPARATE question, not this dispatch's job.

**Phase 1 read-only, ends at a STOP. Phase 2 is a production write (new orgs + memberships + deal
backfill) and runs only on explicit approval of the Phase 1 counts.**
