/**
 * Economic Context Routes
 * Serves assembled macro + labor market context for any deal module.
 *
 * GET /api/v1/economic-context
 *   ?msaId=<msas.id>           optional — MSA-scoped BLS labor data
 *   &businessType=<type>        optional — filter labor to relevant NAICS
 *
 * Returns:
 *   - FRED macro snapshot (latest from m28_rate_environment)
 *   - BLS MSA labor snapshot (latest from msa_economic_snapshot)
 *   - Formatted context block for AI prompt injection
 */
import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// Map business-type strings to BLS CES supersector codes stored in
// msa_economic_snapshot.naics_code. (Legacy 3-digit NAICS codes were
// retired when the ingest moved from QCEW to CES — the QCEW timeseries
// API doesn't expose MSA-level series.)
//   00=Total Nonfarm  20=Construction  30=Manufacturing
//   40=Trade/Transport/Util  50=Information  55=Financial Activities
//   60=Prof & Business Svcs  65=Education & Health  70=Leisure & Hospitality
//   90=Government
const BUSINESS_TYPE_NAICS: Record<string, string[]> = {
  APARTMENT:        ['00', '60', '65'], // total + the supersectors that drive housing demand
  SELF_STORAGE:     ['00', '60'],
  OFFICE:           ['55', '60'],       // financial + professional services
  RETAIL:           ['40', '70'],       // trade + leisure/hospitality
  INDUSTRIAL:       ['30', '40'],       // manufacturing + trade/transport
  HOTEL:            ['70'],             // leisure & hospitality
  HEALTHCARE:       ['65'],             // education & health services
  SENIOR_HOUSING:   ['65'],
  STUDENT_HOUSING:  ['65'],
};

interface MacroSnapshot {
  ffr: number | null;
  sofr: number | null;
  t10y: number | null;
  t30y_mtg: number | null;
  policy_stance: string | null;
  forward_direction: string | null;
  gdp_growth_pct: number | null;
  cpi_yoy_pct: number | null;
  unrate: number | null;
  consumer_sentiment: number | null;
  m2_yoy: number | null;
  dxy: number | null;
  snapshot_date: string | null;
}

interface LaborDataPoint {
  naics_code: string;
  naics_label: string;
  total_employment: number | null;
  yoy_change_pct: number | null;
  avg_weekly_wage: number | null;
  establishment_count: number | null;
  bls_citation_tag: string | null;
}

function formatMacroBlock(macro: MacroSnapshot): string {
  const lines: string[] = [
    '=== MACRO ENVIRONMENT ===',
    `Fed Funds Rate: ${macro.ffr !== null ? macro.ffr + '%' : 'N/A'} [FRED DFF ${macro.snapshot_date ?? ''}]`,
    `SOFR: ${macro.sofr !== null ? macro.sofr + '%' : 'N/A'} [FRED SOFR]`,
    `10Y Treasury: ${macro.t10y !== null ? macro.t10y + '%' : 'N/A'} [FRED DGS10]`,
    `30Y Mortgage: ${macro.t30y_mtg !== null ? macro.t30y_mtg + '%' : 'N/A'} [FRED MORTGAGE30US]`,
    `Policy Stance: ${macro.policy_stance ?? 'Unknown'}`,
    `Rate Direction: ${macro.forward_direction ?? 'Unknown'}`,
  ];

  if (macro.gdp_growth_pct !== null) {
    lines.push(`Real GDP Growth (YoY): ${macro.gdp_growth_pct}% [FRED GDPC1]`);
  }
  if (macro.cpi_yoy_pct !== null) {
    lines.push(`CPI Inflation (YoY): ${macro.cpi_yoy_pct}% [FRED CPIAUCSL]`);
  }
  if (macro.unrate !== null) {
    lines.push(`Unemployment Rate: ${macro.unrate}% [FRED UNRATE]`);
  }
  if (macro.consumer_sentiment !== null) {
    lines.push(`Consumer Sentiment: ${macro.consumer_sentiment} [FRED UMCSENT]`);
  }
  if (macro.m2_yoy !== null) {
    lines.push(`M2 Money Supply (YoY): ${macro.m2_yoy}% [FRED M2SL]`);
  }
  if (macro.dxy !== null) {
    lines.push(`USD Index (DXY): ${macro.dxy} [FRED DTWEXBGS]`);
  }

  return lines.join('\n');
}

