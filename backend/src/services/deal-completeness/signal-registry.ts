/**
 * Deal Completeness — Signal Registry (Piece C1)
 *
 * Each signal definition knows how to evaluate itself for a given deal.
 * The registry is intentionally additive: new signals are added here without
 * touching the evaluation engine or the REST layer.
 *
 * Initial 4 signals (C1 scope):
 *   - m07_missing              Traffic Engine (M07) hasn't run → vacancy trajectory flat-constant
 *   - costar_upload_missing    No CoStar market data → rent comp pool empty
 *   - rent_roll_missing        No rent roll document → all LV layers degraded
 *   - material_divergence_high ≥1 block-level source divergence on key assumptions
 */

import { Pool } from 'pg';
import type { SignalSeverity, SignalStatus } from '../../types/deal-completeness';
import { getDivergenceSummary } from '../field-access/get-field-value.service';

export interface SignalDefinition {
  id:                string;
  severity:          SignalSeverity;
  title:             string;
  description:       string;
  recommendedAction: string;
  ctaLabel?:         string;
  ctaLink?:          (dealId: string) => string;
  evaluate:          (dealId: string, propertyId: string | null, pool: Pool) => Promise<SignalStatus>;
}

const SIGNAL_REGISTRY: SignalDefinition[] = [

  {
    id:       'm07_missing',
    severity: 'blocker',
    title:    'Traffic Engine (M07) hasn\'t run',
    description:
      'The M07 Traffic Engine produces a per-year vacancy trajectory calibrated to ' +
      'this property\'s observed leasing velocity. Without it, the Financial Engine ' +
      'uses a flat vacancy constant for all projection years — silently degrading ' +
      'accuracy for vacancy-sensitive underwriting.',
    recommendedAction:
      'Run M07 for this property to produce a traffic-calibrated vacancy trajectory. ' +
      'Open the Traffic Engine tab (F7), then click "Run Prediction Engine."',
    ctaLabel: 'Open Traffic Engine',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=traffic`,

    async evaluate(_dealId, propertyId, pool): Promise<SignalStatus> {
      if (!propertyId) return 'incomplete';
      try {
        const res = await pool.query(
          `SELECT 1 FROM traffic_projections WHERE property_id = $1 LIMIT 1`,
          [propertyId],
        );
        return res.rows.length > 0 ? 'complete' : 'incomplete';
      } catch {
        return 'incomplete';
      }
    },
  },

  {
    id:       'costar_upload_missing',
    severity: 'advisory',
    title:    'No CoStar market data uploaded',
    description:
      'CoStar rent comps and sale comps power the market intelligence layer ' +
      '(rent comp pool, cap-rate benchmarks, submarket performance). Without a ' +
      'CoStar upload, these surfaces rely on platform estimates only.',
    recommendedAction:
      'Upload a CoStar "Near-By Rents," "Near-By Sales," or "Submarket Stats" ' +
      'export from the Data Library tab. Exports from the CoStar platform are ' +
      'accepted directly.',
    ctaLabel: 'Upload CoStar Data',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=data-library`,

    async evaluate(dealId, _propertyId, pool): Promise<SignalStatus> {
      try {
        const rentRes = await pool.query(
          `SELECT 1 FROM market_rent_comps
           WHERE source = 'costar_upload' AND deal_id = $1::uuid LIMIT 1`,
          [dealId],
        );
        if (rentRes.rows.length > 0) return 'complete';

        const saleRes = await pool.query(
          `SELECT 1 FROM market_sale_comps
           WHERE source = 'costar_upload' AND deal_id = $1::uuid LIMIT 1`,
          [dealId],
        );
        return saleRes.rows.length > 0 ? 'complete' : 'incomplete';
      } catch {
        return 'incomplete';
      }
    },
  },

  {
    id:       'rent_roll_missing',
    severity: 'blocker',
    title:    'No rent roll uploaded',
    description:
      'The rent roll is the primary data source for in-place GPR, loss-to-lease, ' +
      'vacancy, and other-income assumptions. Without it, all LayeredValue fields ' +
      'for revenue assumptions fall back to OM estimates or platform benchmarks, ' +
      'significantly reducing underwriting precision.',
    recommendedAction:
      'Upload the T-12 rent roll (Excel or PDF) from the Documents tab. The ' +
      'extraction pipeline will automatically populate GPR, LTL, and vacancy layers.',
    ctaLabel: 'Upload Rent Roll',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=documents`,

    async evaluate(dealId, _propertyId, pool): Promise<SignalStatus> {
      try {
        const res = await pool.query(
          `SELECT 1 FROM deal_files
           WHERE deal_id = $1 AND category = 'rent_roll' LIMIT 1`,
          [dealId],
        );
        return res.rows.length > 0 ? 'complete' : 'incomplete';
      } catch {
        return 'incomplete';
      }
    },
  },

  {
    id:       'material_divergence_high',
    severity: 'advisory',
    title:    'Material source divergence on key assumptions',
    description:
      'One or more key underwriting assumptions have source layers that disagree ' +
      'significantly. This means different data sources (T-12, OM, live traffic) ' +
      'are telling materially different stories — the resolved value may be anchored ' +
      'to the wrong source.',
    recommendedAction:
      'Open the Assumption Validation Grid (F9 → VALIDATION tab) to review ' +
      'contested fields. Click any ⚡ CONTESTED badge to see which sources disagree ' +
      'and by how much, then decide which layer to trust.',
    ctaLabel: 'Review Validation Grid',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=financial-engine&subtab=validation`,

    async evaluate(dealId, _propertyId, pool): Promise<SignalStatus> {
      try {
        const summary = await getDivergenceSummary(pool, dealId);
        if (summary.blockCount >= 1) return 'incomplete';
        if (summary.warnCount >= 3)  return 'degraded';
        return 'complete';
      } catch {
        return 'complete';
      }
    },
  },

];

export function getSignalRegistry(): SignalDefinition[] {
  return SIGNAL_REGISTRY;
}
