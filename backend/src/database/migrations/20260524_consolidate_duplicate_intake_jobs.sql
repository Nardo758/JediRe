-- Step 6: Consolidate 53 inverted duplicate pairs.
-- LOSER  = source_record_id IS NULL,  parcel_id = real ArcGIS ID  ← canonical
-- WINNER = source_record_id = al_id,  parcel_id = display name   ← to be corrected

BEGIN;

WITH pairs AS (
  SELECT
    loser.id                              AS loser_id,
    loser.parcel_id                       AS real_parcel,
    winner.id                             AS winner_id,
    winner.parcel_id                      AS display_parcel,
    winner.source_record_id               AS al_id
  FROM intake_jobs loser
  JOIN intake_jobs winner
    ON winner.source_type      = 'apartment_locator'
   AND winner.source_record_id = loser.source_data->>'apartment_locator_id'
  WHERE loser.source_type       = 'apartment_locator'
    AND loser.source_record_id  IS NULL
    AND loser.parcel_id        != (loser.source_data->>'name')
    AND loser.parcel_id        != COALESCE(loser.source_data->>'address', '')
    AND winner.parcel_id        = winner.source_data->>'name'
),

-- 1. Null out winner's source_record_id first (avoids unique index violation)
clear_winner_src AS (
  UPDATE intake_jobs
     SET source_record_id = NULL,
         updated_at = NOW()
    FROM pairs
   WHERE intake_jobs.id = pairs.winner_id
  RETURNING intake_jobs.id
),

-- 2. Stamp loser with source_record_id (now safe)
stamp_losers AS (
  UPDATE intake_jobs
     SET source_record_id = pairs.al_id,
         updated_at = NOW()
    FROM pairs, clear_winner_src
   WHERE intake_jobs.id = pairs.loser_id
  RETURNING intake_jobs.id
),

-- 3. Redirect winner's parcel_id to the real ArcGIS value
redirect_winner_parcel AS (
  UPDATE intake_jobs
     SET parcel_id  = pairs.real_parcel,
         updated_at = NOW()
    FROM pairs, stamp_losers
   WHERE intake_jobs.id = pairs.winner_id
  RETURNING intake_jobs.id
),

-- 4. Redirect historical_observations → real parcel_id
redirect_ho AS (
  UPDATE historical_observations ho
     SET parcel_id  = pairs.real_parcel,
         updated_at = NOW()
    FROM pairs
   WHERE ho.parcel_id = pairs.display_parcel
  RETURNING ho.id
),

-- 5. Redirect data_library_files → real parcel_id (no updated_at column)
redirect_dlf AS (
  UPDATE data_library_files dlf
     SET parcel_id = pairs.real_parcel
    FROM pairs
   WHERE dlf.parcel_id = pairs.display_parcel
  RETURNING dlf.id
),

-- 6. Merge display-name pd fields into real_arcgis pd row (COALESCE — real wins)
merge_pd AS (
  UPDATE property_descriptions canon
     SET
       address         = COALESCE(canon.address,         disp.address),
       county          = COALESCE(canon.county,          disp.county),
       unit_count      = COALESCE(canon.unit_count,      disp.unit_count),
       lot_size_acres  = COALESCE(canon.lot_size_acres,  disp.lot_size_acres),
       assessed_value  = COALESCE(canon.assessed_value,  disp.assessed_value),
       appraised_value = COALESCE(canon.appraised_value, disp.appraised_value),
       owner           = COALESCE(canon.owner,           disp.owner),
       property_name   = COALESCE(canon.property_name,   disp.property_name),
       updated_at      = NOW()
    FROM pairs
    JOIN property_descriptions disp ON disp.parcel_id = pairs.display_parcel
   WHERE canon.parcel_id = pairs.real_parcel
  RETURNING canon.parcel_id
),

-- 7. Delete the display-name property_descriptions rows
delete_display_pd AS (
  DELETE FROM property_descriptions
   USING pairs
   WHERE property_descriptions.parcel_id = pairs.display_parcel
  RETURNING property_descriptions.parcel_id
)

SELECT
  (SELECT COUNT(*) FROM clear_winner_src)       AS winners_src_cleared,
  (SELECT COUNT(*) FROM stamp_losers)            AS losers_stamped,
  (SELECT COUNT(*) FROM redirect_winner_parcel)  AS winner_parcels_redirected,
  (SELECT COUNT(*) FROM redirect_ho)             AS ho_rows_redirected,
  (SELECT COUNT(*) FROM redirect_dlf)            AS dlf_rows_redirected,
  (SELECT COUNT(*) FROM merge_pd)                AS pd_rows_merged,
  (SELECT COUNT(*) FROM delete_display_pd)       AS pd_display_rows_deleted;

COMMIT;
