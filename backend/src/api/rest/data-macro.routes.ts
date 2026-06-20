import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../utils/logger';

/**
 * Macro Data Freshness API
 *
 * Provides staleness information for macro indicators used in underwriting.
 * The frontend (F9) consumes this to show a "stale data" badge when
 * CPI (or other macro feeds) is older than a configurable threshold.
 */

const router = Router();
router.use(requireAuth);

const STALE_THRESHOLD_DAYS = 30; // configurable per metric

interface FreshnessResult {
  metricId: string;
  label: string;
  lastPeriodDate: string | null;  // YYYY-MM-DD of most recent data point
  lastUpdated: string | null;     // when the row was inserted/updated
  daysOld: number;
  isStale: boolean;
  thresholdDays: number;
  currentValue: number | null;
  confidence: 'high' | 'medium' | 'low';
  warning: string | null;
}

/**
 * GET /api/v1/data-macro/freshness
 *
 * Returns staleness status for all tracked macro indicators.
 * Currently tracks:
 *   - MACRO_CPI_OFFICIAL (used by OPEX anchors)
 *   - MACRO_FED_FUNDS_RATE (used by debt sizing)
 *   - MACRO_UNEMPLOYMENT (used by demand signals)
 */
router.get('/freshness', async (req, res) => {
  try {
    const metrics: FreshnessResult[] = [];

    // ── CPI Official ──────────────────────────────────────────────────────
    const cpi = await query(
      `SELECT period_date, value, updated_at
       FROM metric_time_series
       WHERE metric_id = 'MACRO_CPI_OFFICIAL'
         AND geography_type = 'national'
       ORDER BY period_date DESC
       LIMIT 1`
    );

    if (cpi.rows.length > 0) {
      const row = cpi.rows[0];
      const periodDate = new Date(row.period_date);
      const now = new Date();
      const daysOld = Math.floor((now.getTime() - periodDate.getTime()) / (1000 * 60 * 60 * 24));
      const isStale = daysOld > STALE_THRESHOLD_DAYS;
      const value = parseFloat(row.value) ?? null;

      metrics.push({
        metricId: 'MACRO_CPI_OFFICIAL',
        label: 'CPI (Consumer Price Index)',
        lastPeriodDate: row.period_date.toISOString().slice(0, 10),
        lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : null,
        daysOld,
        isStale,
        thresholdDays: STALE_THRESHOLD_DAYS,
        currentValue: value != null ? parseFloat(value.toFixed(2)) : null,
        confidence: isStale ? 'low' : daysOld > 14 ? 'medium' : 'high',
        warning: isStale
          ? `CPI data is ${daysOld} days old. OPEX anchors may be using stale inflation assumptions.`
          : null,
      });
    } else {
      metrics.push({
        metricId: 'MACRO_CPI_OFFICIAL',
        label: 'CPI (Consumer Price Index)',
        lastPeriodDate: null,
        lastUpdated: null,
        daysOld: Infinity,
        isStale: true,
        thresholdDays: STALE_THRESHOLD_DAYS,
        currentValue: null,
        confidence: 'low',
        warning: 'No CPI data available. OPEX anchors using fallback defaults.',
      });
    }

    // ── Fed Funds Rate ────────────────────────────────────────────────────
    const fed = await query(
      `SELECT period_date, value, updated_at
       FROM metric_time_series
       WHERE metric_id = 'MACRO_FED_FUNDS_RATE'
         AND geography_type = 'national'
       ORDER BY period_date DESC
       LIMIT 1`
    );

    if (fed.rows.length > 0) {
      const row = fed.rows[0];
      const periodDate = new Date(row.period_date);
      const now = new Date();
      const daysOld = Math.floor((now.getTime() - periodDate.getTime()) / (1000 * 60 * 60 * 24));
      const isStale = daysOld > STALE_THRESHOLD_DAYS;
      const value = parseFloat(row.value) ?? null;

      metrics.push({
        metricId: 'MACRO_FED_FUNDS_RATE',
        label: 'Fed Funds Rate',
        lastPeriodDate: row.period_date.toISOString().slice(0, 10),
        lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : null,
        daysOld,
        isStale,
        thresholdDays: STALE_THRESHOLD_DAYS,
        currentValue: value != null ? parseFloat(value.toFixed(2)) : null,
        confidence: isStale ? 'low' : daysOld > 14 ? 'medium' : 'high',
        warning: isStale
          ? `Fed Funds data is ${daysOld} days old. Interest rate assumptions may be stale.`
          : null,
      });
    } else {
      metrics.push({
        metricId: 'MACRO_FED_FUNDS_RATE',
        label: 'Fed Funds Rate',
        lastPeriodDate: null,
        lastUpdated: null,
        daysOld: Infinity,
        isStale: true,
        thresholdDays: STALE_THRESHOLD_DAYS,
        currentValue: null,
        confidence: 'low',
        warning: 'No Fed Funds data available. Interest rate assumptions using fallback.',
      });
    }

    res.json({
      success: true,
      computedAt: new Date().toISOString(),
      metrics,
    });
  } catch (error) {
    logger.error('Macro freshness endpoint error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
