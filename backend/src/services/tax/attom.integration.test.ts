/**
 * ATTOM adapter + provenance carry-through integration tests
 *
 * Mocks `fetchFromAttom` at the module boundary so no real HTTPS is needed.
 * Proves the full pipeline:
 *
 *   GeneralPropertyAppraiserFetcher.fetch()
 *     → fetchFromAttom() (module-mocked → NormalizedParcel with source='attom')
 *     → externalProvenance built from parcel
 *     → taxService.forecast(ctx, externalProvenance)
 *     → TaxForecast.provenance.parcel_source === 'attom'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taxService } from './taxService';
import type { NormalizedParcel, TaxContext, TaxForecastProvenance } from './types';

// ── Module-level mock for ATTOM adapter ──────────────────────────────────────
// Must be hoisted before any import of propertyAppraiserFetcher.

const FLORIDA_APN   = '01-3234-567-0010';
const FLORIDA_STATE = 'FL';
const FLORIDA_COUNTY = 'Miami-Dade';

const MOCK_PARCEL: NormalizedParcel = {
  parcel_id:         FLORIDA_APN,
  state:             'FL',
  county:            FLORIDA_COUNTY,
  just_value:        4_000_000,
  assessed_value:    3_200_000,
  land_value:          800_000,
  improvement_value: 2_400_000,
  exemptions_total:          0,
  millage_rate:          20.0,   // mils
  annual_tax:           64_000,
  tax_year:               2025,
  last_updated:   '2025-11-01',
  staleness_days:           90,
  source:              'attom',
};

vi.mock('./attomAdapter', () => ({
  fetchFromAttom: vi.fn(),
}));

vi.mock('../../database/connection', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

// Import after mocks are hoisted
import { fetchFromAttom } from './attomAdapter';
import { query } from '../../database/connection';
import { generalPropertyAppraiserFetcher } from './propertyAppraiserFetcher';

// ── Helpers ───────────────────────────────────────────────────────────────────

function useAttomParcel(parcel: NormalizedParcel | null, extraWarnings: string[] = []) {
  vi.mocked(fetchFromAttom).mockResolvedValue({
    parcel,
    warnings: extraWarnings,
  });
}

function buildExternalProvenance(
  p: NormalizedParcel,
  confidence: 'high' | 'medium' | 'low',
): TaxForecastProvenance {
  const now = new Date().toISOString();
  const mkLv = <T>(v: T, src: string) => ({
    value: v,
    source: src,
    metadata: {
      ruleset_version: 'FL-2026',
      formula: src,
      confidence,
      computed_at: now,
    },
  });
  return {
    computed_at:       now,
    ruleset_version:   'FL-2026',
    parcel_source:     p.source,
    parcel_confidence: confidence,
    assessed_value:     mkLv(p.assessed_value  ?? null, p.source),
    millage_rate:       mkLv(p.millage_rate    ?? null, p.source),
    t12_annual_tax:     mkLv(p.annual_tax      ?? null, p.source),
    t12_millage_rate:   mkLv(p.millage_rate    ?? null, p.source),
    t12_assessed_value: mkLv(p.assessed_value  ?? null, p.source),
    platform_annual_tax:    mkLv(null, 'tax_service_computed'),
    delta_vs_t12_pct:       mkLv(null, 'tax_service_computed'),
    assessment_growth_pct:  mkLv(0,    'tax_service_computed'),
    soh_cap_pct:            mkLv(0,    'tax_service_computed'),
    doc_stamp_amount:       mkLv(null, 'tax_service_computed'),
    intangible_tax_amount:  mkLv(null, 'tax_service_computed'),
    county_surtax_amount:   mkLv(null, 'tax_service_computed'),
    total_transfer_tax:     mkLv(null, 'tax_service_computed'),
    land_allocation_pct:    mkLv(0.20, 'ruleset_default'),
    depreciable_base:       mkLv(null, 'tax_service_computed'),
    annual_depreciation:    mkLv(null, 'tax_service_computed'),
    bonus_depreciation_pct: mkLv(0,    'tax_service_computed'),
    cost_seg_available_pct: mkLv(0,    'tax_service_computed'),
    federal_income_tax_rate: mkLv(0,   'tax_service_computed'),
    state_income_tax_rate:   mkLv(0,   'tax_service_computed'),
    effective_combined_rate: mkLv(0,   'tax_service_computed'),
    tpp_exemption_amount:    mkLv(0,   'tax_service_computed'),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ATTOM data layer + provenance carry-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // DB tier-1 returns nothing (no uploaded PDF) so Tier 2 is always reached
    vi.mocked(query).mockResolvedValue({ rows: [] });
  });

  it('Tier 2 (ATTOM): returns NormalizedParcel for a Florida APN', async () => {
    useAttomParcel(MOCK_PARCEL);

    const result = await generalPropertyAppraiserFetcher.fetch({
      dealId:   'deal-fl-001',
      parcelId: FLORIDA_APN,
      state:    FLORIDA_STATE,
      county:   FLORIDA_COUNTY,
    });

    expect(result.tier).toBe(2);
    expect(result.confidence).toBe('high');
    expect(result.parcel).not.toBeNull();

    const p = result.parcel!;
    expect(p.source).toBe('attom');
    expect(p.parcel_id).toBe(FLORIDA_APN);
    expect(p.state).toBe('FL');
    expect(p.assessed_value).toBe(3_200_000);
    expect(p.annual_tax).toBe(64_000);
    expect(p.millage_rate).toBe(20.0);
  });

  it('provenance.parcel_source === "attom" flows through taxService.forecast()', async () => {
    useAttomParcel(MOCK_PARCEL);

    const parcelResult = await generalPropertyAppraiserFetcher.fetch({
      dealId:   'deal-fl-002',
      parcelId: FLORIDA_APN,
      state:    FLORIDA_STATE,
      county:   FLORIDA_COUNTY,
    });

    const p = parcelResult.parcel!;
    const externalProvenance = buildExternalProvenance(p, parcelResult.confidence);

    const ctx: TaxContext = {
      state:                 'FL',
      county:                FLORIDA_COUNTY,
      city:                  'Miami',
      purchasePrice:         4_000_000,
      loanAmount:            3_000_000,
      assessedValueOverride: null,
      millageRateOverride:   p.millage_rate ?? null,
      countyOverride:        null,
      units:                 10,
      t12AnnualTax:          p.annual_tax,
      holdYears:             10,
    };

    const forecast = taxService.forecast(ctx, externalProvenance);

    // Core provenance carry-through assertions
    expect(forecast.provenance).toBeDefined();
    expect(forecast.provenance!.parcel_source).toBe('attom');
    expect(forecast.provenance!.parcel_confidence).toBe('high');
    expect(forecast.provenance!.assessed_value.source).toBe('attom');
    expect(forecast.provenance!.assessed_value.value).toBe(3_200_000);
    expect(forecast.provenance!.millage_rate.source).toBe('attom');
    expect(forecast.provenance!.t12_annual_tax.value).toBe(64_000);

    // Forecast outputs are populated
    expect(forecast.reTax.t12AnnualTax).toBe(64_000);
    expect(forecast.reTax.platformAnnualTax).toBeGreaterThan(0);
    expect(forecast.jurisdictionMapped).toBe(true);
    expect(forecast.confidence).toBe('high');
  });

  it('Tier 4 (fallback): null parcel + low confidence when ATTOM returns nothing', async () => {
    useAttomParcel(null, ['ATTOM_API_KEY not configured — Tier 2 (ATTOM) skipped']);

    const result = await generalPropertyAppraiserFetcher.fetch({
      dealId:   'deal-no-attom',
      parcelId: FLORIDA_APN,
      state:    FLORIDA_STATE,
      county:   FLORIDA_COUNTY,
    });

    expect(result.parcel).toBeNull();
    expect(result.tier).toBe(4);
    expect(result.confidence).toBe('low');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('millage_rate on parcel matches fixture value (20 mils)', async () => {
    useAttomParcel(MOCK_PARCEL);

    const result = await generalPropertyAppraiserFetcher.fetch({
      dealId:   'deal-fl-003',
      parcelId: FLORIDA_APN,
      state:    FLORIDA_STATE,
      county:   FLORIDA_COUNTY,
    });

    expect(result.parcel!.millage_rate).toBeCloseTo(20.0, 1);
    // Sanity: tax ≈ assessed * millage / 1000
    const { assessed_value, annual_tax, millage_rate } = result.parcel!;
    const derived = (assessed_value ?? 0) * (millage_rate ?? 0) / 1000;
    expect(annual_tax).toBeCloseTo(derived, -2);   // within ~$100
  });
});
