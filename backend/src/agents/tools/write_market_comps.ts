/**
 * write_market_comps Tool
 * 
 * Records sale and rent comparables found during market research.
 * Feeds the market_sale_comps and market_rent_comps tables for platform-wide intelligence.
 */

import { z } from 'zod';
import { query, getClient } from '../../database/connection';
import { logger } from '../../utils/logger';

const SaleCompSchema = z.object({
  property_name: z.string(),
  property_address: z.string().optional(),
  city: z.string(),
  state: z.string(),
  submarket: z.string().optional(),
  msa: z.string().optional(),
  
  sale_date: z.string().describe('Sale date (YYYY-MM-DD)'),
  sale_price: z.number().describe('Total sale price'),
  units: z.number().describe('Unit count'),
  price_per_unit: z.number().optional().describe('Calculated if not provided'),
  
  cap_rate: z.number().optional().describe('Cap rate at sale (%)'),
  noi_at_sale: z.number().optional(),
  occupancy_at_sale: z.number().optional().describe('Occupancy % at sale'),
  
  year_built: z.number().optional(),
  asset_class: z.enum(['A', 'B', 'C', 'A+', 'B+', 'C+']).optional(),
  
  buyer_name: z.string().optional(),
  buyer_type: z.enum(['institutional', 'private', 'reit', 'syndicator', 'other']).optional(),
  seller_name: z.string().optional(),
  
  source: z.enum(['costar', 'real_capital', 'public_records', 'broker', 'news', 'web_research']),
  source_url: z.string().optional(),
  source_id: z.string().optional(),
});

const RentCompSchema = z.object({
  property_name: z.string(),
  property_address: z.string().optional(),
  city: z.string(),
  state: z.string(),
  submarket: z.string().optional(),
  msa: z.string().optional(),
  
  snapshot_date: z.string().describe('Date of rent data (YYYY-MM-DD)'),
  
  avg_asking_rent: z.number().describe('Average asking rent'),
  avg_effective_rent: z.number().optional(),
  
  // Unit type breakdown (optional)
  rent_by_type: z.record(z.string(), z.object({
    asking: z.number(),
    effective: z.number().optional(),
    sqft: z.number().optional(),
  })).optional().describe('Rent by unit type (1BR, 2BR, etc.)'),
  
  occupancy: z.number().optional().describe('Occupancy %'),
  concessions: z.string().optional(),
  concession_value: z.number().optional().describe('Concession value in months'),
  
  units: z.number().optional(),
  year_built: z.number().optional(),
  asset_class: z.enum(['A', 'B', 'C', 'A+', 'B+', 'C+']).optional(),
  
  source: z.enum(['costar', 'yardi_matrix', 'apartments_com', 'zillow', 'web_research', 'broker']),
  source_url: z.string().optional(),
  source_id: z.string().optional(),
});

export const writeMarketCompsSchema = z.object({
  // Optional deal association
  deal_id: z.string().optional().describe('Associate comps with a specific deal'),
  
  sale_comps: z.array(SaleCompSchema).optional().describe('Sale comparables'),
  rent_comps: z.array(RentCompSchema).optional().describe('Rent comparables'),
}).refine(
  data => (data.sale_comps && data.sale_comps.length > 0) || (data.rent_comps && data.rent_comps.length > 0),
  { message: 'At least one sale_comp or rent_comp is required' }
);

export type WriteMarketCompsInput = z.infer<typeof writeMarketCompsSchema>;

export interface WriteMarketCompsResult {
  dealId: string | null;
  saleCompsAdded: number;
  rentCompsAdded: number;
  duplicatesSkipped: number;
  saleCompIds: string[];
  rentCompIds: string[];
}

/**
 * Write market comps to platform database
 */
