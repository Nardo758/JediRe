// ============================================================================
// LEASING FIELDS CONFIG — Single source of truth for the Leasing Assumptions tab
// ============================================================================
//
// EDITABILITY-IS-INTENTIONAL RULE:
//   A field becomes editable only when it appears here. Adding a field here is a
//   deliberate decision committing to: validation rules, default sources, tooltip
//   content, and tier classification. Bypassing this config to make a field
//   editable directly in a component is forbidden.
//
// TIER-DEFAULTS-PROTECT-USERS RULE:
//   Beginner tier is the cognitive-load budget for the average sponsor underwriter.
//   Beginner fields must number ≤ 12 across all categories combined.
//
// General / Leasing boundary rule:
//   "Does this assumption affect leasing velocity, occupancy, or rent capture?"
//   YES → Leasing tab. NO → General tab.
//   Bad debt is Leasing (revenue-side, M22 pipeline same as renewal rate).
//
// Category J = Renovation Assumptions (VALUE_ADD / REDEVELOPMENT mode only).
//   Mode Override control lives in Deal Settings per spec §6.5 — not here.
// ============================================================================

export type FieldTier = 'beginner' | 'advanced' | 'expert';
export type FieldType = 'percent' | 'currency' | 'integer' | 'days' | 'months' | 'month' | 'enum' | 'array' | 'schedule';
export type LeaseMode =
  | 'LEASE_UP_NEW_CONSTRUCTION'
  | 'STABILIZED_MAINTENANCE'
  | 'OCCUPANCY_RECOVERY'
  | 'VALUE_ADD'
  | 'REDEVELOPMENT';

export interface LeasingFieldDef {
  id: string;
  label: string;
  path: string;
  type: FieldType;
  tier: FieldTier;
  /** Which modes surface this field. 'all' = every mode. */
  modes: LeaseMode[] | 'all';
  /** Read-only computed field — no edit affordance */
  readonly?: boolean;
  /** Platform default value (for display when no override exists) */
  platformDefault?: number | string | null;
  /** Validation bounds (in native units — percent fields use 0–1) */
  min?: number;
  max?: number;
  /** Enum values if type === 'enum' */
  enumValues?: string[];
  tooltip: string;
  /** Default source description */
  defaultSource: string;
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
}

export interface LeasingCategoryDef {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  label: string;
  /** Modes where this entire category is visible ('all' = always visible) */
  visibleIn: LeaseMode[] | 'all';
  fields: LeasingFieldDef[];
}

// ── Category A — Occupancy Targets ───────────────────────────────────────────
const CAT_A: LeasingCategoryDef = {
  id: 'A',
  label: 'Occupancy Targets',
  visibleIn: 'all',
  fields: [
    {
      id: 'a_stabilized_occ',
      label: 'Target stabilized occupancy',
      path: 'traffic.stabilization.ceiling_occupancy',
      type: 'percent',
      tier: 'beginner',
      modes: 'all',
      platformDefault: 0.95,
      min: 0.80, max: 1.00,
      tooltip: 'Long-run occupancy the model stabilizes to. Drives the vacancy ramp in all projection years once lease-up or recovery is complete.',
      defaultSource: 'Platform 95%',
      category: 'A',
    },
    {
      id: 'a_stab_definition',
      label: 'Stabilization definition',
      path: 'traffic.stabilization.definition',
      type: 'enum',
      tier: 'beginner',
      modes: 'all',
      platformDefault: 'PHYSICAL_95',
      enumValues: ['PHYSICAL_95', 'ECONOMIC_95', 'AGENCY_90_30_60_90'],
      tooltip: 'How stabilization is measured. PHYSICAL_95 = 95% physical occupancy. ECONOMIC_95 = 95% economic occupancy after concessions. AGENCY_90_30_60_90 = agency lender definition.',
      defaultSource: 'Platform PHYSICAL_95',
      category: 'A',
    },
    {
      id: 'a_current_occ',
      label: 'Current occupancy (override)',
      path: 'traffic.subject_history.current_state.occupancy_pct',
      type: 'percent',
      tier: 'beginner',
      modes: ['OCCUPANCY_RECOVERY', 'STABILIZED_MAINTENANCE'],
      platformDefault: null,
      min: 0.00, max: 1.00,
      tooltip: 'Override the rent-roll occupancy reading. Use when the uploaded rent roll is stale or the deal is mid-lease-up.',
      defaultSource: 'From rent roll',
      category: 'A',
    },
    {
      id: 'a_target_basis',
      label: 'Target: paid vs signed',
      path: 'lease_velocity.target_basis',
      type: 'enum',
      tier: 'advanced',
      modes: 'all',
      platformDefault: 'SIGNED',
      enumValues: ['SIGNED', 'PAID'],
      tooltip: 'Whether occupancy targets count signed leases or paid/moved-in leases. SIGNED is the standard for underwriting; PAID is more conservative.',
      defaultSource: 'Platform SIGNED',
      category: 'A',
    },
  ],
};

