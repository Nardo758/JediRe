# Data Library 500 — Diagnosis & Fix

**Date:** 2026-05-24  
**Endpoint:** `GET /api/v1/data-library-files`  
**Status before fix:** 500 Internal Server Error  
**Status after fix:** 200 OK

---

## (a) Failing Endpoint

```
GET /api/v1/data-library-files
GET /api/v1/data-library-files?page=1&limit=50   (all variants)
```

Triggered as soon as the **FILES** tab is clicked in the Data Library UI. The tab mounts `FilesTab` which immediately issues this request on render.

---

## (b) Backend Stack Trace

```
22:17:29 [error] [data-library-files] list error
{
  "service": "jedire-api",
  "environment": "development",
  "error": "column p.address does not exist"
}
```

PostgreSQL error code `42703` — undefined_column.  
Thrown at `backend/src/api/rest/data-library-files.routes.ts` in the `pool.query(...)` call inside `GET /`.

The offending SQL fragment:

```sql
COALESCE(p.address, '') AS property_display_name
FROM data_library_files dlf
LEFT JOIN properties p ON p.parcel_id = dlf.parcel_id
```

---

## (c) Root Cause Classification

**Column reference mismatch.** The `properties` table does not have an `address` column. Its actual street-address column is `address_line1`.

Confirmed via:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'properties'
ORDER BY ordinal_position LIMIT 20;
-- Returns: id, address_line1, city, state_code, ...
```

---

## (d) Fix Applied

**File:** `backend/src/api/rest/data-library-files.routes.ts`  
**Line ~74:**

```diff
- COALESCE(p.address, '')           AS property_display_name
+ COALESCE(p.address_line1, '')     AS property_display_name
```

Single-line fix. Backend restarted to pick up the TypeScript change.

---

## (e) Other Endpoints Affected by the Same Root Cause

No other routes in the recent batch of new files reference `p.address`. The `data-library-assets.routes.ts` file doesn't JOIN the `properties` table at all. The `intake-jobs.routes.ts` file doesn't either.

The only consumer of this JOIN pattern is `data-library-files.routes.ts`.

---

## (f) Pre-existing or Introduced by Recent Dispatch?

**Introduced by the recent dispatch.** The `data-library-files.routes.ts` file was created in the prior dispatch as a net-new file. The `p.address` reference was a first-write error — the `properties` schema was not inspected before writing the JOIN, so the wrong column name was used. The `properties` table was built at project inception with `address_line1` as the street-address column.

---

## Resolution Status

Fixed and verified. The FILES tab loads without errors as of the restart at 22:21 on 2026-05-24.
