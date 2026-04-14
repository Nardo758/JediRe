/**
 * M07: Rent Roll Field Mapper
 *
 * Normalizes raw column names from Yardi and generic CSV/XLSX formats
 * into the canonical RentRollLeaseEvent field names.
 *
 * Returns a mapping from canonical field → original column index.
 */

import type { RentRollFormat } from './format-detector.service';

export type CanonicalField =
  | 'unit_id'
  | 'unit_type'
  | 'unit_sf'
  | 'contract_rent'
  | 'market_rent'
  | 'concession_value'
  | 'concession_months'
  | 'lease_start'
  | 'lease_end'
  | 'move_in_date'
  | 'move_out_date'
  | 'notice_date'
  | 'unit_status'
  | 'is_renewal'
  | 'days_vacant';

export type FieldMapping = Partial<Record<CanonicalField, number>>;

// Yardi column aliases (lowercase)
const YARDI_ALIASES: Record<CanonicalField, string[]> = {
  unit_id:           ['unit', 'unit id', 'unit #', 'unitid'],
  unit_type:         ['unit type', 'floorplan', 'floor plan', 'bedroom type', 'plan'],
  unit_sf:           ['sqft', 'sq ft', 'square feet', 'unit sqft', 'unit size'],
  contract_rent:     ['lease rent', 'contract rent', 'actual rent', 'resident rent', 'charge amount'],
  market_rent:       ['market rent', 'market rate', 'asking rent', 'budgeted rent'],
  concession_value:  ['concession', 'concession amount', 'concession value', 'conc amount'],
  concession_months: ['concession months', 'free months', 'conc months'],
  lease_start:       ['lease from', 'lease start', 'lease begin', 'start date'],
  lease_end:         ['lease to', 'lease end', 'lease expiration', 'expiration date', 'end date'],
  move_in_date:      ['move in', 'move-in', 'move in date', 'actual move in'],
  move_out_date:     ['move out', 'move-out', 'move out date', 'actual move out'],
  notice_date:       ['notice date', 'notice given', 'ntv date'],
  unit_status:       ['unit status', 'status', 'occ status', 'occupancy status'],
  is_renewal:        ['renewal', 'is renewal', 'lease type'],
  days_vacant:       ['days vacant', 'vacant days', 'days empty'],
};

// Generic / common alias variations
const GENERIC_ALIASES: Record<CanonicalField, string[]> = {
  unit_id:           ['unit', 'unit id', 'unit number', 'apt', 'apartment', 'unitno'],
  unit_type:         ['unit type', 'type', 'bedroom', 'bed', 'br', 'layout', 'plan'],
  unit_sf:           ['sqft', 'sf', 'sq ft', 'square feet', 'area'],
  contract_rent:     ['rent', 'contract rent', 'actual rent', 'monthly rent', 'current rent'],
  market_rent:       ['market rent', 'market rate', 'asking'],
  concession_value:  ['concession', 'concession amount', 'free rent', 'discount'],
  concession_months: ['free months', 'concession months'],
  lease_start:       ['lease start', 'start date', 'from', 'begin'],
  lease_end:         ['lease end', 'end date', 'expiration', 'expires', 'to'],
  move_in_date:      ['move in', 'move-in date', 'movein'],
  move_out_date:     ['move out', 'move-out date', 'moveout', 'vacated'],
  notice_date:       ['notice date', 'notice', 'ntv'],
  unit_status:       ['status', 'unit status', 'occ', 'occupancy'],
  is_renewal:        ['renewal', 'renew', 'lease type'],
  days_vacant:       ['days vacant', 'vacant days'],
};

export class FieldMapperService {

  /**
   * Build a FieldMapping from headers + format.
   * Returns a map of canonical_field → column_index.
   */
  buildMapping(headers: string[], format: RentRollFormat): FieldMapping {
    const aliases = format.startsWith('yardi') ? YARDI_ALIASES : GENERIC_ALIASES;
    const headerLower = headers.map(h => h.toLowerCase().trim());
    const mapping: FieldMapping = {};

    for (const [canonical, aliasList] of Object.entries(aliases) as [CanonicalField, string[]][]) {
      for (const alias of aliasList) {
        const idx = headerLower.findIndex(h => h === alias || h.includes(alias));
        if (idx >= 0) {
          mapping[canonical] = idx;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Report which canonical fields could not be mapped (for confidence scoring).
   */
  getMissingFields(mapping: FieldMapping): CanonicalField[] {
    const required: CanonicalField[] = [
      'unit_id', 'unit_type', 'contract_rent', 'lease_start', 'lease_end', 'unit_status',
    ];
    return required.filter(f => mapping[f] === undefined);
  }

  /**
   * Extract a value from a raw row array by canonical field name.
   */
  getValue(row: any[], mapping: FieldMapping, field: CanonicalField): string | undefined {
    const idx = mapping[field];
    if (idx === undefined || idx >= row.length) return undefined;
    const val = row[idx];
    if (val === null || val === undefined || val === '') return undefined;
    return String(val).trim();
  }
}

export const fieldMapperService = new FieldMapperService();
