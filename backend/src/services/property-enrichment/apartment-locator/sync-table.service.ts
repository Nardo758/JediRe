/**
 * Apartment Locator → apartment_locator_properties one-way sync.
 *
 * Source rows are taken from `properties` where `apartment_locator_id IS NOT NULL`.
 * The Apartment Locator ID is used as the `external_id` so identity remains
 * stable across runs (manual /sync-table endpoint and the daily cron).
 */
import { query as dbQuery } from '../../../database/connection';

export interface AlSyncOptions {
  city?: string;
  state?: string;
  minUnits?: number;
}

export interface AlSyncStats {
  inserted: number;
  updated: number;
  source: number;
}

export async function syncApartmentLocatorTable(opts: AlSyncOptions = {}): Promise<AlSyncStats> {
  const { city, state, minUnits = 1 } = opts;

  const where: string[] = [
    'p.apartment_locator_id IS NOT NULL',
    'p.address_line1 IS NOT NULL',
    'p.city IS NOT NULL',
    'p.state_code IS NOT NULL',
  ];
  const params: unknown[] = [minUnits];
  where.push(`COALESCE(p.units, 0) >= $1`);
  if (city) {
    params.push(city);
    where.push(`UPPER(p.city) = UPPER($${params.length})`);
  }
  if (state) {
    params.push(state);
    where.push(`UPPER(p.state_code) = UPPER($${params.length})`);
  }

  const sourceRows = await dbQuery<{
    id: string;
    apartment_locator_id: string;
    name: string | null;
    address_line1: string;
    city: string;
    state_code: string;
    zip: string | null;
    lat: number | null;
    lng: number | null;
    units: number | null;
    year_built: number | null;
    avg_rent: number | null;
    market_rent: number | null;
    current_occupancy: number | null;
  }>(
    `SELECT p.id, p.apartment_locator_id, p.name, p.address_line1, p.city, p.state_code, p.zip,
            p.lat, p.lng, p.units, p.year_built,
            p.avg_rent, p.market_rent, p.current_occupancy
       FROM properties p
      WHERE ${where.join(' AND ')}`,
    params
  );

  let inserted = 0;
  let updated = 0;
  for (const r of sourceRows.rows) {
    const externalId = String(r.apartment_locator_id);
    const result = await dbQuery<{ inserted: boolean }>(
      `INSERT INTO apartment_locator_properties (
          external_id, property_name, address, city, state, zip,
          latitude, longitude, total_units, year_built,
          avg_asking_rent, avg_effective_rent, occupancy_pct,
          source, data_as_of
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'apartment_locator', CURRENT_DATE)
        ON CONFLICT (external_id, source) DO UPDATE SET
          property_name = EXCLUDED.property_name,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          zip = EXCLUDED.zip,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          total_units = EXCLUDED.total_units,
          year_built = EXCLUDED.year_built,
          avg_asking_rent = EXCLUDED.avg_asking_rent,
          avg_effective_rent = EXCLUDED.avg_effective_rent,
          occupancy_pct = EXCLUDED.occupancy_pct,
          last_updated = NOW()
        RETURNING (xmax = 0) AS inserted`,
      [
        externalId,
        r.name || `${r.address_line1}, ${r.city}, ${r.state_code}`,
        r.address_line1,
        r.city,
        r.state_code,
        r.zip || null,
        r.lat || null,
        r.lng || null,
        r.units || null,
        r.year_built || null,
        r.avg_rent || null,
        r.market_rent || null,
        r.current_occupancy != null
          ? (() => {
              const v = Number(r.current_occupancy);
              if (!Number.isFinite(v)) return null;
              // properties.current_occupancy is already stored as a percentage
              // (0–100). Some legacy rows may use 0–1 fractions; auto-normalize.
              const pct = v <= 1 ? v * 100 : v;
              return Math.max(0, Math.min(100, pct));
            })()
          : null,
      ]
    );
    if (result.rows[0]?.inserted) inserted++;
    else updated++;
  }

  return { inserted, updated, source: sourceRows.rows.length };
}
