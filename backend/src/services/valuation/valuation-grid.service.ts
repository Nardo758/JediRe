/**
 * Valuation Grid Service — Multi-Method Price Triangulation
 * Task #1370, Dispatch 2
 *
 * Runs 5 active valuation methods (V0.1) + 4 placeholder methods (V1.0)
 * against a subject deal and reconciles them into a recommended price range.
 *
 * Active V0.1 methods:
 *   1. Cap Rate × NOI          — bottom-up income capitalisation
 *   2. Per-Unit Benchmark      — archive_assumption_benchmarks PPU cohort
 *   3. Sales Comp PPU          — CompSetService transaction comps
 *   3b. Sales Comp PSF         — conditional on sqft coverage
 *   4. Operator Override       — manual, always available
 *   5. Replacement Cost        — ReplacementCostServiceV2 (BLS PPI + permits)
 *
 * Placeholder V1.0 methods:
 *   6. GRM  — blocked on gross_rent_annual field coverage
 *   7. GIM  — blocked on gross_income_annual field coverage
 *   8. DCF  — blocked on Phase 2 full derivation logic
 */

import { Pool } from 'pg';
import { compSetService } from '../saleComps/compSet.service';
import { getReplacementCostServiceV2, type ReplacementCostInput } from '../inflation/replacement-cost-v2.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MethodId =
  | 'cap_rate_noi'
  | 'per_unit_benchmark'
  | 'sales_comp_ppu'
  | 'sales_comp_psf'
  | 'operator_override'
  | 'replacement_cost'
  | 'grm'
  | 'gim'
  | 'dcf';

export type MethodStatus = 'active' | 'insufficient' | 'placeholder';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export type MethodDirection = 'bottom_up' | 'top_down' | 'cost' | 'income' | 'manual';
export type ConvergenceSignal = 'CONVERGENT' | 'MODERATE' | 'DIVERGENT';

export interface EvidenceLine {
  label: string;
  value: string;
  source?: string;
}

export interface ValuationMethod {
  id: MethodId;
  label: string;
  direction: MethodDirection;
  status: MethodStatus;
  placeholderVersion?: string;
  confidence: ConfidenceLevel;
  indicatedValueP25: number | null;
  indicatedValueP50: number | null;
  indicatedValueP75: number | null;
  indicatedPPU: number | null;
  indicatedPSF: number | null;
  compCount?: number;
  sampleSize?: number;
  sourceProvenance: string;
  evidenceTrail: EvidenceLine[];
  warningFlags: string[];
}

export interface GapAnalysisItem {
  methodA: MethodId;
  methodB: MethodId;
  labelA: string;
  labelB: string;
  deltaPct: number;
  driverText: string;
  severity: 'info' | 'watch' | 'alert';
}

