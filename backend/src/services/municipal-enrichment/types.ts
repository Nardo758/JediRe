/**
 * Shared types for the MunicipalEnrichmentService and its adapters.
 */

export interface MunicipalLookupResult {
  status: 'ok' | 'not_found' | 'not_implemented' | 'error';

  parcel_id?:       string | null;
  address?:         string | null;
  owner?:           string | null;
  legal_description?: string | null;
  assessed_value?:  number;
  appraised_value?: number;
  land_acres?:      number;
  units?:           number;
  county?:          string;
  state?:           string;
  tax_district?:    string | null;
  source?:          string;
  error?:           string;
  candidates?:      number;
  raw?:             Record<string, unknown>;
}
