/**
 * Inngest Cron: Sync OSM Overpass POIs
 *
 * Fires monthly on the 3rd at 04:00 UTC.
 * Queries OpenStreetMap Overpass API for grocery stores, parks, and hospitals
 * within the Atlanta metro bounding box and upserts into points_of_interest.
 *
 * Architecture:
 *   Step 1 — Sync groceries (shop=supermarket)
 *   Step 2 — Sync parks (leisure=park)
 *   Step 3 — Sync hospitals (amenity=hospital)
 *   Step 4 — Log summary
 */

import { inngest } from '../../lib/inngest';
import { syncOsmPois } from '../../services/real-data/osm-overpass.service';
import { logger } from '../../utils/logger';

export const syncOsmPoisFunction = inngest.createFunction(
  {
    id: 'sync-osm-pois',
    name: 'Atlanta: sync OSM Overpass POIs (monthly)',
    triggers: [{ cron: '0 4 3 * *' }],
  },
  async ({ step }) => {
    const result = await step.run('fetch-and-upsert-osm-pois', async () => {
      try {
        const r = await syncOsmPois();
        logger.info('[Inngest] syncOsmPois complete', {
          groceries: r.groceries,
          parks: r.parks,
          hospitals: r.hospitals,
          errors: r.errors.length,
        });
        return r;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[Inngest] syncOsmPois fatal', { error: msg });
        throw err;
      }
    });

    await step.run('log-osm-summary', async () => {
      const totalUpserted =
        result.groceries.upserted + result.parks.upserted + result.hospitals.upserted;
      logger.info('[Inngest] OSM sync summary', {
        total_upserted: totalUpserted,
        groceries: result.groceries,
        parks: result.parks,
        hospitals: result.hospitals,
      });
      return { total_upserted: totalUpserted };
    });

    const totalUpserted =
      result.groceries.upserted + result.parks.upserted + result.hospitals.upserted;

    return {
      success: result.errors.length === 0,
      total_upserted: totalUpserted,
      groceries: result.groceries,
      parks: result.parks,
      hospitals: result.hospitals,
    };
  }
);
