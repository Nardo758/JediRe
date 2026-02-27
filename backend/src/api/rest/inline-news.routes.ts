import { Router, Request, Response } from 'express';
import pool from '../../database/connection';

const router = Router();

router.get('/events', async (req: Request, res: Response) => {
  try {
    const { category, severity, limit = '50', offset = '0' } = req.query;
    
    let whereConditions: string[] = [];
    const params: any[] = [];
    
    if (category && category !== 'all') {
      params.push(category);
      whereConditions.push(`event_category = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      whereConditions.push(`impact_severity = $${params.length}`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await pool.query(`
      SELECT 
        id, event_category, event_type, event_status,
        source_type, source_name, source_url, source_credibility_score,
        extracted_data, location_raw, city, state,
        impact_analysis, impact_severity, extraction_confidence,
        corroboration_count, early_signal_days,
        published_at
      FROM news_events
      ${whereClause}
      ORDER BY published_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('News events error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch news events' });
  }
});

router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM news_events WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('News event detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
});

router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        na.id, na.event_id, na.alert_type, na.headline, na.summary,
        na.suggested_action, na.severity, na.is_read, na.is_dismissed,
        na.linked_deal_id, na.linked_property_id, na.created_at,
        ne.event_category, ne.event_type, ne.location_raw
      FROM news_alerts na
      LEFT JOIN news_events ne ON na.event_id = ne.id
      ORDER BY na.created_at DESC
      LIMIT 50
    `);
    
    const unreadCount = result.rows.filter(a => !a.is_read).length;
    
    res.json({
      success: true,
      data: result.rows,
      unread_count: unreadCount,
      count: result.rows.length
    });
  } catch (error) {
    console.error('News alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

router.patch('/alerts/:id', async (req: Request, res: Response) => {
  try {
    const { is_read, is_dismissed } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    
    if (is_read !== undefined) {
      params.push(is_read);
      updates.push(`is_read = $${params.length}`);
    }
    if (is_dismissed !== undefined) {
      params.push(is_dismissed);
      updates.push(`is_dismissed = $${params.length}`);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }
    
    params.push(req.params.id);
    await pool.query(
      `UPDATE news_alerts SET ${updates.join(', ')} WHERE id = $${params.length}`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const employmentEvents = await pool.query(`
      SELECT extracted_data FROM news_events 
      WHERE event_category = 'employment'
      ORDER BY published_at DESC
    `);
    
    let inboundJobs = 0, outboundJobs = 0, layoffJobs = 0;
    for (const row of employmentEvents.rows) {
      const data = row.extracted_data || {};
      const jobs = data.estimated_jobs || data.job_count || 0;
      const type = data.event_subtype || '';
      
      if (type.includes('expansion') || type.includes('relocation_in') || type.includes('hiring')) {
        inboundJobs += jobs;
      } else if (type.includes('closure') || type.includes('relocation_out')) {
        outboundJobs += jobs;
      } else if (type.includes('layoff')) {
        layoffJobs += jobs;
      } else {
        inboundJobs += Math.round(jobs * 0.6);
      }
    }
    
    const netJobs = inboundJobs - outboundJobs - layoffJobs;
    const estimatedHousingDemand = Math.round(netJobs * 0.45);
    
    const supplyEvents = await pool.query(`
      SELECT extracted_data FROM news_events 
      WHERE event_category = 'development'
    `);
    
    let pipelineUnits = 0;
    for (const row of supplyEvents.rows) {
      const data = row.extracted_data || {};
      pipelineUnits += data.total_units || data.units || 0;
    }
    
    const transactionEvents = await pool.query(`
      SELECT extracted_data FROM news_events 
      WHERE event_category = 'transactions'
    `);
    
    let txCount = transactionEvents.rows.length;
    let totalCapRate = 0, capRateCount = 0;
    let totalPPU = 0, ppuCount = 0;
    
    for (const row of transactionEvents.rows) {
      const data = row.extracted_data || {};
      if (data.cap_rate) { totalCapRate += data.cap_rate; capRateCount++; }
      if (data.price_per_unit) { totalPPU += data.price_per_unit; ppuCount++; }
    }
    
    res.json({
      success: true,
      data: {
        demand_momentum: {
          inbound_jobs: inboundJobs,
          outbound_jobs: outboundJobs,
          layoff_jobs: layoffJobs,
          net_jobs: netJobs,
          estimated_housing_demand: estimatedHousingDemand,
          momentum_pct: inboundJobs > 0 ? ((netJobs / inboundJobs) * 100) : 0,
        },
        supply_pressure: {
          pipeline_units: pipelineUnits,
          project_count: supplyEvents.rows.length,
          pressure_pct: estimatedHousingDemand > 0 
            ? Math.min(100, (pipelineUnits / estimatedHousingDemand) * 100) 
            : 0,
        },
        transaction_activity: {
          count: txCount,
          avg_cap_rate: capRateCount > 0 ? totalCapRate / capRateCount : null,
          avg_price_per_unit: ppuCount > 0 ? Math.round(totalPPU / ppuCount) : null,
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

router.get('/network', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        contact_name, contact_company, contact_role,
        total_signals, corroborated_signals, credibility_score,
        specialties, last_signal_at
      FROM news_contact_credibility
      ORDER BY credibility_score DESC
      LIMIT 20
    `);
    
    const avgEarlyDays = await pool.query(`
      SELECT AVG(early_signal_days) as avg_days 
      FROM news_events 
      WHERE early_signal_days > 0
    `);
    
    res.json({
      success: true,
      data: {
        contacts: result.rows,
        avg_early_signal_days: parseFloat(avgEarlyDays.rows[0]?.avg_days) || 0
      }
    });
  } catch (error) {
    console.error('Network intel error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch network intelligence' });
  }
});

export default router;