export interface SubjectProperty {
  units: number | null;
  totalSF: number | null;
  purchasePrice: number | null;
  noi: number | null;
  noiSource: string;
  assetClass: string | null;
  city: string;
  state: string;
  submarket: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ValuationGridResult {
  dealId: string;
  computedAt: string;
  subject: SubjectProperty;
  methods: ValuationMethod[];
  reconciliation: {
    convergenceScore: number;
    convergenceSignal: ConvergenceSignal;
    convergenceText: string;
    reconciledValue: number | null;
    reconciledPPU: number | null;
    reconciledPSF: number | null;
    recommendedPriceLow: number | null;
    recommendedPriceHigh: number | null;
    gapAnalysis: GapAnalysisItem[];
    activeMethodCount: number;
  };
}

// ── Confidence weight map ─────────────────────────────────────────────────────

const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INSUFFICIENT: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(v: number | null): string {
  if (v == null) return '—';
  return v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPPU(v: number | null): string {
  if (v == null) return '—';
  return `$${Math.round(v).toLocaleString('en-US')}/unit`;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function safeFloat(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ValuationGridService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async compute(dealId: string): Promise<ValuationGridResult> {
    const subject = await this.getSubjectProperty(dealId);
    const methods: ValuationMethod[] = [];

    const [
      m1,
      m2,
      m3,
      m5,
    ] = await Promise.all([
      this.computeCapRateNOI(subject),
      this.computePerUnitBenchmark(subject),
      this.computeSalesCompPPU(dealId, subject),
      this.computeReplacementCost(subject),
    ]);

    methods.push(m1);
    methods.push(m2);
    methods.push(m3);

    // PSF sub-method — only if subject has sqft and comp PSF is meaningful
    const m3b = this.computeSalesCompPSF(m3, subject);
    if (m3b) methods.push(m3b);

    // Method 4 — Operator Override — always appended (may be INSUFFICIENT if not set)
    const m4 = await this.computeOperatorOverride(dealId, subject);
    methods.push(m4);

    methods.push(m5);

    // V1.0 placeholders
    methods.push(this.placeholder('grm', 'GRM — Gross Rent Multiplier', 'income'));
    methods.push(this.placeholder('gim', 'GIM — Gross Income Multiplier', 'income'));
    methods.push(this.placeholder('dcf', 'DCF — Discounted Cash Flow', 'income'));

    const reconciliation = this.reconcile(methods, subject);

    return {
      dealId,
      computedAt: new Date().toISOString(),
      subject,
      methods,
      reconciliation,
    };
  }

  // ── Subject property ────────────────────────────────────────────────────────

  private async getSubjectProperty(dealId: string): Promise<SubjectProperty> {
    const result = await this.pool.query(
      `SELECT
         d.id,
         COALESCE(d.municipality, d.address, '')  AS city,
         COALESCE(d.state, '')                    AS state,
         p.units,
         p.building_sf                            AS total_sf,
         p.latitude,
         p.longitude,
         p.asset_class,
         p.submarket,
         da.purchase_price                        AS purchase_price,
         da.valuation_override_lv                 AS valuation_override_lv,
         (da.year1->>'noi')                       AS noi_year1,
         (da.year1->>'year1_noi')                 AS noi_year1_alt
       FROM deals d
       LEFT JOIN properties p ON p.deal_id = d.id
       LEFT JOIN deal_assumptions da ON da.deal_id = d.id
       WHERE d.id = $1::uuid
       LIMIT 1`,
      [dealId]
    );

    const row = result.rows[0];
    if (!row) throw new Error(`Deal ${dealId} not found`);

    // NOI: read from year1 JSONB if present, else null (service degrades gracefully)
    let noi: number | null = null;
    let noiSource = 'none';
    const noiY1 = safeFloat(row.noi_year1 ?? row.noi_year1_alt, 0);
    if (noiY1 > 0) {
      noi = noiY1;
      noiSource = 'proforma_year1';
    }

    return {
      units: row.units ? safeFloat(row.units) : null,
      totalSF: row.total_sf ? safeFloat(row.total_sf) : null,
      purchasePrice: row.purchase_price ? safeFloat(row.purchase_price) : null,
      noi,
      noiSource,
      assetClass: row.asset_class || null,
      city: row.city || '',
      state: row.state || '',
      submarket: row.submarket || null,
      latitude: row.latitude ? safeFloat(row.latitude) : null,
      longitude: row.longitude ? safeFloat(row.longitude) : null,
    };
  }

  // ── Method 1: Cap Rate × NOI ─────────────────────────────────────────────

  private async computeCapRateNOI(subject: SubjectProperty): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'cap_rate_noi';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.noi) {
      return this.insufficientMethod(
        METHOD_ID,
        'Cap Rate × NOI',
        'bottom_up',
        'No NOI available — add proforma assumptions or upload a T12 rent roll.',
        []
      );
    }

    // Query cap rate distribution from archive benchmarks
    const params: unknown[] = [];
    let whereClauses = [`assumption_name = 'cap_rate'`];

    if (subject.assetClass) {
      params.push(subject.assetClass);
      whereClauses.push(`(asset_class = $${params.length} OR asset_class IS NULL)`);
    } else {
      whereClauses.push(`asset_class IS NULL`);
    }

    if (subject.submarket) {
      params.push(subject.submarket);
      whereClauses.push(`(submarket_id = $${params.length} OR submarket_id IS NULL)`);
    }

    const capQuery = await this.pool.query(
      `SELECT p25, p50, p75, n_samples, as_of, submarket_id
       FROM archive_assumption_benchmarks
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY
         (CASE WHEN submarket_id IS NOT NULL THEN 0 ELSE 1 END),
         as_of DESC
       LIMIT 1`,
      params
    );

    let capP25: number, capP50: number, capP75: number, nSamples: number;
    let sourceText: string;

    if (capQuery.rows.length > 0 && capQuery.rows[0].p50 != null) {
      const row = capQuery.rows[0];
      capP25 = safeFloat(row.p25, 0.045);
      capP50 = safeFloat(row.p50, 0.055);
      capP75 = safeFloat(row.p75, 0.065);
      nSamples = safeFloat(row.n_samples, 0);
      const scope = row.submarket_id ? `${row.submarket_id} submarket` : `${subject.city} market`;
      sourceText = `Archive benchmark — ${scope} (n=${nSamples}, as of ${row.as_of?.toISOString?.()?.slice(0, 10) ?? 'unknown'})`;

      if (nSamples < 5) {
        warnings.push(`Very thin archive sample (n=${nSamples}) — cap rate range is unreliable for this cohort.`);
      } else if (nSamples < 10) {
        warnings.push(`Sparse archive sample (n=${nSamples}) — treat cap rate range with caution.`);
      }
    } else {
      // Market defaults for FL/GA/TX primary — conservative placeholder
      const defaults = this.defaultCapRatesByMarket(subject.state, subject.city);
      capP25 = defaults.p25;
      capP50 = defaults.p50;
      capP75 = defaults.p75;
      nSamples = 0;
      sourceText = `Market default cap rates for ${subject.city}, ${subject.state} (no archive data yet)`;
      warnings.push('No archive cap rate data for this cohort — using market defaults. Confidence LOW.');
    }

    // Indicated values: V = NOI / cap_rate
    // Higher cap → lower value; lower cap → higher value
    const noi = subject.noi!;
    const valP25 = noi / capP75;  // low end: high cap
    const valP50 = noi / capP50;
    const valP75 = noi / capP25;  // high end: low cap

    const ppu50 = subject.units ? valP50 / subject.units : null;
    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;

    evidence.push(
      { label: 'Stabilized NOI', value: fmt$(noi), source: subject.noiSource },
      { label: 'Cap Rate P25', value: `${(capP25 * 100).toFixed(2)}%`, source: 'archive_assumption_benchmarks' },
      { label: 'Cap Rate P50', value: `${(capP50 * 100).toFixed(2)}%`, source: 'archive_assumption_benchmarks' },
      { label: 'Cap Rate P75', value: `${(capP75 * 100).toFixed(2)}%`, source: 'archive_assumption_benchmarks' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    const confidence = this.archiveConfidence(nSamples, subject.state, subject.city);

    return {
      id: METHOD_ID,
      label: 'Cap Rate × NOI',
      direction: 'bottom_up',
      status: 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: ppu50,
      indicatedPSF: psf50,
      sampleSize: nSamples,
      sourceProvenance: sourceText,
      evidenceTrail: evidence,
      warningFlags: warnings,
    };
  }

  // ── Method 2: Per-Unit Benchmark ─────────────────────────────────────────

  private async computePerUnitBenchmark(subject: SubjectProperty): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'per_unit_benchmark';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.units) {
      return this.insufficientMethod(
        METHOD_ID,
        'Per-Unit Benchmark',
        'top_down',
        'Unit count not available for this deal.',
        []
      );
    }

    const params: unknown[] = ['price_per_unit'];
    const whereClauses: string[] = [`assumption_name = $1`];

    if (subject.assetClass) {
      params.push(subject.assetClass);
      whereClauses.push(`(asset_class = $${params.length} OR asset_class IS NULL)`);
    }

    if (subject.submarket) {
      params.push(subject.submarket);
      whereClauses.push(`(submarket_id = $${params.length} OR submarket_id IS NULL)`);
    }

    const benchmarkQuery = await this.pool.query(
      `SELECT p25, p50, p75, n_samples, as_of, submarket_id
       FROM archive_assumption_benchmarks
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY
         (CASE WHEN submarket_id IS NOT NULL THEN 0 ELSE 1 END),
         as_of DESC
       LIMIT 1`,
      params
    );

    if (benchmarkQuery.rows.length === 0 || benchmarkQuery.rows[0].p50 == null) {
      return this.insufficientMethod(
        METHOD_ID,
        'Per-Unit Benchmark',
        'top_down',
        `No archive PPU data for ${subject.assetClass || 'multifamily'} in ${subject.city}. Data accumulates as platform deals close.`,
        []
      );
    }

    const row = benchmarkQuery.rows[0];
    const p25 = safeFloat(row.p25);
    const p50 = safeFloat(row.p50);
    const p75 = safeFloat(row.p75);
    const n = safeFloat(row.n_samples);

    const valP25 = p25 * subject.units;
    const valP50 = p50 * subject.units;
    const valP75 = p75 * subject.units;

    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;
    const scope = row.submarket_id ? `${row.submarket_id} submarket` : `${subject.city} market`;

    if (n < 5) {
      warnings.push(`Very sparse archive (n=${n}) — per-unit benchmark is indicative only.`);
    } else if (n < 10) {
      warnings.push(`Sparse archive sample (n=${n}, ${scope}) — use with caution.`);
    }

    evidence.push(
      { label: 'Archive PPU P25', value: fmtPPU(p25), source: 'archive_assumption_benchmarks' },
      { label: 'Archive PPU P50', value: fmtPPU(p50), source: 'archive_assumption_benchmarks' },
      { label: 'Archive PPU P75', value: fmtPPU(p75), source: 'archive_assumption_benchmarks' },
      { label: 'Sample Size', value: `n=${n}` },
      { label: 'As Of', value: row.as_of?.toISOString?.()?.slice(0, 10) ?? 'unknown' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    const confidence = this.archiveConfidence(n, subject.state, subject.city);

    return {
      id: METHOD_ID,
      label: 'Per-Unit Benchmark',
      direction: 'top_down',
      status: confidence === 'INSUFFICIENT' ? 'insufficient' : 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: p50,
      indicatedPSF: psf50,
      sampleSize: n,
      sourceProvenance: `Archive benchmark — ${scope} (n=${n})`,
      evidenceTrail: evidence,
      warningFlags: warnings,
    };
  }

  // ── Method 3: Sales Comp PPU ──────────────────────────────────────────────

  private async computeSalesCompPPU(
    dealId: string,
    subject: SubjectProperty
  ): Promise<ValuationMethod & { _compSetRaw?: any }> {
    const METHOD_ID: MethodId = 'sales_comp_ppu';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.units) {
      return {
        ...this.insufficientMethod(
          METHOD_ID,
          'Sales Comp PPU',
          'top_down',
          'Unit count not available — cannot derive value from PPU comps.',
          []
        ),
        _compSetRaw: null,
      };
    }

    if (!subject.latitude || !subject.longitude) {
      warnings.push('Property coordinates not available — comp set uses city-level filter (less precise).');
    }

    let compSet: any = null;
    try {
      compSet = await compSetService.getCompSetByDeal(dealId);
      if (!compSet || compSet.comp_count === 0) {
        // Attempt to generate on-the-fly
        compSet = await compSetService.generateCompSet({ deal_id: dealId });
      }
    } catch {
      // Silent fail — comp set generation may fail if no lat/lon
    }

    if (!compSet || compSet.comp_count === 0) {
      return {
        ...this.insufficientMethod(
          METHOD_ID,
          'Sales Comp PPU',
          'top_down',
          'No sale comps available within search radius. Widen radius or add comps manually.',
          []
        ),
        _compSetRaw: null,
      };
    }

    const medianPPU = safeFloat(compSet.median_price_per_unit);
    const stdDevPPU = safeFloat(compSet.std_dev_price_per_unit, medianPPU * 0.1);
    const compCount = safeFloat(compSet.comp_count);

    // P25/P75 via normal approximation (median ± 0.675σ)
    const ppuP25 = Math.max(0, medianPPU - 0.675 * stdDevPPU);
    const ppuP75 = medianPPU + 0.675 * stdDevPPU;

    const valP25 = ppuP25 * subject.units;
    const valP50 = medianPPU * subject.units;
    const valP75 = ppuP75 * subject.units;
    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;

    if (compCount < 5) {
      warnings.push(`Thin comp pool (n=${compCount}) — consider widening radius or vintage band.`);
    }
    if (!subject.submarket) {
      warnings.push('Submarket not assigned — comp set may include dissimilar-area transactions.');
    }

    evidence.push(
      { label: 'Comp Count', value: String(compCount) },
      { label: 'Median PPU', value: fmtPPU(medianPPU), source: 'market_sale_comps' },
      { label: 'PPU Range', value: `${fmtPPU(compSet.min_price_per_unit)} – ${fmtPPU(compSet.max_price_per_unit)}` },
      { label: 'Std Dev PPU', value: fmtPPU(stdDevPPU) },
      { label: 'Subject Percentile', value: compSet.subject_percentile != null ? `P${compSet.subject_percentile}` : '—' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    const confidence = this.compConfidence(compCount, subject.state, subject.city);

    return {
      id: METHOD_ID,
      label: 'Sales Comp PPU',
      direction: 'top_down',
      status: 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: medianPPU,
      indicatedPSF: psf50,
      compCount,
      sourceProvenance: `${compCount} market sale comps`,
      evidenceTrail: evidence,
      warningFlags: warnings,
      _compSetRaw: compSet,
    } as any;
  }

  // ── Method 3b: Sales Comp PSF ─────────────────────────────────────────────

  private computeSalesCompPSF(
    ppuMethod: ValuationMethod & { _compSetRaw?: any },
    subject: SubjectProperty
  ): ValuationMethod | null {
    if (!subject.totalSF) return null;
    const compSet = (ppuMethod as any)._compSetRaw;
    if (!compSet || !compSet.median_price_per_sf || safeFloat(compSet.median_price_per_sf) <= 0) return null;

    const medianPSF = safeFloat(compSet.median_price_per_sf);
    if (medianPSF <= 0) return null;

    const valP50 = medianPSF * subject.totalSF;
    const valP25 = valP50 * 0.85;
    const valP75 = valP50 * 1.15;
    const ppu = subject.units ? valP50 / subject.units : null;

    const warnings: string[] = [];
    if (!subject.totalSF) warnings.push('Subject total SF not available.');

    return {
      id: 'sales_comp_psf',
      label: 'Sales Comp PSF',
      direction: 'top_down',
      status: 'active',
      confidence: ppuMethod.confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: ppu,
      indicatedPSF: medianPSF,
      compCount: ppuMethod.compCount,
      sourceProvenance: `${ppuMethod.compCount} market sale comps (PSF)`,
      evidenceTrail: [
        { label: 'Median PSF', value: `$${medianPSF.toFixed(0)}/SF`, source: 'market_sale_comps' },
        { label: 'Subject Total SF', value: `${subject.totalSF.toLocaleString()} SF` },
        { label: 'Indicated Value P50', value: fmt$(valP50) },
      ],
      warningFlags: warnings,
    };
  }

  // ── Method 4: Operator Override ───────────────────────────────────────────

  private async computeOperatorOverride(
    dealId: string,
    subject: SubjectProperty
  ): Promise<ValuationMethod> {
    const result = await this.pool.query(
      `SELECT da.valuation_override_lv
       FROM deal_assumptions da
       WHERE da.deal_id = $1::uuid
       LIMIT 1`,
      [dealId]
    );

    const lv = result.rows[0]?.valuation_override_lv;
    const override = lv?.resolved ?? lv?.layers?.operator?.value ?? null;

    if (!override) {
      return this.insufficientMethod(
        'operator_override',
        'Operator Override',
        'manual',
        'No operator override set. Enter a value to anchor the reconciliation.',
        []
      );
    }

    const val = safeFloat(override);
    const ppu = subject.units ? val / subject.units : null;
    const psf = subject.totalSF ? val / subject.totalSF : null;

    return {
      id: 'operator_override',
      label: 'Operator Override',
      direction: 'manual',
      status: 'active',
      confidence: 'HIGH',
      indicatedValueP25: val,
      indicatedValueP50: val,
      indicatedValueP75: val,
      indicatedPPU: ppu,
      indicatedPSF: psf,
      sourceProvenance: 'Operator-entered value',
      evidenceTrail: [
        { label: 'Override Value', value: fmt$(val), source: 'operator' },
        ...(lv?.layers?.operator?.updatedAt
          ? [{ label: 'Set', value: new Date(lv.layers.operator.updatedAt).toLocaleDateString() }]
          : []),
      ],
      warningFlags: [],
    };
  }

  // ── Method 5: Replacement Cost ────────────────────────────────────────────

  private async computeReplacementCost(subject: SubjectProperty): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'replacement_cost';
    const warnings: string[] = [];

    if (!subject.units || !subject.totalSF) {
      return this.insufficientMethod(
        METHOD_ID,
        'Replacement Cost',
        'cost',
        'Unit count and total SF required for replacement cost estimate.',
        []
      );
    }

    try {
      const rcService = getReplacementCostServiceV2(this.pool);
      const input: ReplacementCostInput = {
        units: subject.units,
        totalSF: subject.totalSF,
        city: subject.city,
        state: subject.state,
        assetClass: (subject.assetClass as any) || 'B',
      };

      const rc = await rcService.estimateReplacementCost(input);
      const cpsfVal = safeFloat(rc.costPerSF?.value, 0);
      const cpuVal = safeFloat(rc.costPerUnit?.value, 0);
      const totalCost = safeFloat(rc.totalCost?.value, 0);

      if (totalCost <= 0) throw new Error('Replacement cost estimate returned zero');

      // Add land value proxy (10–20% of improvement cost, typical multifamily)
      const landFraction = 0.15;
      const landValue = totalCost * landFraction;
      const indicatedValue = totalCost + landValue;

      const valP50 = indicatedValue;
      const valP25 = valP50 * 0.90;
      const valP75 = valP50 * 1.12;

      const ppu50 = valP50 / subject.units;
      const psf50 = valP50 / subject.totalSF;

      const confidence: ConfidenceLevel =
        rc.costPerSF?.confidence === 'high' ? 'HIGH'
        : rc.costPerSF?.confidence === 'medium' ? 'MEDIUM'
        : 'LOW';

      if (rc.costPerSF?.source === 'default') {
        warnings.push('Using regional default replacement cost — no permit data for this market. Confidence reduced.');
      }

      return {
        id: METHOD_ID,
        label: 'Replacement Cost',
        direction: 'cost',
        status: 'active',
        confidence,
        indicatedValueP25: valP25,
        indicatedValueP50: valP50,
        indicatedValueP75: valP75,
        indicatedPPU: ppu50,
        indicatedPSF: psf50,
        sourceProvenance: `ReplacementCostServiceV2 (${rc.costPerSF?.source ?? 'default'})`,
        evidenceTrail: [
          { label: 'Cost/SF', value: `$${cpsfVal.toFixed(0)}/SF`, source: rc.costPerSF?.source ?? 'estimate' },
          { label: 'Cost/Unit', value: `$${Math.round(cpuVal).toLocaleString()}/unit` },
          { label: 'Improvement Cost', value: fmt$(totalCost) },
          { label: 'Land Value (est.)', value: fmt$(landValue), source: 'flat 15% of improvements' },
          { label: 'Total Indicated', value: fmt$(indicatedValue) },
        ],
        warningFlags: warnings,
      };
    } catch (err: any) {
      return this.insufficientMethod(
        METHOD_ID,
        'Replacement Cost',
        'cost',
        `Replacement cost unavailable: ${err?.message ?? 'unknown error'}`,
        []
      );
    }
  }

  // ── Reconciliation engine ─────────────────────────────────────────────────

  private reconcile(
    methods: ValuationMethod[],
    subject: SubjectProperty
  ): ValuationGridResult['reconciliation'] {
    const activeMethods = methods.filter(
      m => m.status === 'active' && m.indicatedValueP50 != null && m.confidence !== 'INSUFFICIENT'
    );

    if (activeMethods.length === 0) {
      return {
        convergenceScore: 0,
        convergenceSignal: 'DIVERGENT',
        convergenceText: 'No active methods with sufficient data.',
        reconciledValue: null,
        reconciledPPU: null,
        reconciledPSF: null,
        recommendedPriceLow: null,
        recommendedPriceHigh: null,
        gapAnalysis: [],
        activeMethodCount: 0,
      };
    }

    const values = activeMethods.map(m => m.indicatedValueP50!);
    const mu = mean(values);
    const sd = stdDev(values);
    const convergenceScore = mu > 0 ? Math.max(0, 1 - sd / mu) : 0;

    const convergenceSignal: ConvergenceSignal =
      convergenceScore >= 0.90 ? 'CONVERGENT'
      : convergenceScore >= 0.80 ? 'MODERATE'
      : 'DIVERGENT';

    const spreadPct = mu > 0 ? ((sd * 2) / mu * 100).toFixed(0) : '—';
    const convergenceText =
      convergenceSignal === 'CONVERGENT'
        ? `Methods agree — P50 values within ${(100 - convergenceScore * 100).toFixed(0)}% of each other.`
        : convergenceSignal === 'MODERATE'
        ? `Methods show ${spreadPct}% spread — review gap analysis below.`
        : `High divergence (${spreadPct}% spread) — investigate drivers before committing to a price.`;

    // Confidence-weighted mean
    const totalWeight = activeMethods.reduce(
      (s, m) => s + CONFIDENCE_WEIGHT[m.confidence],
      0
    );
    const reconciledValue =
      totalWeight > 0
        ? activeMethods.reduce(
            (s, m) => s + m.indicatedValueP50! * CONFIDENCE_WEIGHT[m.confidence],
            0
          ) / totalWeight
        : mu;

    const reconciledPPU = subject.units ? reconciledValue / subject.units : null;
    const reconciledPSF = subject.totalSF ? reconciledValue / subject.totalSF : null;

    const recommendedPriceLow = Math.max(0, reconciledValue - 0.5 * sd);
    const recommendedPriceHigh = reconciledValue + 0.5 * sd;

    // Gap analysis: M1 vs M3 (main diagnostic pair)
    const gapAnalysis: GapAnalysisItem[] = [];
    const m1 = activeMethods.find(m => m.id === 'cap_rate_noi');
    const m3 = activeMethods.find(m => m.id === 'sales_comp_ppu');
    const m2 = activeMethods.find(m => m.id === 'per_unit_benchmark');

    if (m1 && m3 && m3.indicatedValueP50) {
      const deltaPct = ((m1.indicatedValueP50! - m3.indicatedValueP50!) / m3.indicatedValueP50!) * 100;
      const absDelta = Math.abs(deltaPct);
      gapAnalysis.push({
        methodA: 'cap_rate_noi',
        methodB: 'sales_comp_ppu',
        labelA: 'Cap Rate × NOI',
        labelB: 'Sales Comp PPU',
        deltaPct,
        driverText: this.gapDriverText(m1, m3, subject, deltaPct),
        severity: absDelta < 10 ? 'info' : absDelta < 25 ? 'watch' : 'alert',
      });
    }

    if (m2 && m3 && m3.indicatedValueP50) {
      const deltaPct = ((m2.indicatedValueP50! - m3.indicatedValueP50!) / m3.indicatedValueP50!) * 100;
      const absDelta = Math.abs(deltaPct);
      gapAnalysis.push({
        methodA: 'per_unit_benchmark',
        methodB: 'sales_comp_ppu',
        labelA: 'Per-Unit Benchmark',
        labelB: 'Sales Comp PPU',
        deltaPct,
        driverText: `Archive benchmark PPU (${fmtPPU(m2.indicatedPPU)}) vs comp set PPU (${fmtPPU(m3.indicatedPPU)}). Archive uses ${m2.sampleSize ?? 0} platform deals; comp set uses ${m3.compCount ?? 0} market transactions.`,
        severity: absDelta < 15 ? 'info' : absDelta < 30 ? 'watch' : 'alert',
      });
    }

    return {
      convergenceScore,
      convergenceSignal,
      convergenceText,
      reconciledValue,
      reconciledPPU,
      reconciledPSF,
      recommendedPriceLow,
      recommendedPriceHigh,
      gapAnalysis,
      activeMethodCount: activeMethods.length,
    };
  }

  // ── Gap analysis driver text ──────────────────────────────────────────────

  private gapDriverText(
    m1: ValuationMethod,
    m3: ValuationMethod,
    subject: SubjectProperty,
    deltaPct: number
  ): string {
    const dir = deltaPct > 0 ? 'above' : 'below';
    const absPct = Math.abs(deltaPct).toFixed(0);
    const ppuDiff = `Cap-rate method (${fmt$(m1.indicatedValueP50)}) is ${absPct}% ${dir} comp PPU (${fmt$(m3.indicatedValueP50)}).`;

    if (m1.sampleSize != null && m1.sampleSize < 10) {
      return `${ppuDiff} Cap rate derived from thin archive (n=${m1.sampleSize}) — widen to city-level for more data.`;
    }
    if (m3.compCount != null && m3.compCount < 5) {
      return `${ppuDiff} Comp pool is thin (n=${m3.compCount}) — transaction sample may not represent the submarket.`;
    }
    return `${ppuDiff} Review NOI margin and cap rate assumptions against comp set characteristics.`;
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  private insufficientMethod(
    id: MethodId,
    label: string,
    direction: MethodDirection,
    provenance: string,
    warnings: string[]
  ): ValuationMethod {
    return {
      id,
      label,
      direction,
      status: 'insufficient',
      confidence: 'INSUFFICIENT',
      indicatedValueP25: null,
      indicatedValueP50: null,
      indicatedValueP75: null,
      indicatedPPU: null,
      indicatedPSF: null,
      sourceProvenance: provenance,
      evidenceTrail: [],
      warningFlags: warnings,
    };
  }

  private placeholder(id: MethodId, label: string, direction: MethodDirection): ValuationMethod {
    const tooltips: Partial<Record<MethodId, string>> = {
      grm: 'GRM requires gross_rent_annual at time of sale — not yet captured in comp data. Coming V1.0.',
      gim: 'GIM requires gross income data from broker OMs. Coming V1.0.',
      dcf: 'DCF requires full rent/OpEx derivation logic from Phase 2. Coming V1.0.',
    };
    return {
      id,
      label,
      direction,
      status: 'placeholder',
      placeholderVersion: 'V1.0',
      confidence: 'INSUFFICIENT',
      indicatedValueP25: null,
      indicatedValueP50: null,
      indicatedValueP75: null,
      indicatedPPU: null,
      indicatedPSF: null,
      sourceProvenance: tooltips[id] ?? 'Coming V1.0',
      evidenceTrail: [],
      warningFlags: [],
    };
  }

  private archiveConfidence(n: number, state: string, city: string): ConfidenceLevel {
    const isPrimary = this.isPrimaryMarket(state, city);
    if (n >= 30) return isPrimary ? 'HIGH' : 'MEDIUM';
    if (n >= 10) return isPrimary ? 'MEDIUM' : 'LOW';
    if (n >= 5)  return 'LOW';
    return 'INSUFFICIENT';
  }

  private compConfidence(compCount: number, state: string, city: string): ConfidenceLevel {
    const isPrimary = this.isPrimaryMarket(state, city);
    if (compCount >= 10) return isPrimary ? 'HIGH' : 'MEDIUM';
    if (compCount >= 5)  return 'MEDIUM';
    if (compCount >= 2)  return 'LOW';
    return 'INSUFFICIENT';
  }

  private isPrimaryMarket(state: string, city: string): boolean {
    const cityLower = city.toLowerCase();
    const PRIMARY_FL = ['tampa', 'orlando', 'miami', 'jacksonville'];
    const PRIMARY_TX = ['dallas', 'fort worth', 'houston', 'austin'];
    const PRIMARY_GA = ['atlanta'];
    if (state === 'FL' && PRIMARY_FL.some(c => cityLower.includes(c))) return true;
    if (state === 'TX' && PRIMARY_TX.some(c => cityLower.includes(c))) return true;
    if (state === 'GA' && PRIMARY_GA.some(c => cityLower.includes(c))) return true;
    return false;
  }

  private defaultCapRatesByMarket(
    state: string,
    city: string
  ): { p25: number; p50: number; p75: number } {
    // Conservative market-knowledge defaults when no archive data
    // Florida multifamily historically tighter; Sun Belt generally 5–6%
    if (state === 'FL') return { p25: 0.045, p50: 0.052, p75: 0.060 };
    if (state === 'GA') return { p25: 0.050, p50: 0.057, p75: 0.065 };
    if (state === 'TX') return { p25: 0.048, p50: 0.055, p75: 0.063 };
    return { p25: 0.050, p50: 0.058, p75: 0.068 };
  }

  // ── Operator override persistence ─────────────────────────────────────────

  async saveOperatorOverride(
    dealId: string,
    value: number,
    rationale?: string
  ): Promise<void> {
    const lv = {
      resolved: value,
      layers: {
        operator: {
          value,
          rationale: rationale ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
      resolvedFrom: 'operator',
      alertLevel: 'none',
    };

    await this.pool.query(
      `UPDATE deal_assumptions
       SET valuation_override_lv = $1::jsonb
       WHERE deal_id = $2::uuid`,
      [JSON.stringify(lv), dealId]
    );
  }
}
