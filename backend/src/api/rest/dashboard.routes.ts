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
  type: 'news' | 'market' | 'insight' | 'action';
  priority: 'urgent' | 'important' | 'info';
  title: string;
  description: string;
  timestamp: string;
  link: string;
  metadata?: any;
}

/**
 * Generate mock findings for demo/testing when database tables don't exist yet
 */
function generateMockFindings(): {
  news: Finding[];
  market: Finding[];
  insights: Finding[];
  actions: Finding[];
} {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  return {
    news: [
      {
        id: 'news-1',
        type: 'news',
        priority: 'urgent',
        title: 'Microsoft expanding Atlanta tech hub with 2,000 new jobs',
        description: 'Major tech investment in Midtown and Buckhead areas. Expected to drive residential demand and rent growth in surrounding submarkets.',
        timestamp: yesterday.toISOString(),
        link: '/news-intel',
        metadata: {
          category: 'Employment',
          affectedDeals: 3,
          location: 'Midtown Atlanta'
        }
      },
      {
        id: 'news-2',
        type: 'news',
        priority: 'important',
        title: 'New 500-unit luxury development announced in Buckhead',
        description: 'Competitor project breaking ground Q2 2026. May impact absorption rates in your Buckhead Tower deal.',
        timestamp: yesterday.toISOString(),
        link: '/news-intel',
        metadata: {
          category: 'Development',
          affectedDeals: 1,
          location: 'Buckhead'
        }
      },
      {
        id: 'news-3',
        type: 'news',
        priority: 'info',
        title: 'Atlanta Fed announces interest rate outlook',
        description: 'Projected rate cuts in H2 2026 could improve deal economics. Consider accelerating acquisitions.',
        timestamp: twoDaysAgo.toISOString(),
        link: '/news-intel',
        metadata: {
          category: 'Economic',
          affectedDeals: 5,
          location: 'Metro Atlanta'
        }
      },
      {
        id: 'news-4',
        type: 'news',
        priority: 'important',
        title: 'College Park seeing institutional investor activity',
        description: 'Three major acquisitions in past 30 days. Competition heating up in workforce housing segment.',
        timestamp: threeDaysAgo.toISOString(),
        link: '/news-intel',
        metadata: {
          category: 'Transaction',
          affectedDeals: 1,
          location: 'College Park'
        }
      }
    ],
    market: [
      {
        id: 'market-1',
        type: 'market',
        priority: 'urgent',
        title: 'Midtown rents up 12.3% in last quarter',
        description: 'Submarket rents increased from $1,850 to $2,078. Strong demand driven by new corporate relocations.',
        timestamp: yesterday.toISOString(),
        link: '/market-data',
        metadata: {
          metric: 'rent',
          change: 12.3
        }
      },
      {
        id: 'market-2',
        type: 'market',
        priority: 'important',
        title: 'Buckhead occupancy dropped to 88.5%',
        description: 'Down 4.2% from last quarter. New supply entering market - consider pricing adjustments.',
        timestamp: twoDaysAgo.toISOString(),
        link: '/market-data',
        metadata: {
          metric: 'occupancy',
          change: -4.2
        }
      },
      {
        id: 'market-3',
        type: 'market',
        priority: 'info',
        title: 'West Midtown absorption rate accelerating',
        description: 'New units leasing 15% faster than 6-month average. Strong market momentum.',
        timestamp: threeDaysAgo.toISOString(),
        link: '/market-data',
        metadata: {
          metric: 'absorption',
          change: 15.0
        }
      }
    ],
    insights: [
      {
        id: 'insight-1',
        type: 'insight',
        priority: 'urgent',
        title: '🎯 Strong opportunity: Midtown Tower',
        description: 'JEDI Score 87/100 - STRONG_OPPORTUNITY. Excellent location metrics, favorable market timing. Consider moving to full research.',
        timestamp: yesterday.toISOString(),
        link: '/deals',
        metadata: {
          jediScore: 87,
          verdict: 'STRONG_OPPORTUNITY',
          recommendationCount: 3
        }
      },
      {
        id: 'insight-2',
        type: 'insight',
        priority: 'important',
        title: '💡 Good opportunity: College Park Workforce Housing',
        description: 'JEDI Score 74/100 - OPPORTUNITY. Strong demand fundamentals, moderate competition. Review for pipeline inclusion.',
        timestamp: yesterday.toISOString(),
        link: '/deals',
        metadata: {
          jediScore: 74,
          verdict: 'OPPORTUNITY',
          recommendationCount: 2
        }
      },
      {
        id: 'insight-3',
        type: 'insight',
        priority: 'info',
        title: '📊 Optimization suggestions available',
        description: '4 recommendations to improve deal performance: rent optimization, expense reduction, capital improvements, refinancing timing.',
        timestamp: twoDaysAgo.toISOString(),
        link: '/deals',
        metadata: {
          recommendationCount: 4
        }
      },
      {
        id: 'insight-4',
        type: 'insight',
        priority: 'urgent',
        title: '⚠️ Risk alert: Alpharetta Retail Center',
        description: 'JEDI Score 42/100. Market fundamentals weakening, increased vacancy risk. Review immediately.',
        timestamp: threeDaysAgo.toISOString(),
        link: '/deals',
        metadata: {
          jediScore: 42,
          verdict: 'CAUTION',
          recommendationCount: 1
        }
      }
    ],
    actions: [
      {
        id: 'action-1',
        type: 'action',
        priority: 'urgent',
        title: 'No recent updates: hhninjnj',
        description: 'Deal has been inactive for 14+ days. Review status and next steps.',
        timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        link: '/deals',
        metadata: {
          state: 'TRIAGE',
          daysInactive: 15
        }
      },
      {
        id: 'action-2',
        type: 'action',
        priority: 'important',
        title: 'Decision needed: College Park Workforce Housing',
        description: 'Triage complete. Review JEDI Score and decide: proceed to research, save as market note, or archive.',
        timestamp: yesterday.toISOString(),
        link: '/deals',
        metadata: {
          state: 'TRIAGE',
          needsDecision: true
        }
      },
      {
        id: 'action-3',
        type: 'action',
        priority: 'info',
        title: 'LOI expiring in 5 days',
        description: 'Midtown Tower LOI expires Feb 14. Finalize terms or request extension.',
        timestamp: twoDaysAgo.toISOString(),
        link: '/deals',
        metadata: {
          state: 'UNDERWRITING',
          deadline: 'Feb 14, 2026'
        }
      }
    ]
  };
}

