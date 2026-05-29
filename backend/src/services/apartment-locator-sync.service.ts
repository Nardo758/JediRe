/**
 * Apartment Locator AI Sync Service
 * 
 * Syncs rent data from Apartment Locator AI into JediRE properties
 * Base URL: https://apartment-locator-ai-real.replit.app/api/jedi/
 */

import { getPool, query as dbQuery } from '../database/connection';
import { logger } from '../utils/logger';

const pool = getPool();

const APARTMENT_LOCATOR_URL = process.env.APARTMENT_LOCATOR_API_URL || 'https://apartment-locator-ai-real.replit.app';
const API_KEY = process.env.APARTMENT_LOCATOR_API_KEY || '';

interface ApartmentLocatorMarketData {
  location: {
    city: string;
    state: string;
  };
  supply: {
    total_properties: number;
    total_listings: number;
    available_units: number;
    avg_sqft: number;
  };
  pricing: {
    avg_rent: number;
    min_rent: number;
    max_rent: number;
    avg_rent_by_type: {
      studio: number;
      '1br': number;
      '2br': number;
      '3br': number;
    };
    concession_rate: number;
    avg_concession_value: number;
  };
  demand: {
    total_renters: number;
    avg_budget: number;
    lease_expirations_90d: number;
  };
  forecast: {
    units_delivering_30d: number;
    units_delivering_60d: number;
    units_delivering_90d: number;
  };
}

interface RentComp {
  property_id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  rent_per_sqft: number;
  units_available: number;
  concessions: string;
}

interface SupplyProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  rent: number;
  bedrooms: number;
  bathrooms: string;
  square_feet: number;
  total_units: number;
  units_available: number;
  concessions: string;
  // Forward-delivery fields — upstream Apartment Locator AI is expected to
  // start emitting one of these as it begins tracking in-progress construction
  // (today's payload carries none of them, so available_date stays NULL and
  // the 8-quarter chart correctly degrades to its empty state). When any of
  // these arrive, syncCity() persists them into apartment_supply_pipeline
  // .available_date and the chart turns on automatically. Field names mirror
  // common shapes seen across rental/permit data providers — accept any.
  available_date?: string | null;
  expected_delivery?: string | null;
  delivery_date?: string | null;
  available_starting?: string | null;
  estimated_delivery?: string | null;
}

/**
 * Pull a delivery date out of an upstream SupplyProperty payload, trying
 * known field names. Returns a value parseable as a SQL DATE/TIMESTAMP or
 * null when no usable date is present. Invalid dates (NaN) are rejected so
 * a malformed upstream string never corrupts apartment_supply_pipeline.
 */