export async function writeMarketComps(input: WriteMarketCompsInput): Promise<WriteMarketCompsResult> {
  logger.info('[write_market_comps] Writing market comps', {
    dealId: input.deal_id,
    saleComps: input.sale_comps?.length ?? 0,
    rentComps: input.rent_comps?.length ?? 0,
  });

  const client = await getClient();
  const saleCompIds: string[] = [];
  const rentCompIds: string[] = [];
  let duplicatesSkipped = 0;

  try {
    await client.query('BEGIN');

    // Process sale comps
    if (input.sale_comps) {
      for (const comp of input.sale_comps) {
        // Check for duplicate (same property + sale date)
        const existingResult = await client.query(
          `SELECT id FROM market_sale_comps 
           WHERE property_name = $1 AND sale_date = $2`,
          [comp.property_name, comp.sale_date]
        );

        if (existingResult.rows.length > 0) {
          duplicatesSkipped++;
          continue;
        }

        // Calculate price per unit if not provided
        const pricePerUnit = comp.price_per_unit ?? Math.round(comp.sale_price / comp.units);

        const insertResult = await client.query(
          `INSERT INTO market_sale_comps (
            deal_id,
            property_name, property_address, city, state, submarket, msa,
            sale_date, sale_price, units, price_per_unit,
            cap_rate, noi_at_sale, occupancy_at_sale,
            year_built, asset_class,
            buyer_name, buyer_type, seller_name,
            source, source_url, source_id
          ) VALUES (
            $1,
            $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14,
            $15, $16,
            $17, $18, $19,
            $20, $21, $22
          ) RETURNING id`,
          [
            input.deal_id,
            comp.property_name, comp.property_address, comp.city, comp.state, comp.submarket, comp.msa,
            comp.sale_date, comp.sale_price, comp.units, pricePerUnit,
            comp.cap_rate, comp.noi_at_sale, comp.occupancy_at_sale,
            comp.year_built, comp.asset_class,
            comp.buyer_name, comp.buyer_type, comp.seller_name,
            comp.source, comp.source_url, comp.source_id,
          ]
        );

        saleCompIds.push(insertResult.rows[0].id);
      }
    }

    // Process rent comps
    if (input.rent_comps) {
      for (const comp of input.rent_comps) {
        // Check for duplicate (same property + snapshot date)
        const existingResult = await client.query(
          `SELECT id FROM market_rent_comps 
           WHERE property_name = $1 AND snapshot_date = $2`,
          [comp.property_name, comp.snapshot_date]
        );

        if (existingResult.rows.length > 0) {
          duplicatesSkipped++;
          continue;
        }

        const insertResult = await client.query(
          `INSERT INTO market_rent_comps (
            deal_id,
            property_name, property_address, city, state, submarket, msa,
            snapshot_date,
            avg_asking_rent, avg_effective_rent, rent_by_type,
            occupancy, concessions, concession_value,
            units, year_built, asset_class,
            source, source_url, source_id
          ) VALUES (
            $1,
            $2, $3, $4, $5, $6, $7,
            $8,
            $9, $10, $11,
            $12, $13, $14,
            $15, $16, $17,
            $18, $19, $20
          ) RETURNING id`,
          [
            input.deal_id,
            comp.property_name, comp.property_address, comp.city, comp.state, comp.submarket, comp.msa,
            comp.snapshot_date,
            comp.avg_asking_rent, comp.avg_effective_rent, 
            comp.rent_by_type ? JSON.stringify(comp.rent_by_type) : null,
            comp.occupancy, comp.concessions, comp.concession_value,
            comp.units, comp.year_built, comp.asset_class,
            comp.source, comp.source_url, comp.source_id,
          ]
        );

        rentCompIds.push(insertResult.rows[0].id);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  logger.info('[write_market_comps] Comps written', {
    saleCompsAdded: saleCompIds.length,
    rentCompsAdded: rentCompIds.length,
    duplicatesSkipped,
  });

  return {
    dealId: input.deal_id ?? null,
    saleCompsAdded: saleCompIds.length,
    rentCompsAdded: rentCompIds.length,
    duplicatesSkipped,
    saleCompIds,
    rentCompIds,
  };
}

/**
 * Tool definition for agent registration
 */
export const writeMarketCompsTool = {
  name: 'write_market_comps',
  description: `Record sale and rent comparables discovered during market research.
Feeds the platform-wide market intelligence database.

Sale comps include:
- Sale date, price, units, price per unit
- Cap rate and NOI at sale
- Buyer/seller information
- Source tracking

Rent comps include:
- Snapshot date, asking/effective rents
- Rent breakdown by unit type (1BR, 2BR, etc.)
- Occupancy and concessions
- Source tracking

Can optionally associate comps with a specific deal for targeted analysis.
Automatically skips duplicates (same property + date).`,
  inputSchema: writeMarketCompsSchema,
  outputSchema: z.any(),
  execute: writeMarketComps,
};
