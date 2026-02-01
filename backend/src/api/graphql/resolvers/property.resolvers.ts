/**
 * Property GraphQL Resolvers
 */

import { query } from '../../../database/connection';
import { AppError } from '../../../middleware/errorHandler';

export const propertyResolvers = {
  Query: {
    property: async (_: any, { id }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await query(
        'SELECT * FROM properties WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'Property not found');
      }

      return formatProperty(result.rows[0]);
    },

    properties: async (_: any, { filters, limit = 50, offset = 0 }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      let queryText = 'SELECT * FROM properties WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.city) {
        queryText += ` AND city ILIKE $${paramIndex}`;
        params.push(`%${filters.city}%`);
        paramIndex++;
      }

      if (filters?.stateCode) {
        queryText += ` AND state_code = $${paramIndex}`;
        params.push(filters.stateCode);
        paramIndex++;
      }

      if (filters?.propertyType) {
        queryText += ` AND property_type = $${paramIndex}`;
        params.push(filters.propertyType);
        paramIndex++;
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await query(queryText, params);

      return result.rows.map(formatProperty);
    },

    propertiesNearby: async (_: any, { lat, lng, radius = 1000 }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await query(
        `SELECT *
         FROM properties
         WHERE ST_DWithin(location, ST_SetSRID(ST_Point($1, $2), 4326)::geography, $3)
         ORDER BY ST_Distance(location, ST_SetSRID(ST_Point($1, $2), 4326)::geography)
         LIMIT 50`,
        [lng, lat, radius]
      );

      return result.rows.map(formatProperty);
    },
  },

  Mutation: {
    createProperty: async (_: any, { input }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await query(
        `INSERT INTO properties (
          address_line1, city, state_code, zip_code, latitude, longitude,
          lot_size_sqft, property_type, analyzed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          input.addressLine1,
          input.city,
          input.stateCode,
          input.zipCode,
          input.latitude,
          input.longitude,
          input.lotSizeSqft,
          input.propertyType,
          context.user.userId,
        ]
      );

      return formatProperty(result.rows[0]);
    },
  },

  Property: {
    zoningDistrict: async (parent: any) => {
      if (!parent.zoning_district_id) return null;

      const result = await query(
        'SELECT * FROM zoning_district_boundaries WHERE id = $1',
        [parent.zoning_district_id]
      );

      if (result.rows.length === 0) return null;

      return formatZoningDistrict(result.rows[0]);
    },

    analyses: async (parent: any) => {
      const result = await query(
        'SELECT * FROM property_analyses WHERE property_id = $1 ORDER BY created_at DESC',
        [parent.id]
      );

      return result.rows;
    },
  },
};

function formatProperty(row: any) {
  return {
    id: row.id,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateCode: row.state_code,
    zipCode: row.zip_code,
    county: row.county,
    latitude: row.latitude,
    longitude: row.longitude,
    zoningCode: row.zoning_code,
    lotSizeSqft: row.lot_size_sqft,
    buildingSqft: row.building_sqft,
    yearBuilt: row.year_built,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    currentUse: row.current_use,
    propertyType: row.property_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
