import re

path = r"C:\Users\Leons' Computer 2\OneDrive - Myers Apartment Group\Documents\JediRe\backend\src\api\rest\operations.routes.ts"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
old_import = "import { getRentRollDerivations } from '../../services/rent-roll/rent-roll-derivations.service';"
new_import = """import { getRentRollDerivations } from '../../services/rent-roll/rent-roll-derivations.service';
import {
  dealPropertyLinkService,
  OPERATIONS_FLAG,
  shouldUseNewPath,
  shouldRunShadow,
  phase3ShadowService,
} from '../../services/property-entity';"""
content = content.replace(old_import, new_import)

# 2. Replace property resolution block in monthly-actuals POST
old_block = """    // Resolve property_id from deal_properties (first linked property)
    const propRes = await query(
      `SELECT property_id FROM deal_properties WHERE deal_id = $1 ORDER BY created_at LIMIT 1`,
      [dealId]
    );
    const propertyId: string | null = propRes.rows[0]?.property_id ?? null;"""
new_block = """    const opFlag = OPERATIONS_FLAG();
    const opUseNew = shouldUseNewPath(opFlag);
    const opRunShadow = shouldRunShadow(opFlag);

    // Old path: resolve property_id from deal_properties (first linked property)
    const propRes = await query(
      `SELECT property_id FROM deal_properties WHERE deal_id = $1 ORDER BY created_at LIMIT 1`,
      [dealId]
    );
    let propertyId: string | null = propRes.rows[0]?.property_id ?? null;

    // New path
    if (opUseNew || opRunShadow) {
      try {
        const link = await dealPropertyLinkService.resolveDealProperty(dealId);
        const newPropertyId = link?.propertyId ?? null;
        if (opRunShadow) {
          await phase3ShadowService.logBatch('operations', dealId, {
            property_id: { old: propertyId, new: newPropertyId },
          });
        }
        if (opUseNew) propertyId = newPropertyId;
      } catch (err) {
        logger.warn('R-005 operations new path failed; falling back to old', { err, dealId });
      }
    }"""
content = content.replace(old_block, new_block)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done editing operations.routes.ts')
