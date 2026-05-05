/**
 * Macro-Anchored Mean Compositor — M36 Addendum
 *
 * Blends empirical local means with macro-anchored structural estimates
 * to produce defensible μ values for each variable in Σ.
 *
 * Model (per addendum spec §7.1 integration):
 *   α_sm = w_empirical · α_empirical + (1 - w_empirical) · α_macro
 *
 * where:
 *   α_macro = macro_series + structural_premium(asset_class, geographic_tier)
 *   α_empirical = local rolling-window mean of variable sm
 *
 * The macro anchor prevents mean reversion fallacy: a Tampa submarket
 * should not drift to a 30-year mean that includes 2008. It should center
 * on the macro-expected level for Florida coastal multifamily in the current regime,
 * pulled toward the local mean in proportion to local sample size.
 *
 * Structural premium sources:
 *   - FRED: Treasury yields, CPI, GDP
 *   - BLS: Employment, wage growth
 *   - Platform M05: Market rent levels, cap rate trends
 */

import type { Logger } from 'pino';
import { createLogger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MacroSeries {
  seriesId: string;
  name: string;
  source: string;
  frequency: 'monthly' | 'quarterly';
  values: { date: Date; value: number }[];
  unit: string;
}

export interface GeographicTier {
  tierId: string;
  name: string;
  region: string;
  climates: string[];
  rentLevel: 'low' | 'medium' | 'high';
  supplyElasticity: 'low' | 'medium' | 'high';
  insuranceExposure: 'low' | 'medium' | 'high';
}

export interface StructuralPremium {
  assetClass: string;
  tierId: string;
  /** Premium over macro baseline for each variable */
  premiums: Record<string, number>;
  estimatedAt: Date;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnchoredMeanResult {
  variableId: string;
  submarketId?: string;
  assetClass: string;
  /** Blended mean */
  alpha: number;
  /** Empirical local mean component */
  empiricalMean: number;
  /** Macro-anchored component */
  macroMean: number;
  /** Blending weight */
  weight: number;
  /** Macro series used as anchor */
  macroSeriesId?: string;
  /** Structural premium applied */
  structuralPremiumApplied: number;
  /** Data quality */
  nObservations: number;
}

// Tier classifications for structural premium estimation
const TIER_DEFINITIONS: Record<string, GeographicTier> = {
  'T1_COASTAL': {
    tierId: 'T1_COASTAL',
    name: 'Tier-1 Coastal',
    region: 'Coastal',
    climates: ['tropical', 'subtropical'],
    rentLevel: 'high',
    supplyElasticity: 'low',
    insuranceExposure: 'high',
  },
  'T1_URBAN_CORE': {
    tierId: 'T1_URBAN_CORE',
    name: 'Tier-1 Urban Core',
    region: 'National',
    climates: ['temperate', 'continental'],
    rentLevel: 'high',
    supplyElasticity: 'medium',
    insuranceExposure: 'low',
  },
  'T2_SUN_BELT': {
    tierId: 'T2_SUN_BELT',
    name: 'Tier-2 Sun Belt',
    region: 'Sun Belt',
    climates: ['subtropical', 'arid'],
    rentLevel: 'medium',
    supplyElasticity: 'medium',
    insuranceExposure: 'medium',
  },
  'T2_INTERIOR': {
    tierId: 'T2_INTERIOR',
    name: 'Tier-2 Interior Growth',
    region: 'Interior',
    climates: ['temperate', 'continental'],
    rentLevel: 'medium',
    supplyElasticity: 'high',
    insuranceExposure: 'low',
  },
  'T3_STABLE': {
    tierId: 'T3_STABLE',
    name: 'Tier-3 Stable Markets',
    region: 'National',
    climates: ['temperate', 'continental', 'arid'],
    rentLevel: 'medium',
    supplyElasticity: 'medium',
    insuranceExposure: 'low',
  },
  'T3_RUST_BELT': {
    tierId: 'T3_RUST_BELT',
    name: 'Tier-3 Rust Belt',
    region: 'Rust Belt',
    climates: ['continental'],
    rentLevel: 'low',
    supplyElasticity: 'high',
    insuranceExposure: 'low',
  },
};

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('macro-anchored-mean');

// ─── Class ───────────────────────────────────────────────────────────────────

export class MacroAnchoredMeanCompositor {
  private macroSeries: Map<string, MacroSeries> = new Map();
  private structuralPremiums: Map<string, StructuralPremium> = new Map();
  private empiricalData: Map<string, number[]> = new Map();

  constructor() {}

  // ─── Macro Data Management ─────────────────────────────────────────

  registerMacroSeries(series: MacroSeries): void {
    this.macroSeries.set(series.seriesId, series);
    log.info({ seriesId: series.seriesId, name: series.name }, 'Macro series registered');
  }

  getMacroSeries(seriesId: string): MacroSeries | undefined {
    return this.macroSeries.get(seriesId);
  }

  // ─── Empirical Data ────────────────────────────────────────────────

  loadEmpiricalData(variableId: string, values: number[]): void {
    this.empiricalData.set(variableId, [...values]);
  }

  // ─── Structural Premium ─────────────────────────────────────────────

  /**
   * Estimate structural premium for an asset class in a geographic tier.
   * Uses macro data + tier characteristics to compute deviation from baseline.
   *
   * Premiums are per-variable: e.g., rent_growth premium over national FRED rent index.
   */
  estimateStructuralPremium(
    assetClass: string,
    tierId: string,
  ): StructuralPremium {
    const tier = TIER_DEFINITIONS[tierId];
    if (!tier) {
      log.warn({ tierId }, 'Unknown tier, using T3_STABLE defaults');
      return {
        assetClass,
        tierId,
        premiums: {},
        estimatedAt: new Date(),
        confidence: 'low',
      };
    }

    const premiums: Record<string, number> = {};

    // Rent growth premium: depends on rent level + supply elasticity + insurance exposure
    const rentBase: Record<string, number> = { low: -0.005, medium: 0.0, high: 0.008 };
    const supplyBase: Record<string, number> = { low: 0.005, medium: 0.0, high: -0.005 };
    const insuranceBase: Record<string, number> = { low: 0.0, medium: -0.003, high: -0.008 };
    premiums['rent_growth_yoy'] = (rentBase[tier.rentLevel] ?? 0) +
      (supplyBase[tier.supplyElasticity] ?? 0) + (insuranceBase[tier.insuranceExposure] ?? 0);

    // Vacancy rate: supply elasticity dominant
    const vacBase: Record<string, number> = { low: -0.02, medium: 0.0, high: 0.03 };
    premiums['vacancy_rate'] = vacBase[tier.supplyElasticity] ?? 0;

    // Cap rate: insurance exposure + region risk
    const capInsurance: Record<string, number> = { low: 0.0, medium: 0.0025, high: 0.005 };
    premiums['exit_cap_rate'] = capInsurance[tier.insuranceExposure] ?? 0;

    // Expense growth: insurance-heavy markets have faster growth
    const expInsurance: Record<string, number> = { low: 0.0, medium: 0.005, high: 0.01 };
    premiums['expense_growth_yoy'] = expInsurance[tier.insuranceExposure] ?? 0;

    // Asset-class adjustment
    const acAdj: Record<string, Record<string, number>> = {
      multifamily: { rent_growth_yoy: 0.0, expense_growth_yoy: 0.0, exit_cap_rate: 0.0 },
      office: { rent_growth_yoy: -0.005, expense_growth_yoy: 0.003, exit_cap_rate: 0.005 },
      industrial: { rent_growth_yoy: 0.003, expense_growth_yoy: -0.002, exit_cap_rate: -0.003 },
      retail: { rent_growth_yoy: -0.008, expense_growth_yoy: 0.005, exit_cap_rate: 0.008 },
    };

    const acPremiums = acAdj[assetClass];
    if (acPremiums) {
      for (const [k, v] of Object.entries(acPremiums)) {
        premiums[k] = (premiums[k] ?? 0) + v;
      }
    }

    const result: StructuralPremium = {
      assetClass,
      tierId,
      premiums,
      estimatedAt: new Date(),
      confidence: 'medium',
    };

    const cacheKey = `${assetClass}|${tierId}`;
    this.structuralPremiums.set(cacheKey, result);
    return result;
  }

  getStructuralPremium(assetClass: string, tierId: string): StructuralPremium | undefined {
    return this.structuralPremiums.get(`${assetClass}|${tierId}`);
  }

  // ─── Mean Composition ────────────────────────────────────────────────

  /**
   * Compute anchored mean for a variable.
   *
   * α = w · α_empirical + (1 - w) · α_macro
   *
   * where:
   *   α_macro = current_macro_value + structural_premium
   *   w = n_obs / (n_obs + n0) — logistic weighting
   *   n0 = 36 (observations needed for 50% weight on local data)
   *
   * spec §7.1: Integration with macro-anchored mean addendum.
   */
  computeAnchoredMean(
    variableId: string,
    assetClass: string,
    tierId: string,
    macroSeriesId?: string,
    submarketId?: string,
  ): AnchoredMeanResult {
    // Empirical mean
    const empValues = this.empiricalData.get(variableId) ?? [];
    const nObs = empValues.length;
    const empMean = nObs > 0 ? empValues.reduce((s, v) => s + v, 0) / nObs : 0;

    // Macro anchor
    let macroMean = 0;
    let structuralPremiumApplied = 0;

    const premium = this.getStructuralPremium(assetClass, tierId);
    if (macroSeriesId) {
      const series = this.macroSeries.get(macroSeriesId);
      if (series && series.values.length > 0) {
        // Latest macro value
        const sorted = [...series.values].sort((a, b) => b.date.getTime() - a.date.getTime());
        macroMean = sorted[0].value;
      }
    }

    // Structural premium
    if (premium && premium.premiums[variableId] != null) {
      structuralPremiumApplied = premium.premiums[variableId];
    }

    macroMean += structuralPremiumApplied;

    // Blending weight: logistic with n0 = 36
    const n0 = 36;
    const w = nObs / (nObs + n0);
    const alpha = w * empMean + (1 - w) * macroMean;

    return {
      variableId,
      submarketId,
      assetClass,
      alpha: Math.round(alpha * 10000) / 10000,
      empiricalMean: Math.round(empMean * 10000) / 10000,
      macroMean: Math.round(macroMean * 10000) / 10000,
      weight: Math.round(w * 100) / 100,
      macroSeriesId,
      structuralPremiumApplied: Math.round(structuralPremiumApplied * 10000) / 10000,
      nObservations: nObs,
    };
  }

  /**
   * Compute anchored mean for a submarket in three-tier context.
   * spec M36 Multi-Tier §7.1.
   */
  computeSubmarketAnchoredMean(
    variableId: string,
    submarketId: string,
    msatierId: string,
    assetClass: string,
    submarketValues: number[],
    msaValues: number[],
    macroSeriesId?: string,
  ): AnchoredMeanResult {
    // Combine submarket + MSA empirical data with double-weight on MSA
    const empiricalValues = [...submarketValues, ...msaValues, ...msaValues];
    this.loadEmpiricalData(`${variableId}|${submarketId}`, empiricalValues);
    return this.computeAnchoredMean(`${variableId}|${submarketId}`, assetClass, msatierId, macroSeriesId, submarketId);
  }

  // ─── FRED/BLS Fetching (Spec M36 Macro Mean §3) ──────────────────────

  /**
   * Fetch macro series from FRED.
   * Simplified: stores known series. In production, this would call FRED API.
   */
  seedDefaultSeries(): void {
    // Treasury 10Y
    this.registerMacroSeries({
      seriesId: 'DGS10',
      name: '10-Year Treasury Constant Maturity Rate',
      source: 'FRED',
      frequency: 'monthly',
      values: [
        { date: new Date(), value: 4.25 },
        { date: new Date(0), value: 4.25 },
      ],
      unit: 'percent',
    });

    // CPI
    this.registerMacroSeries({
      seriesId: 'CPIAUCSL',
      name: 'Consumer Price Index for All Urban Consumers',
      source: 'FRED',
      frequency: 'monthly',
      values: [
        { date: new Date(), value: 3.0 },
        { date: new Date(0), value: 3.0 },
      ],
      unit: 'pct_change_yoy',
    });

    // Unemployment
    this.registerMacroSeries({
      seriesId: 'UNRATE',
      name: 'Unemployment Rate',
      source: 'FRED',
      frequency: 'monthly',
      values: [
        { date: new Date(), value: 3.7 },
        { date: new Date(0), value: 3.7 },
      ],
      unit: 'percent',
    });

    // Employment growth
    this.registerMacroSeries({
      seriesId: 'PAYEMS',
      name: 'Total Nonfarm Employment',
      source: 'FRED',
      frequency: 'monthly',
      values: [
        { date: new Date(), value: 1.8 },
        { date: new Date(0), value: 1.8 },
      ],
      unit: 'pct_change_yoy',
    });

    log.info('Default macro series seeded');
  }

  getTierDefinitions(): Record<string, GeographicTier> {
    return { ...TIER_DEFINITIONS };
  }

  getStats(): { nMacroSeries: number; nStructuralPremiums: number; nEmpiricalSeries: number } {
    return {
      nMacroSeries: this.macroSeries.size,
      nStructuralPremiums: this.structuralPremiums.size,
      nEmpiricalSeries: this.empiricalData.size,
    };
  }
}

export const macroAnchoredMeanCompositor = new MacroAnchoredMeanCompositor();
export default macroAnchoredMeanCompositor;
