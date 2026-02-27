/**
 * Grid View Types
 * Type definitions for Pipeline and Assets Owned grid views
 */

export interface PipelineDeal {
  id: string;
  property_name: string;
  address: string;
  asset_type: string;
  unit_count: number;
  pipeline_stage: string;
  days_in_stage: number;
  ai_opportunity_score: number;
  ask_price: number;
  jedi_adjusted_price: number;
  broker_projected_irr: number;
  jedi_adjusted_irr: number;
  noi: number;
  best_strategy: string;
  strategy_confidence: number;
  supply_risk_flag: boolean;
  imbalance_score: number;
  source: string;
  loi_deadline: string;
  closing_date: string;
  dd_checklist_pct: number;
  created_at: string;
  
  // Map view coordinates (optional, for geocoding)
  lat?: number;
  lng?: number;
  geocoded_at?: string;
}

export interface OwnedAsset {
  id: string;
  property_name: string;
  address: string;
  asset_type: string;
  acquisition_date: string;
  hold_period: number;
  actual_noi: number;
  proforma_noi: number;
  noi_variance: number;
  actual_occupancy: number;
  proforma_occupancy: number;
  occupancy_variance: number;
  actual_avg_rent: number;
  proforma_rent: number;
  rent_variance: number;
  current_irr: number;
  projected_irr: number;
  coc_return: number;
  equity_multiple: number;
  total_distributions: number;
  actual_opex_ratio: number;
  actual_capex: number;
  proforma_capex: number;
  loan_maturity_date: string;
  months_to_maturity: number;
  refi_risk_flag: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface GridFilter {
  column: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface GridSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface GridState {
  sort: GridSort | null;
  filters: GridFilter[];
  page: number;
  pageSize: number;
}