// ── Category B — Renewal & Turnover Behavior ──────────────────────────────────
// Hidden only for LEASE_UP_NEW_CONSTRUCTION (no renewal cohort yet during initial ramp).
// Visible for all other modes, including VALUE_ADD and REDEVELOPMENT where renovated
// units still roll leases and require renewal/turnover assumptions post-renovation.
const CAT_B: LeasingCategoryDef = {
  id: 'B',
  label: 'Renewal & Turnover',
  visibleIn: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT'],
  fields: [
    {
      id: 'b_renewal_rate',
      label: 'Renewal rate',
      path: 'traffic.renewal_rate',
      type: 'percent',
      tier: 'beginner',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 0.55,
      min: 0.20, max: 0.85,
      tooltip: 'Fraction of lease expirations that renew at the property. Drives Year 2+ vacancy and concession costs.',
      defaultSource: 'Subject S2+ → peer set → platform 55%',
      category: 'B',
    },
    {
      id: 'b_turnover_rate',
      label: 'Turnover rate',
      path: 'traffic.turnover_rate',
      type: 'percent',
      tier: 'beginner',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT'],
      readonly: true,
      tooltip: 'Computed as 1 − renewal rate. Read-only to prevent drift from the renewal rate definition.',
      defaultSource: 'Computed: 1 − renewal rate',
      category: 'B',
    },
    {
      id: 'b_days_vacant',
      label: 'Days vacant (median)',
      path: 'traffic.days_vacant_median',
      type: 'days',
      tier: 'beginner',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 21,
      min: 0, max: 90,
      tooltip: 'Average days between move-out and new lease move-in. Drives the days-vacant correction in occupancy targeting.',
      defaultSource: 'Subject S2+ → peer set → platform 21 days',
      category: 'B',
    },
    {
      id: 'b_avg_lease_term',
      label: 'Average lease term (months)',
      path: 'traffic.avg_lease_term_months',
      type: 'months',
      tier: 'advanced',
      modes: 'all',
      platformDefault: 12,
      min: 3, max: 24,
      tooltip: 'Weighted average lease term across the unit mix. Drives concession amortization and LTL decay rate.',
      defaultSource: 'Subject S1+ → peer set → platform 12 months',
      category: 'B',
    },
    {
      id: 'b_rent_step_renewal',
      label: 'Rent step on renewal',
      path: 'traffic.rent_step_renewal_pct',
      type: 'percent',
      tier: 'advanced',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 0.03,
      min: -0.05, max: 0.10,
      tooltip: 'Rent change (%) when an existing tenant renews. Positive = renewal at higher rent. Negative = concession to retain tenant.',
      defaultSource: 'Subject trade-out renewal → peer → platform 3%',
      category: 'B',
    },
    {
      id: 'b_trade_out_new',
      label: 'Trade-out new (vs prior tenant)',
      path: 'traffic.trade_out_new',
      type: 'percent',
      tier: 'advanced',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 0.045,
      min: -0.10, max: 0.20,
      tooltip: 'Rent change (%) on new leases compared to the prior tenant\'s rent. Drives effective rent ramp vs in-place rent.',
      defaultSource: 'Subject S2+ → peer → platform 4.5%',
      category: 'B',
    },
  ],
};

