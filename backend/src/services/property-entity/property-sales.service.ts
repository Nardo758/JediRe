/**
 * PropertySalesService
 * Phase 1 — Property Plumbing Refactor
 *
 * Canonical transaction history. This table will eventually
 * absorb market_sale_comps (Phase 5). For now it accepts new
 * writes and comp-linked queries; existing comp reads stay on
 * market_sale_comps until reader migration (Phase 3).
 */

import { query } from '../../database/connection';
import type { PropertySale, CreatePropertySaleInput, SaleSource } from './types';

function mapRow(row: Record<string, unknown>): PropertySale {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    saleDate: (row.sale_date as string) ?? null,
    salePrice: row.sale_price != null ? parseFloat(row.sale_price as string) : null,
    pricePerUnit: row.price_per_unit != null ? parseFloat(row.price_per_unit as string) : null,
    pricePerSf: row.price_per_sf != null ? parseFloat(row.price_per_sf as string) : null,
    buyer: (row.buyer as string) ?? null,
    seller: (row.seller as string) ?? null,
    buyerOperatorId: (row.buyer_operator_id as string) ?? null,
    sellerOperatorId: (row.seller_operator_id as string) ?? null,
    deedType: (row.deed_type as string) ?? null,
    deedBookPage: (row.deed_book_page as string) ?? null,
    financingType: (row.financing_type as string) ?? null,
    loanAmount: row.loan_amount != null ? parseFloat(row.loan_amount as string) : null,
    loanTerms: (row.loan_terms as Record<string, unknown>) ?? null,
    impliedCapRate: row.implied_cap_rate != null ? parseFloat(row.implied_cap_rate as string) : null,
    relatedOperatingDataId: (row.related_operating_data_id as string) ?? null,
    source: row.source as SaleSource,
    sourceId: (row.source_id as string) ?? null,
    sourceDate: (row.source_date as string) ?? null,
    confidence: row.confidence != null ? parseFloat(row.confidence as string) : null,
    isJediTracked: Boolean(row.is_jedi_tracked),
    qualified: row.qualified != null ? Boolean(row.qualified) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class PropertySalesService {
  /**
   * Get all sales for a property, newest first.
   */
  async getByProperty(propertyId: string): Promise<PropertySale[]> {
    const result = await query(
      `SELECT * FROM property_sales
       WHERE property_id = $1
       ORDER BY sale_date DESC NULLS LAST`,
      [propertyId]
    );
    return result.rows.map(mapRow);
  }

  /**
   * Get the most recent sale for a property.
   */
  async getLastSale(propertyId: string): Promise<PropertySale | null> {
    const result = await query(
      `SELECT * FROM property_sales
       WHERE property_id = $1
       ORDER BY sale_date DESC NULLS LAST
       LIMIT 1`,
      [propertyId]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Get qualified sale comps within radius and time window.
   * This is the future home of comp set generation (Phase 5).
   * Currently returns empty — comp reads are still on market_sale_comps.
   *
   * @param centerLat - subject property latitude
   * @param centerLng - subject property longitude
   * @param radiusMiles - search radius
   * @param monthsBack - sale date lookback window
   */
  async getCompSet(
    centerLat: number,
    centerLng: number,
    radiusMiles: number,
    monthsBack: number
  ): Promise<PropertySale[]> {
    const result = await query(
      `SELECT ps.*
       FROM property_sales ps
       JOIN properties p ON ps.property_id = p.id
       WHERE ps.qualified = TRUE
         AND ps.sale_date >= NOW() - ($4 || ' months')::interval
         AND ST_DWithin(
           ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3 * 1609.34
         )
       ORDER BY ps.sale_date DESC`,
      [centerLat, centerLng, radiusMiles, monthsBack]
    );
    return result.rows.map(mapRow);
  }

  /**
   * Create a new sale record.
   */
  async create(input: CreatePropertySaleInput): Promise<PropertySale> {
    const result = await query(
      `INSERT INTO property_sales (
        property_id, sale_date, sale_price, price_per_unit, price_per_sf,
        buyer, seller, buyer_operator_id, seller_operator_id,
        deed_type, deed_book_page, financing_type, loan_amount, loan_terms,
        implied_cap_rate, related_operating_data_id,
        source, source_id, source_date, confidence,
        is_jedi_tracked, qualified
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [
        input.propertyId,
        input.saleDate ?? null,
        input.salePrice ?? null,
        input.pricePerUnit ?? null,
        input.pricePerSf ?? null,
        input.buyer ?? null,
        input.seller ?? null,
        input.buyerOperatorId ?? null,
        input.sellerOperatorId ?? null,
        input.deedType ?? null,
        input.deedBookPage ?? null,
        input.financingType ?? null,
        input.loanAmount ?? null,
        input.loanTerms ? JSON.stringify(input.loanTerms) : null,
        input.impliedCapRate ?? null,
        input.relatedOperatingDataId ?? null,
        input.source,
        input.sourceId ?? null,
        input.sourceDate ?? null,
        input.confidence ?? null,
        input.isJediTracked ?? false,
        input.qualified ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Upsert by source + source_id — idempotent for ETL pipelines.
   */
  async upsertBySourceId(input: CreatePropertySaleInput): Promise<PropertySale> {
    if (!input.sourceId) return this.create(input);

    const result = await query(
      `INSERT INTO property_sales (
        property_id, sale_date, sale_price, price_per_unit, price_per_sf,
        buyer, seller, source, source_id, source_date, confidence,
        is_jedi_tracked, qualified
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (source, source_id) DO UPDATE SET
        sale_date        = EXCLUDED.sale_date,
        sale_price       = EXCLUDED.sale_price,
        price_per_unit   = EXCLUDED.price_per_unit,
        price_per_sf     = EXCLUDED.price_per_sf,
        buyer            = EXCLUDED.buyer,
        seller           = EXCLUDED.seller,
        confidence       = EXCLUDED.confidence,
        qualified        = EXCLUDED.qualified,
        updated_at       = NOW()
      RETURNING *`,
      [
        input.propertyId,
        input.saleDate ?? null,
        input.salePrice ?? null,
        input.pricePerUnit ?? null,
        input.pricePerSf ?? null,
        input.buyer ?? null,
        input.seller ?? null,
        input.source,
        input.sourceId,
        input.sourceDate ?? null,
        input.confidence ?? null,
        input.isJediTracked ?? false,
        input.qualified ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }
}

export const propertySalesService = new PropertySalesService();
