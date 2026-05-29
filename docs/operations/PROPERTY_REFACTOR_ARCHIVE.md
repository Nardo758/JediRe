# PROPERTY REFACTOR — ARCHIVE REGISTRY

**Phase:** 4 — Old-Table Deprecation  
**Status:** PENDING — archives must be taken before DROP scripts are applied  
**Last updated:** 2026-05-29

---

## Purpose

Each deprecated table requires a verified pg_dump archive before it is dropped.
Archives must be retained for ≥ 1 year from drop date.

**Gate:** All 7 entries must show `ARCHIVE STATUS: VERIFIED` before any table is dropped.

---

## How to Take an Archive Snapshot

Run the following for each table, replacing `<TABLE>` and `<DATE>`:

```bash
# Dump a single table to SQL format
pg_dump \
  --no-owner \
  --no-privileges \
  --table=<TABLE> \
  --format=custom \
  "$DATABASE_URL" \
  -f "/backups/property_refactor_phase4_<TABLE>_<DATE>.dump"

# Verify the dump is readable
pg_restore --list "/backups/property_refactor_phase4_<TABLE>_<DATE>.dump" | head -20

# Record the file size and row count
wc -c "/backups/property_refactor_phase4_<TABLE>_<DATE>.dump"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM <TABLE>;"
```

Store archives in a location accessible to the team (S3 bucket, shared backup store, etc.).
Update this document with the archive location and verification status for each table.

---

## Archive Registry

### TABLE: deal_properties

| Field | Value |
|---|---|
| **Row count at archive** | TBD (27 rows expected) |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Legacy join table linking deals to properties via many-to-many.  
**Replaced by:** `deals.property_id` UUID FK (canonical, added Phase 1).  
**Note:** 27 rows — trivial archive. All rows should be backfilled to `deals.property_id` by Phase 2 Backfill 5 before archiving.

**Pre-archive verification query:**
```sql
-- Confirm all deal_properties rows have corresponding deals.property_id
SELECT COUNT(*) AS deal_properties_rows,
       COUNT(d.property_id) AS deals_with_property_id_set
FROM deal_properties dp
JOIN deals d ON d.id = dp.deal_id;
-- Expected: deal_properties_rows = deals_with_property_id_set
```

---

### TABLE: property_sales_legacy

| Field | Value |
|---|---|
| **Row count at archive** | TBD (292 rows expected) |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Pre-Phase-1 stub table with parcel-level sale year/price. Renamed from the original `property_sales` during Phase 1 migration.  
**Replaced by:** `property_sales` (canonical 24-column transaction table; backfilled Phase 2).

**Pre-archive verification query:**
```sql
-- Confirm all legacy rows are present in property_sales
SELECT COUNT(*) AS legacy_rows FROM property_sales_legacy;
SELECT COUNT(*) AS canonical_rows
FROM property_sales ps
JOIN property_sales_legacy psl
  ON ps.source_id = psl.parcel_id::text
  AND EXTRACT(YEAR FROM ps.sale_date)::int = psl.sale_year
WHERE ps.source = 'county_recorded';
-- Expected: canonical_rows ≈ legacy_rows (within dedup tolerance)
```

---

### TABLE: market_sale_comps

| Field | Value |
|---|---|
| **Row count at archive** | TBD (~343K rows expected) |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Cobb County sale comp inventory, ~343K rows. Primary comp source before Phase 4.  
**Replaced by:** `property_sales` (canonical; backfilled Phase 2 Backfill 3).  
**FK dependency:** `sale_comp_set_members.market_comp_id REFERENCES market_sale_comps(id)` — this column is dropped in `phase4_drop_tables.sql` Step 3 before the table is dropped.

**Pre-archive verification query:**
```sql
SELECT COUNT(*) FROM market_sale_comps;
-- Spot-check: 100 rows from property_sales vs market_sale_comps for same parcel/date
SELECT msc.parcel_id, msc.sale_date, msc.sale_price,
       ps.sale_date AS ps_date, ps.sale_price AS ps_price
FROM market_sale_comps msc
JOIN properties prop ON prop.parcel_id = msc.parcel_id
JOIN property_sales ps ON ps.property_id = prop.id
  AND ps.sale_date = msc.sale_date
LIMIT 100;
```

---

### TABLE: market_rent_comps

| Field | Value |
|---|---|
| **Row count at archive** | TBD |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Rent comp inventory. Feed for F4 Supply module (R-025).  
**Replaced by:** `property_operating_data` (period-specific rent metrics per property).

**Pre-archive verification query:**
```sql
SELECT COUNT(*) FROM market_rent_comps;
```

---

### TABLE: comp_properties

| Field | Value |
|---|---|
| **Row count at archive** | TBD |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Comp property candidate pool used by the competition module (R-019), unit mix intelligence (R-031), and deal-market-intelligence (R-029).  
**Replaced by:** `properties` + `property_characteristics` (canonical property entity).

**Pre-archive verification query:**
```sql
SELECT COUNT(*) FROM comp_properties;
```

---

### TABLE: recorded_transactions

| Field | Value |
|---|---|
| **Row count at archive** | TBD (12 rows expected) |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Small (12-row) recorded transaction table predating the canonical `property_sales` table. Used by tax comp analysis (R-032).  
**Replaced by:** `property_sales` (source=county_recorded).

**Pre-archive verification query:**
```sql
SELECT * FROM recorded_transactions;
-- All 12 rows; verify each has a counterpart in property_sales
```

---

### TABLE: property_records

| Field | Value |
|---|---|
| **Row count at archive** | TBD (~249K rows expected) |
| **Archive file** | TBD |
| **Archive location** | TBD |
| **Archive date** | TBD |
| **File size** | TBD |
| **Verified by** | TBD |
| **ARCHIVE STATUS** | PENDING |

**Description:** Assessor scrape results (~249K rows). The largest deprecated table. Used by F3 Markets, competition module, rankings, spatial analysis, and more (R-018 through R-029).  
**Replaced by:** `property_info_cache` (canonical assessor layer) + `property_characteristics` (time-varying backfill).  
**5 columns migrated to property_info_cache:** `class_code`, `neighborhood_code`, `tax_district`, `assessor_url`, `property_class` (per Phase 1.1.A resolution).

**Pre-archive verification query:**
```sql
SELECT COUNT(*) FROM property_records;
-- Spot-check 100 rows against property_info_cache for parcel overlap
SELECT COUNT(*) AS in_both
FROM property_records pr
JOIN property_info_cache pic ON pic.parcel_id = pr.parcel_id
LIMIT 1;
```

---

## DROP Execution Checklist

Run this checklist immediately before applying `phase4_drop_tables.sql`:

- [ ] All 7 archive entries above show `ARCHIVE STATUS: VERIFIED`
- [ ] All archive files tested with `pg_restore --list` — no errors
- [ ] Window 1 (write revocation) clean for ≥ 7 days — confirm date: ___________
- [ ] Window 2 (read revocation) clean for ≥ 7 days — confirm date: ___________
- [ ] Phase 3 acceptance criteria confirmed met — confirmed by: ___________
- [ ] `phase4_drop_tables.sql` tested on staging environment — staging drop date: ___________
- [ ] Application traffic paused or drop scheduled in low-traffic window
- [ ] On-call engineer available for post-drop monitoring

---

## Archive Retention Policy

- Archives retained for **≥ 1 year** from drop date
- Deletion requires approval from engineering lead
- Archive storage location: ___________ (update when set)

---

## Document History

| Date | Entry |
|---|---|
| 2026-05-29 | Archive registry created. All 7 tables documented with verification queries. Status: PENDING (Phase 3 not yet complete). |
