// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Product Type Module Adaptation Layer
// ═══════════════════════════════════════════════════════════════════════════════
//
// This extends deal-type-visibility.ts with PRODUCT TYPE as the second axis.
// Every module now adapts across TWO dimensions:
//   Axis 1: DealType      — existing | development | redevelopment
//   Axis 2: ProductType   — multifamily | single_family | industrial | ...
//
// The combination drives:
//   - Which sub-components render inside each module
//   - What metrics, line items, and terminology appear
//   - Which data sources are relevant
//   - What the Unit Mix module looks like (completely different per combo)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { DealType, ModuleId, StrategyId } from './deal-type-visibility';


// ─── Product Type Taxonomy ───────────────────────────────────────────────────

/**
 * Product families — the top-level category.
 * Each family contains specific product types.
 */
export type ProductFamily =
  | 'multifamily'
  | 'single_family'
  | 'industrial'
  | 'office'
  | 'retail'
  | 'hospitality'
  | 'mixed_use'
  | 'land'
  | 'special_purpose';

/**
 * Specific product types — maps to the Strategy Matrix's 39 rows.
 * Grouped by family for organization, but typed as a flat union.
 */
export type ProductType =
  // Multifamily
  | 'mf_garden'          // Garden-Style (1-3 stories)
  | 'mf_midrise'         // Mid-Rise (4-8 stories)
  | 'mf_highrise'        // High-Rise (9+ stories)
  | 'mf_student'         // Student Housing
  | 'mf_senior'          // Senior Housing
  | 'mf_affordable'      // Affordable / LIHTC
  | 'mf_btr'             // Build-to-Rent SFR Communities
  // Single Family
  | 'sf_single'          // Single-Family Homes
  | 'sf_condo'           // Condos/Townhouses
  | 'sf_small_multi'     // Duplex/Triplex/Quad
  | 'sf_manufactured'    // Manufactured/Mobile
  // Industrial
  | 'ind_warehouse'      // Warehouse/Distribution
  | 'ind_fulfillment'    // Fulfillment/Last-Mile
  | 'ind_cold_storage'   // Cold Storage
  | 'ind_manufacturing'  // Manufacturing
  | 'ind_data_center'    // Data Centers
  // Office
  | 'off_class_a'        // Class A Office
  | 'off_class_bc'       // Class B/C Office
  | 'off_medical'        // Medical Office
  | 'off_flex'           // Flex/Creative Office
  // Retail
  | 'ret_nnn'            // Single-Tenant NNN
  | 'ret_strip'          // Strip Centers
  | 'ret_grocery'        // Grocery-Anchored
  | 'ret_power'          // Power Centers/Malls
  // Hospitality
  | 'hosp_limited'       // Limited-Service Hotels
  | 'hosp_full'          // Full-Service Hotels
  | 'hosp_extended'      // Extended-Stay
  | 'hosp_str'           // Short-Term Rentals
  // Mixed-Use
  | 'mx_vertical'        // Vertical Mixed-Use
  | 'mx_horizontal'      // Horizontal Mixed-Use
  | 'mx_livework'        // Live-Work
  // Land
  | 'land_raw'           // Raw/Undeveloped
  | 'land_entitled'      // Entitled/Approved
  | 'land_ag'            // Agricultural
  | 'land_infill'        // Infill Parcels
  // Special Purpose
  | 'sp_storage'         // Self-Storage
  | 'sp_parking'         // Parking
  | 'sp_life_science'    // Life Sciences/Lab
  | 'sp_healthcare'      // Healthcare Facilities
  | 'sp_carwash';        // Car Washes

export const PRODUCT_FAMILY_MAP: Record<ProductType, ProductFamily> = {
  mf_garden: 'multifamily', mf_midrise: 'multifamily', mf_highrise: 'multifamily',
  mf_student: 'multifamily', mf_senior: 'multifamily', mf_affordable: 'multifamily', mf_btr: 'multifamily',
  sf_single: 'single_family', sf_condo: 'single_family', sf_small_multi: 'single_family', sf_manufactured: 'single_family',
  ind_warehouse: 'industrial', ind_fulfillment: 'industrial', ind_cold_storage: 'industrial',
  ind_manufacturing: 'industrial', ind_data_center: 'industrial',
  off_class_a: 'office', off_class_bc: 'office', off_medical: 'office', off_flex: 'office',
  ret_nnn: 'retail', ret_strip: 'retail', ret_grocery: 'retail', ret_power: 'retail',
  hosp_limited: 'hospitality', hosp_full: 'hospitality', hosp_extended: 'hospitality', hosp_str: 'hospitality',
  mx_vertical: 'mixed_use', mx_horizontal: 'mixed_use', mx_livework: 'mixed_use',
  land_raw: 'land', land_entitled: 'land', land_ag: 'land', land_infill: 'land',
  sp_storage: 'special_purpose', sp_parking: 'special_purpose', sp_life_science: 'special_purpose',
  sp_healthcare: 'special_purpose', sp_carwash: 'special_purpose',
};

export function getProductFamily(pt: ProductType): ProductFamily {
  return PRODUCT_FAMILY_MAP[pt];
}


// ═══════════════════════════════════════════════════════════════════════════════
// UNIT MIX MODULE — The centerpiece of product-type adaptation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is effectively a NEW module (M03B) that lives between Property (M02)
// and Development Capacity (M03). It behaves completely differently:
//
//   Existing + Multifamily  → "Existing Unit Mix Analyzer" — read what's there,
//                              benchmark against market, identify repositioning opps
//
//   Development + Multifamily → "Unit Mix Designer" — build the optimal mix from
//                                scratch using demand signals, zoning constraints,
//                                and market comps
//
//   Redevelopment + Multifamily → BOTH — analyze existing, then design the target
//
//   Industrial (any deal type) → "Space Configuration" — bay sizes, clear heights,
//                                 dock doors, not bedrooms
//
// ═══════════════════════════════════════════════════════════════════════════════