function extractDeliveryDate(prop: SupplyProperty): string | null {
  const candidates = [
    prop.available_date,
    prop.expected_delivery,
    prop.delivery_date,
    prop.available_starting,
    prop.estimated_delivery,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// ── Intake-jobs upsert helper ────────────────────────────────────────────────
// Delegates to the dedicated apartment-locator source adapter.
// Idempotent: ON CONFLICT on (source_type, source_record_id) — refreshes
// raw_input on re-scrape, never creates duplicate rows or disturbs in-flight
// processing state.
import { upsertApartmentLocatorJob } from './intake-sources/apartment-locator';

// ── Phase 5 — Property entity dual-write helpers ─────────────────────────────
// Write property_characteristics (physical) + property_operating_data (rents/occ)
// to the new canonical schema after every Apartment Locator property sync.
// Non-fatal: errors logged, never surface to the caller.
import { isDualWriteEnabled } from './property-entity/property-dual-write.service';
import { propertyCharacteristicsService } from './property-entity/property-characteristics.service';
import { propertyOperatingDataService } from './property-entity/property-operating-data.service';

async function dualWriteApartmentLocatorPropertyEntity(
  propertyId: string,
  prop: SupplyProperty,
  safeInt: (v: any) => number | null,
  safeFloat: (v: any) => number | null,
): Promise<void> {
  if (!isDualWriteEnabled()) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const units = safeInt(prop.total_units);
    const sqft  = safeInt(prop.square_feet);
    if (units || sqft) {
      await propertyCharacteristicsService.create({
        propertyId,
        effectiveFrom: today,
        unitCount: units ?? undefined,
        buildingSf: sqft ?? undefined,
        source: 'agent',
        sourceDate: today,
        confidence: 0.70,
        provenance: { enrichmentSource: 'apartment_locator_ai', syncedAt: today },
      });
    }
  } catch (err) {
    logger.warn('[ApartmentLocatorSync] property_characteristics dual-write failed', {
      propertyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    const rent  = safeFloat(prop.rent);
    const units = safeInt(prop.total_units);
    const avail = safeInt(prop.units_available);
    const occupancy = (units && units > 0 && avail != null)
      ? ((units - avail) / units)
      : null;
    if (rent || occupancy != null) {
      await propertyOperatingDataService.create({
        propertyId,
        periodType: 'point_in_time',
        periodEnd: today,
        askingRentPerUnit: rent ?? undefined,
        occupancy: occupancy ?? undefined,
        source: 'agent_derived',
        sourceDate: today,
        confidence: 0.65,
        isOwned: false,
      });
    }
  } catch (err) {
    logger.warn('[ApartmentLocatorSync] property_operating_data dual-write failed', {
      propertyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function upsertIntakeJob(prop: SupplyProperty): Promise<void> {
  if (!prop.id) return;
  try {
    await upsertApartmentLocatorJob({
      id:          String(prop.id),
      name:        prop.name,
      address:     prop.address,
      city:        prop.city,
      state:       prop.state,
      zip_code:    prop.zip_code ?? null,
      total_units: prop.total_units ?? null,
      rent:        prop.rent ?? null,
      bedrooms:    prop.bedrooms ?? null,
      bathrooms:   prop.bathrooms ?? null,
      square_feet: prop.square_feet ?? null,
      units_available: prop.units_available ?? null,
      concessions: prop.concessions ?? null,
    });
  } catch (err: any) {
    // Non-fatal — log and continue; the property itself was already written
    logger.warn('[intake-jobs] upsert failed for property', { id: prop.id, error: err.message });
  }
}

// ── ApartmentLocatorSyncService ──────────────────────────────────────────────

export class ApartmentLocatorSyncService {
  /**
   * Fetch market data for a city
   */
  async fetchMarketData(city: string, state: string): Promise<ApartmentLocatorMarketData | null> {
    try {
      const url = `${APARTMENT_LOCATOR_URL}/api/jedi/market-data?city=${encodeURIComponent(city)}&state=${state}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error(`Apartment Locator API error: ${response.status}`, { city, state });
        return null;
      }
      
      const result = await response.json();
      return result.success ? result.data : null;
      
    } catch (error: any) {
      logger.error('Failed to fetch market data', { error: error.message, city, state });
      return null;
    }
  }
  
  /**
   * Fetch rent comps for a city
   */
  async fetchRentComps(city: string, state: string): Promise<RentComp[]> {
    try {
      const url = `${APARTMENT_LOCATOR_URL}/api/jedi/rent-comps?city=${encodeURIComponent(city)}&state=${state}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error(`Apartment Locator API error: ${response.status}`, { city, state });
        return [];
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
      
    } catch (error: any) {
      logger.error('Failed to fetch rent comps', { error: error.message, city, state });
      return [];
    }
  }
  
  /**
   * Fetch supply pipeline for a city
   */
  async fetchSupplyPipeline(city: string, state: string): Promise<SupplyProperty[]> {
    try {
      const url = `${APARTMENT_LOCATOR_URL}/api/jedi/supply-pipeline?city=${encodeURIComponent(city)}&state=${state}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error(`Apartment Locator API error: ${response.status}`, { city, state });
        return [];
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
      
    } catch (error: any) {
      logger.error('Failed to fetch supply pipeline', { error: error.message, city, state });
      return [];
    }
  }
  
  async syncCity(city: string, state: string): Promise<{ success: boolean; stats: any }> {
    logger.info(`Starting ${city} sync from Apartment Locator AI...`);
    
    try {
      const marketData = await this.fetchMarketData(city, state);
      
      if (!marketData) {
        throw new Error('Failed to fetch market data');
      }
      
      logger.info('Market data fetched', {
        total_properties: marketData.supply.total_properties,
        avg_rent: marketData.pricing.avg_rent
      });
      
      await pool.query(`
        INSERT INTO apartment_market_snapshots (
          city, state, snapshot_date,
          total_properties, total_listings, available_units,
          avg_rent, min_rent, max_rent,
          studio_rent, one_br_rent, two_br_rent, three_br_rent,
          source
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'apartment_locator_ai')
        ON CONFLICT (city, state, snapshot_date) DO UPDATE SET
          total_properties = EXCLUDED.total_properties,
          total_listings = EXCLUDED.total_listings,
          available_units = EXCLUDED.available_units,
          avg_rent = EXCLUDED.avg_rent,
          updated_at = NOW()
      `, [
        city,
        state,
        marketData.supply.total_properties,
        marketData.supply.total_listings,
        marketData.supply.available_units,
        marketData.pricing.avg_rent,
        marketData.pricing.min_rent,
        marketData.pricing.max_rent,
        marketData.pricing.avg_rent_by_type?.studio,
        marketData.pricing.avg_rent_by_type?.['1br'],
        marketData.pricing.avg_rent_by_type?.['2br'],
        marketData.pricing.avg_rent_by_type?.['3br']
      ]);
      
      const rentComps = await this.fetchRentComps(city, state);
      logger.info(`Fetched ${rentComps.length} rent comps`);
      
      const supplyProps = await this.fetchSupplyPipeline(city, state);
      logger.info(`Fetched ${supplyProps.length} supply properties`);
      
      // 5. Merge supply properties into main properties table
      let inserted = 0;
      let updated = 0;
      
      const safeInt = (v: any): number | null => { const n = parseInt(v); return isNaN(n) ? null : n; };
      const safeFloat = (v: any): number | null => { const n = parseFloat(v); return isNaN(n) ? null : n; };

      for (const prop of supplyProps) {
        try {
          const units = safeInt(prop.total_units);
          const rent = safeFloat(prop.rent);
          const beds = safeInt(prop.bedrooms);
          const baths = safeFloat(prop.bathrooms);
          const sqft = safeInt(prop.square_feet);
          const avail = safeInt(prop.units_available);

          const existing = await pool.query(`
            SELECT id FROM properties
            WHERE LOWER(address_line1) = LOWER($1)
              AND LOWER(city) = LOWER($2)
              AND state_code = $3
            LIMIT 1
          `, [prop.address, prop.city, prop.state]);
          
          let canonicalPropertyId: string | null = null;

          if (existing.rows.length > 0) {
            canonicalPropertyId = existing.rows[0].id;
            await pool.query(`
              UPDATE properties SET
                name = COALESCE($1, name),
                units = COALESCE($2, units),
                rent = COALESCE($3, rent),
                beds = COALESCE($4, beds),
                baths = COALESCE($5, baths),
                sqft = COALESCE($6, sqft),
                current_occupancy = CASE
                  WHEN $7 > 0 AND $8 > 0 THEN (($7 - $8)::float / $7) * 100
                  ELSE current_occupancy
                END,
                apartment_locator_id = $9,
                last_enriched_at = NOW(),
                updated_at = NOW()
              WHERE id = $10
            `, [
              prop.name,
              units,
              rent,
              beds,
              baths,
              sqft,
              units,
              avail,
              prop.id,
              existing.rows[0].id
            ]);
            updated++;
          } else {
            const insertResult = await pool.query(`
              INSERT INTO properties (
                name, address_line1, city, state_code, zip,
                property_type, units, rent, beds, baths, sqft,
                current_occupancy,
                apartment_locator_id, enrichment_source, enriched_at
              ) VALUES ($1, $2, $3, $4, $5, 'multi_family', $6, $7, $8, $9, $10, 
                CASE 
                  WHEN $6 > 0 AND $11 > 0 THEN (($6 - $11)::float / $6) * 100
                  ELSE NULL
                END,
                $12, 'apartment_locator_ai', NOW())
              RETURNING id
            `, [
              prop.name,
              prop.address,
              prop.city,
              prop.state,
              prop.zip_code,
              units,
              rent,
              beds,
              baths,
              sqft,
              avail,
              prop.id
            ]);
            canonicalPropertyId = insertResult.rows[0]?.id ?? null;
            inserted++;
          }

          // Phase 5 — dual-write to canonical property entity schema
          if (canonicalPropertyId) {
            dualWriteApartmentLocatorPropertyEntity(
              canonicalPropertyId, prop, safeInt, safeFloat
            ).catch(() => { /* non-fatal; logged inside */ });
          }

          // Wire property into the intake pipeline so the orchestrator
          // can enrich it (other-docs check, municipal stub, etc.)
          await upsertIntakeJob(prop);
        } catch (error: any) {
          logger.error('Failed to sync property', { 
            property: prop.name, 
            error: error.message 
          });
        }
      }
      
      logger.info('Atlanta sync complete', { inserted, updated, total: supplyProps.length });

      // Gap 5: Permits → Supply Signal
      // Write supply properties to apartment_supply_pipeline so agents can
      // see future competition (units delivering 30/60/90 days out)
      let supplyInserted = 0;
      const syncedAt = new Date().toISOString();
      for (const prop of supplyProps) {
        try {
          const totalUnits = safeInt(prop.total_units);
          if (!totalUnits || totalUnits < 4) continue;
          // Pull any forward-delivery date the upstream provides; today this
          // is null for all records, so the chart correctly empty-states.
          // Once upstream begins emitting it, available_date flows through
          // without further code changes and the 8-quarter chart lights up.
          const deliveryDate = extractDeliveryDate(prop);
          await pool.query(`
            INSERT INTO apartment_supply_pipeline (
              name, address, city, state,
              total_units, units_delivering,
              available_date, synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
            ON CONFLICT (address, city, state) WHERE address IS NOT NULL
            DO UPDATE SET
              name            = EXCLUDED.name,
              total_units     = EXCLUDED.total_units,
              units_delivering= EXCLUDED.units_delivering,
              -- Only overwrite available_date with a non-null upstream value;
              -- preserve any prior date if upstream drops the field on a
              -- later sync (defensive against transient API regressions).
              available_date  = COALESCE(EXCLUDED.available_date, apartment_supply_pipeline.available_date),
              synced_at       = EXCLUDED.synced_at
          `, [
            prop.name || null,
            prop.address,
            prop.city,
            prop.state,
            totalUnits,
            safeInt(prop.units_available),
            deliveryDate,
            syncedAt,
          ]);
          supplyInserted++;
        } catch (err: any) {
          logger.warn('Failed to insert supply pipeline entry', { prop: prop.address, err: err.message });
        }
      }
      logger.info('Supply pipeline synced', { supplyInserted, city, state });

      // Gap 3: Populate apartment_locator_properties from supply props so
      // discoverFromAptLocator() has a rich rental comp pool to query.
      // Subquery pulls lat/lng from the properties table where an address match exists.
      let alpInserted = 0;
      const dataAsOf = new Date().toISOString().slice(0, 10);
      for (const prop of supplyProps) {
        try {
          const totalUnits = safeInt(prop.total_units);
          const avgRent = safeFloat(prop.rent);
          const avail = safeInt(prop.units_available);
          if (!prop.id || !prop.address) continue;
          await pool.query(`
            INSERT INTO apartment_locator_properties (
              external_id, property_name, address, city, state, zip,
              latitude, longitude,
              total_units, avg_asking_rent, available_units, concessions,
              source, data_as_of
            )
            SELECT
              $1, $2, $3, $4, $5, $6,
              (SELECT lat FROM properties
               WHERE LOWER(address_line1) = LOWER($3) AND lat IS NOT NULL LIMIT 1),
              (SELECT lng FROM properties
               WHERE LOWER(address_line1) = LOWER($3) AND lng IS NOT NULL LIMIT 1),
              $7, $8, $9, $10,
              'apartment_locator_ai', $11::date
            ON CONFLICT (external_id, source) DO UPDATE SET
              property_name   = EXCLUDED.property_name,
              avg_asking_rent = EXCLUDED.avg_asking_rent,
              available_units = EXCLUDED.available_units,
              total_units     = COALESCE(EXCLUDED.total_units, apartment_locator_properties.total_units),
              latitude        = COALESCE(EXCLUDED.latitude, apartment_locator_properties.latitude),
              longitude       = COALESCE(EXCLUDED.longitude, apartment_locator_properties.longitude),
              last_updated    = NOW()
          `, [
            prop.id, prop.name || prop.address,
            prop.address, prop.city, prop.state, prop.zip_code || null,
            totalUnits, avgRent, avail,
            prop.concessions || null,
            dataAsOf,
          ]);
          alpInserted++;
        } catch (err: any) {
          logger.warn('Failed to insert apartment_locator_properties entry', { prop: prop.address, err: err.message });
        }
      }
      logger.info('apartment_locator_properties synced', { alpInserted, city, state });

      // Task #353: capture today's class-level rent aggregates so the
      // MSATrendsTab can show trends over time (not just today's snapshot).
      let classSnapshotsInserted = 0;
      try {
        const classAgg = await pool.query(`
          SELECT
            CASE
              WHEN year_built >= 2010 THEN 'A'
              WHEN year_built >= 1995 THEN 'B'
              ELSE 'C'
            END AS asset_class,
            COUNT(*)::int                                AS property_count,
            ROUND(AVG(avg_asking_rent)::numeric, 2)      AS avg_rent,
            ROUND(MIN(avg_asking_rent)::numeric, 2)      AS min_rent,
            ROUND(MAX(avg_asking_rent)::numeric, 2)      AS max_rent
          FROM apartment_locator_properties
          WHERE city ILIKE $1
            AND state = $2
            AND avg_asking_rent IS NOT NULL
            AND avg_asking_rent > 0
          GROUP BY asset_class
        `, [city, state]);

        for (const row of classAgg.rows) {
          await pool.query(`
            INSERT INTO apartment_class_rent_snapshots (
              city, state, asset_class, snapshot_date,
              property_count, avg_rent, min_rent, max_rent, source
            ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, 'apartment_locator_ai')
            ON CONFLICT (city, state, asset_class, snapshot_date) DO UPDATE SET
              property_count = EXCLUDED.property_count,
              avg_rent       = EXCLUDED.avg_rent,
              min_rent       = EXCLUDED.min_rent,
              max_rent       = EXCLUDED.max_rent,
              updated_at     = NOW()
          `, [
            city, state, row.asset_class,
            row.property_count, row.avg_rent, row.min_rent, row.max_rent,
          ]);
          classSnapshotsInserted++;
        }
        logger.info('apartment_class_rent_snapshots written', {
          city, state, classSnapshotsInserted,
        });
      } catch (err: any) {
        logger.warn('Failed to write apartment_class_rent_snapshots', {
          city, state, err: err.message,
        });
      }

      return {
        success: true,
        stats: {
          market_data: marketData,
          rent_comps_count: rentComps.length,
          properties_inserted: inserted,
          properties_updated: updated,
          total_properties: supplyProps.length,
          supply_pipeline_inserted: supplyInserted,
          apt_locator_properties_synced: alpInserted,
          class_snapshots_inserted: classSnapshotsInserted,
          forecast: marketData.forecast,
        }
      };
      
    } catch (error: any) {
      logger.error(`${city} sync failed`, { error: error.message });
      return {
        success: false,
        stats: { error: error.message }
      };
    }
  }

  async syncAtlanta(): Promise<{ success: boolean; stats: any }> {
    return this.syncCity('Atlanta', 'GA');
  }
  
  async syncAllMetros(): Promise<{ success: boolean; results: any[] }> {
    const metros = [
      { city: 'Atlanta', state: 'GA' },
      { city: 'Houston', state: 'TX' },
      { city: 'Dallas', state: 'TX' },
      { city: 'Austin', state: 'TX' },
      { city: 'San Antonio', state: 'TX' },
      { city: 'Charlotte', state: 'NC' },
      { city: 'Nashville', state: 'TN' },
      { city: 'Orlando', state: 'FL' },
      { city: 'Tampa', state: 'FL' },
      { city: 'Jacksonville', state: 'FL' },
      { city: 'Miami', state: 'FL' },
    ];
    
    const results = [];
    
    for (const metro of metros) {
      try {
        const cityResult = await this.syncCity(metro.city, metro.state);
        
        results.push({
          metro: `${metro.city}, ${metro.state}`,
          success: cityResult.success,
          properties: cityResult.stats.total_properties || 0,
          inserted: cityResult.stats.properties_inserted || 0,
          updated: cityResult.stats.properties_updated || 0,
          avg_rent: cityResult.stats.market_data?.pricing?.avg_rent
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error: any) {
        logger.error(`Failed to sync ${metro.city}`, { error: error.message });
        results.push({
          metro: `${metro.city}, ${metro.state}`,
          success: false,
          error: error.message
        });
      }
    }
    
    const allSucceeded = results.every(r => r.success);
    return { success: allSucceeded, results };
  }
}

export const apartmentLocatorSyncService = new ApartmentLocatorSyncService();