// ── Category C — Rent Growth & Loss-to-Lease ─────────────────────────────────
const CAT_C: LeasingCategoryDef = {
  id: 'C',
  label: 'Rent Growth & Loss-to-Lease',
  visibleIn: 'all',
  fields: [
    {
      id: 'c_rent_growth',
      label: 'Blended rent growth',
      path: 'traffic.coefficients.blended_rent_growth',
      type: 'percent',
      tier: 'beginner',
      modes: 'all',
      platformDefault: 0.030,
      min: -0.05, max: 0.10,
      tooltip: 'Year-over-year rent growth applied to all unit types. Platform calibrates from subject S2+ rent history → submarket peer set → MSA trend.',
      defaultSource: 'Subject S2+ → peer set → platform 3.0%',
      category: 'C',
    },
    {
      id: 'c_loss_to_lease',
      label: 'Loss-to-lease % (Y1)',
      path: 'traffic.loss_to_lease_pct',
      type: 'percent',
      tier: 'beginner',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'],
      platformDefault: 0,
      min: 0, max: 0.20,
      tooltip: 'Gap between market rent and average in-place rent, expressed as % of market rent. Positive = in-place rents below market (value to capture on renewal).',
      defaultSource: 'Subject S1+ → peer → platform 0%',
      category: 'C',
    },
    {
      id: 'c_ltl_decay',
      label: 'LTL decay rate',
      path: 'proforma.ltl_decay_rate',
      type: 'percent',
      tier: 'advanced',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'],
      platformDefault: null,
      min: 0, max: 1.00,
      tooltip: 'Annual rate at which loss-to-lease burns off as in-place leases roll to market. Platform default = 1 / avg_lease_term_months × 12.',
      defaultSource: 'Platform: 1 / avg_lease_term × 12',
      category: 'C',
    },
    {
      id: 'c_affordable_growth',
      label: 'Affordable unit rent growth (HUD/LIHTC)',
      path: 'proforma.affordable_rent_growth',
      type: 'percent',
      tier: 'expert',
      modes: 'all',
      platformDefault: 0.02,
      min: 0, max: 0.05,
      tooltip: 'Rent growth rate for income-restricted units. Separate from blended market-rate growth because affordable rents follow HUD adjustment schedules.',
      defaultSource: 'Platform 2%',
      category: 'C',
    },
  ],
};

// ── Category D — Concessions ──────────────────────────────────────────────────
const CAT_D: LeasingCategoryDef = {
  id: 'D',
  label: 'Concessions',
  visibleIn: 'all',
  fields: [
    {
      id: 'd_concession_strategy',
      label: 'Concession strategy',
      path: 'lease_velocity.inputs.concession_strategy',
      type: 'enum',
      tier: 'beginner',
      modes: 'all',
      enumValues: ['CONSERVATIVE', 'MARKET', 'AGGRESSIVE'],
      tooltip: 'Overall concession posture. CONSERVATIVE = below-market concessions. MARKET = peer-set average. AGGRESSIVE = above-market to accelerate velocity.',
      defaultSource: 'Mode-aware: MARKET for stabilized, AGGRESSIVE for recovery',
      category: 'D',
    },
    {
      id: 'd_new_lease_onetime',
      label: 'New lease — one-time concession ($/unit)',
      path: 'traffic.concession_environment.new_lease_onetime_per_unit',
      type: 'currency',
      tier: 'beginner',
      modes: 'all',
      min: 0,
      tooltip: 'One-time upfront concession per new lease (e.g. 1 month free). Flows through the concession line in the P&L.',
      defaultSource: 'Concession engine output',
      category: 'D',
    },
    {
      id: 'd_renewal_onetime',
      label: 'Renewal — one-time concession ($/unit)',
      path: 'traffic.concession_environment.renewal_onetime_per_unit',
      type: 'currency',
      tier: 'beginner',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'],
      min: 0,
      tooltip: 'One-time concession offered to retain renewing tenants. Typically smaller than new-lease concessions.',
      defaultSource: 'Concession engine output',
      category: 'D',
    },
    {
      id: 'd_new_ongoing',
      label: 'New lease — monthly abatement ($/unit/mo)',
      path: 'traffic.concession_environment.new_lease_ongoing_monthly',
      type: 'currency',
      tier: 'advanced',
      modes: ['LEASE_UP_NEW_CONSTRUCTION', 'OCCUPANCY_RECOVERY'],
      min: 0,
      tooltip: 'Recurring monthly rent abatement on new leases. Common in aggressive lease-up or recovery campaigns.',
      defaultSource: 'Concession engine output (0 for stabilized)',
      category: 'D',
    },
    {
      id: 'd_renewal_ongoing',
      label: 'Renewal — monthly abatement ($/unit/mo)',
      path: 'traffic.concession_environment.renewal_ongoing_monthly',
      type: 'currency',
      tier: 'advanced',
      modes: ['OCCUPANCY_RECOVERY'],
      min: 0,
      tooltip: 'Recurring monthly abatement offered to retain renewing tenants during recovery.',
      defaultSource: 'Concession engine output (0 for stabilized/lease-up)',
      category: 'D',
    },
    {
      id: 'd_pct_new_receiving',
      label: '% of new leases with concession',
      path: 'traffic.concession_environment.pct_of_new_leases_receiving',
      type: 'percent',
      tier: 'advanced',
      modes: 'all',
      min: 0, max: 1.00,
      tooltip: 'Fraction of new leases that actually receive a concession. 100% in lease-up. ~40% in stable market. ~70% in recovery.',
      defaultSource: 'Mode-aware: LEASE_UP 100%, STAB 40%, REC 70%',
      category: 'D',
    },
    {
      id: 'd_pct_renewals_receiving',
      label: '% of renewals with concession',
      path: 'traffic.concession_environment.pct_of_renewals_receiving',
      type: 'percent',
      tier: 'advanced',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'],
      min: 0, max: 1.00,
      tooltip: 'Fraction of renewals receiving a concession. 10% in stabilized (competitive retention). 30% in recovery.',
      defaultSource: 'Platform 10% stabilized, 30% recovery',
      category: 'D',
    },
    {
      id: 'd_amortization_method',
      label: 'Concession amortization method',
      path: 'lease_velocity.inputs.concession_amortization_method',
      type: 'enum',
      tier: 'advanced',
      modes: 'all',
      enumValues: ['STRAIGHT_LINE', 'FRONT_LOADED', 'BACK_LOADED'],
      platformDefault: 'STRAIGHT_LINE',
      tooltip: 'How free-rent / abatement concessions are amortized over the lease term for NOI purposes. ' +
        'STRAIGHT_LINE: equal monthly credit. FRONT_LOADED: credit taken in first months (accelerates NOI recovery). ' +
        'BACK_LOADED: credit deferred to final months (conservative).',
      defaultSource: 'Platform STRAIGHT_LINE',
      category: 'D',
    },
  ],
};

