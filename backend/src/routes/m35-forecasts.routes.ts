/**
 * M35 Forecast Routes
 *
 * GET  /api/v1/m35/events/:id/forecast          — active forecast for an event
 * POST /api/v1/m35/events/:id/forecast/generate  — (re)generate forecast
 * GET  /api/v1/m35/msa/:msaId/active-forecasts   — all active forecasts for MSA
 * GET  /api/v1/m35/deals/:dealId/events          — events + forecasts affecting a deal
 * GET  /api/v1/m35/submarkets/:id/active-forecasts — active forecasts for submarket
 * POST /api/v1/m35/forecasts/run-divergence      — admin: run divergence tracking job
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getPool } from '../database/connection';
import {
  generateForecast,
  getEventForecast,
  getMsaActiveForecasts,
  invalidateForecasts,
  runDivergenceTrackingJob,
} from '../services/m35-forecast.service';

const router = Router();

// ─── Get active forecast for an event ────────────────────────────────────────

router.get('/events/:id/forecast', async (req: Request, res: Response) => {
  try {
    const forecast = await getEventForecast(req.params.id);
    if (!forecast) return res.status(404).json({ error: 'Event not found or no active forecast' });
    res.json({ forecast });
  } catch (err) {
    logger.error('[M35 Forecasts] Error fetching forecast:', err);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

// ─── (Re)generate forecast for an event ──────────────────────────────────────

router.post('/events/:id/forecast/generate', async (req: Request, res: Response) => {
  try {
    const rows = await generateForecast(req.params.id);
    if (rows.length === 0) {
      return res.status(422).json({
        error: 'Could not generate forecast — no playbook found for this event subtype',
        eventId: req.params.id,
      });
    }
    const forecast = await getEventForecast(req.params.id);
    res.json({ forecast, generated: rows.length });
  } catch (err) {
    logger.error('[M35 Forecasts] Error generating forecast:', err);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// ─── All active forecasts for an MSA ─────────────────────────────────────────

router.get('/msa/:msaId/active-forecasts', async (req: Request, res: Response) => {
  try {
    const forecasts = await getMsaActiveForecasts(req.params.msaId);
    res.json({ forecasts, count: forecasts.length });
  } catch (err) {
    logger.error('[M35 Forecasts] Error fetching MSA forecasts:', err);
    res.status(500).json({ error: 'Failed to fetch MSA forecasts' });
  }
});

// ─── Events + forecasts affecting a deal ─────────────────────────────────────

router.get('/deals/:dealId/events', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Resolve deal's MSA from deal_data or properties
    const dealRes = await pool.query(`
      SELECT d.id, d.name,
             p.city, p.state,
             d.deal_data->>'msaId' AS msa_id_from_deal,
             d.deal_data->>'submarketId' AS submarket_id_from_deal
      FROM deals d
      LEFT JOIN deal_properties dp ON dp.deal_id = d.id AND dp.is_primary = true
      LEFT JOIN properties p ON p.id = dp.property_id
      WHERE d.id = $1
      LIMIT 1
    `, [req.params.dealId]);

    if (!dealRes.rows[0]) return res.status(404).json({ error: 'Deal not found' });

    const deal = dealRes.rows[0];
    const msaId = deal.msa_id_from_deal ?? null;

    if (!msaId) {
      return res.json({ events: [], forecasts: [], message: 'No MSA resolved for this deal' });
    }

    const forecasts = await getMsaActiveForecasts(msaId);
    const events = await pool.query(`
      SELECT id, name, category, subtype, status, announced_date, magnitude_value, magnitude_unit, confidence
      FROM key_events
      WHERE msa_id = $1 AND status IN ('announced', 'in_progress', 'materialized')
      ORDER BY announced_date DESC
      LIMIT 20
    `, [msaId]);

    res.json({ dealId: req.params.dealId, msaId, events: events.rows, forecasts });
  } catch (err) {
    logger.error('[M35 Forecasts] Error fetching deal events:', err);
    res.status(500).json({ error: 'Failed to fetch deal events' });
  }
});

// ─── Active forecasts for a submarket ────────────────────────────────────────

router.get('/submarkets/:id/active-forecasts', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const eventsRes = await pool.query(`
      SELECT DISTINCT ke.id
      FROM key_events ke
      JOIN event_forecasts ef ON ef.event_id = ke.id AND ef.status = 'active'
      WHERE ke.submarket_id = $1
        AND ke.status IN ('announced', 'in_progress', 'materialized')
    `, [req.params.id]);

    const forecasts = [];
    for (const ev of eventsRes.rows) {
      const f = await getEventForecast(ev.id);
      if (f) forecasts.push(f);
    }
    res.json({ forecasts, count: forecasts.length });
  } catch (err) {
    logger.error('[M35 Forecasts] Error fetching submarket forecasts:', err);
    res.status(500).json({ error: 'Failed to fetch submarket forecasts' });
  }
});

// ─── M09 ProForma: event attribution for Platform-layer assumptions ──────────

router.get('/deals/:dealId/assumption-attribution', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    const dealRes = await pool.query(
      `SELECT deal_data->>'msaId' AS msa_id, deal_data->>'submarketId' AS submarket_id
       FROM deals WHERE id = $1 LIMIT 1`,
      [req.params.dealId]
    );
    if (!dealRes.rows[0]) return res.status(404).json({ error: 'Deal not found' });

    const msaId: string | null = dealRes.rows[0].msa_id ?? null;
    if (!msaId) return res.json({ rentGrowth: null, vacancy: null, exitCap: null });

    const forecasts = await getMsaActiveForecasts(msaId);

    function pickAttribution(metricKey: string) {
      for (const f of forecasts) {
        const m = f.metrics
          .filter(m2 => m2.metricKey === metricKey && m2.pointEstimate !== null)
          .sort((a, b) => b.confidence - a.confidence)[0];
        if (m) {
          return {
            eventId: f.eventId,
            eventName: f.eventName,
            playbookSubtype: f.subtype,
            metricKey,
            windowMonths: m.windowMonths,
            pointEstimate: m.pointEstimate,
            ciLow: m.ciLow,
            ciHigh: m.ciHigh,
            confidence: m.confidence,
          };
        }
      }
      return null;
    }

    res.json({
      dealId: req.params.dealId,
      msaId,
      rentGrowth: pickAttribution('rent_growth_yoy'),
      vacancy:    pickAttribution('vacancy_rate'),
      exitCap:    pickAttribution('cap_rate'),
    });
  } catch (err) {
    logger.error('[M35 Forecasts] Error fetching assumption attribution:', err);
    res.status(500).json({ error: 'Failed to fetch assumption attribution' });
  }
});

// ─── Admin: Run divergence tracking job ──────────────────────────────────────

router.post('/forecasts/run-divergence', async (req: Request, res: Response) => {
  try {
    const result = await runDivergenceTrackingJob();
    res.json({ message: 'Divergence tracking complete', ...result });
  } catch (err) {
    logger.error('[M35 Forecasts] Error running divergence job:', err);
    res.status(500).json({ error: 'Failed to run divergence job' });
  }
});

export default router;
