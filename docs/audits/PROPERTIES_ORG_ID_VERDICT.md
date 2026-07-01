# Step 2: properties.org_id Column + Derivable Backfill

**Date:** 2026-06-30  
**HEAD SHA:** `4e695b65625883d933b1c355ea71e0441a52d2f8`  
**Precondition:** vocab finalization (is_fixture, 'system' user_type, Phase 2 relabels) confirmed live at this SHA.  
**Mode:** PHASE 1 — READ-ONLY  
**Dispatch spec:** `attached_assets/PROPERTIES_ORG_ID_1782847795700.md`  
**Verification rule (S1-01):** derivation paths proven by live DB joins.

---

## PHASE 1 — LINK PATH + DERIVATION TIERS

### 1. Inventory + Current Linkage

**Total:** 1,060,029 properties.

Three link paths exist between properties and deals/orgs:

| Path | Column/table | Direction |
|---|---|---|
| A | `deals.property_id` → `properties.id` | deal → property (deal knows its property) |
| B | `deal_properties` join table | many-to-many via `(deal_id, property_id)` |
| C | `properties.deal_id` column | property → deal (property knows its primary deal) |

```sql
-- Confirmed columns:
-- properties: deal_id UUID, created_by UUID, legal_owner, owner_mailing, ownership_status
-- deals: property_id UUID, org_id UUID (already present)
-- deal_properties: deal_id UUID, property_id UUID, relationship, confidence_score, linked_by
```

**Link population:**
```
 total     | has_deal_id | has_created_by | no_link_at_all
-----------+-------------+----------------+----------------
 1,060,029 |          35 |             11 |      1,059,994
```

- **35** properties have `properties.deal_id` set.
- **11** properties have `created_by` set.
- **27** distinct property IDs appear in `deal_properties`.
- **1,059,994** (99.999%) have no link of any kind — confirmed ArcGIS / market-comp ingest data.

The 35 + 11 + 27 sets overlap heavily. The comprehensive union across all three paths yields **exactly 35 unique linked properties**. The ArcGIS corpus is the remaining 1,059,994.

---

### 2. Derivation Tiers — All 35 Linked Properties

Comprehensive probe run across all three link paths simultaneously:

```sql
SELECT id, name, created_by,
  COUNT(DISTINCT deal_id) AS deal_count,
  COUNT(DISTINCT org_id) FILTER (WHERE org_id IS NOT NULL AND is_fixture = FALSE) AS distinct_real_orgs,
  (ARRAY_AGG(DISTINCT org_id::text) FILTER (WHERE org_id IS NOT NULL AND is_fixture = FALSE))[1] AS derived_org,
  BOOL_OR(is_fixture) AS any_fixture_deal
FROM <union of all three paths>
GROUP BY id, name, created_by;
```

**Results — 35 linked properties:**

```
                  id                  |          name          | deal_count | distinct_real_orgs |             derived_org              | any_fixture
--------------------------------------+------------------------+------------+--------------------+--------------------------------------+-------------
 0bc9c7c0                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 0f514e0e                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 1222a2c1                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 1b0b66b2                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 1e804422                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 2afe152c                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 2e275467                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 32d68002                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 340e87dc                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 49d2e311                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 4b3cc51f                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 55ee8abc                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 656fe704                             | 464 Bishop             |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 77b65c86                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 7ea31caf ← HIGHLANDS                | Highlands at Satellite |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 87064a8f                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 97c87a60                             | —                      |          5 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 a1a14a3f                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 a49a837d                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 ae978125                             | —                      |          2 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 b04cac1f                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 b27c1de6                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 ca8f78e5                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 cec62230                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 e1c46be0                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 ecc542ba                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 f5617d88                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 fa526821                             | Sentosa Epperson       |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 fb893da8                             | —                      |          1 |                  1 | dd201183-3cb5-45dd-8485-d17f5a053421 | f
 ── above: 29 Tier 1 ─────────────────────────────────────────────────────────────────────────
 27ccb328                             | —                      |          1 |                  0 | (null)                               | t ← fixture
 40d8d4c3                             | —                      |          1 |                  0 | (null)                               | t ← fixture
 445ae2d8                             | —                      |          1 |                  0 | (null)                               | t ← fixture
 79a63134                             | —                      |          1 |                  0 | (null)                               | t ← fixture
 b30fdc32                             | —                      |          1 |                  0 | (null)                               | t ← fixture
 5948f2f2                             | —                      |          1 |                  0 | (null)                               | f ← f2a test
```

**Tier summary:**

