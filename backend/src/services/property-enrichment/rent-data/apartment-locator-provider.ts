import { query } from '../../../database/connection';
import { BaseRentDataProvider } from './base-provider';
import type { ProviderConfig, RentData, UnitType } from '../types';
import { observationNumber } from '../../apartment-locator-rent-history.service';

/** Local-only: the nightly Apartment Locator sync owns all network access. */
export class ApartmentLocatorRentProvider extends BaseRentDataProvider {
  readonly config: ProviderConfig = {
    name: 'apartment_locator_ai', type: 'rent_data', enabled: true, priority: 1,
  };

  async canHandle(address: string, city: string, state: string): Promise<boolean> {
    return Boolean(address.trim() && city.trim() && state.trim());
  }

  async healthCheck(): Promise<boolean> {
    await query('SELECT 1 FROM apartment_locator_rent_snapshots LIMIT 1');
    return true;
  }

  async fetchRentData(address: string, city: string, state: string): Promise<RentData | null> {
    const snapshots = await query(`
      WITH matched AS (
        SELECT alai_property_id FROM apartment_locator_rent_snapshots
        WHERE source = 'apartment_locator_ai'
          AND LOWER(TRIM(address)) = LOWER(TRIM($1))
          AND LOWER(TRIM(city)) = LOWER(TRIM($2))
          AND LOWER(TRIM(state)) = LOWER(TRIM($3))
        ORDER BY snapshot_date DESC, fetched_at DESC, alai_property_id LIMIT 1
      )
      SELECT s.* FROM apartment_locator_rent_snapshots s JOIN matched m USING (alai_property_id)
      WHERE s.source = 'apartment_locator_ai' AND s.snapshot_date = (
        SELECT MAX(snapshot_date) FROM apartment_locator_rent_snapshots
        WHERE source = 'apartment_locator_ai' AND alai_property_id = m.alai_property_id
      )
      ORDER BY s.unit_type_key
    `, [address, city, state]);
    let rows = snapshots.rows;
    // Partial observations can have identity/availability but no usable price.
    // They must not hide a valid retained latest-table rent.
    if (!rows.some(r => (observationNumber(r.asking_rent) ?? 0) > 0)) {
      const latest = await query(`
        SELECT property_name, avg_asking_rent AS asking_rent, total_units,
          available_units AS units_available, concessions AS concessions_text,
          data_as_of AS snapshot_date, last_updated AS fetched_at
        FROM apartment_locator_properties
        WHERE source = 'apartment_locator_ai'
          AND LOWER(TRIM(address)) = LOWER(TRIM($1))
          AND LOWER(TRIM(city)) = LOWER(TRIM($2))
          AND LOWER(TRIM(state)) = LOWER(TRIM($3))
        ORDER BY data_as_of DESC NULLS LAST, external_id LIMIT 1
      `, [address, city, state]);
      rows = latest.rows;
    }
    const valid = rows.filter(r => (observationNumber(r.asking_rent) ?? 0) > 0);
    if (!valid.length) return null;
    // A property-level observation is not an invented studio/floor plan.
    const plans = valid.filter(r => r.unit_type_key !== 'property' &&
      observationNumber(r.bedrooms) != null && observationNumber(r.bathrooms) != null &&
      observationNumber(r.square_feet) != null);
    const unitMix: UnitType[] = plans.map(r => ({
      beds: Number(r.bedrooms), baths: Number(r.bathrooms), sqFt: Number(r.square_feet),
      unitCount: 0, // The API reports availability, not inventory per floor plan.
      askingRent: Number(r.asking_rent),
      ...(r.rent_per_sqft != null ? { rentPerSqFt: Number(r.rent_per_sqft) } : {}),
    }));
    const priced = plans.length ? plans : valid;
    const rents = priced.map(r => Number(r.asking_rent));
    const row = valid[0];
    return {
      provider: this.config.name, propertyName: row.property_name ?? undefined,
      unitMix, totalUnits: Math.max(...valid.map(r => observationNumber(r.total_units) ?? 0)),
      avgAskingRent: rents.reduce((a, b) => a + b, 0) / rents.length,
      minRent: Math.min(...rents), maxRent: Math.max(...rents),
      concessions: [...new Set(valid.map(r => r.concessions_text).filter(Boolean))].join('; ') || undefined,
      asOfDate: new Date(row.snapshot_date ?? row.fetched_at),
      fetchedAt: new Date(),
    };
  }
}
