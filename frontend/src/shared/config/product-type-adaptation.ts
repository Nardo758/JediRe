import type { DealType, StrategyId } from './deal-type-visibility';

export type ProductType =
  | 'mf_garden'
  | 'mf_midrise'
  | 'mf_highrise'
  | 'mf_mixed_use'
  | 'sfr'
  | 'btrs'
  | 'student'
  | 'senior'
  | 'affordable';

interface StrategyProfile {
  strategy: StrategyId;
  strength: number;
  available: boolean;
}

const MATRIX: Partial<Record<DealType, Partial<Record<ProductType, Partial<Record<StrategyId, number>>>>>> = {
  existing_acquisition: {
    mf_garden: { value_add: 0.9, core_plus: 0.75, core: 0.6 },
    mf_midrise: { value_add: 0.8, core_plus: 0.85, core: 0.7 },
    mf_highrise: { core_plus: 0.8, core: 0.9, value_add: 0.6 },
    mf_mixed_use: { value_add: 0.8, core_plus: 0.8, core: 0.65 },
    sfr: { value_add: 0.85, core_plus: 0.6, core: 0.5 },
    btrs: { value_add: 0.8, core_plus: 0.7, core: 0.6 },
    student: { value_add: 0.85, core_plus: 0.7, core: 0.5 },
    senior: { value_add: 0.75, core_plus: 0.8, core: 0.7 },
    affordable: { value_add: 0.7, core_plus: 0.6, core: 0.8 },
  },
  new_development: {
    mf_garden: { development: 0.9, opportunistic: 0.75 },
    mf_midrise: { development: 0.85, opportunistic: 0.8 },
    mf_highrise: { development: 0.75, opportunistic: 0.85 },
    mf_mixed_use: { development: 0.8, opportunistic: 0.9 },
    sfr: { development: 0.85, opportunistic: 0.7 },
    btrs: { development: 0.85, opportunistic: 0.75 },
    student: { development: 0.8, opportunistic: 0.7 },
    senior: { development: 0.8, opportunistic: 0.7 },
    affordable: { development: 0.9, opportunistic: 0.6 },
  },
  redevelopment: {
    mf_garden: { value_add: 0.8, opportunistic: 0.85, development: 0.75 },
    mf_midrise: { value_add: 0.75, opportunistic: 0.9, development: 0.8 },
    mf_highrise: { value_add: 0.7, opportunistic: 0.85, development: 0.85 },
    mf_mixed_use: { value_add: 0.8, opportunistic: 0.9, development: 0.85 },
    sfr: { value_add: 0.8, opportunistic: 0.75, development: 0.7 },
    btrs: { value_add: 0.75, opportunistic: 0.8, development: 0.75 },
    student: { value_add: 0.75, opportunistic: 0.8, development: 0.75 },
    senior: { value_add: 0.75, opportunistic: 0.75, development: 0.8 },
    affordable: { value_add: 0.7, opportunistic: 0.7, development: 0.85 },
  },
};

export function getStrategyStrength(dealType: DealType, productType: ProductType, strategy: StrategyId): number {
  return MATRIX[dealType]?.[productType]?.[strategy] ?? 0.5;
}

export function getStrategyAvailability(dealType: DealType, productType: ProductType): StrategyProfile[] {
  const row = MATRIX[dealType]?.[productType] ?? {};
  return Object.entries(row).map(([s, strength]) => ({
    strategy: s as StrategyId,
    strength: strength as number,
    available: (strength as number) > 0.5,
  }));
}
