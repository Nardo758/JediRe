/**
 * Dashboard API Routes
 * Key Findings feed - mission control intelligence
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { query } from '../../database/connection';

const logger = { error: (...args: any[]) => console.error(...args) };

const router = Router();

interface Finding {
  id: string;
  type: 'news' | 'property' | 'market' | 'deal';
  priority: 'urgent' | 'important' | 'info';
  title: string;
  description: string;
  timestamp: string;
  link: string;
  metadata?: any;
}

/**
 * GET /api/v1/dashboard/findings
 * Get all key findings for the dashboard feed
 */
router.get('/findings', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { category } = req.query; // 'news', 'properties', 'market', 'deals', or 'all'

    // Initialize results
    const results: {
      news: Finding[];
      properties: Finding[];
      market: Finding[];
      deals: Finding[];
    } = {
      news: [],
      properties: [],
      market: [],
      deals: [],
    };

    // Fetch News Intelligence findings
    if (!category || category === 'all' || category === 'news') {
      const newsResult = await query(
        `SELECT 
          ne.id,
          ne.event_type,
          ne.event_category,
          ne.impact_severity,
          ne.location_raw,
          ne.extracted_data,
          ne.published_at,
          COUNT(DISTINCT negi.deal_id) as affected_deals
        FROM news_events ne
        LEFT JOIN news_event_geo_impacts negi ON negi.event_id = ne.id
        LEFT JOIN deals d ON d.id = negi.deal_id
        WHERE (ne.source_type = 'public' OR ne.source_user_id = $1)
          AND ne.published_at > NOW() - INTERVAL '7 days'
          AND (d.user_id = $1 OR d.user_id IS NULL)
        GROUP BY ne.id
        HAVING COUNT(DISTINCT negi.deal_id) > 0 OR ne.impact_severity IN ('high', 'critical')
        ORDER BY 
          CASE ne.impact_severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'significant' THEN 3 
            ELSE 4 
          END,
          ne.published_at DESC
        LIMIT 5`,
        [userId]
      );

      results.news = newsResult.rows.map(row => {
        const extractedData = row.extracted_data || {};
        const description = extractedData.summary || 
          `${formatEventType(row.event_type)} in ${row.location_raw}`;
        
        return {
          id: row.id,
          type: 'news',
          priority: getPriorityFromSeverity(row.impact_severity),
          title: extractedData.headline || formatEventType(row.event_type),
          description: description.substring(0, 150) + (description.length > 150 ? '...' : ''),
          timestamp: row.published_at,
          link: `/news-intel?event=${row.id}`,
          metadata: {
            category: row.event_category,
            affectedDeals: row.affected_deals,
            location: row.location_raw,
          },
        };
      });
    }

    // Fetch Property Alerts (AI-flagged opportunities)
    if (!category || category === 'all' || category === 'properties') {
      // Mock for now - will be replaced with actual AI flagging system
      const propertyResult = await query(
        `SELECT 
          p.id,
          p.address_line1,
          p.city,
          p.state,
          p.property_type,
          p.created_at,
          p.metadata
        FROM properties p
        WHERE p.user_id = $1
          AND p.created_at > NOW() - INTERVAL '30 days'
        ORDER BY p.created_at DESC
        LIMIT 5`,
        [userId]
      );

      results.properties = propertyResult.rows.map(row => ({
        id: row.id,
        type: 'property',
        priority: 'info', // AI will determine this based on scoring
        title: `New opportunity: ${row.address_line1}`,
        description: `${row.property_type} in ${row.city}, ${row.state}`,
        timestamp: row.created_at,
        link: `/properties/${row.id}`,
        metadata: {
          address: row.address_line1,
          city: row.city,
          state: row.state,
          propertyType: row.property_type,
        },
      }));
    }

    // Fetch Market Signals (significant changes)
    if (!category || category === 'all' || category === 'market') {
      const marketResult = await query(
        `SELECT 
          d.id as deal_id,
          d.name as deal_name,
          d.city,
          d.state,
          md.metric_type,
          md.current_value,
          md.previous_value,
          md.change_pct,
          md.updated_at
        FROM deals d
        LEFT JOIN LATERAL (
          SELECT 
            'rent' as metric_type,
            100 as current_value,
            90 as previous_value,
            11.1 as change_pct,
            NOW() - INTERVAL '1 day' as updated_at
          WHERE d.user_id = $1
          LIMIT 1
        ) md ON true
        WHERE d.user_id = $1
          AND md.change_pct IS NOT NULL
          AND ABS(md.change_pct) >= 10
        ORDER BY ABS(md.change_pct) DESC
        LIMIT 5`,
        [userId]
      );

      results.market = marketResult.rows.map(row => {
        const isPositive = row.change_pct > 0;
        const direction = isPositive ? 'up' : 'down';
        const priority = Math.abs(row.change_pct) >= 15 ? 'urgent' : 'important';
        
        return {
          id: `market-${row.deal_id}-${row.metric_type}`,
          type: 'market',
          priority: priority,
          title: `${row.metric_type} ${direction} ${Math.abs(row.change_pct).toFixed(1)}% in ${row.deal_name}`,
          description: `Market ${row.metric_type} changed from $${row.previous_value} to $${row.current_value} in ${row.city}, ${row.state}`,
          timestamp: row.updated_at,
          link: `/deals/${row.deal_id}?tab=market`,
          metadata: {
            dealId: row.deal_id,
            dealName: row.deal_name,
            metric: row.metric_type,
            change: row.change_pct,
          },
        };
      });
    }

    // Fetch Deal Alerts (stalled deals or requiring decisions)
    if (!category || category === 'all' || category === 'deals') {
      const dealsResult = await query(
        `SELECT 
          d.id,
          d.name,
          d.status,
          d.updated_at,
          d.metadata,
          COUNT(t.id) as pending_tasks
        FROM deals d
        LEFT JOIN tasks t ON t.deal_id = d.id AND t.status != 'completed'
        WHERE d.user_id = $1
          AND (
            d.status IN ('STALLED', 'PENDING_DECISION')
            OR (d.updated_at < NOW() - INTERVAL '14 days' AND d.status NOT IN ('CLOSED', 'PASSED'))
            OR COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'completed') > 0
          )
        GROUP BY d.id
        ORDER BY 
          CASE d.status 
            WHEN 'STALLED' THEN 1 
            WHEN 'PENDING_DECISION' THEN 2 
            ELSE 3 
          END,
          d.updated_at ASC
        LIMIT 5`,
        [userId]
      );

      results.deals = dealsResult.rows.map(row => {
        let title = '';
        let description = '';
        let priority: 'urgent' | 'important' | 'info' = 'info';

        if (row.status === 'STALLED') {
          title = `Deal stalled: ${row.name}`;
          description = 'No activity in 14+ days. Review status and next steps.';
          priority = 'urgent';
        } else if (row.status === 'PENDING_DECISION') {
          title = `Decision needed: ${row.name}`;
          description = 'Deal awaiting your decision to proceed.';
          priority = 'urgent';
        } else if (row.pending_tasks > 0) {
          title = `${row.pending_tasks} overdue tasks: ${row.name}`;
          description = 'Tasks are past due. Review and update progress.';
          priority = 'important';
        } else {
          title = `No recent updates: ${row.name}`;
          description = 'Deal has been inactive for 14+ days.';
          priority = 'info';
        }

        return {
          id: row.id,
          type: 'deal',
          priority: priority,
          title: title,
          description: description,
          timestamp: row.updated_at,
          link: `/deals/${row.id}`,
          metadata: {
            status: row.status,
            pendingTasks: row.pending_tasks,
          },
        };
      });
    }

    // Return all findings
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching dashboard findings:', error);
    next(error);
  }
});

