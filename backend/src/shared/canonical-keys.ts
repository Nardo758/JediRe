// canonical-keys.ts
// Foundation module for Wave 1 refactor — centralized string literals.
// EVERYTHING else imports this module. Do NOT add string literals elsewhere.

// ── DealType ────────────────────────────────────────────────────────────────
export const DealType = {
  EXISTING: 'existing',
  VALUE_ADD: 'value_add',
  DEVELOPMENT: 'development',
  REDEVELOPMENT: 'redevelopment',
  LEASE_UP: 'lease_up',
  STABILIZED: 'stabilized',
} as const;
export type DealType = (typeof DealType)[keyof typeof DealType];

// ── SubStrategy ─────────────────────────────────────────────────────────────
export const SubStrategy = {
  CORE: 'core',
  CORE_PLUS: 'core_plus',
  VALUE_ADD: 'value_add',
  DEEP_VALUE: 'deep_value',
  DISTRESSED: 'distressed',
  LEASE_UP: 'lease_up',
} as const;
export type SubStrategy = (typeof SubStrategy)[keyof typeof SubStrategy];

// ── StageLabel ──────────────────────────────────────────────────────────────
export const StageLabel = {
  VISIT_TO_TOUR: 'visit_to_tour',
  TOUR_TO_LEASE: 'tour_to_lease',
  INQUIRY_TO_TOUR: 'inquiry_to_tour',
} as const;
export type StageLabel = (typeof StageLabel)[keyof typeof StageLabel];

// ── SourceClass ─────────────────────────────────────────────────────────────
export const SourceClass = {
  S1_USER_DEAL_DOCS: 's1_user_deal_docs',
  S2_OWNED_ACTUALS: 's2_owned_actuals',
  S3_PLATFORM: 's3_platform',
  S4_RESTRICTED: 's4_restricted',
  S5_BROKER_CLAIMS: 's5_broker_claims',
} as const;
export type SourceClass = (typeof SourceClass)[keyof typeof SourceClass];

// ── DisplayMap (presentation layer only) ────────────────────────────────────
export const DisplayMap = {
  dealType: {
    existing: 'Existing',
    value_add: 'Value-Add',
    development: 'Development',
    redevelopment: 'Redevelopment',
    lease_up: 'Lease-Up',
    stabilized: 'Stabilized',
  },
  stageLabel: {
    visit_to_tour: 'Visit → Tour',
    tour_to_lease: 'Tour → Lease',
    inquiry_to_tour: 'Inquiry → Tour',
  },
} as const;