function formatLaborBlock(laborRows: LaborDataPoint[], msaName: string): string {
  if (laborRows.length === 0) return '';
  const lines: string[] = [`\n=== LABOR MARKET: ${msaName.toUpperCase()} ===`];
  for (const row of laborRows) {
    const emp = row.total_employment !== null
      ? (row.total_employment / 1000).toFixed(1) + 'k workers'
      : 'N/A';
    const yoy = row.yoy_change_pct !== null
      ? ` (${row.yoy_change_pct >= 0 ? '+' : ''}${row.yoy_change_pct}% YoY)`
      : '';
    const wage = row.avg_weekly_wage !== null
      ? `, avg wage $${row.avg_weekly_wage.toLocaleString()}/wk`
      : '';
    const tag = row.bls_citation_tag ? ` [${row.bls_citation_tag}]` : '';
    lines.push(`${row.naics_label}: ${emp}${yoy}${wage}${tag}`);
  }
  return lines.join('\n');
}

/**
 * GET /api/v1/economic-context
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const msaId = req.query.msaId ? parseInt(req.query.msaId as string) : null;
  const businessType = ((req.query.businessType as string) || '').toUpperCase();

  try {
    // 1. Latest FRED macro snapshot
    const macroResult = await query(
      `SELECT ffr, sofr, t10y, t30y_mtg, policy_stance, forward_direction,
              gdp_growth_pct, cpi_yoy_pct, unrate, consumer_sentiment,
              m2_yoy, dxy, snapshot_date::text
       FROM m28_rate_environment
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      []
    );

    const macro: MacroSnapshot = macroResult.rows[0] ?? {
      ffr: null, sofr: null, t10y: null, t30y_mtg: null,
      policy_stance: null, forward_direction: null,
      gdp_growth_pct: null, cpi_yoy_pct: null,
      unrate: null, consumer_sentiment: null,
      m2_yoy: null, dxy: null, snapshot_date: null,
    };

    // 2. BLS MSA-level labor data (if msaId provided)
    let laborRows: LaborDataPoint[] = [];
    let msaName = '';

    if (msaId) {
      const msaResult = await query(`SELECT name FROM msas WHERE id = $1`, [msaId]);
      msaName = msaResult.rows[0]?.name ?? '';

      const naicsCodes = businessType && BUSINESS_TYPE_NAICS[businessType]
        ? BUSINESS_TYPE_NAICS[businessType]
        : null;

      const laborQuery = naicsCodes
        ? `SELECT naics_code, naics_label, total_employment, yoy_change_pct,
                  avg_weekly_wage, establishment_count, bls_citation_tag
           FROM msa_economic_snapshot
           WHERE msa_id = $1 AND naics_code = ANY($2::text[])
           ORDER BY snapshot_date DESC`
        : `SELECT naics_code, naics_label, total_employment, yoy_change_pct,
                  avg_weekly_wage, establishment_count, bls_citation_tag
           FROM msa_economic_snapshot
           WHERE msa_id = $1
           ORDER BY snapshot_date DESC, naics_code`;

      const laborResult = naicsCodes
        ? await query(laborQuery, [msaId, naicsCodes])
        : await query(laborQuery, [msaId]);

      laborRows = laborResult.rows;
    }

    // 3. Build formatted text block
    const macroBlock = formatMacroBlock(macro);
    const laborBlock = laborRows.length > 0 ? formatLaborBlock(laborRows, msaName) : '';
    const contextBlock = macroBlock + laborBlock;

    return res.json({
      success: true,
      data: {
        macro,
        labor: laborRows,
        msaName,
        contextBlock,
        snapshotDate: macro.snapshot_date,
        hasMacro: macro.ffr !== null,
        hasLabor: laborRows.length > 0,
      },
    });

  } catch (err: any) {
    logger.error('[EconomicContext] GET failed', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