| Tier | Count | Description | Derived org |
|---|---|---|---|
| **TIER 1** | **29** | Linked via deal(s); all deals resolve to the same non-null org | `dd201183-3cb5-45dd-8485-d17f5a053421` (the primary operator's org) |
| **UNDERIVABLE — fixture-linked** | **5** | Linked only to fixture deals (null org_id, is_fixture=true) | (null — eval corpus) |
| **UNDERIVABLE — test residue** | **1** | `5948f2f2`: linked to f2a-operator's test deal (null org, non-fixture) | (null — test residue, deletion pending) |
| **UNDERIVABLE — ArcGIS market data** | **1,059,994** | No deal link, no created_by; pure ingest data | (null — market data, not tenant-owned) |
| **TOTAL** | **1,060,029** | | |

**Zero ambiguous properties.** No property links to deals across multiple orgs. `97c87a60` links to 5 deals — all owned by `dd201183`. The 34-org user (`m.dixon5030`) created some properties, but every one of them also has a deal link pointing to the same org — no Tier 2 fallback needed anywhere.

---

### 3. Named Owned Assets

**Highlands at Sweetwater Creek (p2122)**  
`id: 7ea31caf-f070-43eb-9fd1-fe08f7123701`  
`deal_id: eaabeb9f-830e-44f9-a923-56679ad0329d`  
`deal_org_id: dd201183-3cb5-45dd-8485-d17f5a053421`  
`created_by: 6253ba3f (m.dixon5030)`  
**→ TIER 1. Derives unambiguously to `dd201183`.**

No other named portfolio assets (Frisco TX / McKinney TX deleted 2026-05-31 per replit.md; confirmed not in the current properties set with any deal link).

---

### 4. Proposed Column + Backfill (written out — do NOT run until Phase 2 approval)

**Step 1 — Add the column:**
```sql
ALTER TABLE properties ADD COLUMN org_id UUID NULL;
-- REFERENCES organizations(id) NOT added — nullable, no FK constraint needed for now
-- NOT NULL deliberately omitted — 1,059,994 underivable rows must stay null
```

**Step 2 — Backfill Tier 1 (29 properties, all three paths, only where ALL paths agree):**
```sql
UPDATE properties p
SET org_id = sub.derived_org
FROM (
  SELECT property_id,
    (ARRAY_AGG(DISTINCT org_id ORDER BY org_id))[1]::uuid AS derived_org
  FROM (
    -- Path A: deals.property_id
    SELECT d.property_id, d.org_id
    FROM deals d
    WHERE d.property_id IS NOT NULL
      AND d.org_id IS NOT NULL
      AND d.is_fixture = FALSE
    UNION ALL
    -- Path B: deal_properties join table
    SELECT dp.property_id, d.org_id
    FROM deal_properties dp
    JOIN deals d ON d.id = dp.deal_id
    WHERE d.org_id IS NOT NULL
      AND d.is_fixture = FALSE
    UNION ALL
    -- Path C: properties.deal_id column
    SELECT p2.id, d.org_id
    FROM properties p2
    JOIN deals d ON d.id = p2.deal_id
    WHERE d.org_id IS NOT NULL
      AND d.is_fixture = FALSE
  ) paths
  GROUP BY property_id
  HAVING COUNT(DISTINCT org_id) = 1  -- only assign when ALL paths agree on same org
) sub
WHERE p.id = sub.property_id
  AND p.org_id IS NULL;
```

Expected: exactly **29 rows updated**, all assigned org `dd201183-3cb5-45dd-8485-d17f5a053421`.

**No Tier 2 backfill needed** — every property with a `created_by` link also has a deal link (Tier 1 covers them all). Tier 2 path is unused in this dataset.

---

### 5. Properties That Will Be Left NULL

| id | Reason | Notes |
|---|---|---|
| `27ccb328` | Fixture-linked (S1 Gold Set Atlanta MF #2) | eval corpus |
| `40d8d4c3` | Fixture-linked ([CS-AUDIT] Flip Test) | eval corpus |
| `445ae2d8` | Fixture-linked (S1 Gold Set Atlanta MF #1) | eval corpus |
| `79a63134` | Fixture-linked ([CS-AUDIT] Value-Add Test) | eval corpus |
| `b30fdc32` | Fixture-linked (S1 Gold Set Jacksonville) | eval corpus |
| `5948f2f2` | f2a-operator test deal, null org — test residue | deletion dispatch pending |
| 1,059,994 rows | ArcGIS ingest / market comps — no owner link | market data, not tenant assets |

**Total null after backfill:** 1,060,000 properties (6 named above + 1,059,994 market data).  
**Total assigned:** 29.

---

### 6. Out-of-Scope Flags (property CREATE path)

Three INSERT paths found that will NOT set `org_id` after the column lands:

- `backend/src/api/rest/property.routes.ts:173` — REST property creation
- `backend/src/api/graphql/resolvers/property.resolvers.ts:87` — GraphQL mutation
- `backend/src/services/deal-property-linker.service.ts:282` — deal-property linker

All three need a follow-up wiring pass to accept and persist `org_id` on new property creation (first-org-or-current-workspace logic, same pattern deals use). Separate dispatch — not here.

---

## PHASE 1 DELIVERABLE SUMMARY

**Link path confirmed:** deals → properties via three paths (A: `deals.property_id`, B: `deal_properties` join table, C: `properties.deal_id`). Derivation uses the union of all three.

**Per-tier counts:**
- Tier 1 (derivable): **29** → all `dd201183`
- Underivable (fixture/test/market data): **1,060,000**

**Highlands (named owned asset):** TIER 1 — derives to `dd201183` via deal `eaabeb9f`. ✓

**Proposed DDL + backfill:** written above — `ALTER TABLE properties ADD COLUMN org_id UUID NULL`, then single UPDATE via union-of-paths join, 29 rows expected.

**Null set after backfill:** 6 named (fixture × 5 + f2a test × 1) + 1,059,994 ArcGIS market data.

**One-line (projected, pending Phase 2 approval):** 29 properties assigned `org_id`, 1,060,000 left null (6 fixture/test + 1,059,994 market data) — pending manual assignment or remain null permanently as market comps.

---

**=== HARD STOP. Phase 1 complete. Awaiting approval for Phase 2. ===**
