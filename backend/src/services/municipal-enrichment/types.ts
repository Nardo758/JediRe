/**
 * Shared types for the MunicipalEnrichmentService and its adapters.
 */

export interface MunicipalLookupResult {
  status: 'ok' | 'not_found' | 'not_implemented' | 'error';

  // Core identifiers
  parcel_id?:           string | null;
  address?:             string | null;

  // Ownership
  owner?:               string | null;
  owner_address?:       string | null;

  // Legal description (subdivision/lot info)
  legal_description?:   string | null;
  subdivision?:         string | null;
  subdivision_lot?:     string | null;
  subdivision_block?:   string | null;

  // Valuations
  assessed_value?:      number;
  appraised_value?:     number;
  assessed_land?:       number;
  assessed_improvement?: number;
  appraised_land?:      number;

  // Physical
  land_acres?:          number;
  geometry_area_sqft?:  number;
  units?:               number;

  // Classification
  land_use_code?:       string | null;
  class_code?:          string | null;
  neighborhood?:        string | null;
  tax_district?:        string | null;

  // Meta
  county?:              string;
  state?:               string;
  source?:              string;
  error?:               string;
  candidates?:          number;
  raw?:                 Record<string, unknown>;
}
