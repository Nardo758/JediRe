# Phase 0.1 Dispatch — Per-Property Visibility Substrate

## Reference Spec
`docs/PER_PROPERTY_VISIBILITY_SPEC.md` (attached to this dispatch — copy it into the Replit workspace before proceeding)

## Pre-Phase Ops (Leon, done before this dispatch)
- [ ] Cloudflare account created
- [ ] R2 bucket created (suggest: `jedire-archive`)
- [ ] R2 API tokens generated (Read+Write scoped to bucket)
- [ ] Tokens added as REPLIT env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- [ ] Confirm Replit agent can reach R2 endpoint

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Storage provider | **Cloudflare R2** | Zero egress for inline PDF viewing. $0.015/GB/month. S3-compatible SDK. |
| License-restricted default | **false** | Archive is internal deal docs, not licensed 3rd-party exports. Tag files with "CoStar"/"Yardi"/"REIS" in filename during upload. |
| New table or extend `properties` | **New `property_descriptions` table** | 40+ jsonb columns with LayeredValue<T> shape don't belong in a table of plain scalars. Old `properties` table → deprecated view. |
| Multi-account scoping | **Deferred to Mode 4** | Single-operator for now. |

## What to Build (Phase 0.1)

### 1. Migrations

**1a. `property_descriptions` table**

```sql
CREATE TABLE property_descriptions (
 parcel_id text PRIMARY KEY REFERENCES properties(parcel_id) ON DELETE CASCADE,
 -- All mutable attributes are LayeredValue<jsonb>:
 property_name jsonb,
 address jsonb,           -- { street, city, state, zip }
 msa jsonb,
 county jsonb,
 year_built jsonb,        -- { resolved, layers: { om, municipal, web, manual }, resolution_rule }
 year_renovated jsonb,
 unit_count jsonb,
 building_count jsonb,
 stories jsonb,
 stories_band jsonb,      -- 'walkup'|'midrise'|'highrise'|'super_highrise'
 total_sqft jsonb,
 rentable_sqft jsonb,
 lot_size_acres jsonb,
 construction_type jsonb, -- 'wood_frame'|'concrete'|'steel'|'mixed'
 parking_type jsonb,
 parking_spaces jsonb,
 parking_ratio jsonb,
 asset_class jsonb,       -- 'A'|'B'|'C'
 property_type jsonb,     -- 'multifamily'|'office'|'retail'
 amenities jsonb,         -- { has_pool, has_fitness, has_clubhouse, ... } all LayeredValue<boolean>
 zoning_code jsonb,
 flood_zone jsonb,
 in_opportunity_zone jsonb,
 narrative jsonb,         -- Research Agent generated description
 submarket jsonb,
 created_at timestamptz DEFAULT now(),
 updated_at timestamptz DEFAULT now()
);
```

Indexes:
- `CREATE INDEX idx_pd_parcel ON property_descriptions(parcel_id);`
- `CREATE INDEX idx_pd_msa ON property_descriptions USING GIN (msa);` — for cohort rollup queries
- `CREATE INDEX idx_pd_asset_class ON property_descriptions USING GIN (asset_class);`
- `CREATE INDEX idx_pd_updated ON property_descriptions(updated_at DESC);`

**1b. `data_library_files` table**

```sql
CREATE TABLE data_library_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parcel_id text REFERENCES properties(parcel_id),
 deal_id uuid,
 original_filename text NOT NULL,
 sha256 text NOT NULL UNIQUE,
 mime_type text,
 size_bytes bigint,
 storage_provider text NOT NULL DEFAULT 'r2',
 storage_bucket text,
 storage_key text,
 cdn_url text,
 document_type text,
 parser_used text,
 parser_version text,
 parser_status text DEFAULT 'unparsed' CHECK (parser_status IN ('success','partial','failed','unparsed')),
 parser_run_id uuid,
 parser_error text,
 uploaded_at timestamptz DEFAULT now(),
 uploaded_by text,
 source_signal text,
 license_restricted boolean DEFAULT false,
 license_source text,
 CONSTRAINT parcel_or_deal CHECK (parcel_id IS NOT NULL OR deal_id IS NOT NULL)
);

CREATE INDEX idx_dlf_parcel ON data_library_files(parcel_id);
CREATE INDEX idx_dlf_deal ON data_library_files(deal_id);
CREATE INDEX idx_dlf_sha256 ON data_library_files(sha256);
CREATE INDEX idx_dlf_document_type ON data_library_files(document_type);
```

**1c. `historical_observations.source_file_ids` column**

```sql
ALTER TABLE historical_observations ADD COLUMN source_file_ids uuid[];
CREATE INDEX idx_ho_source_files ON historical_observations USING GIN (source_file_ids);
```

### 2. R2 Client Module

`src/services/storage/r2-client.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../utils/logger';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET_NAME!;

const client = new S3Client({
 region: 'auto',
 endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
 credentials: {
   accessKeyId: R2_ACCESS_KEY_ID,
   secretAccessKey: R2_SECRET_ACCESS_KEY,
 },
});

export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
 await client.send(new PutObjectCommand({
   Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: mimeType,
 }));
 logger.info(`R2 upload: ${key}`);
}

export async function getSignedViewUrl(key: string, expiresInSeconds = 3600): Promise<string> {
 return getSignedUrl(client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}

// Baseline test — exports a test function so Phase 0.1 can verify connectivity
export async function testR2Connectivity(): Promise<boolean> {
 try {
   const testKey = `_r2_connectivity_test_${Date.now()}.txt`;
   await uploadFile(testKey, Buffer.from('connectivity ok'), 'text/plain');
   await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: testKey }));
   return true;
 } catch (err) {
   logger.error('R2 connectivity test failed', err);
   return false;
 }
}
```

### 3. Tests

`backend/tests/storage/r2-client.test.ts`:
- `testR2Connectivity()` returns true
- Upload + signed URL generation for a small buffer
- Upload + delete cleanup
- **IMPORTANT**: Test uses `R2_*` env vars — must have them configured in Replit environment. If not set, skip test with a clear message.

### 4. Baseline Test Script

`src/scripts/verify-r2-connectivity.ts` — standalone script that:
1. Attempts `testR2Connectivity()`
2. Prints PASS/FAIL
3. Exits with code 0/1

Runnable via: `npx ts-node --transpile-only src/scripts/verify-r2-connectivity.ts`

## Acceptance Criteria (Phase 0.1)

1. All three migrations run cleanly (up and down)
2. `property_descriptions` table exists with correct schema, indexes, and FK to `properties`
3. `data_library_files` table exists with correct schema, CHECK constraints, and indexes
4. `historical_observations` has `source_file_ids` column with GIN index
5. `testR2Connectivity()` returns true (R2 bucket reachable, write + delete works)
6. All TypeScript compiles: `npx tsc --noEmit --skipLibCheck`
7. All tests pass

## Closing Note

After completion, report:
```
Phase 0.1 closing note:
- Migration output (schema diff, indexes created)
- R2 connectivity test: PASS/FAIL
- Test results: X/Y passing
- Compile check: PASS/FAIL
- Any env var gaps discovered
```