// ── Category E — Lease-Up Strategy (LEASE_UP mode only) ──────────────────────
const CAT_E: LeasingCategoryDef = {
  id: 'E',
  label: 'Lease-Up Strategy',
  visibleIn: ['LEASE_UP_NEW_CONSTRUCTION'],
  fields: [
    {
      id: 'e_pre_leased',
      label: 'Pre-leased count (units)',
      path: 'lease_velocity.inputs.pre_leased_count',
      type: 'integer',
      tier: 'beginner',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      platformDefault: 0,
      min: 0,
      tooltip: 'Number of units under signed lease at delivery. Reduces absorbed units needed from zero on day one.',
      defaultSource: 'Platform 0 (no pre-leasing assumed)',
      category: 'E',
    },
    {
      id: 'e_delivery_month',
      label: 'Delivery month',
      path: 'lease_velocity.inputs.delivery_month',
      type: 'month',
      tier: 'beginner',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      tooltip: 'Month and year of certificate of occupancy / first move-in. Seeds the lease-up ramp start date.',
      defaultSource: 'From M22 capex schedule',
      category: 'E',
    },
    {
      id: 'e_marketing_intensity',
      label: 'Marketing intensity',
      path: 'lease_velocity.inputs.marketing_intensity',
      type: 'enum',
      tier: 'beginner',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      enumValues: ['LOW', 'MARKET', 'AGGRESSIVE'],
      tooltip: 'Overall marketing spend posture during lease-up. AGGRESSIVE unlocks higher velocity at higher cost.',
      defaultSource: 'Platform MARKET',
      category: 'E',
    },
    {
      id: 'e_pre_lease_window',
      label: 'Pre-lease window (months)',
      path: 'lease_velocity.inputs.pre_lease_window_months',
      type: 'months',
      tier: 'advanced',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      platformDefault: 6,
      min: 3, max: 12,
      tooltip: 'Number of months before delivery when pre-leasing begins. Must align with construction schedule.',
      defaultSource: 'Platform 6 months',
      category: 'E',
    },
    {
      id: 'e_move_in_lag',
      label: 'Sign-to-move-in lag (median days)',
      path: 'traffic.move_in_lag.median_lag_days',
      type: 'days',
      tier: 'advanced',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      platformDefault: 21,
      min: 0, max: 60,
      tooltip: 'Median days between lease signing and move-in. Affects when signed leases translate to economic occupancy.',
      defaultSource: 'Subject → peer → platform 21 days',
      category: 'E',
    },
    {
      id: 'e_stab_target_override',
      label: 'Stabilization target month override',
      path: 'lease_velocity.inputs.stabilization_target_month_override',
      type: 'integer',
      tier: 'expert',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      min: 6, max: 36,
      tooltip: 'Override the engine-detected stabilization month. Use when you have a contractual obligation that differs from the engine\'s estimate.',
      defaultSource: 'Engine-detected (no override)',
      category: 'E',
    },
    {
      id: 'e_absorption_type',
      label: 'Absorption curve type',
      path: 'lease_velocity.inputs.absorption_type',
      type: 'enum',
      tier: 'advanced',
      modes: ['LEASE_UP_NEW_CONSTRUCTION'],
      enumValues: ['LINEAR', 'FRONT_LOADED', 'S_CURVE'],
      platformDefault: 'LINEAR',
      tooltip: 'Shape of the monthly leasing absorption ramp from delivery to stabilization. ' +
        'LINEAR: equal velocity each month. FRONT_LOADED: 60/30/10 weight toward early months ' +
        '(aggressive opening). S_CURVE: sigmoid ramp — slow start, peak velocity mid-lease-up, ' +
        'tapering to stabilization. S-curve reflects typical new-construction market dynamics.',
      defaultSource: 'Platform LINEAR',
      category: 'E',
    },
  ],
};

