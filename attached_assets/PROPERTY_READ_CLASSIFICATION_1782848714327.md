# DISPATCH — MARKET-DATA vs TENANT PROPERTY READ CLASSIFICATION (READ-ONLY)

**Why:** properties is two populations in one table — 35 tenant-owned rows and 1,059,994 ArcGIS
market-data rows with null org_id forever. Step 4 will add org scoping to property reads. A blanket
`WHERE org_id = <workspace>` would strip ALL 1.06M market rows from every workspace — fine if nothing
user-facing reads them, catastrophic if they feed market intelligence / comps / valuations. This
trace determines, per property-read site, whether it serves tenant data (must be org-scoped) or
market/reference data (must stay global). Decide nothing, build nothing.
**Target:** running Replit instance + live code.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** every read site's classification carries `file:line` and what it returns.
**Report to:** `docs/audits/PROPERTY_READ_CLASSIFICATION.md`

---

## THE CORE DISTINCTION

- **TENANT properties (35):** owned assets/deals. Reads MUST be org-scoped (`org_id = workspace`).
- **MARKET-DATA properties (1.06M):** ArcGIS comps/reference. Reads must be GLOBAL — readable across
  all workspaces, never org-filtered, because they belong to no one and feed shared intelligence.

Step 4 cannot apply one rule to both. This trace finds which reads are which.

---

## TRACE

**1. Enumerate every property-read site.** Grep all reads of the properties table:
```
grep -rniE "from properties|join properties|properties\b.*(select|where)|\.properties\.|propertyService|getPropert|findPropert" backend/src --include=*.ts
```
Plus GraphQL resolvers and any property service/repository. List each read site `file:line`.

**2. Classify each read site:**
   | read site | `file:line` | returns | population | Step-4 treatment |
   - **TENANT-READ** — returns owned/deal-linked properties (portfolio views, deal detail, the 35).
     → must be org-scoped.
   - **MARKET-READ** — returns ArcGIS/comp data (comp sets, market intelligence, peer comparison,
     valuation inputs, map layers, search over all properties). → must stay global, NOT org-scoped.
   - **MIXED** — a single query that returns BOTH tenant and market rows (e.g. "all properties near
     X" that includes both owned and comp). → the dangerous case; needs a split or a predicate that
     scopes tenant rows while keeping market rows visible. Flag each explicitly.

**3. The user-facing question — does ANY tenant-reachable feature read the 1.06M?**
   Trace the comp / market-intelligence / valuation / peer-comparison features (the "Bloomberg
   terminal" surfaces) to their property reads. Do they read market-data properties directly? If a
   user-facing feature reads those rows, they CANNOT be org-scoped without breaking the feature.
   Name the features and their read paths. `file:line`.

**4. How is market-data vs tenant currently distinguishable at query time?**
   Right now the only signal will be `org_id IS NULL` (market) vs `org_id IS NOT NULL` (tenant) —
   but that conflates market-data with not-yet-backfilled and with the 6 fixture/test nulls. Check:
   - Is there any existing column that marks a property as ArcGIS/ingest/market vs tenant? (source,
     ingest_type, data_source, is_comp, etc.) `\d properties` relevant columns.
   - If NONE exists, the recommendation is a `is_market_data` / `is_reference` flag (mirror of
     is_fixture) so Step 4 can split cleanly: tenant reads = `org_id = ws`, market reads =
     `is_market_data = true` (global). State whether such a column already exists or is net-new.

**5. The 6 deliberate nulls.** The 5 fixtures + 1 test property are null but are NOT market data —
   they must not get swept into a "null = global market" rule. Confirm how a market-data rule would
   distinguish them (is_fixture already flags 5; the f2a test property is the deletion-pending one).

---

## DELIVERABLE — the Step-4 property-scoping spec

- SHA + READ-ONLY header
- Read-site classification table (every site: TENANT / MARKET / MIXED + required treatment)
- The MIXED sites called out explicitly — these are where Step 4 is most likely to break something
- Answer: does any user-facing feature read the 1.06M market rows? (yes → they must stay global)
- The distinguisher recommendation: existing column, or net-new `is_market_data` flag — and exactly
  what predicate Step 4 should use for tenant-reads vs market-reads
- One-line: is property read-scoping a SIMPLE org filter (no user-facing market reads — rare) or a
  TWO-POPULATION SPLIT (market data is user-facing — must exempt the 1.06M by an explicit signal)

**STOP at the spec. This hands Step 4 a safe per-site scoping plan. Adding any is_market_data flag,
and the read-scoping itself, are separate human-approved dispatches. Do NOT scope any read here.**

---

## OUT OF SCOPE

- The Phase 2 properties.org_id backfill (separate, approved — 29 rows).
- Step 4 read-scoping implementation (this trace is its prerequisite spec).
- Property INSERT org_id wiring (the 3 flagged sites — split the same tenant/ingest way; later).
- Deletion of the f2a test property (dead-account cleanup).
