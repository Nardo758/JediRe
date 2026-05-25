import { apiClient } from './api.client';

export interface LayeredValueLayer<T = unknown> {
  value: T;
  ts: string;
  source?: string;
}

export interface LayeredValue<T = unknown> {
  resolved: T | null;
  layers?: {
    om?: { value: T; source_file_id?: string; confidence?: number; extracted_at?: string };
    municipal?: { value: T; source?: string; fetched_at?: string; api_endpoint?: string };
    web?: { value: T; source_url?: string; fetched_at?: string };
    pending_web?: { value: T; ts: string; source: string };
    manual?: { value: T; user?: string; entered_at?: string; note?: string };
  };
  resolution_rule?: string;
}

export interface PropertyDescription {
  parcel_id: string;
  property_name?: LayeredValue<string>;
  address?: LayeredValue<{ street: string; city: string; state: string; zip: string }>;
  msa?: LayeredValue<string>;
  county?: LayeredValue<string>;
  year_built?: LayeredValue<number>;
  year_renovated?: LayeredValue<number>;
  unit_count?: LayeredValue<number>;
  building_count?: LayeredValue<number>;
  stories?: LayeredValue<number>;
  total_sqft?: LayeredValue<number>;
  rentable_sqft?: LayeredValue<number>;
  lot_size_acres?: LayeredValue<number>;
  construction_type?: LayeredValue<string>;
  parking_type?: LayeredValue<string>;
  parking_spaces?: LayeredValue<number>;
  parking_ratio?: LayeredValue<number>;
  asset_class?: LayeredValue<string>;
  property_type?: LayeredValue<string>;
  has_pool?: LayeredValue<boolean>;
  has_fitness?: LayeredValue<boolean>;
  has_clubhouse?: LayeredValue<boolean>;
  has_concierge?: LayeredValue<boolean>;
  has_business_center?: LayeredValue<boolean>;
  has_dog_park?: LayeredValue<boolean>;
  is_master_metered?: LayeredValue<boolean>;
  is_individual_metered?: LayeredValue<boolean>;
  zoning_code?: LayeredValue<string>;
  flood_zone?: LayeredValue<string>;
  narrative?: LayeredValue<string>;
  amenities?: LayeredValue<string[]>;
  photos?: LayeredValue<Array<{ photo_name: string; proxy_url: string; attribution: string | null; width_px: number | null; height_px: number | null }>>;
  reviews?: LayeredValue<Array<{
    author: string;
    rating: number;
    text: string;
    publishTime: string;
    sentiment_score: number;
    named_entities: string[];
    hazard_mentions: string[];
    amenity_mentions: string[];
  }>>;
  sentiment_summary?: LayeredValue<{
    overall_score: number;
    rating: number | null;
    total_ratings: number | null;
    hazard_flags: string[];
    amenity_gaps: string[];
    recency_weight: boolean;
  }>;
  recent_events?: LayeredValue<Array<{
    title: string;
    date: string;
    type: 'renovation' | 'ownership_change' | 'capex' | 'news';
    summary: string;
    source_url: string;
  }>>;
  created_at?: string;
  updated_at?: string;
}

export interface DataLibraryFile {
  id: string;
  parcel_id: string;
  deal_id?: string;
  original_filename: string;
  sha256?: string;
  mime_type?: string;
  size_bytes?: number;
  storage_provider?: string;
  storage_key?: string;
  cdn_url?: string;
  document_type: string;
  parser_used?: string;
  parser_version?: string;
  parser_status?: string;
  parser_run_id?: string;
  parser_error?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  source_signal?: string;
  license_restricted?: boolean;
  license_source?: string;
}

export interface TimeSeriesPoint {
  observation_date: string;
  value: number | null;
  tier: string | null;
  source_file_ids: string[] | null;
}

export interface TimeSeries {
  parcel_id: string;
  series: {
    asking_rent: TimeSeriesPoint[];
    avg_rent: TimeSeriesPoint[];
    occupancy: TimeSeriesPoint[];
    signing_velocity: TimeSeriesPoint[];
    concession_per_unit: TimeSeriesPoint[];
  };
  coverage: Record<string, {
    observations_count: number;
    date_range: { start: string | null; end: string | null };
    gap_diagnostic?: { coverage_pct: number; gap_count: number; gap_months: string[] } | null;
  }>;
  range?: { start: string; end: string };
}

export interface CoverageDiagnostics {
  has_om: boolean;
  has_t12_count: number;
  has_rent_roll_count: number;
  has_tax_bill: boolean;
  has_leasing_stats: boolean;
  description_completeness: number;
  time_series_completeness: number;
}

export interface PropertySummary {
  parcel_id: string;
  description: PropertyDescription | null;
  files: DataLibraryFile[];
  time_series: TimeSeries;
  coverage_diagnostics: CoverageDiagnostics;
}

export const archivePropertiesService = {
  async getSummary(parcelId: string): Promise<PropertySummary> {
    const { data } = await apiClient.get<PropertySummary>(
      `/api/v1/properties/${encodeURIComponent(parcelId)}/summary`,
    );
    return data;
  },

  async getFiles(parcelId: string, params?: { document_type?: string; parser_status?: string }): Promise<{ parcel_id: string; files: DataLibraryFile[]; count: number }> {
    const { data } = await apiClient.get(
      `/api/v1/properties/${encodeURIComponent(parcelId)}/files`,
      { params },
    );
    return data;
  },
};
