# DISPATCH — B2a: ORG-ENTITLEMENT CORE (SHARED POOL + PER-MEMBER ATTRIBUTION)

**The keystone of the org arc.** Moves entitlement from per-USER to per-ORG: an org has ONE shared
credit pool, any member draws from it, the gate reads/decrements the ORG balance, and every usage row
records WHICH member spent it (attribution baked in, not bolted on). This is what B2b (creation
paths) and B2c (admin view) build on, and what makes multi-user Institutional possible.
**Model (settled):** shared org pool (not per-member allocation); everyone in exactly one org (solo
tiers = org-of-one, Institutional = org-of-many); gate reads org-balance; per-member attribution for
reporting. Activity scope = usage-attribution + roster (NOT a full per-action audit log — deferred).
**Repo:** `Nardo758/JediRe.git` — branch `claude/b2a-org-entitlement`.
**Verification rule (S1-01):** proven LIVE — a member's AI call decrements the ORG pool (not their
personal balance), the row records the member, and the gate blocks on ORG balance. Billing stakes →
live run required.
**Report to:** `docs/audits/B2A_ORG_ENTITLEMENT_VERDICT.md`

---

## PHASE 1 — DESIGN THE LEDGER SHIFT (READ-ONLY, STOP)

Before changing enforcement, map the current per-user model and design the org-level one.

**1. Current state.** Where does the balance/cap live today?
   - `user_credit_balances.credits_remaining` + `monthly_credit_cap` — per-user. `file:line` of the
     gate (createMessage pre-flight) + decrement (reportStripeCost, from S5).
   - How does the gate currently resolve WHICH balance to check — `req.user.userId`? Confirm.

**2. The org-level model — design it, don't build yet.** Decide the storage shape:
   - **Option: org-level balance table** — a per-org credit pool (`org_credit_balances` or a column on
     `organizations`): `org_id, credits_remaining, monthly_cap, cycle_reset_at`. The gate reads THIS
     by the user's org_id.
   - **Option: reuse user_credit_balances keyed to the org owner** — simpler but conflates owner's
     personal balance with org pool; NOT recommended (breaks when owner ≠ sole spender).
   RECOMMEND the dedicated org-balance table — clean separation, the pool belongs to the org not a
   user. State the chosen shape + schema.

**3. Attribution design.** Every metered call must record the spending member. `ai_usage_log` already
   captures `user_id` — confirm it does, and confirm it ALSO captures/can-capture `org_id`. The dual
   record: decrement `org` pool, log `(org_id, user_id, cost)`. This is the per-member attribution
   B2c reports on. `file:line`.

**4. The resolution path.** A member fires a call → how do we get from `user_id` to their `org_id`?
   Via `org_members` (the join table, now clean — 1 row after B1). Confirm the lookup:
   `user_id → org_members.org_id → org_credit_balances`. For solo tiers (org-of-one) this is the
   user's own org; for Institutional (org-of-many) it's the shared org. Same path, both cases.

**=== STOP: report the current per-user gate/decrement sites, the chosen org-balance schema, the
attribution design, and the user→org resolution path. Approve the schema before Phase 2 builds it. ===**

---

## PHASE 2 — BUILD THE ORG-LEVEL LEDGER (after schema approved)

1. **Create the org-balance store** (per the approved schema): org credit pool, cap, cycle reset,
   keyed by `org_id`. Migrate the existing single real org (dd201183) to have a pool. `file:line`.
2. **Gate reads ORG balance.** Change the createMessage pre-flight gate: resolve `user_id → org_id`
   (via org_members), check the ORG pool, block if the ORG is out (not the user). `file:line`.
3. **Decrement ORG balance.** Change the S5 decrement (reportStripeCost): deduct from the ORG pool,
   not the user's personal balance. `file:line`.
4. **Attribution on every row.** Each usage row records `(org_id, user_id, markup-adjusted cost)` —
   org for the pool, user for reporting. `file:line`.
5. **Cycle reset at org level.** The S5 reset (invoice.paid webhook) resets the ORG pool, not
   per-user. `file:line`.
6. **Solo-tier correctness.** For an org-of-one (Scout/Operator/Principal — one member), the org pool
   IS effectively that user's allotment. Confirm the model degrades correctly to the solo case — a
   solo user's gate/decrement behaves exactly as S5 did, just resolved via their org. (This is the
   proof that the org model doesn't break the existing solo tiers.)

---

## ACCEPTANCE — live

1. **Org pool decrements, not user balance:** a member fires a metered call → the ORG pool drops by
   the markup-adjusted amount; confirm the decrement hit `org_credit_balances`, not a personal
   balance. Paste before/after of the org pool.
2. **Attribution recorded:** the usage row has BOTH `org_id` and `user_id`. Paste.
3. **Gate blocks on ORG balance:** drive an org's pool to zero via real usage → the next call from
   ANY member of that org is blocked (not just the member who spent it — the POOL is empty). Paste.
   (For the test, this can be a solo org; the multi-member proof comes when B2b enables invites.)
4. **Solo tier unbroken:** a Scout/Operator/Principal user (org-of-one) → gate + decrement + block
   behave exactly as S5 proved, now resolved via their org. Paste — proves the shift didn't break
   existing tiers.
5. **Cycle reset at org level:** simulate renewal webhook → org pool resets to full allotment. Paste.
6. **Resolution correct:** `user_id → org_id → pool` resolves right for dd201183. Paste.
7. Idempotency: no double-decrement. Cleanup.

---

## DELIVERABLE

- SHA + Phase 1 (current sites, org-balance schema, attribution + resolution design) → STOP
- Phase 2 (post-approval): org-balance store, gate/decrement/reset moved to org-level, attribution on
  every row, solo-tier degradation confirmed
- Live acceptance 1-7
- One-line: entitlement now ORG-level (shared pool); gate reads/decrements org balance; every usage
  row attributes to member; solo tiers unbroken; ready for B2b (creation paths) + B2c (admin view)

---

## OUT OF SCOPE (the rest of B2 + arc — sequenced after)

- **B2b — account-origin paths:** wire signup/bridge/invite to all assign org membership (bridge is
  the gap B1 found; invite is new, Institutional-only). NEXT after B2a.
- **B2c — admin activity view:** org-admin report of per-member usage + roster (reads the attribution
  B2a records). After B2b.
- Institutional invites / seat model — B2b.
- B3 org-scoped subscription, B4 data scoping, B5 Institutional tier — later.
- Full per-action audit log (every deal viewed etc.) — deferred; B2a records usage-attribution only.

**B2a is the keystone: entitlement moves to the org, attribution is native (not retrofitted). The two
proofs that matter: acceptance #1 (org pool decrements, not user) and #4 (solo tiers still work). The
model must serve org-of-one and org-of-many with the SAME path.**
