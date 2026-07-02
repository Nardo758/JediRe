# DISPATCH — B4b: PUBLIC/PRIVATE BOUNDARY VERIFICATION (NOT A PROPERTIES MIGRATION)

**Corrected premise.** The earlier draft assumed some property ROWS are private and need org-scoping.
That's wrong for this architecture. The correct model (confirmed with Leon):
- **Platform-generated data is PUBLIC** — the `properties` table (1.06M ArcGIS + enriched address
  data) is platform-owned, global, Lane A. There is NO user-write path onto a property row: user
  uploads enter ONLY via deal-capsule and Assets-Owned surfaces; **the Terminal has no upload routes.**
- **User-provided data is PRIVATE** — it lives where the upload doors are: capsule document library
  and `deal_monthly_actuals` (Assets-Owned portfolio actuals). That data is already deal/org-scoped
  by its own keys.
So the public/private separation is enforced by UPLOAD-ROUTE TOPOLOGY, not by property-row ownership.
Properties don't need `org_id`. B4b is therefore a VERIFICATION that the boundary the architecture
implies actually holds — not a structural migration.

**The real privacy surface:** `deal_monthly_actuals` is keyed by `property_id`, and a property is
PUBLIC/shared. So the risk is an actuals READ that joins from a global property to its private
actuals WITHOUT scoping the actuals by owner — leaking Operator A's private performance to Operator B
who's looking at the same public property. The public property is a shared join key; the private
actuals hanging off it must stay scoped. THAT is what B4b verifies.

**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA. Mode: READ-ONLY verification; if a leak is
found, it becomes a separate scoped fix, not an in-place patch here.
**Verification rule (S1-01):** every claim carries live DB output or `file:line`.
**Report to:** `docs/audits/B4B_PUBLIC_PRIVATE_BOUNDARY_VERDICT.md`

---

## CLAIM 1 — Properties are write-CLOSED to users (the load-bearing assumption)

The whole model rests on "no user-write path onto property rows." VERIFY it, don't assume it.
1. **Terminal has no upload/property-write routes.** Enumerate every route that INSERTs or UPDATEs
   `properties`. Grep:
   ```
   grep -rniE "insert into properties|update properties|properties.*set |\.insert\(.*propert|createProperty|updateProperty" backend/src --include=*.ts
   ```
   Classify each writer: is it (a) platform enrichment (research agent, ArcGIS sync, address
   ingestion — EXPECTED, platform-owned writes), or (b) a USER-facing route where an operator could
   write private data onto a property row (NOT EXPECTED — if found, that's the commingling leak the
   model says shouldn't exist). `file:line` each.
2. **Confirm the Terminal specifically has no property upload.** The Terminal is the properties
   surface — confirm no route mounted under the Terminal/property UI accepts user uploads that land
   on `properties`. If one exists, FLAG it — it violates the "platform-public only" premise and is
   the real finding.
3. **Verdict for Claim 1:** properties are WRITE-CLOSED to users (only platform enrichment writes) /
   a user-write path exists (flag it — that's a commingling leak).

## CLAIM 2 — User uploads enter ONLY via capsule + Assets-Owned, and are scoped there

1. **Enumerate the upload/user-write routes** for the two legit doors:
   - Deal-capsule document library (Layer 2 uploads). `file:line`.
   - Assets-Owned actuals (`deal_monthly_actuals` writes). `file:line`.
   Confirm these are the ONLY user-data ingress paths, and each is deal/org-scoped at write time
   (writes carry the owner's deal_id / org / user scope).
2. Confirm no OTHER surface writes user-private property data anywhere. If a third door exists, flag.

## CLAIM 3 — The private data is scoped on READ (the actual leak surface)

This is the load-bearing check. A public property is a shared join key; verify private data attached
to it can't leak across operators.
1. **`deal_monthly_actuals` reads.** Enumerate every read. For each, does it scope the actuals by the
   caller's deal/org, or does it join from a (global) property to actuals WITHOUT owner-scoping?
   ```
   grep -rniE "from deal_monthly_actuals|join deal_monthly_actuals|deal_monthly_actuals" backend/src --include=*.ts
   ```
   The danger pattern: `SELECT ... FROM deal_monthly_actuals WHERE property_id = <public property>`
   with NO deal/org filter → returns every operator's actuals for that property. `file:line` each,
   classify SCOPED / UNSCOPED-LEAK-RISK.
2. **Capsule document reads.** Same check — are documents scoped to the owning deal/org, or reachable
   via a shared property/deal join without owner-scoping? `file:line`.
3. **The Assets-Owned / portfolio read paths** (portfolio.routes.ts et al. from B4a): confirm actuals
   surfaced there are scoped to the caller's org, not returning all actuals for a shared property.
   (B4a scoped DEALS; this confirms the ACTUALS keyed by property_id are scoped too.)

## CLAIM 4 — Cross-operator isolation on a SHARED property (the live proof)

The concrete test: two operators, same public property, private actuals must not cross.
1. If test data allows: Operator A has actuals on property P (public). Operator B queries property P
   (legitimately — it's public, they can see the platform data). Confirm B does NOT receive A's
   `deal_monthly_actuals` rows or A's capsule documents for P. Paste the query + result.
2. If no two-operator test data exists on a shared property, construct minimal test rows (A's actuals
   on a public property, B in a different org) and prove the isolation. Clean up after.
3. This is the single proof that matters: **public property shared, private actuals isolated.**

---

## DELIVERABLE — the boundary verdict

- SHA + READ-ONLY confirmation
- **Claim 1:** properties write-closed to users? (or the user-write path that leaks — flagged)
- **Claim 2:** the two legit upload doors enumerated + scoped; no third door
- **Claim 3:** every `deal_monthly_actuals` + capsule-doc read classified SCOPED / LEAK-RISK,
  `file:line`
- **Claim 4:** live proof — shared public property, private actuals isolated across operators
- **THE VERDICT (one line):** the public-platform / private-user boundary HOLDS (enforced by
  upload-route topology + scoped actuals reads) / a LEAK exists at [exact site] — becomes a fix
  dispatch
- **What B4b is NOT:** confirm properties need NO org_id column and NO row-scoping — the private data
  is elsewhere and (if the verdict holds) already scoped. State this explicitly so the parked
  "properties org_id migration" is formally retired as unnecessary.

---

## IF A LEAK IS FOUND

Do NOT fix in place. Name it precisely (which read, which private table, joined through which public
property, missing which scope) and STOP. The fix is a separate scoped dispatch — same discipline as
B4a's deal-read scoping, applied to the specific leaking actuals/document read.

---

## SEQUENCING

- **B3** ✅ / **B4a** ✅ (deals scoped) / **B4b (this)** — verify the public/private boundary; retire
  the properties-org_id migration as unnecessary IF the verdict holds.
- **B5 (last):** Institutional polish — zero-markup-unlimited exposure decision. Mostly decisions.

## OUT OF SCOPE

- Adding org_id to properties — RETIRED. Properties are platform-public; the earlier structural
  migration was based on a wrong premise. This dispatch confirms that and formally closes it.
- The `.unscoped()` / market-data governance CLAUDE.md note (from B4a tail) — still worth adding.
- The 43 null-org deals backfill (B4a tail).
- B5.

**B4b is a VERIFICATION, not a migration. The private data (actuals, documents) is separated from
public data (properties) by WHERE THE UPLOAD DOORS ARE — the Terminal has none. The one real risk is
a private-actuals read joining through a shared public property without owner-scoping (Claim 3/4).
The proof that matters: shared public property, isolated private actuals across operators.**