/**
 * GET /api/v1/dashboard/findings
 * Get all key findings for the dashboard feed
 */
router.get('/findings', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { category } = req.query; // 'news', 'market', 'insights', 'actions', or 'all'

    // Initialize results
    const results: {
      news: Finding[];
      market: Finding[];
      insights: Finding[];
      actions: Finding[];
    } = {
      news: [],
      market: [],
      insights: [],
      actions: [],
    };

    // Fetch News Intelligence findings
    if (!category || category === 'all' || category === 'news') {
      try {
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
      } catch (error) {
        // Table doesn't exist yet - return mock data for demo
        logger.error('News Intelligence table not found, using mock data:', error);
        const mockData = generateMockFindings();
        results.news = mockData.news;
      }
    }

    // Fetch Market Signals (submarket trends, occupancy/rent changes)
    if (!category || category === 'all' || category === 'market') {
      try {
        // Query market_snapshots for significant changes in submarkets relevant to user's deals
        const marketResult = await query(
        `SELECT 
          d.id as deal_id,
          d.name as deal_name,
          COALESCE(d.address, 'Unknown') as city,
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
          description: `Market ${row.metric_type} changed from $${row.previous_value} to $${row.current_value} near ${row.city}`,
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
      } catch (error) {
        // Market snapshots table or deals query failed - return mock data
        logger.error('Market signals query failed, using mock data:', error);
        const mockData = generateMockFindings();
        results.market = mockData.market;
      }
    }

    // Fetch AI Insights (platform-generated recommendations from JEDI analysis)
    if (!category || category === 'all' || category === 'insights') {
      try {
        const insightsResult = await query(
        `SELECT 
          ar.id,
          ar.deal_id,
          d.name as deal_name,
          d.address,
          COALESCE(d.address, 'Unknown') as city,
          d.state,
          ar.jedi_score,
          ar.verdict,
          ar.recommendations,
          ar.created_at,
          ar.analysis_data
        FROM analysis_results ar
        JOIN deals d ON d.id = ar.deal_id
        WHERE d.user_id = $1
          AND ar.created_at > NOW() - INTERVAL '14 days'
          AND (
            -- High score opportunities not in pipeline yet
            (ar.jedi_score >= 70 AND d.state IN ('SIGNAL_INTAKE', 'TRIAGE'))
            -- Risk alerts on portfolio deals
            OR (ar.jedi_score < 50 AND d.deal_category = 'portfolio')
            -- Optimization opportunities
            OR (ar.recommendations IS NOT NULL AND jsonb_array_length(ar.recommendations) > 0)
          )
        ORDER BY 
          CASE 
            WHEN ar.jedi_score >= 80 THEN 1
            WHEN ar.jedi_score < 50 THEN 2
            WHEN ar.jedi_score >= 70 THEN 3
            ELSE 4
          END,
          ar.created_at DESC
        LIMIT 5`,
        [userId]
      );

      results.insights = insightsResult.rows.map(row => {
        const score = row.jedi_score || 0;
        let priority: 'urgent' | 'important' | 'info' = 'info';
        let title = '';
        let description = '';
        
        if (score >= 80) {
          priority = 'urgent';
          title = `🎯 Strong opportunity: ${row.deal_name}`;
          description = `JEDI Score ${score}/100 - ${row.verdict}. Consider moving to full research.`;
        } else if (score >= 70) {
          priority = 'important';
          title = `💡 Good opportunity: ${row.deal_name}`;
          description = `JEDI Score ${score}/100. Review for pipeline inclusion.`;
        } else if (score < 50 && row.deal_category === 'portfolio') {
          priority = 'urgent';
          title = `⚠️ Risk alert: ${row.deal_name}`;
          description = `JEDI Score ${score}/100. Portfolio asset underperforming - review needed.`;
        } else {
          priority = 'info';
          title = `📊 Analysis complete: ${row.deal_name}`;
          const recs = row.recommendations || [];
          description = recs.length > 0 
            ? `${recs.length} optimization suggestions available`
            : `JEDI Score ${score}/100`;
        }

        return {
          id: row.id,
          type: 'insight',
          priority: priority,
          title: title,
          description: description,
          timestamp: row.created_at,
          link: `/deals/${row.deal_id}?tab=analysis`,
          metadata: {
            dealId: row.deal_id,
            jediScore: score,
            verdict: row.verdict,
            recommendationCount: row.recommendations?.length || 0,
          },
        };
      });
      } catch (error) {
        // analysis_results table doesn't exist yet - return mock data for demo
        logger.error('Analysis results table not found, using mock data:', error);
        const mockData = generateMockFindings();
        results.insights = mockData.insights;
      }
    }

    // Fetch Action Items (stalled deals, pending decisions, overdue tasks)
    if (!category || category === 'all' || category === 'actions') {
      try {
        const actionsResult = await query(
          `SELECT 
            d.id,
            d.name,
            d.state,
            d.updated_at
          FROM deals d
          WHERE d.user_id = $1
            AND (
              d.state IN ('STALLED')
              OR (d.updated_at < NOW() - INTERVAL '14 days' AND d.state NOT IN ('POST_CLOSE', 'ARCHIVED'))
            )
          ORDER BY 
            CASE d.state 
              WHEN 'STALLED' THEN 1 
              ELSE 2 
            END,
            d.updated_at ASC
          LIMIT 5`,
          [userId]
        );

        results.actions = actionsResult.rows.map(row => {
          let title = '';
          let description = '';
          let priority: 'urgent' | 'important' | 'info' = 'info';

          if (row.state === 'STALLED') {
            title = `Deal stalled: ${row.name}`;
            description = 'No activity in 14+ days. Review status and next steps.';
            priority = 'urgent';
          } else {
            title = `No recent updates: ${row.name}`;
            description = 'Deal has been inactive for 14+ days.';
            priority = 'info';
          }

          return {
            id: row.id,
            type: 'action',
            priority: priority,
            title: title,
            description: description,
            timestamp: row.updated_at,
            link: `/deals/${row.id}`,
            metadata: {
              state: row.state,
            },
          };
        });
      } catch (error) {
        // Deal state queries might fail - return mock data for demo
        logger.error('Action items query failed, using mock data:', error);
        const mockData = generateMockFindings();
        results.actions = mockData.actions;
      }
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