// ── Category F — Recovery Strategy (RECOVERY mode only) ──────────────────────
const CAT_F: LeasingCategoryDef = {
  id: 'F',
  label: 'Recovery Strategy',
  visibleIn: ['OCCUPANCY_RECOVERY'],
  fields: [
    {
      id: 'f_catchup_period',
      label: 'Catch-up period (months)',
      path: 'lease_velocity.inputs.catch_up_period_months',
      type: 'months',
      tier: 'beginner',
      modes: ['OCCUPANCY_RECOVERY'],
      platformDefault: 12,
      min: 3, max: 36,
      tooltip: 'Target months to recover from current occupancy to stabilized target. Shorter = more aggressive spend.',
      defaultSource: 'Platform 12 months',
      category: 'F',
    },
    {
      id: 'f_locator_usage',
      label: 'Locator / broker usage %',
      path: 'lease_velocity.inputs.locator_usage_pct',
      type: 'percent',
      tier: 'advanced',
      modes: ['OCCUPANCY_RECOVERY'],
      platformDefault: 0.30,
      min: 0, max: 1.00,
      tooltip: 'Fraction of new leases sourced through apartment locators or brokers during recovery. Higher = faster absorption but higher cost.',
      defaultSource: 'Platform 30%',
      category: 'F',
    },
  ],
};

