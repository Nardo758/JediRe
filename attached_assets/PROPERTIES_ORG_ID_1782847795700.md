# DISPATCH — STEP 2: properties.org_id COLUMN + DERIVABLE BACKFILL (TWO-PHASE, GATED)

**The structural one.** `properties` has no `org_id` column on a 101-column table, and properties
have no owner-org link today — so "which org does this property belong to" may not be derivable from
the row alone. PHASE 1 (read-only) determines the derivation path per property and counts the
underivable ones. PHASE 2 (gated) adds the column and backfills ONLY the derivable set; ambiguous
properties land null-and-flagged, never guessed.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Verification rule (S1-01):** derivation paths and backfill proven by live DB joins/queries, not
assumed. Every property's assigned org traces to a real link.
**Report to:** `docs/audits/PROPERTIES_ORG_ID_VERDICT.md`

**Precondition:** the vocab finalization (is_fixture, 'system' user_type, Phase 2 relabels) is live.
Confirm running SHA carries it. Not strictly required for THIS migration, but keeps the sequence
honest — paste the SHA.

---

## PHASE 1 — DETERMINE DERIVABILITY (READ-ONLY, STOP)

The question is not "how many properties" — it's "for how many can we KNOW the right org, and how."

**1. Inventory + current linkage.**
```sql
SELECT COUNT(*) AS total_properties FROM properties;
-- how do properties connect to deals (which carry org_id)?
SELECT column_name FROM information_schema.columns
WHERE table_name='properties' AND (column_name ILIKE '%deal%' OR column_name ILIKE '%owner%' OR column_name ILIKE '%user%' OR column_name ILIKE '%org%');
-- and the join table if deals link to properties from their side:
SELECT column_name FROM information_schema.columns
WHERE table_name='deals' AND column_name ILIKE '%propert%';
SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%deal_propert%' OR table_name ILIKE '%property_deal%';
```
Establish the actual link path: property → ? → org. Likely via `deals.property_id` /
`deal_properties` join → `deals.org_id`. Confirm which exists. `file:line` for how the app currently
associates a property with a deal/owner.

**2. Derivation tiers — classify EVERY property into exactly one:**
   - **TIER 1 — derivable via deal:** property linked to one deal that has a non-null org_id →
     org is that deal's org. Unambiguous.
   - **TIER 2 — derivable via creating user:** property has a creator/owner user_id whose org is
     unambiguous (user in exactly 1 org) → org is that user's org.
   - **AMBIGUOUS — multiple candidate orgs:** property links to multiple deals across different orgs,
     OR its owner is the 34-org user, OR conflicting signals. Cannot auto-assign.
   - **UNDERIVABLE — no link at all:** no deal, no clear owner, or owner is an agent/system account.
     The 290-unit Highlands import and any portfolio-imported assets may land here — check.
   Produce a count per tier and the full per-property list with its tier and the derived org (or why
   not).
   ```sql
   -- example derivation probe (adapt to real link path found in step 1):
   SELECT p.id, p.name,
          COUNT(DISTINCT d.org_id) AS distinct_candidate_orgs,
          MIN(d.org_id) AS sole_org
   FROM properties p
   LEFT JOIN deals d ON d.property_id = p.id   -- or via deal_properties join
   GROUP BY p.id, p.name
   ORDER BY distinct_candidate_orgs DESC NULLS LAST;
   ```
   `distinct_candidate_orgs = 1` → Tier 1. `> 1` → ambiguous. `0/null` → fall to Tier 2 (user) then
   underivable.

**3. The named owned assets — explicit check.** Frisco, McKinney, Duluth, Highlands. What org does
   each derive to, and via which tier? These are your real portfolio — if any land AMBIGUOUS or
   UNDERIVABLE, that's the highest-priority manual assignment. Paste their derivation.

**4. Proposed column + backfill (write out, do NOT run):**
   - `ALTER TABLE properties ADD COLUMN org_id UUID NULL;` (nullable — ambiguous/underivable stay
     null. Do NOT add NOT NULL; a NOT NULL default would force a wrong org onto every property.)
   - The backfill statement(s) for Tier 1 and Tier 2 ONLY, with the exact derivation join.
   - Expected counts: N Tier1 + M Tier2 backfilled, K ambiguous/underivable left null.

**=== HARD STOP. Phase 1 deliverable: the link path, per-tier counts, the named-asset derivations,
the proposed column + backfill, and the explicit list of properties that will be left null. Approve
before Phase 2. ===**

---

## PHASE 2 — ADD COLUMN + BACKFILL DERIVABLE (ONLY ON APPROVAL)

1. **Re-confirm counts** unchanged since Phase 1 (re-run the tier probe). If moved, STOP, re-scope.
2. **Add the column:** `ALTER TABLE properties ADD COLUMN org_id UUID NULL;` Confirm it landed.
3. **Backfill Tier 1** (via deal org). Paste statement + rows affected.
4. **Backfill Tier 2** (via sole-org creator). Paste statement + rows affected.
5. **Verify:**
   ```sql
   SELECT COUNT(*) total, COUNT(org_id) assigned, COUNT(*)-COUNT(org_id) still_null FROM properties;
   ```
   `assigned` must equal Tier1+Tier2 count; `still_null` must equal the ambiguous+underivable count
   (no more, no fewer). Paste.
6. **Confirm no wrong assignment:** spot-check that each backfilled property's org_id actually
   matches its deriving deal/user — paste a join proving 5+ assignments are correct, including the
   named owned assets.
7. **Flag the null set** as the open manual-assignment item (ambiguous/underivable properties),
   listed by id+name+reason, for a separate human-decision dispatch.

---

## DELIVERABLE

- SHA + precondition
- Phase 1: link path, per-tier counts, named-asset derivations, proposed backfill, null-set list → STOP
- Phase 2 (post-approval): column added, Tier1+Tier2 backfilled, verification that assigned+null
  reconcile exactly, named assets confirmed correct, null set flagged
- One-line: N properties assigned org_id, K left null (ambiguous/underivable) pending manual decision

---

## OUT OF SCOPE

- Read-scoping property queries (Step 4) — the column existing doesn't scope reads; that's next.
- org_id-required-on-creation for NEW properties — small follow-up once the column exists; flag it,
  the property-create path (`grep` for property INSERT) currently can't set org_id and will need the
  same first-org-or-current-workspace logic deals use. Note the site, don't fix here.
- Manual assignment of the null set — separate human-decision dispatch.
- The multi-org "current workspace" question — still deferred; relevant when property-create wiring
  lands, flag don't solve.

**Phase 1 read-only ends at STOP. Phase 2 is a structural DDL change + data backfill — runs only on
approval, leaves ambiguous rows null rather than guessing, and reconciles assigned+null exactly.**