export type UnitMixMode =
  | 'analyzer'          // Read & benchmark existing
  | 'designer'          // Build from scratch
  | 'analyzer_designer' // Both (redevelopment)
  | 'space_config'      // Industrial / commercial space layout
  | 'key_config'        // Hospitality keys / rooms
  | 'lot_config'        // SFR lots / pads
  | 'tenant_config'     // Retail / office tenant suites
  | 'hidden';           // Land, parking, etc.

export interface UnitMixConfig {
  mode: UnitMixMode;
  label: string;                    // Tab label (changes per product type)
  unitTerm: string;                 // "Units" | "Keys" | "Bays" | "Lots" | "Suites" | "Spaces"
  unitSubterm: string;              // "Bedrooms" | "Room type" | "Bay size" | "Lot size" | etc.
  pricingTerm: string;              // "Rent/mo" | "ADR" | "Rent/SF/yr" | "Pad rent"
  pricingUnit: string;              // "per_unit_monthly" | "per_key_nightly" | "per_sf_annual"

  /** The fields that define a unit type row in the mix table */
  unitTypeFields: UnitTypeField[];

  /** Fields specific to the analyzer mode (existing properties) */
  analyzerFields?: string[];

  /** Fields specific to the designer mode (new development) */
  designerFields?: string[];

  /** Which market comp dimensions to pull */
  compDimensions: string[];

  /** Benchmark metrics for this product type */
  benchmarkMetrics: string[];
}

export interface UnitTypeField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'range';
  options?: string[];                // For select fields
  unit?: string;                     // "SF" | "ft" | "$" | "%"
  required: boolean;
}


// ─── Unit Mix Configurations by Product Family ───────────────────────────────

const MF_UNIT_TYPE_FIELDS: UnitTypeField[] = [
  { key: 'type_name',    label: 'Unit type',     type: 'text',   required: true },
  { key: 'bedrooms',     label: 'Bedrooms',      type: 'select', options: ['Studio', '1BR', '2BR', '3BR', '4BR'], required: true },
  { key: 'bathrooms',    label: 'Bathrooms',      type: 'select', options: ['1', '1.5', '2', '2.5', '3'], required: true },
  { key: 'avg_sf',       label: 'Avg SF',         type: 'number', unit: 'SF', required: true },
  { key: 'unit_count',   label: 'Count',          type: 'number', required: true },
  { key: 'mix_pct',      label: 'Mix %',          type: 'number', unit: '%', required: false }, // auto-calculated
  { key: 'market_rent',  label: 'Market rent',    type: 'number', unit: '$', required: true },
  { key: 'current_rent', label: 'In-place rent',  type: 'number', unit: '$', required: false }, // analyzer only
  { key: 'rent_per_sf',  label: 'Rent/SF',        type: 'number', unit: '$', required: false }, // auto-calculated
  { key: 'floor_plan',   label: 'Floor plan',     type: 'text',   required: false },
];

const SF_UNIT_TYPE_FIELDS: UnitTypeField[] = [
  { key: 'lot_id',       label: 'Lot/unit ID',    type: 'text',   required: true },
  { key: 'product',      label: 'Product',        type: 'select', options: ['SFD', 'SFA', 'TH', 'Duplex', 'Villa'], required: true },
  { key: 'bedrooms',     label: 'Bedrooms',       type: 'select', options: ['2BR', '3BR', '4BR', '5BR'], required: true },
  { key: 'bathrooms',    label: 'Bathrooms',      type: 'select', options: ['2', '2.5', '3', '3.5', '4'], required: true },
  { key: 'living_sf',    label: 'Living SF',      type: 'number', unit: 'SF', required: true },
  { key: 'lot_sf',       label: 'Lot SF',         type: 'number', unit: 'SF', required: true },
  { key: 'garage',       label: 'Garage',         type: 'select', options: ['None', '1-car', '2-car', '3-car'], required: true },
  { key: 'target_price', label: 'Target price',   type: 'number', unit: '$', required: true },
  { key: 'price_per_sf', label: 'Price/SF',       type: 'number', unit: '$', required: false },
  { key: 'monthly_rent', label: 'Monthly rent',   type: 'number', unit: '$', required: false }, // if BTR
];

const IND_SPACE_FIELDS: UnitTypeField[] = [
  { key: 'bay_id',       label: 'Bay/space ID',   type: 'text',   required: true },
  { key: 'space_type',   label: 'Space type',     type: 'select', options: ['Warehouse', 'Fulfillment', 'Cold storage', 'Manufacturing', 'Office/flex', 'Mezzanine'], required: true },
  { key: 'rentable_sf',  label: 'Rentable SF',    type: 'number', unit: 'SF', required: true },
  { key: 'clear_height', label: 'Clear height',   type: 'number', unit: 'ft', required: true },
  { key: 'dock_doors',   label: 'Dock doors',     type: 'number', required: true },
  { key: 'drive_in',     label: 'Drive-in doors', type: 'number', required: false },
  { key: 'power_amps',   label: 'Power (amps)',   type: 'number', required: false },
  { key: 'hvac',         label: 'Climate ctrl',   type: 'select', options: ['None', 'Heated', 'Cooled', 'Temp-controlled'], required: true },
  { key: 'rent_sf_yr',   label: 'Rent/SF/yr',     type: 'number', unit: '$', required: true },
  { key: 'tenant',       label: 'Tenant',         type: 'text',   required: false }, // existing only
];

const HOSP_KEY_FIELDS: UnitTypeField[] = [
  { key: 'room_type',    label: 'Room type',      type: 'select', options: ['Standard King', 'Standard Queen', 'Double Queen', 'Suite', 'Executive Suite', 'Studio Suite', 'Penthouse'], required: true },
  { key: 'key_count',    label: 'Key count',      type: 'number', required: true },
  { key: 'avg_sf',       label: 'Avg SF',         type: 'number', unit: 'SF', required: true },
  { key: 'rack_rate',    label: 'Rack rate',      type: 'number', unit: '$', required: true },
  { key: 'avg_adr',      label: 'Avg ADR',        type: 'number', unit: '$', required: true },
  { key: 'occ_rate',     label: 'Occupancy %',    type: 'number', unit: '%', required: false },
  { key: 'revpar',       label: 'RevPAR',         type: 'number', unit: '$', required: false },
  { key: 'floor',        label: 'Floor(s)',        type: 'text',   required: false },
];