// ── Category G — Marketing & Leasing Cost ────────────────────────────────────
const CAT_G: LeasingCategoryDef = {
  id: 'G',
  label: 'Marketing & Leasing Cost',
  visibleIn: 'all',
  fields: [
    {
      id: 'g_marketing_per_lease',
      label: 'Marketing cost per lease ($)',
      path: 'lease_velocity.cost_stack.marketing_per_lease',
      type: 'currency',
      tier: 'advanced',
      modes: 'all',
      min: 0, max: 5000,
      tooltip: 'Variable marketing cost per signed lease. Mode-aware default: $1,800 lease-up / $400 stabilized / $1,000 recovery.',
      defaultSource: 'Mode-aware: $1,800 LEASE_UP / $400 STAB / $1,000 REC',
      category: 'G',
    },
    {
      id: 'g_marketing_base',
      label: 'Marketing base cost ($/month)',
      path: 'lease_velocity.cost_stack.marketing_base_monthly',
      type: 'currency',
      tier: 'advanced',
      modes: 'all',
      min: 0, max: 50000,
      tooltip: 'Fixed monthly marketing spend regardless of leasing volume. Mode-aware default: $8,000 lease-up / $2,000 stabilized / $4,000 recovery.',
      defaultSource: 'Mode-aware: $8K LEASE_UP / $2K STAB / $4K REC',
      category: 'G',
    },
    {
      id: 'g_locator_fee',
      label: 'Locator / broker fee (% of monthly rent)',
      path: 'lease_velocity.cost_stack.locator_fee_pct_of_rent',
      type: 'percent',
      tier: 'advanced',
      modes: 'all',
      platformDefault: 0.50,
      min: 0, max: 1.50,
      tooltip: 'Fee paid to apartment locators or brokers per lease, expressed as fraction of one month\'s rent.',
      defaultSource: 'Platform 0.5 (half month\'s rent)',
      category: 'G',
    },
    {
      id: 'g_locator_pct',
      label: 'Locator usage % of new leases',
      path: 'lease_velocity.cost_stack.locator_usage_pct',
      type: 'percent',
      tier: 'advanced',
      modes: 'all',
      min: 0, max: 1.00,
      tooltip: 'Fraction of new leases sourced through paid locators. Mode-aware: 30% lease-up/recovery, 0% stabilized.',
      defaultSource: 'Mode-aware: 30% LEASE_UP/REC, 0% STAB',
      category: 'G',
    },
    {
      id: 'g_turn_cost',
      label: 'Make-ready / turn cost per unit ($)',
      path: 'lease_velocity.cost_stack.turn_cost_per_unit',
      type: 'currency',
      tier: 'advanced',
      modes: ['STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'],
      min: 0, max: 10000,
      tooltip: 'Cost to prepare a unit for the next tenant after move-out. Platform default is class-aware: $1,500 Class A / $1,000 Class B / $700 Class C.',
      defaultSource: 'Platform class-aware: $1,500A / $1,000B / $700C',
      category: 'G',
    },
  ],
};

// ── Category H — Funnel Conversion ───────────────────────────────────────────
const CAT_H: LeasingCategoryDef = {
  id: 'H',
  label: 'Funnel Conversion',
  visibleIn: 'all',
  fields: [
    {
      id: 'h_prospect_to_tour',
      label: 'Prospect → tour rate',
      path: 'traffic.funnel_conversion.active.prospect_to_tour',
      type: 'percent',
      tier: 'expert',
      modes: 'all',
      min: 0.05, max: 0.50,
      tooltip: 'Fraction of prospects who schedule and complete a tour. Drives implied prospect volume needed to hit leasing velocity.',
      defaultSource: 'Mode-aware platform default',
      category: 'H',
    },
    {
      id: 'h_tour_to_app',
      label: 'Tour → application rate',
      path: 'traffic.funnel_conversion.active.tour_to_application',
      type: 'percent',
      tier: 'expert',
      modes: 'all',
      min: 0.10, max: 0.70,
      tooltip: 'Fraction of tours that result in a submitted application.',
      defaultSource: 'Mode-aware platform default',
      category: 'H',
    },
    {
      id: 'h_app_to_approval',
      label: 'Application → approval rate',
      path: 'traffic.funnel_conversion.active.application_to_approval',
      type: 'percent',
      tier: 'expert',
      modes: 'all',
      min: 0.40, max: 0.95,
      tooltip: 'Fraction of applications that pass screening and receive approval.',
      defaultSource: 'Mode-aware platform default',
      category: 'H',
    },
    {
      id: 'h_approval_to_lease',
      label: 'Approval → signed lease rate',
      path: 'traffic.funnel_conversion.active.approval_to_lease',
      type: 'percent',
      tier: 'expert',
      modes: 'all',
      min: 0.70, max: 0.98,
      tooltip: 'Fraction of approved applicants who actually sign a lease (vs. backing out).',
      defaultSource: 'Mode-aware platform default',
      category: 'H',
    },
    {
      id: 'h_overall_conversion',
      label: 'Overall funnel conversion',
      path: 'traffic.funnel_conversion.active.overall',
      type: 'percent',
      tier: 'advanced',
      modes: 'all',
      readonly: true,
      tooltip: 'Computed product of all four funnel stages. Read-only — edit the individual stage rates above.',
      defaultSource: 'Computed: prospect_to_tour × tour_to_app × app_to_approval × approval_to_lease',
      category: 'H',
    },
  ],
};

