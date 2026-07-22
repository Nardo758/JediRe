import re

path = r"C:\Users\Leons' Computer 2\OneDrive - Myers Apartment Group\Documents\JediRe\backend\src\api\rest\leasing-traffic.routes.ts"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports (unique anchor)
old_import = "import { CompTrafficService } from '../../services/comp-traffic.service';\n"
new_import = """import { CompTrafficService } from '../../services/comp-traffic.service';
import {
  dealPropertyLinkService,
  LEASING_TRAFFIC_FLAG,
  shouldUseNewPath,
  shouldRunShadow,
  phase3ShadowService,
} from '../../services/property-entity';
"""
if new_import.strip() not in content:
    content = content.replace(old_import, new_import)

# 2. Add flag definitions in /weekly-report/:dealId/projection
# Use a unique anchor that only appears once: the view validation block
old_projection = """      const view = (req.query.view as string) || 'yearly';
      if (!['weekly', 'monthly', 'yearly'].includes(view)) {
        return res.status(400).json({ error: 'view must be weekly, monthly, or yearly' });
      }

      let marketFactors: { demand?: number; supply?: number; digital?: number } = {};
      let propertyData: any = {};
      let calibrationData: any = undefined;"""
new_projection = """      const view = (req.query.view as string) || 'yearly';
      if (!['weekly', 'monthly', 'yearly'].includes(view)) {
        return res.status(400).json({ error: 'view must be weekly, monthly, or yearly' });
      }

      const ltFlag = LEASING_TRAFFIC_FLAG();
      const ltUseNew = shouldUseNewPath(ltFlag);
      const ltRunShadow = shouldRunShadow(ltFlag);

      let marketFactors: { demand?: number; supply?: number; digital?: number } = {};
      let propertyData: any = {};
      let calibrationData: any = undefined;"""
content = content.replace(old_projection, new_projection)

# 3. Replace digital score block (unique anchor with properties query)
old_digital = """          try {
            const propResult = await pool.query(
              `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
              [dealId]
            );
            const propId = propResult.rows[0]?.id;
            if (propId) {
              try {
                const digitalScore = await digitalTrafficService.calculateDigitalScore(propId);
                if (digitalScore) {
                  marketFactors.digital = 1 + Math.min(0.2, (Number(digitalScore.trending_velocity) || 0) * 0.01);
                }
              } catch (e) {
                logger.debug('[LeasingTraffic] Digital traffic fetch skipped');
              }
            }
          } catch (e) {
            logger.debug('[LeasingTraffic] Property lookup for digital score skipped');
          }"""
new_digital = """          try {
            // Old path
            const propResult = await pool.query(
              `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
              [dealId]
            );
            let propId = propResult.rows[0]?.id;

            // New path
            if (ltUseNew || ltRunShadow) {
              try {
                const link = await dealPropertyLinkService.resolveDealProperty(dealId);
                const newPropId = link?.propertyId;
                if (ltRunShadow) {
                  await phase3ShadowService.logBatch('leasing_traffic', dealId, {
                    property_id: { old: propId ?? null, new: newPropId ?? null },
                  });
                }
                if (ltUseNew) propId = newPropId;
              } catch (err) {
                logger.warn('R-004 leasing-traffic new path failed; falling back to old', { err, dealId });
              }
            }

            if (propId) {
              try {
                const digitalScore = await digitalTrafficService.calculateDigitalScore(propId);
                if (digitalScore) {
                  marketFactors.digital = 1 + Math.min(0.2, (Number(digitalScore.trending_velocity) || 0) * 0.01);
                }
              } catch (e) {
                logger.debug('[LeasingTraffic] Digital traffic fetch skipped');
              }
            }
          } catch (e) {
            logger.debug('[LeasingTraffic] Property lookup for digital score skipped');
          }"""
content = content.replace(old_digital, new_digital)

# 4. Replace data source signals block in projection (unique anchor with deal_properties)
old_ds_proj = """          let propId: string | undefined;
          const dpLookup = await pool.query(
            `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
            [dealId]
          );
          propId = dpLookup.rows[0]?.property_id;
          if (!propId) {
            const propLookup = await pool.query(
              `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
              [dealId]
            );
            propId = propLookup.rows[0]?.id;
          }
          if (propId) {
            try {
              dataSourceSignals = await trafficPredictionEngine.loadDataSourceSignals(propId);
            } catch (e) {
              logger.debug('[LeasingTraffic] Data source signals fetch skipped');
            }
          }"""
new_ds_proj = """          // Old path
          let propId: string | undefined;
          const dpLookup = await pool.query(
            `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
            [dealId]
          );
          propId = dpLookup.rows[0]?.property_id;
          if (!propId) {
            const propLookup = await pool.query(
              `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
              [dealId]
            );
            propId = propLookup.rows[0]?.id;
          }

          // New path
          if (ltUseNew || ltRunShadow) {
            try {
              const link = await dealPropertyLinkService.resolveDealProperty(dealId);
              const newPropId = link?.propertyId;
              if (ltRunShadow) {
                await phase3ShadowService.logBatch('leasing_traffic', dealId, {
                  property_id: { old: propId ?? null, new: newPropId ?? null },
                });
              }
              if (ltUseNew) propId = newPropId;
            } catch (err) {
              logger.warn('R-004 leasing-traffic new path failed; falling back to old', { err, dealId });
            }
          }

          if (propId) {
            try {
              dataSourceSignals = await trafficPredictionEngine.loadDataSourceSignals(propId);
            } catch (e) {
              logger.debug('[LeasingTraffic] Data source signals fetch skipped');
            }
          }"""
content = content.replace(old_ds_proj, new_ds_proj)

# 5. Replace data source signals block in /data-sources/:dealId (unique anchor)
old_ds_route = """      let propertyId: string | undefined;
      const dpLookup = await pool.query(
        `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
        [dealId]
      );
      propertyId = dpLookup.rows[0]?.property_id;
      if (!propertyId) {
        const propLookup = await pool.query(
          `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
          [dealId]
        );
        propertyId = propLookup.rows[0]?.id;
      }

      if (!propertyId) {"""
new_ds_route = """      const ltFlag = LEASING_TRAFFIC_FLAG();
      const ltUseNew = shouldUseNewPath(ltFlag);
      const ltRunShadow = shouldRunShadow(ltFlag);

      // Old path
      let propertyId: string | undefined;
      const dpLookup = await pool.query(
        `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
        [dealId]
      );
      propertyId = dpLookup.rows[0]?.property_id;
      if (!propertyId) {
        const propLookup = await pool.query(
          `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
          [dealId]
        );
        propertyId = propLookup.rows[0]?.id;
      }

      // New path
      if (ltUseNew || ltRunShadow) {
        try {
          const link = await dealPropertyLinkService.resolveDealProperty(dealId);
          const newPropertyId = link?.propertyId;
          if (ltRunShadow) {
            await phase3ShadowService.logBatch('leasing_traffic', dealId, {
              property_id: { old: propertyId ?? null, new: newPropertyId ?? null },
            });
          }
          if (ltUseNew) propertyId = newPropertyId;
        } catch (err) {
          logger.warn('R-004 leasing-traffic new path failed; falling back to old', { err, dealId });
        }
      }

      if (!propertyId) {"""
content = content.replace(old_ds_route, new_ds_route)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done editing leasing-traffic.routes.ts')
