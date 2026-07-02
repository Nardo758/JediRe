# DISPATCH — B4b: PROPERTIES SCOPING (TWO-POPULATION, STRUCTURAL)

**The structural half of B4. B4a ✅ (deals, single-population, scope-everything). B4b is harder:**
properties is TWO populations — 35 tenant rows (scope like deals) + ~1.06M ArcGIS market rows (must
stay GLOBAL, every org reads them, they're reference data). And properties has NO `org_id` column
yet. So B4b = structural column-add + a two-population split predicate. A wrong predicate either LEAKS
tenant properties across orgs OR HIDES the market layer (breaking JEDI Score boundary + market
briefing, which DEPEND on the 1.06M).
**Reuses B4a's proven pattern:** the `scopedQuery`/`.unscoped()` layer mechanism. Market-data reads
are "always global" (the carve-out); tenant-property reads scope like deals.
**Repo:** `Nardo758/JediRe.git` — branch `claude/b4b-properties-scoping`.
**Verification rule (S1-01):** proven LIVE — a tenant property is org-scoped (cross-org rejected),
AND the 1.06M market rows stay readable by all orgs (comp features unbroken). Both halves.
**Report to:** `docs/audits/B4B_PROPERTIES_SCOPING_VERDICT.md`

---

## PHASE 1 — CONFIRM THE SPLIT + DESIGN THE MIGRATION (READ-ONLY, STOP)

**1. Confirm the two populations live.**
```sql
SELECT COUNT(*) FROM properties;                                    -- ~1,060,029
-- tenant properties: linked to a deal/owner (the 35)
SELECT COUNT(*) FROM properties p WHERE EXISTS (SELECT 1 FROM deals d WHERE d.property_id = p.id)
   OR p.id IN (SELECT property_id FROM deal_properties);            -- the tenant set
-- market rows: no owner link (the ~1.06M)
```
Confirm the tenant count (~35) and the market count (~1.06M). Confirm properties still has NO
`org_id` column. `file:line` / paste.

**2. The distinguisher — how to tell tenant from market at query time.** The earlier property-read
classification recommended `is_market_data BOOLEAN`. Confirm no such column exists, and confirm the
backfill predicate that cleanly separates the two (from the earlier trace):
`is_market_data = TRUE WHERE <no deal link AND no owner>` (the ~1.06M), `FALSE` for the ~35 tenant.
Run the predicate as a COUNT to confirm it partitions cleanly (~35 false, ~1.06M true, no overlap).
Paste.

**3. Design the migration:**
   - `ALTER TABLE properties ADD COLUMN org_id UUID NULL` (nullable — market rows stay null forever;
     only tenant rows get an org).
   - `ALTER TABLE properties ADD COLUMN is_market_data BOOLEAN NOT NULL DEFAULT FALSE`.
   - Backfill `is_market_data = TRUE` for the ~1.06M market rows (the no-link predicate).
   - Backfill `org_id` for the ~35 tenant rows — derive from their linked deal's org_id (same
     derivation as the earlier properties-org trace: property → deal → deal.org_id). Ambiguous/
     underivable tenant rows stay null + flagged (do NOT guess).