const RETAIL_TENANT_FIELDS: UnitTypeField[] = [
  { key: 'suite_id',     label: 'Suite',          type: 'text',   required: true },
  { key: 'tenant_type',  label: 'Tenant type',    type: 'select', options: ['Anchor', 'Jr Anchor', 'Inline', 'Pad', 'Outparcel', 'Kiosk'], required: true },
  { key: 'rentable_sf',  label: 'Rentable SF',    type: 'number', unit: 'SF', required: true },
  { key: 'tenant_name',  label: 'Tenant',         type: 'text',   required: false },
  { key: 'lease_type',   label: 'Lease type',     type: 'select', options: ['NNN', 'Modified Gross', 'Gross', 'Percentage'], required: true },
  { key: 'base_rent_sf', label: 'Base rent/SF',   type: 'number', unit: '$', required: true },
  { key: 'cam_sf',       label: 'CAM/SF',         type: 'number', unit: '$', required: false },
  { key: 'lease_exp',    label: 'Lease expiry',   type: 'text',   required: false },
  { key: 'options',      label: 'Options',        type: 'text',   required: false },
];

const OFFICE_TENANT_FIELDS: UnitTypeField[] = [
  { key: 'suite_id',     label: 'Suite',          type: 'text',   required: true },
  { key: 'floor',        label: 'Floor',          type: 'number', required: true },
  { key: 'rentable_sf',  label: 'Rentable SF',    type: 'number', unit: 'SF', required: true },
  { key: 'usable_sf',    label: 'Usable SF',      type: 'number', unit: 'SF', required: false },
  { key: 'tenant_name',  label: 'Tenant',         type: 'text',   required: false },
  { key: 'tenant_industry', label: 'Industry',    type: 'text',   required: false },
  { key: 'lease_type',   label: 'Lease type',     type: 'select', options: ['NNN', 'Modified Gross', 'Full Service', 'Industrial Gross'], required: true },
  { key: 'base_rent_sf', label: 'Base rent/SF',   type: 'number', unit: '$', required: true },
  { key: 'ti_allowance', label: 'TI allowance/SF', type: 'number', unit: '$', required: false },
  { key: 'lease_exp',    label: 'Lease expiry',   type: 'text',   required: false },
  { key: 'walt_months',  label: 'WALT (mo)',      type: 'number', required: false },
];


// ─── Build the Config per Product Family ─────────────────────────────────────

