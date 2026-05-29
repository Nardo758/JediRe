/**
 * PropertyCharacteristicsService
 * Phase 1 — Property Plumbing Refactor
 *
 * Manages time-varying physical state of properties.
 * No production reads yet — Phase 2 dual-write wires this in.
 */

import { query } from '../../database/connection';
import type { PropertyCharacteristic, CreatePropertyCharacteristicInput } from './types';

function mapRow(row: Record<string, unknown>): PropertyCharacteristic {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    effectiveFrom: row.effective_from as string,
    effectiveTo: (row.effective_to as string) ?? null,
    currentBuildingClass: (row.current_building_class as string) ?? null,
    unitCount: row.unit_count != null ? Number(row.unit_count) : null,
    buildingSf: row.building_sf != null ? parseFloat(row.building_sf as string) : null,
    unitMix: (row.unit_mix as Record<string, { count: number; sf: number }>) ?? null,
    condition: (row.condition as string) ?? null,
    lastRenovationYear: row.last_renovation_year != null ? Number(row.last_renovation_year) : null,
    renovationScope: (row.renovation_scope as PropertyCharacteristic['renovationScope']) ?? null,
    source: (row.source as PropertyCharacteristic['source']) ?? null,
    sourceDate: (row.source_date as string) ?? null,
    confidence: row.confidence != null ? parseFloat(row.confidence as string) : null,
    provenance: (row.provenance as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class PropertyCharacteristicsService {
  /**
   * Get the current (active) characteristics for a property.
   * Returns null if no active row exists.
   */
  async getCurrent(propertyId: string): Promise<PropertyCharacteristic | null> {
    const result = await query(
      `SELECT * FROM property_characteristics
       WHERE property_id = $1 AND effective_to IS NULL
       ORDER BY effective_from DESC
       LIMIT 1`,
      [propertyId]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Get the full characteristics history for a property, newest first.
   */
  async getHistory(propertyId: string): Promise<PropertyCharacteristic[]> {
    const result = await query(
      `SELECT * FROM property_characteristics
       WHERE property_id = $1
       ORDER BY effective_from DESC`,
      [propertyId]
    );
    return result.rows.map(mapRow);
  }

  /**
   * Get characteristics as of a specific date.
   */
  async getAsOf(propertyId: string, asOfDate: string): Promise<PropertyCharacteristic | null> {
    const result = await query(
      `SELECT * FROM property_characteristics
       WHERE property_id = $1
         AND effective_from <= $2
         AND (effective_to IS NULL OR effective_to > $2)
       ORDER BY effective_from DESC
       LIMIT 1`,
      [propertyId, asOfDate]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Create a new characteristics record.
   * If this is the new current state (effective_to = null),
   * closes out the previous current row first.
   */
  async create(input: CreatePropertyCharacteristicInput): Promise<PropertyCharacteristic> {
    if (!input.effectiveTo) {
      await query(
        `UPDATE property_characteristics
         SET effective_to = $2, updated_at = NOW()
         WHERE property_id = $1 AND effective_to IS NULL`,
        [input.propertyId, input.effectiveFrom]
      );
    }

    const result = await query(
      `INSERT INTO property_characteristics (
        property_id, effective_from, effective_to,
        current_building_class, unit_count, building_sf, unit_mix,
        condition, last_renovation_year, renovation_scope,
        source, source_date, confidence, provenance
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        input.propertyId,
        input.effectiveFrom,
        input.effectiveTo ?? null,
        input.currentBuildingClass ?? null,
        input.unitCount ?? null,
        input.buildingSf ?? null,
        input.unitMix ? JSON.stringify(input.unitMix) : null,
        input.condition ?? null,
        input.lastRenovationYear ?? null,
        input.renovationScope ?? null,
        input.source ?? null,
        input.sourceDate ?? null,
        input.confidence ?? null,
        input.provenance ? JSON.stringify(input.provenance) : null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Bulk-check: get current characteristics for a list of property IDs.
   * Returns a map of propertyId → PropertyCharacteristic.
   */
  async getCurrentBatch(propertyIds: string[]): Promise<Map<string, PropertyCharacteristic>> {
    if (propertyIds.length === 0) return new Map();
    const result = await query(
      `SELECT DISTINCT ON (property_id) *
       FROM property_characteristics
       WHERE property_id = ANY($1) AND effective_to IS NULL
       ORDER BY property_id, effective_from DESC`,
      [propertyIds]
    );
    const map = new Map<string, PropertyCharacteristic>();
    for (const row of result.rows) {
      const char = mapRow(row);
      map.set(char.propertyId, char);
    }
    return map;
  }
}

export const propertyCharacteristicsService = new PropertyCharacteristicsService();
