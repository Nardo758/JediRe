/**
 * Deal Completeness — Signal Registry (Piece C1)
 *
 * Each signal definition knows how to evaluate itself for a given deal.
 * The registry is intentionally additive: new signals are added here without
 * touching the evaluation engine or the REST layer.
 *
 * Signals (C1 + Phase 2C):
 *   - m07_missing              Traffic Engine (M07) hasn't run → vacancy trajectory flat-constant
 *   - costar_upload_missing    No CoStar market data → rent comp pool empty
 *   - rent_roll_missing        No rent roll document → all LV layers degraded
 *   - material_divergence_high ≥1 block-level source divergence on key assumptions
 *   - vendor_data_missing      No vendor market data (CoStar/Yardi) uploaded for this deal + submarket
 *   - vendor_data_stale        Most recent vendor upload has crossed the registry's stale threshold
 */

import { Pool } from 'pg';
import type { SignalSeverity, SignalStatus } from '../../types/deal-completeness';
import { getDivergenceSummary } from '../field-access/get-field-value.service';
import { vendorRegistry } from '../document-extraction/vendor-registry';
import { computeFreshnessStatus } from '../vendor-freshness.service';

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
        if (summary.block >= 1) return 'incomplete';
        if (summary.warn >= 3)  return 'degraded';
        return 'complete';
      } catch {
        return 'complete';
      }
    },
  },

  // ── Per-field unresolved divergence signals (one per tracked field) ─────────
  // Each emits its own completeness signal so T-C1 consumers can surface
  // field-specific guidance (e.g. "loss_to_lease is contested — review T-12 vs live").
  // Severity: 'blocker' for required fields (exit_cap, noi, gpr); 'advisory' for recommended.

  ...([
    { fieldName: 'loss_to_lease',   required: false },
    { fieldName: 'vacancy',         required: false },
    { fieldName: 'exit_cap',        required: true  },
    { fieldName: 'rent_growth_yr1', required: false },
    { fieldName: 'gpr',             required: true  },
    { fieldName: 'noi',             required: true  },
    { fieldName: 'real_estate_tax', required: false },
  ] as { fieldName: string; required: boolean }[]).map(({ fieldName, required }) => ({
    id:       `unresolved_divergence:${fieldName}`,
    severity: (required ? 'blocker' : 'advisory') as SignalSeverity,
    title:    `Source disagreement on ${fieldName.replace(/_/g, ' ')} — resolution needed`,
    description:
      `Multiple data sources are reporting materially different values for ` +
      `${fieldName.replace(/_/g, ' ')}. The resolved value may be anchored to the wrong ` +
      `layer. This is a per-field signal; check the Validation Grid for delta details.`,
    recommendedAction:
      `Open the Assumption Validation Grid (F9 → VALIDATION tab), locate the ` +
      `${fieldName.replace(/_/g, ' ')} row, and review the ⚡ CONTESTED badge to decide ` +
      `which data source to trust.`,
    ctaLabel: 'Open Validation Grid',
    ctaLink:  (dealId: string) => `/deals/${dealId}?tab=financial-engine&subtab=validation`,

    async evaluate(dealId: string, _propertyId: string | null, pool: Pool): Promise<SignalStatus> {
      try {
        const { getFieldValues } = await import('../field-access/get-field-value.service');
        const values = await getFieldValues(pool, dealId, [fieldName]);
        const lv = values[fieldName];
        if (!lv?.divergenceSignature?.exceeds) return 'complete';
        return lv.divergenceSignature.alertLevel === 'block' ? 'incomplete' : 'degraded';
      } catch {
        return 'complete';
      }
    },
  })),

  // ── Phase 2C: Vendor data completeness signals ────────────────────────────

  {
    id:       'vendor_data_missing',
    severity: 'advisory',
    title:    'No vendor market data uploaded for this deal',
    description:
      'No market data from a registered vendor (CoStar, Yardi Matrix) has been ' +
      'uploaded for this deal\'s submarket. Rent comp benchmarks, submarket vacancy ' +
      'trends, and supply pipeline context will use platform estimates only, which ' +
      'may be less precise than operator-provided vendor exports.',
    recommendedAction:
      'Upload a CoStar DataTable, Near-By Sales, or Rent Comp export, or a Yardi ' +
      'Matrix Rent Survey, from the Data Library tab. The platform accepts vendor ' +
      'exports directly and parses them automatically.',
    ctaLabel: 'Upload Market Data',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=data-library`,

    async evaluate(dealId, _propertyId, pool): Promise<SignalStatus> {
      try {
        // Check vendor_market_observations (primary cross-vendor substrate)
        const obsRes = await pool.query(
          `SELECT 1 FROM vendor_market_observations WHERE deal_id = $1::uuid LIMIT 1`,
          [dealId],
        );
        if (obsRes.rows.length > 0) return 'complete';

        // Also check data_library_files for vendor-typed uploads (comp files that
        // write to market_*_comps but not vendor_market_observations)
        const allVendors = vendorRegistry.getAllVendors();
        const vendorDocTypes = allVendors.flatMap(v => v.fileTypes.map(ft => ft.documentType));

        const fileRes = await pool.query(
          `SELECT 1 FROM data_library_files
           WHERE deal_id = $1::uuid
             AND document_type = ANY($2::text[])
             AND parser_status = 'success'
           LIMIT 1`,
          [dealId, vendorDocTypes],
        );
        return fileRes.rows.length > 0 ? 'complete' : 'incomplete';
      } catch {
        // Fail-open: don't falsely alarm if the query fails (table may not exist yet)
        return 'complete';
      }
    },
  },

  {
    id:       'vendor_data_stale',
    severity: 'advisory',
    title:    'Vendor market data is stale',
    description:
      'The most recent vendor market data upload for this deal has exceeded the ' +
      'vendor\'s declared freshness window. Stale data may not reflect current ' +
      'submarket conditions, which can affect rent comp benchmarks, cap-rate ' +
      'context, and supply pipeline projections.',
    recommendedAction:
      'Upload a fresh vendor export from the Data Library tab. ' +
      'CoStar data is considered stale after 90 days; Yardi Matrix after 120 days.',
    ctaLabel: 'View Freshness Banner',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=financial-engine#vendor-freshness-banner`,

    async evaluate(dealId, _propertyId, pool): Promise<SignalStatus> {
      try {
        const allVendors = vendorRegistry.getAllVendors();

        // Pull the most recent vendor_data_as_of per vendor from observations (primary)
        const obsRes = await pool.query<{
          vendor_id:   string;
          most_recent: string;
        }>(
          `SELECT vendor_id,
                  MAX(COALESCE(vendor_data_as_of, observation_date::date))::text AS most_recent
             FROM vendor_market_observations
            WHERE deal_id = $1::uuid
            GROUP BY vendor_id`,
          [dealId],
        );

        // Collect observation-based staleness
        const staleness = new Map<string, string>(); // vendorId -> mostRecentDate
        for (const row of obsRes.rows) {
          staleness.set(row.vendor_id, row.most_recent);
        }

        // Fallback: also check data_library_files for file-only deals (same as vendor_data_missing)
        // This ensures consistency: if vendor_data_missing uses files, vendor_data_stale should too.
        if (staleness.size === 0) {
          const vendorDocTypes = allVendors.flatMap(v => v.fileTypes.map(ft => ft.documentType));
          const fileRes = await pool.query<{
            document_type: string;
            most_recent:   string;
          }>(
            `SELECT document_type,
                    MAX(created_at)::text AS most_recent
               FROM data_library_files
              WHERE deal_id = $1::uuid
                AND document_type = ANY($2::text[])
                AND parser_status = 'success'
              GROUP BY document_type`,
            [dealId, vendorDocTypes],
          ).catch(() => ({ rows: [] as { document_type: string; most_recent: string }[] }));

          for (const row of fileRes.rows) {
            const vendorEntry = vendorRegistry.getVendorByDocType(row.document_type as any);
            if (!vendorEntry) continue;
            const vid = vendorEntry.vendor.vendorId;
            const existing = staleness.get(vid);
            if (!existing || row.most_recent > existing) {
              staleness.set(vid, row.most_recent);
            }
          }
        }

        if (staleness.size === 0) {
          // No vendor data at all — vendor_data_missing signal covers this case
          return 'complete';
        }

        let anyStale = false;
        for (const [vendorId, mostRecent] of staleness.entries()) {
          const vendor = allVendors.find(v => v.vendorId === vendorId);
          if (!vendor) continue;
          const status = computeFreshnessStatus(vendor.freshnessProfile, mostRecent);
          if (status === 'stale') {
            anyStale = true;
            break;
          }
        }

        return anyStale ? 'incomplete' : 'complete';
      } catch {
        return 'complete';
      }
    },
  },

  {
    id:       'proforma_window_undefined',
    severity: 'warning',
    title:    'Pro Forma window undefined',
    description:
      'The Cashflow Agent could not identify a hold-period year where projected vacancy ' +
      'reaches the stabilization threshold and remains there for all subsequent years. ' +
      'The Pro Forma surface is showing the Year-1 acquisition snapshot, which may significantly ' +
      'understate stabilized operating performance for value-add or lease-up deals.',
    recommendedAction:
      'Run the Cashflow Agent to let it compute the stabilization year from the M07 vacancy ' +
      'trajectory, or manually set the Pro Forma Year override in INPUTS → DISPOSITION & HOLD.',
    ctaLabel: 'Open INPUTS',
    ctaLink:  (dealId) => `/deals/${dealId}?tab=f9&subtab=inputs`,

    async evaluate(dealId, _propertyId, pool): Promise<SignalStatus> {
      try {
        const res = await pool.query(
          `SELECT stabilization_year, stabilization_year_override
             FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
          [dealId],
        );
        if (res.rows.length === 0) return 'complete';
        const row = res.rows[0];
        const effective = row.stabilization_year_override ?? row.stabilization_year;
        return effective == null ? 'incomplete' : 'complete';
      } catch {
        return 'complete';
      }
    },
  },

];

export function getSignalRegistry(): SignalDefinition[] {
  return SIGNAL_REGISTRY;
}