// ── Category I — Bad Debt & Other Income ─────────────────────────────────────
const CAT_I: LeasingCategoryDef = {
  id: 'I',
  label: 'Bad Debt & Other Income',
  visibleIn: 'all',
  fields: [
    {
      id: 'i_bad_debt',
      label: 'Bad debt % of GPR',
      path: 'proforma.bad_debt_pct',
      type: 'percent',
      tier: 'advanced',
      modes: 'all',
      platformDefault: 0.01,
      min: 0, max: 0.05,
      tooltip: 'Annual uncollectible rent as % of gross potential rent. Revenue-side loss distinct from vacancy.',
      defaultSource: 'M22 actuals → peer set → platform 1%',
      category: 'I',
    },
    {
      id: 'i_other_income_growth',
      label: 'Other income growth %',
      path: 'proforma.other_income_growth_pct',
      type: 'percent',
      tier: 'advanced',
      modes: 'all',
      min: -0.05, max: 0.10,
      tooltip: 'Year-over-year growth applied to parking, pet fees, laundry, and other ancillary income. Platform default = 50% of blended rent growth.',
      defaultSource: 'Platform: blended_rent_growth × 0.5',
      category: 'I',
    },
  ],
};

// ── Category J — Renovation Assumptions (VALUE_ADD / REDEVELOPMENT only) ──────
// Mode Override control lives in Deal Settings per spec §6.5 — not here.
// These fields gate on VALUE_ADD and REDEVELOPMENT modes which engage when the
// engine detects or the user declares a capex-intensive improvement program.
const CAT_J: LeasingCategoryDef = {
  id: 'J',
  label: 'Renovation Assumptions',
  visibleIn: ['VALUE_ADD', 'REDEVELOPMENT'],
  fields: [
    {
      id: 'j_reno_lift_pct',
      label: 'Rent lift after renovation (%)',
      path: 'reno.assumptions.rent_lift_pct',
      type: 'percent',
      tier: 'beginner',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 0.15,
      min: 0.00, max: 0.60,
      tooltip: 'Expected percentage increase in achievable rent after a full unit renovation. Drives the post-renovation effective rent ramp. Platform default 15% based on peer set for B→B+ repositionings.',
      defaultSource: 'Peer set for asset class & submarket → platform 15%',
      category: 'J',
    },
    {
      id: 'j_after_repair_rent',
      label: 'After-repair rent target ($/unit/mo)',
      path: 'reno.assumptions.after_repair_rent_per_unit',
      type: 'currency',
      tier: 'beginner',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      min: 0, max: 10000,
      tooltip: 'Absolute post-renovation rent target per unit per month. Overrides the percentage-lift model when you have a firm comparable set. Leave blank to use the lift % above.',
      defaultSource: 'User input or peer set comps',
      category: 'J',
    },
    {
      id: 'j_reno_budget_per_unit',
      label: 'Renovation budget per unit ($)',
      path: 'reno.assumptions.budget_per_unit',
      type: 'currency',
      tier: 'beginner',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      min: 0, max: 150000,
      tooltip: 'All-in hard and soft renovation cost per unit (unit interiors only; exclude common areas and exterior). Feeds the capex waterfall and DSCR tests.',
      defaultSource: 'M22 capex schedule → contractor bids → platform estimate',
      category: 'J',
    },
    {
      id: 'j_reno_timeline_months',
      label: 'Renovation timeline (months/unit)',
      path: 'reno.assumptions.timeline_months_per_unit',
      type: 'months',
      tier: 'beginner',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 1,
      min: 0.25, max: 6,
      tooltip: 'Average calendar time to complete one unit renovation from move-out to ready-to-lease. Drives the renovation schedule pacing and resultant vacancy drag.',
      defaultSource: 'Contractor schedule → platform 1 month',
      category: 'J',
    },
    {
      id: 'j_reno_pct_of_units',
      label: 'Fraction of units to renovate (%)',
      path: 'reno.assumptions.pct_of_units_to_renovate',
      type: 'percent',
      tier: 'advanced',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 1.00,
      min: 0.10, max: 1.00,
      tooltip: 'What fraction of the total unit count will receive the full renovation scope. 100% = all units renovated. Partial programs (e.g. 60%) renovate only the lowest-rent units first.',
      defaultSource: 'Platform 100% (full program)',
      category: 'J',
    },
    {
      id: 'j_reno_batches_per_year',
      label: 'Renovation batches per year',
      path: 'reno.assumptions.batches_per_year',
      type: 'integer',
      tier: 'advanced',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 12,
      min: 1, max: 52,
      tooltip: 'How many separate renovation tranches run per year. 12 = monthly batches (rolling). 1 = one annual batch (all units offline at once). Higher = smoother vacancy drag but more GC coordination.',
      defaultSource: 'Platform 12 (monthly batches)',
      category: 'J',
    },
    {
      id: 'j_reno_absorption_lag_days',
      label: 'Post-reno absorption lag (days)',
      path: 'reno.assumptions.absorption_lag_days',
      type: 'days',
      tier: 'expert',
      modes: ['VALUE_ADD', 'REDEVELOPMENT'],
      platformDefault: 21,
      min: 0, max: 90,
      tooltip: 'Median days between renovation completion and a new tenant moving in. Analogous to days_vacant for renovated units. Affects the period of zero-rent hold between renovation finish and re-occupancy.',
      defaultSource: 'Platform 21 days (same as market turn)',
      category: 'J',
    },
  ],
};

