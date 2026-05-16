/**
 * Roadmap Mode — Action Library
 *
 * Static knowledge base of 20 MVP operational actions with impact bands,
 * evidence templates, cost profiles, and dependency graphs.
 *
 * Library calibrates from archive nightly (future: Task #787+).
 * For v1, impact bands are seeded from industry benchmarks.
 */

import type { ActionLibraryEntry } from '../../types/roadmap';

export const ACTION_LIBRARY: ActionLibraryEntry[] = [
  // ── REVENUE LIFT ──────────────────────────────────────────────────────────

  {
    id: 'loss_to_lease_burnoff',
    name: 'Loss-to-Lease Burn-Off Acceleration',
    category: 'revenue',
    description:
      'Aggressively mark leases to market on turnover — each expiring lease renewed at current market rent rather than prior in-place rate. Captures the spread between in-place and market rent as leases roll.',
    applicability: {
      deal_types: ['existing', 'redevelopment', 'value_add'],
      asset_classes: ['multifamily', 'mixed_use'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 2.0,
      p50_pct: 4.5,
      p75_pct: 8.0,
      affected_lines: ['proforma.revenue.gpr', 'proforma.revenue.in_place_rent'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 0,
      typical_operating: 500,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 0,
      typical_duration: 36,
      typical_impact_lag: 1,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'loss_to_lease' IS NOT NULL",
    dependencies: [],
    risks: [
      'Soft leasing market may prevent mark-to-market on renewal',
      'High turnover cost may offset rent lift in Year 1',
    ],
  },

  {
    id: 'rubs_implementation',
    name: 'RUBS Implementation (Utility Billback)',
    category: 'revenue',
    description:
      'Implement Ratio Utility Billing System — allocate master-metered utility costs back to residents. Reduces landlord utility expense and shifts the cost to tenants as an ancillary income stream.',
    applicability: {
      deal_types: ['existing', 'value_add', 'redevelopment'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 1.5,
      p50_pct: 3.0,
      p75_pct: 5.0,
      affected_lines: ['proforma.opex.utilities', 'proforma.revenue.other_income'],
      dollar_basis: 'annual_noi',
    },
    cost_profile: {
      typical_upfront: 15000,
      typical_operating: 2400,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 2,
      typical_duration: 4,
      typical_impact_lag: 6,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'rubs_implemented' = 'true'",
    dependencies: [],
    risks: [
      'Local jurisdiction may restrict or prohibit RUBS',
      'Resident pushback may increase turnover in Year 1',
      'Sub-metered properties cannot implement standard RUBS formula',
    ],
  },

  {
    id: 'interior_renovation_premium',
    name: 'Interior Renovation Premium Capture',
    category: 'revenue',
    description:
      'Renovate unit interiors (flooring, countertops, appliances, fixtures) to command a renovation premium above in-place rents. Typically $100-$250/unit/mo premium over unrenovated comps.',
    applicability: {
      deal_types: ['value_add', 'redevelopment'],
      asset_classes: ['multifamily', 'mixed_use'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 6.0,
      p50_pct: 11.0,
      p75_pct: 18.0,
      affected_lines: ['proforma.revenue.gpr', 'proforma.capex.unit_renovation'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 8000,
      typical_operating: 0,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 3,
      typical_duration: 24,
      typical_impact_lag: 3,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'renovation_premium' IS NOT NULL",
    dependencies: [],
    risks: [
      'Renovation scope creep increases capex beyond budget',
      'Submarket cannot absorb renovation premium if comps are unrenovated',
      'Construction disruption may spike vacancy during reno period',
    ],
  },

  {
    id: 'amenity_reposition_premium',
    name: 'Amenity Reposition Premium Capture',
    category: 'revenue',
    description:
      'Upgrade community amenities (fitness center, co-working, dog park, pool refresh, package locker system) to premium level, enabling $30-$80/unit/mo lift in effective rents versus unrenovated amenity set.',
    applicability: {
      deal_types: ['value_add', 'redevelopment'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense'],
    },
    impact_band: {
      p25_pct: 2.0,
      p50_pct: 4.5,
      p75_pct: 7.5,
      affected_lines: ['proforma.revenue.gpr'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 250000,
      typical_operating: 12000,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 6,
      typical_duration: 12,
      typical_impact_lag: 9,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'amenity_reposition' = 'true'",
    dependencies: [],
    risks: [
      'Premium amenities may not be valued by current tenant base',
      'Construction disruption impacts community satisfaction',
      'Competing properties may upgrade in parallel, reducing relative advantage',
    ],
  },

  {
    id: 'leasing_strategy_change',
    name: 'Leasing Strategy Change (Revenue Management Software)',
    category: 'revenue',
    description:
      'Adopt revenue management software (Yardi Revenue IQ, LRO, Rent Dynamics) to optimize pricing at the unit level based on lease expiration concentration, demand signals, and competitor pricing.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 1.5,
      p50_pct: 3.0,
      p75_pct: 5.5,
      affected_lines: ['proforma.revenue.gpr', 'proforma.revenue.vacancy'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 5000,
      typical_operating: 18000,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 1,
      typical_duration: 3,
      typical_impact_lag: 4,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'revenue_management' = 'true'",
    dependencies: [],
    risks: [
      'Requires leasing team training and buy-in',
      'Software ROI depends on unit count (best above 100 units)',
    ],
  },

  {
    id: 'rent_comp_repositioning',
    name: 'Rent Comp Repositioning (Selective Premium Pricing)',
    category: 'revenue',
    description:
      'Identify highest-demand unit types (top floor, corner units, view units, renovated) and price selectively 5-15% above submarket median — supported by comp analysis showing high-performing peers achieve the premium.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 1.0,
      p50_pct: 2.5,
      p75_pct: 4.5,
      affected_lines: ['proforma.revenue.gpr'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 0,
      typical_operating: 3000,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 0,
      typical_duration: 12,
      typical_impact_lag: 1,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'selective_premium_pricing' IS NOT NULL",
    dependencies: ['leasing_strategy_change'],
    risks: [
      'Premium pricing may extend days-on-market for premium units',
      'Requires strong comp evidence to justify premium to leasing team',
    ],
  },

  // ── EXPENSE REDUCTION ─────────────────────────────────────────────────────

  {
    id: 'property_tax_appeal',
    name: 'Property Tax Assessment Appeal',
    category: 'expense',
    description:
      'File a formal appeal with the county assessor to reduce the assessed value of the property below the acquisition price. Particularly effective when purchase price is below recent comparable assessments, or when the property has deferred maintenance.',
    applicability: {
      deal_types: ['existing', 'value_add', 'redevelopment'],
      asset_classes: ['multifamily', 'office', 'retail', 'industrial', 'mixed_use'],
      requires_posture: ['offense', 'neutral', 'defense'],
    },
    impact_band: {
      p25_pct: 3.0,
      p50_pct: 8.0,
      p75_pct: 15.0,
      affected_lines: ['proforma.opex.property_tax'],
      dollar_basis: 'annual_opex',
    },
    cost_profile: {
      typical_upfront: 5000,
      typical_operating: 0,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 0,
      typical_duration: 12,
      typical_impact_lag: 12,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'tax_appeal_filed' = 'true'",
    dependencies: [],
    risks: [
      'Assessment outcomes are uncertain — appeal may be denied or produce minimal reduction',
      'Some jurisdictions reassess at purchase price automatically',
      'County may counter-appeal and increase assessment',
    ],
  },

  {
    id: 'insurance_reshop',
    name: 'Insurance Reshop (Multi-Property Pooling)',
    category: 'expense',
    description:
      'Competitively bid property insurance at renewal across 3+ carriers. If sponsor has portfolio, pool coverage to achieve scale pricing. Particularly effective following significant market hardening where incumbent carrier has not re-priced competitively.',
    applicability: {
      deal_types: ['existing', 'value_add', 'redevelopment'],
      asset_classes: ['multifamily', 'retail', 'office', 'industrial', 'mixed_use'],
      requires_posture: ['offense', 'neutral', 'defense'],
    },
    impact_band: {
      p25_pct: 3.0,
      p50_pct: 7.0,
      p75_pct: 12.0,
      affected_lines: ['proforma.opex.insurance'],
      dollar_basis: 'annual_opex',
    },
    cost_profile: {
      typical_upfront: 2500,
      typical_operating: 0,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 0,
      typical_duration: 3,
      typical_impact_lag: 3,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'insurance_reshop' = 'true'",
    dependencies: [],
    risks: [
      'Coastal/hurricane-risk markets have limited carrier options',
      'Coverage gaps may emerge when switching carriers',
      'Hard insurance markets limit savings opportunity',
    ],
  },

  {
    id: 'vendor_contract_rebid',
    name: 'Vendor Contract Rebid (R&M, Landscaping, Cleaning)',
    category: 'expense',
    description:
      'Competitively bid all major service contracts — landscaping, janitorial, pest control, elevator maintenance, HVAC preventive maintenance — against 2+ alternatives. Incumbent vendors frequently price in 10-20% premium over market after 3+ years.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily', 'retail', 'office', 'industrial', 'mixed_use'],
      requires_posture: ['offense', 'neutral', 'defense'],
    },
    impact_band: {
      p25_pct: 4.0,
      p50_pct: 8.0,
      p75_pct: 14.0,
      affected_lines: ['proforma.opex.repairs_maintenance', 'proforma.opex.contract_services'],
      dollar_basis: 'annual_opex',
    },
    cost_profile: {
      typical_upfront: 1000,
      typical_operating: 0,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 1,
      typical_duration: 3,
      typical_impact_lag: 3,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'vendor_rebid' IS NOT NULL",
    dependencies: [],
    risks: [
      'Switching vendors may have transition period quality issues',
      'Low-bid vendors may provide inferior service, increasing deferred maintenance',
    ],
  },

  {
    id: 'management_transition',
    name: 'Management Transition (In-House from Third-Party)',
    category: 'expense',
    description:
      'Bring property management in-house from a third-party manager, eliminating management fee (typically 5-8% of EGR) and gaining direct operational control. Requires PM infrastructure — staffing, systems, and process.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 3.0,
      p50_pct: 5.5,
      p75_pct: 8.0,
      affected_lines: ['proforma.opex.management_fee', 'proforma.opex.payroll'],
      dollar_basis: 'annual_noi',
    },
    cost_profile: {
      typical_upfront: 35000,
      typical_operating: 0,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 2,
      typical_duration: 6,
      typical_impact_lag: 8,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'in_house_pm' = 'true'",
    dependencies: [],
    risks: [
      'Requires sponsor to have or hire experienced PM staff',
      'Transition period frequently has leasing/maintenance disruption',
      'Not cost-effective below ~80 units without scale',
    ],
  },

  {
    id: 'energy_efficiency_capex',
    name: 'Energy Efficiency Capex (LED, Water Savers, Smart Thermostats)',
    category: 'expense',
    description:
      'Install LED lighting throughout common areas and units, low-flow water fixtures, and smart thermostats in vacant units during turnover. Reduces landlord utility spend and supports RUBS implementation.',
    applicability: {
      deal_types: ['existing', 'value_add', 'redevelopment'],
      asset_classes: ['multifamily', 'office', 'retail'],
      requires_posture: ['offense', 'neutral', 'defense'],
    },
    impact_band: {
      p25_pct: 5.0,
      p50_pct: 12.0,
      p75_pct: 20.0,
      affected_lines: ['proforma.opex.utilities'],
      dollar_basis: 'annual_opex',
    },
    cost_profile: {
      typical_upfront: 1200,
      typical_operating: 0,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 1,
      typical_duration: 6,
      typical_impact_lag: 6,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'energy_efficiency' IS NOT NULL",
    dependencies: [],
    risks: [
      'Utility savings vary significantly by climate and baseline usage',
      'Utility company rebates may offset capex but require application process',
    ],
  },

  {
    id: 'payroll_restructuring',
    name: 'Payroll Restructuring (Centralized Leasing, Regional Service)',
    category: 'expense',
    description:
      'Centralize leasing across multiple properties in the same submarket with one shared leasing team; create regional maintenance staff shared across assets. Reduces per-property payroll cost by 15-35%.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 8.0,
      p50_pct: 18.0,
      p75_pct: 30.0,
      affected_lines: ['proforma.opex.payroll'],
      dollar_basis: 'annual_opex',
    },
    cost_profile: {
      typical_upfront: 10000,
      typical_operating: 0,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 3,
      typical_duration: 6,
      typical_impact_lag: 6,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'centralized_leasing' = 'true'",
    dependencies: ['management_transition'],
    risks: [
      'Requires portfolio scale — single-asset sponsors cannot centralize',
      'Service response times may suffer with regional maintenance model',
    ],
  },

  // ── OTHER INCOME LIFT ─────────────────────────────────────────────────────

  {
    id: 'pet_rent_implementation',
    name: 'Pet Rent and Pet Deposit Implementation',
    category: 'other_income',
    description:
      'Implement or increase pet rent ($35-$75/pet/mo) and non-refundable pet fees ($200-$500) for new leases and renewals. In markets where 60-70% of renters have pets, this is a material uncaptured income stream.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral', 'defense'],
    },
    impact_band: {
      p25_pct: 1.0,
      p50_pct: 2.5,
      p75_pct: 4.5,
      affected_lines: ['proforma.revenue.other_income'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 500,
      typical_operating: 1000,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 0,
      typical_duration: 2,
      typical_impact_lag: 1,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'pet_rent' IS NOT NULL",
    dependencies: [],
    risks: [
      'Pet penetration rate varies by submarket demographics',
      'Increased damage risk requires higher security deposits',
    ],
  },

  {
    id: 'parking_fee_restructure',
    name: 'Parking Fee Implementation or Restructure',
    category: 'other_income',
    description:
      'Implement monthly parking fees where currently included in base rent, or restructure existing fees to market rate. Covered/garage parking at $50-$150/space/mo; uncovered at $25-$75/space/mo in urban/suburban markets.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily', 'mixed_use'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 1.5,
      p50_pct: 3.5,
      p75_pct: 6.0,
      affected_lines: ['proforma.revenue.other_income'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 2000,
      typical_operating: 500,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 1,
      typical_duration: 3,
      typical_impact_lag: 3,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'parking_fees' IS NOT NULL",
    dependencies: [],
    risks: [
      'Residents may resist new charges not in original lease',
      'Market demand for parking varies by transit access and unit density',
    ],
  },

  {
    id: 'storage_locker_fee',
    name: 'Storage/Locker Fee Implementation',
    category: 'other_income',
    description:
      'Convert unused utility rooms, underused common storage, or garage space into rentable storage units ($30-$80/locker/mo). High-demand in urban markets where units lack storage.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 0.5,
      p50_pct: 1.5,
      p75_pct: 3.0,
      affected_lines: ['proforma.revenue.other_income'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 8000,
      typical_operating: 200,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 2,
      typical_duration: 4,
      typical_impact_lag: 4,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'storage_fees' IS NOT NULL",
    dependencies: [],
    risks: [
      'Physical space may not support storage conversion',
      'Requires insurance endorsement for tenant property',
    ],
  },

  {
    id: 'trash_valet_service',
    name: 'Trash Valet Service Implementation',
    category: 'other_income',
    description:
      'Contract with a trash valet provider (Doorstep Details, Valet Living) to offer door-to-door trash pickup for $20-$35/unit/mo — typically splitting 50/50 between vendor and landlord. Convenience amenity that residents value highly.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 0.8,
      p50_pct: 1.8,
      p75_pct: 3.0,
      affected_lines: ['proforma.revenue.other_income'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 1000,
      typical_operating: 1200,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 1,
      typical_duration: 2,
      typical_impact_lag: 2,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'trash_valet' = 'true'",
    dependencies: [],
    risks: ['Low adoption in suburban markets where residents prefer self-service'],
  },

  {
    id: 'smart_home_tech_fee',
    name: 'Smart Home / Tech Fee Implementation',
    category: 'other_income',
    description:
      'Install smart locks, thermostats, and leak sensors; bundle as a "smart home package" fee of $25-$50/unit/mo. Doubles as operational efficiency (remote access for maintenance, real-time leak detection).',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 0.8,
      p50_pct: 2.0,
      p75_pct: 3.5,
      affected_lines: ['proforma.revenue.other_income'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 300,
      typical_operating: 60,
      sensitivity_to_property_size: 'per_unit',
    },
    duration: {
      typical_start_lag: 2,
      typical_duration: 6,
      typical_impact_lag: 6,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'smart_home' IS NOT NULL",
    dependencies: [],
    risks: [
      'Technology adoption varies by resident demographic',
      'Hardware maintenance cost may offset income gains',
    ],
  },

  {
    id: 'common_area_amenity_fees',
    name: 'Common Area Amenity Fees (Pool Cabanas, etc.)',
    category: 'other_income',
    description:
      'Charge reservation fees for premium amenity spaces: pool cabanas ($25-$75/reservation), private event room bookings ($75-$200/event), rooftop access. Low implementation cost, high resident satisfaction.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 0.3,
      p50_pct: 0.8,
      p75_pct: 1.5,
      affected_lines: ['proforma.revenue.other_income'],
      dollar_basis: 'annual_revenue',
    },
    cost_profile: {
      typical_upfront: 3000,
      typical_operating: 500,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 1,
      typical_duration: 2,
      typical_impact_lag: 2,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'amenity_fees' IS NOT NULL",
    dependencies: [],
    risks: ['Limited impact — works best as complement to larger income actions'],
  },

  // ── DEBT OPTIMIZATION ─────────────────────────────────────────────────────

  {
    id: 'supplemental_financing_refi',
    name: 'Supplemental Financing or Refinance to Lower Rate',
    category: 'debt',
    description:
      'Once stabilized NOI supports higher debt load or market rates have dropped, place supplemental financing or refinance into lower-rate permanent debt. Reduces blended cost of capital and often returns equity for next acquisition.',
    applicability: {
      deal_types: ['existing', 'value_add'],
      asset_classes: ['multifamily', 'office', 'retail', 'industrial', 'mixed_use'],
      requires_posture: ['offense', 'neutral'],
    },
    impact_band: {
      p25_pct: 5.0,
      p50_pct: 12.0,
      p75_pct: 22.0,
      affected_lines: ['proforma.debt.annual_debt_service'],
      dollar_basis: 'annual_noi',
    },
    cost_profile: {
      typical_upfront: 20000,
      typical_operating: 0,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 24,
      typical_duration: 6,
      typical_impact_lag: 6,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'refi_event' IS NOT NULL",
    dependencies: ['interior_renovation_premium', 'loss_to_lease_burnoff'],
    risks: [
      'Rate environment may not improve — refi may be at higher rate',
      'Prepayment penalties on existing debt may make refi uneconomic',
      'Requires stabilized NOI — not available until value-add complete',
    ],
  },

  {
    id: 'mezzanine_paydown',
    name: 'Mezzanine Paydown to Reduce Blended Cost',
    category: 'debt',
    description:
      'Use operating cash flow or supplemental proceeds to pay down higher-cost mezzanine debt ahead of schedule. Each dollar of mezz paid down reduces the high-cost capital in the stack, improving blended cost of capital.',
    applicability: {
      deal_types: ['existing', 'value_add', 'redevelopment'],
      asset_classes: ['multifamily', 'office', 'retail', 'industrial', 'mixed_use'],
      requires_posture: ['offense', 'neutral', 'defense'],
    },
    impact_band: {
      p25_pct: 3.0,
      p50_pct: 8.0,
      p75_pct: 15.0,
      affected_lines: ['proforma.debt.annual_debt_service'],
      dollar_basis: 'annual_noi',
    },
    cost_profile: {
      typical_upfront: 0,
      typical_operating: 0,
      sensitivity_to_property_size: 'fixed',
    },
    duration: {
      typical_start_lag: 12,
      typical_duration: 12,
      typical_impact_lag: 12,
    },
    evidence_query:
      "SELECT * FROM deal_underwriting_snapshots WHERE proforma_json->>'mezz_paydown' IS NOT NULL",
    dependencies: [],
    risks: [
      'Prepayment restrictions may apply to mezz tranche',
      'Cash deployed to paydown is unavailable for capex actions',
    ],
  },
];

/**
 * Look up an action by its library ID.
 */
export function getActionById(id: string): ActionLibraryEntry | undefined {
  return ACTION_LIBRARY.find(a => a.id === id);
}

/**
 * Filter actions eligible for a given deal type, excluding sponsor-excluded IDs.
 */
export function getEligibleActions(
  dealType: string,
  excludedIds: string[] = [],
  mustIncludeIds: string[] = []
): ActionLibraryEntry[] {
  const normalizedType = dealType.toLowerCase().replace('-', '_');
  const eligible = ACTION_LIBRARY.filter(a => {
    if (excludedIds.includes(a.id)) return false;
    if (!a.applicability.deal_types.includes(normalizedType)) {
      // Also allow if deal_type is broadly 'existing' or if the library entry covers 'existing'
      if (!a.applicability.deal_types.includes('existing')) return false;
    }
    return true;
  });
  // Must-include actions are always added even if filtered out
  const mustInclude = ACTION_LIBRARY.filter(
    a => mustIncludeIds.includes(a.id) && !eligible.find(e => e.id === a.id)
  );
  return [...eligible, ...mustInclude];
}