function getUnitMixConfigForFamily(family: ProductFamily, dealType: DealType): UnitMixConfig {
  const mode = resolveUnitMixMode(family, dealType);

  switch (family) {
    case 'multifamily':
      return {
        mode,
        label: mode === 'designer' ? 'Unit mix designer' : mode === 'analyzer' ? 'Unit mix' : 'Unit mix (current → target)',
        unitTerm: 'Units',
        unitSubterm: 'Bedroom type',
        pricingTerm: 'Rent/mo',
        pricingUnit: 'per_unit_monthly',
        unitTypeFields: MF_UNIT_TYPE_FIELDS,
        analyzerFields: ['current_rent', 'in_place_occupancy', 'lease_expiry_distribution', 'loss_to_lease', 'concessions'],
        designerFields: ['target_mix_pct', 'absorption_timeline', 'preleasing_target', 'concession_budget'],
        compDimensions: ['rent_by_bedroom', 'sf_by_bedroom', 'amenity_set', 'concessions', 'occupancy'],
        benchmarkMetrics: ['revenue_per_unit', 'rent_per_sf', 'occupancy_rate', 'loss_to_lease_pct', 'renewal_rate'],
      };

    case 'single_family':
      return {
        mode,
        label: mode === 'designer' ? 'Lot/product mix designer' : mode === 'analyzer' ? 'Product inventory' : 'Product mix (current → target)',
        unitTerm: 'Lots',
        unitSubterm: 'Product type',
        pricingTerm: dealType === 'existing' ? 'Rent/mo' : 'Sale price',
        pricingUnit: dealType === 'existing' ? 'per_unit_monthly' : 'per_unit_sale',
        unitTypeFields: SF_UNIT_TYPE_FIELDS,
        analyzerFields: ['current_condition', 'reno_scope', 'arv_estimate', 'comparable_sales'],
        designerFields: ['lot_width', 'lot_depth', 'setbacks', 'impervious_coverage', 'hoa_budget'],
        compDimensions: ['price_per_sf', 'lot_premium', 'days_on_market', 'absorption_rate'],
        benchmarkMetrics: ['price_per_sf', 'price_per_lot', 'absorption_per_month', 'margin_per_unit'],
      };

    case 'industrial':
      return {
        mode: mode === 'hidden' ? 'hidden' : 'space_config',
        label: 'Space configuration',
        unitTerm: 'Bays',
        unitSubterm: 'Space type',
        pricingTerm: 'Rent/SF/yr',
        pricingUnit: 'per_sf_annual',
        unitTypeFields: IND_SPACE_FIELDS,
        analyzerFields: ['current_tenant', 'lease_remaining', 'renewal_probability', 'market_rent_gap'],
        designerFields: ['target_clear_height', 'truck_court_depth', 'column_spacing', 'fire_suppression', 'ev_charging'],
        compDimensions: ['rent_per_sf', 'clear_height_premium', 'dock_ratio', 'tenant_credit'],
        benchmarkMetrics: ['rent_per_sf', 'occupancy_rate', 'walt_years', 'noi_per_sf'],
      };

    case 'hospitality':
      return {
        mode: mode === 'hidden' ? 'hidden' : 'key_config',
        label: 'Key mix',
        unitTerm: 'Keys',
        unitSubterm: 'Room type',
        pricingTerm: 'ADR',
        pricingUnit: 'per_key_nightly',
        unitTypeFields: HOSP_KEY_FIELDS,
        analyzerFields: ['current_adr', 'occ_rate', 'revpar', 'seasonality_pattern', 'comp_set_str'],
        designerFields: ['target_flag', 'pip_requirements', 'ff_and_e_budget', 'food_bev_concept'],
        compDimensions: ['adr', 'occupancy', 'revpar', 'star_report_index', 'review_score'],
        benchmarkMetrics: ['revpar', 'goppar', 'adr_index', 'occupancy_index', 'review_rating'],
      };

    case 'retail':
      return {
        mode: mode === 'hidden' ? 'hidden' : 'tenant_config',
        label: 'Tenant mix',
        unitTerm: 'Suites',
        unitSubterm: 'Tenant type',
        pricingTerm: 'Rent/SF/yr',
        pricingUnit: 'per_sf_annual',
        unitTypeFields: RETAIL_TENANT_FIELDS,
        analyzerFields: ['current_noi', 'tenant_sales_psf', 'occupancy_cost_ratio', 'co_tenancy_clauses'],
        designerFields: ['anchor_strategy', 'inline_tenant_criteria', 'parking_ratio', 'signage_plan'],
        compDimensions: ['base_rent_psf', 'cam_charges', 'occupancy_rate', 'tenant_mix_quality', 'traffic_count'],
        benchmarkMetrics: ['noi_per_sf', 'sales_per_sf', 'occupancy_cost', 'walt_years'],
      };

    case 'office':
      return {
        mode: mode === 'hidden' ? 'hidden' : 'tenant_config',
        label: 'Tenant stack',
        unitTerm: 'Suites',
        unitSubterm: 'Floor / suite',
        pricingTerm: 'Rent/SF/yr',
        pricingUnit: 'per_sf_annual',
        unitTypeFields: OFFICE_TENANT_FIELDS,
        analyzerFields: ['current_noi', 'tenant_credit', 'renewal_probability', 'ti_amortization_remaining'],
        designerFields: ['floor_plate_efficiency', 'core_factor', 'column_grid', 'ceiling_height', 'building_amenities'],
        compDimensions: ['rent_per_sf', 'ti_allowance', 'free_rent', 'walt', 'tenant_industry_mix'],
        benchmarkMetrics: ['rent_per_sf', 'occupancy_rate', 'walt_years', 'noi_per_sf', 'expense_ratio'],
      };

    case 'mixed_use':
      return {
        mode,
        label: 'Component mix',
        unitTerm: 'Components',
        unitSubterm: 'Use type',
        pricingTerm: 'Varies by component',
        pricingUnit: 'per_component',
        unitTypeFields: MF_UNIT_TYPE_FIELDS, // Primary residential, sub-components load their own
        compDimensions: ['residential_rent', 'retail_rent_psf', 'parking_revenue'],
        benchmarkMetrics: ['blended_noi', 'residential_noi_pct', 'retail_noi_pct', 'parking_noi_pct'],
      };

    case 'land':
      return { mode: 'hidden', label: 'N/A', unitTerm: 'Acres', unitSubterm: 'N/A', pricingTerm: 'Price/acre', pricingUnit: 'per_acre', unitTypeFields: [], compDimensions: ['price_per_acre', 'entitlement_status'], benchmarkMetrics: ['price_per_acre', 'comp_land_sales'] };

    case 'special_purpose':
      return {
        mode: mode === 'hidden' ? 'hidden' : 'space_config',
        label: 'Space configuration',
        unitTerm: 'Spaces',
        unitSubterm: 'Space type',
        pricingTerm: 'Revenue/space',
        pricingUnit: 'per_space',
        unitTypeFields: IND_SPACE_FIELDS, // Generic, can be refined per subtype
        compDimensions: ['revenue_per_sf', 'occupancy'],
        benchmarkMetrics: ['revenue_per_sf', 'economic_occupancy', 'noi_margin'],
      };
  }
}