// ── Full category list — ordered for display (A → J) ─────────────────────────
export const LEASING_CATEGORIES: LeasingCategoryDef[] = [
  CAT_A, CAT_B, CAT_C, CAT_D, CAT_E, CAT_F, CAT_G, CAT_H, CAT_I, CAT_J,
];

// ── Path → field def lookup (for hydration decode + enum index round-trip) ────
// Used in AssumptionsTab to decode backend numeric enum indices back to strings
// and to identify which userOverride keys belong to leasing fields on hydration.
export const LEASING_FIELDS_BY_PATH: Record<string, LeasingFieldDef> = {};
for (const cat of LEASING_CATEGORIES) {
  for (const f of cat.fields) {
    LEASING_FIELDS_BY_PATH[f.path] = f;
  }
}

// ── Override migration map — Section 5 old paths → new spec paths ─────────────
// Runs once per deal on first load after hydration.
// null = field is now engine-computed; drop any existing override.
// Enum fields: concession_pct_of_rent is decoded → enum string in the migration effect.
export const SECTION5_MIGRATION_MAP: Record<string, string | null> = {
  'traffic.stabilized_occupancy_target':    'traffic.stabilization.ceiling_occupancy',
  'traffic.loss_to_lease_pct':              'traffic.loss_to_lease_pct', // unchanged
  'traffic.t06_velocity_signal':            null, // engine output — drop
  'traffic.derived_vacancy_pct':            null, // computed — drop
  'traffic.weeks_to_95_stabilization':      null, // engine-detected — drop
  'traffic.lease_up_velocity':              'lease_velocity.absorption_capacity.peer_max_monthly_pace',
  'traffic.concession_pct_of_rent':         'lease_velocity.inputs.concession_strategy',
  'traffic.t01_walk_ins_per_week':          'traffic.funnel_conversion.active.prospect_volume_per_week',
  'traffic.t05_trade_area_capture_pct':     'traffic.funnel_conversion.active.prospect_to_tour',
};

// ── Mode → visible categories helper ─────────────────────────────────────────
export function getVisibleCategories(mode: LeaseMode | null): ('A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J')[] {
  const base: ('A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J')[] = ['A','C','D','G','H','I'];
  if (mode === 'LEASE_UP_NEW_CONSTRUCTION') return [...base, 'E'];
  if (mode === 'STABILIZED_MAINTENANCE')    return [...base, 'B'];
  if (mode === 'OCCUPANCY_RECOVERY')        return [...base, 'B', 'F'];
  if (mode === 'VALUE_ADD')                 return [...base, 'B', 'J'];
  if (mode === 'REDEVELOPMENT')             return [...base, 'B', 'J'];
  return [...base, 'B']; // default: show stabilized view
}

// ── localStorage key for tier preferences ────────────────────────────────────
export const LEASING_TIER_PREFS_KEY = 'jedi:assumptions_ui';
export interface LeasingTierPrefs { show_advanced: boolean; show_expert: boolean; }
export const DEFAULT_TIER_PREFS: LeasingTierPrefs = { show_advanced: false, show_expert: false };
