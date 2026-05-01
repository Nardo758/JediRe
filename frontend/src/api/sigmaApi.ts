/**
 * σ Engine API client
 *
 * Wraps the 6 Σ engine endpoints for frontend consumption.
 * Phase B: Plausibility UI — see M36-A spec.
 */

import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Assumption set: variable ID → value (decimal, e.g. 0.03 = 3%) */
export interface AssumptionInput {
  rent_growth?: number;
  vacancy_rate?: number;
  exit_cap_rate?: number;
  expense_growth?: number;
  entry_cap_rate?: number;
  debt_rate?: number;
  ltv?: number;
  [key: string]: number | undefined;
}

export type PlausibilityBand = 'Realistic' | 'Stretch' | 'Aggressive' | 'Heroic';

export interface PerVariableResult {
  value: number;
  mean: number;
  zScore: number;
  contribution: number;
  contributionPct: number;
  macroAnchored: boolean;
}

export interface PlausibilityWarning {
  type: 'heroic_assumption' | 'double_up_risk' | 'regime_mismatch' | 'high_divergence' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric?: string;
}

export interface PlausibilityResult {
  mahalanobisD: number;
  mahalanobisD2: number;
  band: PlausibilityBand;
  perVariable: Record<string, PerVariableResult>;
  regime: string;
  warnings: PlausibilityWarning[];
  bundleAssessment?: {
    doubleUp: { severity: string; explanation: string };
    irrVariance: number;
  };
}

export interface FactorDefinition {
  id: string;
  label: string;
  description: string;
  loadingWeight: number;
  signs: Record<string, number>;
}

export interface BundleDefinition {
  id: string;
  name: string;
  rateType: 'fixed' | 'floating';
  f1Loading: number;
  maxLtv: number;
  description: string;
}

export interface GoalSeekInput {
  targetIrr: number; // e.g. 0.15 = 15%
  regime?: string;
  bundleId?: string;
  fixed?: AssumptionInput; // variables to hold fixed
  ranges?: Record<string, [number, number]>; // variable → [min, max]
}

export interface GoalSeekCandidate {
  assumptions: AssumptionInput;
  mahalanobisD: number;
  irr: number;
  band: PlausibilityBand;
}

export interface GoalSeekResult {
  candidates: GoalSeekCandidate[];
  bundle: BundleDefinition;
  regime: string;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/** Score an assumption set for plausibility */
export async function scorePlausibility(input: {
  assumptions: AssumptionInput;
  regime?: string;
  bundleId?: string;
  dealF1Sensitivity?: number;
}): Promise<PlausibilityResult> {
  return apiClient.post('/api/v2/sigma/plausibility', input) as Promise<PlausibilityResult>;
}

/** Goal-seek: find assumption sets matching target IRR */
export async function goalSeek(input: GoalSeekInput): Promise<GoalSeekResult> {
  return apiClient.post('/api/v2/sigma/goal-seek', input) as Promise<GoalSeekResult>;
}

/** List available debt bundles */
export async function getBundles(): Promise<BundleDefinition[]> {
  return apiClient.get('/api/v2/sigma/bundles') as Promise<BundleDefinition[]>;
}

/** List factor definitions */
export async function getFactors(): Promise<FactorDefinition[]> {
  return apiClient.get('/api/v2/sigma/factors') as Promise<FactorDefinition[]>;
}

/** Get current regime */
export async function getCurrentRegime(): Promise<{ regime: string }> {
  return apiClient.get('/api/v2/sigma/regime/current') as Promise<{ regime: string }>;
}

/** Invalidate σ cache */
export async function invalidateSigmaCache(): Promise<void> {
  return apiClient.post('/api/v2/sigma/cache/invalidate') as Promise<void>;
}

// ─── Color Helpers ──────────────────────────────────────────────────────────

export const BAND_COLORS: Record<PlausibilityBand, { bg: string; text: string; border: string }> = {
  Realistic: { bg: '#1a3a1a', text: '#4ade80', border: '#166534' },
  Stretch:   { bg: '#3a2e1a', text: '#facc15', border: '#713f12' },
  Aggressive:{ bg: '#3a1a1a', text: '#fb923c', border: '#7c2d12' },
  Heroic:    { bg: '#3a0a0a', text: '#f87171', border: '#7f1d1d' },
};

export function bandColor(band: PlausibilityBand) {
  return BAND_COLORS[band] ?? BAND_COLORS.Heroic;
}