**4. Enumerate property-read sites + classify (reuse B4a's method).** Grep property reads. Classify
   each: TENANT-READ (portfolio/owned-asset views → scope by org), MARKET-READ (comps, JEDI Score
   boundary, market briefing → stay GLOBAL, never org-filter), MIXED (returns both → split predicate).
   `file:line`. The MIXED ones are the danger — a query returning owned + comp properties needs
   `(org_id = <caller> OR is_market_data = TRUE)`, not a blanket filter.

**5. The scoping predicate (per read type):**
   - TENANT-READ → `org_id = <caller active org>` (scope like deals).
   - MARKET-READ → no org filter / `is_market_data = TRUE` (global — via B4a's `.unscoped()` pattern
     or a market-explicit path).
   - MIXED → `(org_id = <caller active org> OR is_market_data = TRUE)` (tenant rows scoped, market
     rows visible).

**=== STOP: report the confirmed population split (counts + clean partition), the migration design
(both columns + both backfills, with the underivable-tenant flag), the property-read site
classification (TENANT/MARKET/MIXED), and the per-type predicate. Approve the migration + predicates
before Phase 2 — a wrong predicate leaks tenant data or breaks comps. ===**

---

## PHASE 2 — MIGRATE + SCOPE (after design approved)

1. **Add columns + backfill** per Phase 1: `org_id` (nullable), `is_market_data` (default false).
   Backfill market rows TRUE (~1.06M), tenant rows FALSE + derive org_id from linked deal. Underivable
   tenant rows: null org_id, flagged. Paste row counts: ~1.06M market, ~35 tenant, N derivable, K
   flagged. `file:line`.
2. **TENANT-READ sites** → scope by `org_id = <active org>` (reuse B4a's scoped-query layer).
   `file:line`.
3. **MARKET-READ sites** → explicitly global (`.unscoped()` or market path). CONFIRM the comp features
   (JEDI Score boundary ST_Contains, market briefing aggregate) still read the full 1.06M — these
   MUST NOT be org-filtered or they break. `file:line`.
4. **MIXED sites** → the split predicate `(org_id = <caller> OR is_market_data = TRUE)`. `file:line`
   each. These are the highest-risk — verify each returns owned+market correctly.
5. **Reuse ONE resolution** — tenant scoping uses the same active-org as deals/entitlement
   (`resolveOrgForUser`). `file:line`.

---

## ACCEPTANCE — live, BOTH halves

1. **Tenant property org-scoped:** an org-A member reads a tenant/owned property belonging to org B
   (by id or list) → REJECTED / not returned. Paste. (The 35-row tenant isolation.)
2. **Market data stays GLOBAL (the half that breaks if wrong):** an org-A member runs a comp/market
   read (JEDI Score boundary for a deal, market briefing) → still returns market-data properties
   (the ~1.06M), NOT filtered to org A. Paste — confirm the comp feature returns real market rows,
   not near-zero. THIS is the proof the scoping didn't strip the market layer.
3. **MIXED read correct:** a query that returns owned + comps → returns org-A's owned properties AND
   global market properties, NOT org-B's owned. Paste the split working.
4. **Migration counts:** ~1.06M is_market_data=true, ~35 tenant (false, org_id derived), K flagged
   underivable. Paste.
5. **JEDI Score / boundary unbroken:** the ST_Contains boundary query for a real deal still finds its
   surrounding comps from the 1.06M (would return near-zero if market rows got org-scoped). Paste —
   the concrete "comps didn't break" proof.
6. **dd201183 owned properties intact:** Leon sees his owned/tenant properties, scoped to dd201183,
   AND full market data for comps. Paste (both-populations regression guard).
7. **Underivable tenant flag:** any tenant property whose org couldn't be derived is null + flagged,
   not guessed. Paste the flagged list for manual assignment.
8. Cleanup test data.

---

## DELIVERABLE

- SHA + Phase 1 (population split confirmed, migration design, read-site classification, predicates) → STOP
- Phase 2 (post-approval): columns added + backfilled, tenant reads scoped, market reads global,
  mixed reads split, comps proven unbroken
- Live acceptance 1-8 (esp. #2 market-stays-global and #5 JEDI-Score-unbroken — the "didn't strip the
  market layer" proofs)
- One-line: properties scoped two-population — 35 tenant org-scoped, 1.06M market global; comps
  unbroken; org_id + is_market_data columns live; ready for B5

---

## SEQUENCING

- **B3** ✅ / **B4a** ✅ / **B4b (this)** — properties, two-population structural scoping.
- **B5 (last):** Institutional polish — zero-markup-unlimited exposure decision, tier-level behavior.
  Mostly decisions. Closes the arc.

## OUT OF SCOPE (B4b)

- The 43 null-org DEALS backfill (B4a tail — separate small cleanup: assign to dd201183 so they're
  scoped by data not fallback). Not this dispatch.
- B5 Institutional polish.
- The `.unscoped()` / `is_market_data` governance note for CLAUDE.md (document alongside bypassAuth) —
  worth adding but not blocking.

**The two proofs that matter are the MARKET half, not the tenant half: #2 (market data stays global —
comps still see the 1.06M) and #5 (JEDI Score boundary unbroken). Tenant scoping is B4a's proven
pattern; the NEW risk in B4b is stripping the market layer by over-scoping. A wrong predicate that
hides the 1.06M breaks the product's core comp features — that's the failure to guard against.**
