/**
 * Zoning GraphQL Resolvers
 */

import { query } from '../../../database/connection';
import { AppError } from '../../../middleware/errorHandler';
import { ZoningService } from '../../../services/zoning.service';

const zoningService = new ZoningService();

export const zoningResolvers = {
  Query: {
    zoningDistrict: async (_: any, { id }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await query(
        'SELECT * FROM zoning_district_boundaries WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'Zoning district not found');
      }

      return formatZoningDistrict(result.rows[0]);
    },

    zoningLookup: async (_: any, { address, lat, lng }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await zoningService.lookupZoning({ address, lat, lng });

      return result;
    },
  },

  ZoningDistrict: {
    rules: async (parent: any) => {
      const result = await query(
        'SELECT * FROM zoning_rules WHERE district_id = $1 LIMIT 1',
        [parent.id]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];

      return {
        permittedUses: row.permitted_uses,
        conditionalUses: row.conditional_uses,
        prohibitedUses: row.prohibited_uses,
        minLotSizeSqft: row.min_lot_size_sqft,
        maxDensityUnitsPerAcre: row.max_density_units_per_acre,
        maxCoveragePercent: row.max_coverage_percent,
        frontSetbackFt: row.front_setback_ft,
        rearSetbackFt: row.rear_setback_ft,
        sideSetbackFt: row.side_setback_ft,
        maxHeightFt: row.max_height_ft,
        maxStories: row.max_stories,
        parkingSpacesPerUnit: row.parking_spaces_per_unit,
      };
    },
  },
};

function formatZoningDistrict(row: any) {
  return {
    id: row.id,
    municipality: row.municipality,
    stateCode: row.state_code,
    districtCode: row.district_code,
    districtName: row.district_name,
    description: row.district_description,
  };
}
