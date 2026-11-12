import { logger } from '../utils/logger';

export interface RentObservation {
  property_id?: string | number;
  id?: string | number;
  property_name?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  rent?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  square_feet?: unknown;
  rent_per_sqft?: unknown;
  units_available?: unknown;
  total_units?: unknown;
  concessions?: string | null;
}

interface SnapshotDatabase {
  query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export function observationNumber(value: unknown): number | null {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Same normalization as the numeric columns; zero bedrooms is a studio, not missing. */
export function unitTypeKey(row: RentObservation): string {
  const beds = observationNumber(row.bedrooms);
  const baths = observationNumber(row.bathrooms);
  const sqft = observationNumber(row.square_feet);
  if (beds == null && baths == null && sqft == null) return 'property';
  return `b${beds == null ? 'unknown' : Math.round(beds * 10) / 10}-ba${baths == null ? 'unknown' : Math.round(baths * 10) / 10}-sf${sqft == null ? 'unknown' : Math.round(sqft)}`;
}

/**
 * Capture supplied API rows without additional network calls. Each row is
 * independent so a bad row or unavailable snapshot table cannot abort a city.
 * Supply is written first by the caller; rent-comps wins when both describe
 * exactly the same property/unit/day. Unknown values never erase known ones.
 */
export async function writeRentSnapshots(
  db: SnapshotDatabase,
  rows: RentObservation[],
  endpoint: 'rent-comps' | 'supply-pipeline',
  city: string,
  state: string,
  snapshotDate: string,
): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;
  for (const row of rows) {
    const externalId = endpoint === 'rent-comps' ? row.property_id : row.id;
    if (externalId == null || String(externalId).trim() === '') {
      failed++;
      logger.warn('Apartment Locator rent snapshot missing property ID', { city, state, endpoint });
      continue;
    }
    try {
      const sqft = observationNumber(row.square_feet);
      const rent = observationNumber(row.rent);
      const psf = observationNumber(row.rent_per_sqft) ?? (rent != null && sqft ? rent / sqft : null);
      await db.query(`
        INSERT INTO apartment_locator_rent_snapshots (
          source, source_endpoint, alai_property_id, property_id, unit_type_key,
          bedrooms, bathrooms, square_feet, asking_rent, rent_per_sqft,
          effective_rent, concessions_text, units_available, total_units,
          city, state, zip, address, property_name, snapshot_date, raw
        ) VALUES (
          'apartment_locator_ai', $1, $2,
          (SELECT id FROM properties WHERE apartment_locator_id = $2 ORDER BY id LIMIT 1),
          $3, $4, $5, $6, $7, $8, NULL, $9, $10, $11, $12, $13, $14, $15, $16, $17::date, $18::jsonb
        )
        ON CONFLICT (source, alai_property_id, unit_type_key, snapshot_date) DO UPDATE SET
          source_endpoint = EXCLUDED.source_endpoint,
          property_id = COALESCE(EXCLUDED.property_id, apartment_locator_rent_snapshots.property_id),
          asking_rent = COALESCE(EXCLUDED.asking_rent, apartment_locator_rent_snapshots.asking_rent),
          rent_per_sqft = COALESCE(EXCLUDED.rent_per_sqft, apartment_locator_rent_snapshots.rent_per_sqft),
          concessions_text = COALESCE(EXCLUDED.concessions_text, apartment_locator_rent_snapshots.concessions_text),
          units_available = COALESCE(EXCLUDED.units_available, apartment_locator_rent_snapshots.units_available),
          total_units = COALESCE(EXCLUDED.total_units, apartment_locator_rent_snapshots.total_units),
          city = EXCLUDED.city, state = EXCLUDED.state, zip = EXCLUDED.zip,
          address = EXCLUDED.address, property_name = EXCLUDED.property_name,
          fetched_at = NOW(), raw = EXCLUDED.raw
      `, [
        endpoint, String(externalId), unitTypeKey(row),
        observationNumber(row.bedrooms), observationNumber(row.bathrooms),
        sqft == null ? null : Math.round(sqft), rent, psf, row.concessions ?? null,
        observationNumber(row.units_available), observationNumber(row.total_units),
        row.city || city, row.state || state, row.zip_code ?? null, row.address ?? null,
        row.property_name || row.name || null, snapshotDate, JSON.stringify(row),
      ]);
      written++;
    } catch (error: any) {
      failed++;
      logger.warn('Apartment Locator rent snapshot write failed', { city, state, endpoint, code: error.code });
    }
  }
  return { written, failed };
}