function resolveUnitMixMode(family: ProductFamily, dealType: DealType): UnitMixMode {
  if (family === 'land') return 'hidden';

  switch (dealType) {
    case 'existing':      return family === 'hospitality' ? 'key_config' : 'analyzer';
    case 'development':   return family === 'hospitality' ? 'key_config' : 'designer';
    case 'redevelopment': return family === 'hospitality' ? 'key_config' : 'analyzer_designer';
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// PER-MODULE PRODUCT TYPE ADAPTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Describes how a specific module adapts its content for a DealType × ProductType combo.
 */
export interface ModuleProductConfig {
  /** Override label for this module in context */
  label?: string;

  /** Primary metrics this module tracks for this product type */
  primaryMetrics: string[];

  /** Terminology overrides (e.g., "units" → "keys" for hospitality) */
  terminology?: Record<string, string>;

  /** Which sub-sections/sub-tabs are visible */
  visibleSections?: string[];

  /** Which sub-sections are hidden */
  hiddenSections?: string[];

  /** Additional sections that appear only for this product type */
  additionalSections?: string[];

  /** Notes on behavioral differences */
  notes?: string;
}


// ─── M01 Deal Overview — Product Type Hero Metrics ───────────────────────────

export function getOverviewMetrics(dealType: DealType, productType: ProductType): ModuleProductConfig {
  const family = getProductFamily(productType);

  const base: ModuleProductConfig = {
    primaryMetrics: ['jedi_score', 'strategy_recommendation', 'top_risk'],
  };

  // Add deal-type-specific hero metrics
  if (dealType === 'existing') {
    switch (family) {
      case 'multifamily':
        base.primaryMetrics.push('going_in_cap', 'price_per_unit', 'noi', 'occupancy', 'avg_rent', 'loss_to_lease');
        break;
      case 'single_family':
        base.primaryMetrics.push('arv', 'price_per_sf', 'estimated_reno', 'profit_margin', 'days_to_close');
        break;
      case 'industrial':
        base.primaryMetrics.push('going_in_cap', 'price_per_sf', 'noi', 'walt_years', 'clear_height', 'occupancy');
        break;
      case 'hospitality':
        base.primaryMetrics.push('price_per_key', 'revpar', 'adr', 'occupancy', 'noi_per_key');
        base.terminology = { units: 'keys', rent: 'ADR', occupancy: 'occupancy' };
        break;
      case 'office': case 'retail':
        base.primaryMetrics.push('going_in_cap', 'price_per_sf', 'noi', 'walt_years', 'occupancy', 'expense_ratio');
        base.terminology = { units: 'suites', rent: 'rent/SF' };
        break;
      default:
        base.primaryMetrics.push('going_in_cap', 'price_per_sf', 'noi');
    }
  } else if (dealType === 'development') {
    switch (family) {
      case 'multifamily':
        base.primaryMetrics.push('total_dev_cost', 'cost_per_unit', 'yield_on_cost', 'dev_spread', 'timeline_months', 'stabilized_noi');
        break;
      case 'single_family':
        base.primaryMetrics.push('total_dev_cost', 'cost_per_lot', 'projected_margin', 'absorption_per_month', 'lot_count', 'avg_sale_price');
        break;
      case 'industrial':
        base.primaryMetrics.push('total_dev_cost', 'cost_per_sf', 'yield_on_cost', 'preleasing_pct', 'timeline_months');
        base.terminology = { units: 'SF' };
        break;
      default:
        base.primaryMetrics.push('total_dev_cost', 'yield_on_cost', 'dev_spread', 'timeline_months');
    }
  } else { // redevelopment
    switch (family) {
      case 'multifamily':
        base.primaryMetrics.push('acquisition_cost', 'reno_budget', 'total_basis', 'current_noi', 'stabilized_noi', 'value_creation', 'yield_on_cost');
        break;
      case 'single_family':
        base.primaryMetrics.push('purchase_price', 'reno_budget', 'arv', 'profit_margin', 'hold_period');
        break;
      default:
        base.primaryMetrics.push('acquisition_cost', 'reno_budget', 'total_basis', 'yield_on_cost', 'value_creation');
    }
  }

  return base;
}


// ─── M05 Market Analysis — Product Type Metrics ──────────────────────────────

export function getMarketConfig(productType: ProductType): ModuleProductConfig {
  const family = getProductFamily(productType);

  switch (family) {
    case 'multifamily':
      return {
        primaryMetrics: ['avg_effective_rent', 'vacancy_rate', 'absorption_rate', 'rent_growth_yoy', 'submarket_rank'],
        visibleSections: ['market_vitals', 'rent_comps', 'demographic_trends', 'demand_signals', 'submarket_ranking'],
        terminology: { rent: 'Effective rent', vacancy: 'Vacancy rate', pricing: 'Rent/unit' },
      };
    case 'single_family':
      return {
        primaryMetrics: ['median_sale_price', 'days_on_market', 'months_of_inventory', 'price_per_sf', 'absorption_rate'],
        visibleSections: ['market_vitals', 'sale_comps', 'builder_activity', 'demographic_trends', 'school_ratings'],
        additionalSections: ['builder_competitive_landscape', 'lot_availability'],
        terminology: { rent: 'Sale price', vacancy: 'Inventory', pricing: 'Price/SF' },
      };
    case 'industrial':
      return {
        primaryMetrics: ['avg_rent_psf', 'vacancy_rate', 'net_absorption_sf', 'construction_pipeline_sf', 'avg_clear_height'],
        visibleSections: ['market_vitals', 'lease_comps', 'pipeline_tracking', 'tenant_demand', 'logistics_infrastructure'],
        additionalSections: ['ecommerce_demand_index', 'port_proximity_analysis', 'labor_availability'],
        terminology: { rent: 'Rent/SF/yr', vacancy: 'Vacancy rate', pricing: 'Lease rate' },
      };
    case 'hospitality':
      return {
        primaryMetrics: ['market_adr', 'market_occupancy', 'market_revpar', 'supply_pipeline_keys', 'demand_growth'],
        visibleSections: ['market_vitals', 'str_report', 'demand_generators', 'seasonality', 'competitive_set'],
        additionalSections: ['event_calendar_impact', 'airline_route_analysis'],
        terminology: { rent: 'ADR', vacancy: 'Occupancy', pricing: 'RevPAR' },
      };
    case 'office':
      return {
        primaryMetrics: ['avg_rent_psf', 'vacancy_rate', 'net_absorption_sf', 'sublease_availability', 'construction_pipeline'],
        visibleSections: ['market_vitals', 'lease_comps', 'tenant_demand', 'remote_work_index', 'flight_to_quality_trend'],
        terminology: { rent: 'Rent/SF/yr', vacancy: 'Vacancy', pricing: 'Full service rate' },
      };
    case 'retail':
      return {
        primaryMetrics: ['avg_rent_psf', 'vacancy_rate', 'traffic_counts', 'sales_per_sf', 'occupancy_cost_ratio'],
        visibleSections: ['market_vitals', 'lease_comps', 'trade_area_demographics', 'traffic_analysis', 'ecommerce_resilience'],
        terminology: { rent: 'Rent/SF/yr', vacancy: 'Vacancy', pricing: 'Net effective' },
      };
    default:
      return { primaryMetrics: ['avg_rent_psf', 'vacancy_rate', 'absorption'], visibleSections: ['market_vitals'] };
  }
}


// ─── M09 ProForma — Product Type Line Items ──────────────────────────────────

export interface ProFormaProductConfig {
  revenueLineItems: string[];
  expenseLineItems: string[];
  returnMetrics: string[];
  timelinePhases?: string[];       // Development / redev only
  notes: string;
}

export function getProFormaProductConfig(dealType: DealType, productType: ProductType): ProFormaProductConfig {
  const family = getProductFamily(productType);

  if (family === 'multifamily') {
    const revenue = ['Gross Potential Rent', 'Other Income (parking, laundry, pet, storage)', 'Vacancy & Credit Loss', 'Concessions', 'Effective Gross Income'];
    const expenses = ['Property Management (3-5%)', 'On-Site Payroll', 'Repairs & Maintenance', 'Make-Ready/Turns', 'Insurance', 'Property Taxes', 'Utilities', 'Marketing', 'General & Administrative', 'Capital Reserves'];

    if (dealType === 'existing') {
      return { revenueLineItems: revenue, expenseLineItems: expenses,
        returnMetrics: ['NOI', 'Going-In Cap', 'Exit Cap', 'Cash-on-Cash', 'IRR', 'Equity Multiple'],
        notes: 'Acquisition ProForma with renovation budget and rent bump schedule' };
    }
    if (dealType === 'development') {
      return { revenueLineItems: revenue, expenseLineItems: expenses,
        returnMetrics: ['Total Dev Cost', 'Stabilized NOI', 'Yield on Cost', 'Dev Spread', 'IRR (levered)', 'Equity Multiple', 'Profit Margin'],
        timelinePhases: ['Pre-development', 'Entitlement', 'Construction', 'Lease-up', 'Stabilization'],
        notes: 'Development ProForma with phased cost draw schedule and absorption curve' };
    }
    return { revenueLineItems: revenue, expenseLineItems: expenses,
      returnMetrics: ['Total Basis', 'Current NOI', 'Stabilized NOI', 'Value Creation', 'Yield on Cost', 'IRR', 'Equity Multiple'],
      timelinePhases: ['Acquisition', 'Renovation', 'Re-lease', 'Stabilization'],
      notes: 'Hybrid: acquisition basis + renovation costs + repositioned revenue' };
  }

  if (family === 'industrial') {
    return {
      revenueLineItems: ['Base Rent Revenue', 'Expense Reimbursements (NNN)', 'Other Income (signage, roof, antenna)', 'Vacancy & Credit Loss', 'Effective Gross Income'],
      expenseLineItems: ['Property Management', 'Insurance', 'Property Taxes', 'R&M (landlord portion)', 'Capital Reserves'],
      returnMetrics: dealType === 'development'
        ? ['Total Dev Cost', 'Cost/SF', 'Yield on Cost', 'Dev Spread', 'IRR', 'Equity Multiple']
        : ['NOI', 'NOI/SF', 'Going-In Cap', 'Exit Cap', 'IRR', 'WALT'],
      timelinePhases: dealType === 'development' ? ['Pre-dev', 'Construction', 'Tenant fit-out', 'Lease-up'] : undefined,
      notes: 'NNN structure — most expenses passed through. Revenue driven by lease rates and WALT.',
    };
  }

  if (family === 'hospitality') {
    return {
      revenueLineItems: ['Rooms Revenue', 'Food & Beverage', 'Other Operated Departments', 'Miscellaneous Income', 'Total Revenue'],
      expenseLineItems: ['Rooms Expense', 'F&B Expense', 'Other Operated Expense', 'Undistributed Expenses (A&G, Sales, Property Ops, IT)', 'Management Fee', 'Franchise Fee', 'Property Taxes', 'Insurance', 'FF&E Reserve (4-5%)'],
      returnMetrics: ['Gross Operating Profit', 'EBITDA', 'NOI', 'RevPAR Index', 'Price/Key', 'Cap Rate', 'IRR'],
      timelinePhases: dealType === 'development' ? ['Pre-dev', 'Construction', 'FF&E install', 'Ramp-up (24-36mo)'] : undefined,
      notes: 'Hospitality uses USALI format. Revenue is ADR × Occupancy × Keys. Long ramp-up period for new builds.',
    };
  }

  if (family === 'single_family') {
    if (dealType === 'development') {
      return {
        revenueLineItems: ['Lot Sale Revenue', 'Home Sale Revenue (if builder)', 'Upgrade/Option Revenue', 'Closing Cost Credits'],
        expenseLineItems: ['Land Cost', 'Horizontal Infrastructure', 'Vertical Construction', 'Impact Fees', 'Soft Costs', 'Financing Costs', 'Marketing & Sales', 'Warranty Reserve'],
        returnMetrics: ['Total Dev Cost', 'Margin/Unit', 'Absorption/Month', 'Sellout Timeline', 'IRR', 'Profit Margin'],
        timelinePhases: ['Land acquisition', 'Entitlement', 'Horizontal construction', 'Vertical construction', 'Sales/closing'],
        notes: 'For-sale model: revenue recognized at closing. Absorption schedule is the key driver.',
      };
    }
    return {
      revenueLineItems: ['Gross Rent (if rental)', 'Sale Price (if flip)', 'Other Income', 'Vacancy'],
      expenseLineItems: ['Property Management', 'Repairs & Maintenance', 'Insurance', 'Property Taxes', 'HOA/CDD', 'Capital Reserves'],
      returnMetrics: dealType === 'existing'
        ? ['NOI', 'Cap Rate', 'Cash-on-Cash', 'ARV (if flip)', 'Profit Margin', 'IRR']
        : ['Purchase + Reno Cost', 'ARV', 'Profit Margin', 'Monthly Rent (if hold)', 'IRR'],
      notes: 'Single-unit or small portfolio model. Flip shows purchase→reno→ARV margin. Rental shows stabilized cash flow.',
    };
  }

  // Default fallback
  return {
    revenueLineItems: ['Gross Revenue', 'Vacancy', 'Effective Gross Income'],
    expenseLineItems: ['Operating Expenses', 'Management', 'Insurance', 'Taxes', 'Reserves'],
    returnMetrics: ['NOI', 'Cap Rate', 'IRR', 'Equity Multiple'],
    notes: 'Generic ProForma — customize for specific product type.',
  };
}


// ─── M08 Strategy Arbitrage — Product Type Strategy Filtering ────────────────

export interface StrategyAvailability {
  strategyId: StrategyId;
  strength: 'strong' | 'moderate' | 'weak' | 'rare' | 'na';
  notes: string;
}

export function getStrategyAvailability(dealType: DealType, productType: ProductType): StrategyAvailability[] {
  const family = getProductFamily(productType);

  // Base strategies from deal type
  const allStrategies: StrategyAvailability[] = [];

  // Product-type-specific strategy strength (from strategy matrix)
  const MATRIX: Partial<Record<ProductFamily, Record<StrategyId, { strength: 'strong' | 'moderate' | 'weak' | 'rare' | 'na'; note: string }>>> = {
    multifamily: {
      BTS: { strength: 'strong', note: 'Build-to-rent communities, urban infill' },
      FLIP: { strength: 'moderate', note: 'Heavy rehab conversions, value-add exits' },
      RENTAL: { strength: 'strong', note: 'Core strategy: value-add dominant' },
      STR: { strength: 'rare', note: 'Scale doesn\'t fit STR model typically' },
    },
    single_family: {
      BTS: { strength: 'strong', note: 'Spec homes, infill lots, BTR communities' },
      FLIP: { strength: 'strong', note: 'Distressed properties, 70% ARV rule' },
      RENTAL: { strength: 'strong', note: 'BRRRR strategy, 8-12% CoC target' },
      STR: { strength: 'strong', note: 'Tourist/business markets, 2-3x rent premium' },
    },
    industrial: {
      BTS: { strength: 'strong', note: 'E-commerce tailwind, build-to-suit' },
      FLIP: { strength: 'rare', note: 'New construction dominant, not flip-friendly' },
      RENTAL: { strength: 'strong', note: 'Institutional favorite, NNN structure' },
      STR: { strength: 'na', note: 'Not applicable to industrial' },
    },
    hospitality: {
      BTS: { strength: 'strong', note: 'Flag development, franchise opportunities' },
      FLIP: { strength: 'moderate', note: 'PIP renovations, brand conversion' },
      RENTAL: { strength: 'strong', note: 'Management agreement, long-term hold' },
      STR: { strength: 'moderate', note: 'Competes with hotel concept in some formats' },
    },
    office: {
      BTS: { strength: 'moderate', note: 'Pre-leased build-to-suit only' },
      FLIP: { strength: 'moderate', note: 'Conversion to other uses (residential, flex)' },
      RENTAL: { strength: 'strong', note: 'Core strategy with credit tenants' },
      STR: { strength: 'na', note: 'Not applicable' },
    },
    retail: {
      BTS: { strength: 'moderate', note: 'Build-to-suit for NNN tenants' },
      FLIP: { strength: 'moderate', note: 'Re-tenanting, repositioning' },
      RENTAL: { strength: 'strong', note: 'NNN income, mailbox money' },
      STR: { strength: 'na', note: 'Not applicable' },
    },
  };

  const familyStrategies = MATRIX[family];
  const strategies: StrategyId[] = ['BTS', 'FLIP', 'RENTAL', 'STR'];

  for (const strat of strategies) {
    const entry = familyStrategies?.[strat] ?? { strength: 'na' as const, note: 'Not defined' };

    // Apply deal-type filter: can't BTS existing, can't FLIP development
    let effectiveStrength = entry.strength;
    if (dealType === 'existing' && strat === 'BTS') effectiveStrength = 'na';
    if (dealType === 'development' && strat === 'FLIP') effectiveStrength = 'na';

    if (effectiveStrength !== 'na') {
      allStrategies.push({ strategyId: strat, strength: effectiveStrength, notes: entry.note });
    }
  }

  return allStrategies;
}


// ─── M14 Risk Dashboard — Product Type Risk Categories ───────────────────────

export interface RiskCategory {
  key: string;
  label: string;
  weight: number;
  subFactors: string[];
}

export function getRiskCategories(dealType: DealType, productType: ProductType): RiskCategory[] {
  const family = getProductFamily(productType);
  const isDev = dealType === 'development' || dealType === 'redevelopment';

  const base: RiskCategory[] = [
    { key: 'market', label: 'Market risk', weight: 0, subFactors: ['rent_growth_deceleration', 'cap_rate_expansion', 'recession_sensitivity'] },
    { key: 'supply', label: 'Supply risk', weight: 0, subFactors: ['pipeline_pressure', 'absorption_mismatch', 'competitive_entry'] },
    { key: 'execution', label: 'Execution risk', weight: 0, subFactors: [] },
    { key: 'regulatory', label: 'Regulatory risk', weight: 0, subFactors: ['zoning_change', 'rent_control', 'building_code'] },
    { key: 'climate', label: 'Climate & insurance', weight: 0, subFactors: ['flood_zone', 'wind_zone', 'insurance_cost_trend'] },
  ];

  // Adjust weights and subfactors by product family
  switch (family) {
    case 'multifamily':
      base[0].weight = isDev ? 0.15 : 0.25; // Market
      base[1].weight = isDev ? 0.15 : 0.20; // Supply
      base[2].weight = isDev ? 0.25 : 0.10; // Execution
      base[2].subFactors = isDev
        ? ['construction_cost_overrun', 'permitting_delay', 'labor_shortage', 'lease_up_pace']
        : ['renovation_scope_creep', 'tenant_retention', 'management_quality'];
      base[3].weight = isDev ? 0.20 : 0.15; // Regulatory
      base[3].subFactors.push('inclusionary_zoning', 'impact_fees');
      base[4].weight = 0.20; // Climate (FL-specific)
      base[4].subFactors.push('sinkhole_zone');
      break;

    case 'industrial':
      base[0].weight = 0.15;
      base[0].subFactors.push('ecommerce_deceleration', 'nearshoring_reversal');
      base[1].weight = 0.20;
      base[2].weight = isDev ? 0.25 : 0.10;
      base[2].subFactors = isDev
        ? ['construction_cost', 'precommitment_risk', 'spec_vs_bts']
        : ['tenant_concentration', 'lease_rollover', 'functional_obsolescence'];
      base[3].weight = 0.15;
      base[3].subFactors.push('environmental_remediation');
      base[4].weight = 0.15;
      // Add tenant credit risk for industrial
      base.push({ key: 'credit', label: 'Tenant credit risk', weight: 0.10, subFactors: ['tenant_credit_rating', 'industry_cyclicality', 'lease_guaranty'] });
      break;

    case 'hospitality':
      base[0].weight = 0.25;
      base[0].subFactors = ['adr_compression', 'demand_seasonality', 'event_dependency', 'recession_sensitivity'];
      base[1].weight = 0.15;
      base[2].weight = isDev ? 0.20 : 0.15;
      base[2].subFactors = isDev
        ? ['construction_cost', 'flag_approval', 'ramp_up_duration']
        : ['management_quality', 'brand_performance', 'capital_expenditure_cycle'];
      base[3].weight = 0.10;
      base[3].subFactors.push('str_regulation', 'liquor_license');
      base[4].weight = 0.15;
      // Add operational risk for hospitality
      base.push({ key: 'operational', label: 'Operational risk', weight: 0.15, subFactors: ['labor_cost_inflation', 'technology_disruption', 'online_review_vulnerability'] });
      break;

    default:
      // Generic weights
      base[0].weight = 0.25;
      base[1].weight = 0.20;
      base[2].weight = isDev ? 0.25 : 0.10;
      base[3].weight = 0.15;
      base[4].weight = isDev ? 0.10 : 0.20;
  }

  return base;
}


// ═══════════════════════════════════════════════════════════════════════════════
// M15 Competition — Product Type Comp Criteria
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompCriteria {
  primaryMatchFields: string[];
  secondaryMatchFields: string[];
  compMetrics: string[];
  compDisplayColumns: string[];
}

export function getCompCriteria(productType: ProductType): CompCriteria {
  const family = getProductFamily(productType);

  switch (family) {
    case 'multifamily':
      return {
        primaryMatchFields: ['unit_count_range', 'class', 'vintage_range', 'submarket'],
        secondaryMatchFields: ['unit_mix_overlap', 'amenity_set', 'price_tier'],
        compMetrics: ['effective_rent', 'rent_per_sf', 'occupancy', 'concessions', 'rent_growth'],
        compDisplayColumns: ['Property', 'Units', 'Year built', 'Class', 'Avg rent', 'Rent/SF', 'Occupancy', 'Concessions'],
      };
    case 'single_family':
      return {
        primaryMatchFields: ['bedrooms', 'sf_range', 'condition', 'subdivision'],
        secondaryMatchFields: ['lot_size', 'school_zone', 'hoa'],
        compMetrics: ['sale_price', 'price_per_sf', 'days_on_market', 'list_to_close_ratio'],
        compDisplayColumns: ['Address', 'BD/BA', 'SF', 'Lot', 'Sale price', 'Price/SF', 'DOM', 'Status'],
      };
    case 'industrial':
      return {
        primaryMatchFields: ['building_sf_range', 'clear_height', 'dock_count', 'submarket'],
        secondaryMatchFields: ['truck_court_depth', 'power_capacity', 'sprinkler_type'],
        compMetrics: ['rent_per_sf', 'vacancy', 'walt', 'tenant_credit'],
        compDisplayColumns: ['Property', 'SF', 'Clear ht', 'Docks', 'Rent/SF', 'Tenant', 'WALT', 'Lease type'],
      };
    case 'hospitality':
      return {
        primaryMatchFields: ['flag_tier', 'key_count_range', 'service_level', 'submarket'],
        secondaryMatchFields: ['amenity_set', 'meeting_space', 'f_and_b'],
        compMetrics: ['adr', 'occupancy', 'revpar', 'review_score', 'star_index'],
        compDisplayColumns: ['Property', 'Flag', 'Keys', 'ADR', 'Occ%', 'RevPAR', 'Rating', 'Index'],
      };
    default:
      return {
        primaryMatchFields: ['sf_range', 'class', 'submarket'],
        secondaryMatchFields: ['tenant_type', 'lease_structure'],
        compMetrics: ['rent_per_sf', 'vacancy', 'noi'],
        compDisplayColumns: ['Property', 'SF', 'Rent/SF', 'Vacancy', 'NOI'],
      };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// MASTER CONFIG BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The complete module configuration for a specific DealType × ProductType combo.
 * This is what the frontend consumes to render every module correctly.
 */
export interface DealProductConfig {
  dealType: DealType;
  productType: ProductType;
  productFamily: ProductFamily;

  /** Unit Mix module config (M03B) */
  unitMix: UnitMixConfig;

  /** M01 Overview hero metrics */
  overview: ModuleProductConfig;

  /** M05 Market analysis config */
  market: ModuleProductConfig;

  /** M09 ProForma template */
  proforma: ProFormaProductConfig;

  /** M08 Strategy availability */
  strategies: StrategyAvailability[];

  /** M14 Risk categories */
  riskCategories: RiskCategory[];

  /** M15 Competition criteria */
  compCriteria: CompCriteria;
}

export function buildDealProductConfig(dealType: DealType, productType: ProductType): DealProductConfig {
  const family = getProductFamily(productType);

  return {
    dealType,
    productType,
    productFamily: family,
    unitMix: getUnitMixConfigForFamily(family, dealType),
    overview: getOverviewMetrics(dealType, productType),
    market: getMarketConfig(productType),
    proforma: getProFormaProductConfig(dealType, productType),
    strategies: getStrategyAvailability(dealType, productType),
    riskCategories: getRiskCategories(dealType, productType),
    compCriteria: getCompCriteria(productType),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/*
  Usage in components:

  import { useDealProductConfig } from './product-type-adaptation';

  function DealDetailPage() {
    const config = useDealProductConfig();

    // config.unitMix.mode === 'designer' | 'analyzer' | 'analyzer_designer' | ...
    // config.unitMix.unitTerm === 'Units' | 'Keys' | 'Bays' | ...
    // config.strategies === [{ strategyId: 'BTS', strength: 'strong', ... }, ...]
    // config.proforma.revenueLineItems === ['Rooms Revenue', 'F&B', ...]
    // config.riskCategories === [{ key: 'market', weight: 0.25, ... }, ...]
  }

  // In the Unit Mix component:
  function UnitMixModule() {
    const { unitMix } = useDealProductConfig();

    if (unitMix.mode === 'hidden') return null;

    return (
      <div>
        <h2>{unitMix.label}</h2>
        {unitMix.mode === 'analyzer' && <ExistingMixAnalyzer config={unitMix} />}
        {unitMix.mode === 'designer' && <MixDesigner config={unitMix} />}
        {unitMix.mode === 'analyzer_designer' && (
          <>
            <ExistingMixAnalyzer config={unitMix} />
            <TargetMixDesigner config={unitMix} />
            <MixComparisonDelta currentConfig={unitMix} />
          </>
        )}
      </div>
    );
  }
*/