/**
 * GET /api/v1/dashboard/assets
 * Get portfolio properties (owned/managed assets) with performance metrics
 */
router.get('/assets', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    // Query deals where deal_category = 'portfolio' AND state = 'POST_CLOSE'
    // For MVP: Using mock performance data
    const result = await query(
      `SELECT 
        d.id as deal_id,
        d.name,
        d.project_type as type,
        d.target_units as units,
        COALESCE(d.address, 'Address TBD') as address,
        
        -- Performance metrics (MVP: mock data - can wire to real data later)
        ROUND((88 + RANDOM() * 10)::numeric, 1) as occupancy_rate,
        ROUND(d.budget * (0.06 + RANDOM() * 0.02)) as noi,
        ROUND(d.budget * 0.065) as budget_noi,
        ROUND(d.budget * (0.005 + RANDOM() * 0.01)) as monthly_cash_flow,
        ROUND(((RANDOM() * 20) - 5)::numeric, 1) as budget_variance,
        
        -- Cash-on-cash return
        ROUND((6 + RANDOM() * 6)::numeric, 1) as coc_return,
        
        -- Performance status based on variance
        CASE 
          WHEN RANDOM() > 0.7 THEN 'On Target'
          WHEN RANDOM() > 0.4 THEN 'Watch'
          ELSE 'Alert'
        END as status,
        
        d.created_at
        
      FROM deals d
      WHERE d.user_id = $1
        AND d.deal_category = 'portfolio'
        AND d.state = 'POST_CLOSE'
        AND d.archived_at IS NULL
      ORDER BY d.created_at DESC`,
      [userId]
    );
    
    // Calculate summary stats
    const assets = result.rows;
    const totalAssets = assets.length;
    const totalUnits = assets.reduce((sum, a) => sum + (Number(a.units) || 0), 0);
    const avgOccupancy = totalAssets > 0 
      ? (assets.reduce((sum, a) => sum + (Number(a.occupancy_rate) || 0), 0) / totalAssets).toFixed(1)
      : '0.0';
    const portfolioNOI = assets.reduce((sum, a) => sum + (Number(a.noi) || 0), 0);
    
    res.json({
      success: true,
      assets: assets,
      summary: {
        totalAssets,
        totalUnits,
        avgOccupancy: parseFloat(avgOccupancy),
        portfolioNOI: Math.round(portfolioNOI)
      }
    });
    
  } catch (error) {
    logger.error('[Dashboard] Assets error:', error);
    next(error);
  }
});

/**
 * Helper functions
 */
function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPriorityFromSeverity(severity: string): 'urgent' | 'important' | 'info' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'urgent';
    case 'significant':
    case 'moderate':
      return 'important';
    default:
      return 'info';
  }
}

export default router;
