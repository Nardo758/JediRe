/**
 * Scheduled Discovery Jobs
 * 
 * Automated data discovery that runs on schedules:
 * - Hourly: Interest rates, REIT prices
 * - Daily: News scan, employment data
 * - Weekly: Population/demographic updates
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { inngest } from '../../lib/inngest';
import { discoveryEngine } from './discovery-engine';
import { eventDispatcher } from '../agents/event-dispatcher';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { fetchCreTradePressFeeds } from './sources/cre-rss';

// ============================================================================
// HOURLY DISCOVERY
// ============================================================================

/**
 * Hourly market data refresh
 * - Interest rates (SOFR, Fed Funds, Treasury)
 * - REIT prices
 */
export const hourlyMarketDiscovery = inngest.createFunction(
  { id: 'discovery-hourly-market', name: 'Hourly Market Discovery' , triggers: [{ cron: '15 * * * *' }] }, // 15 minutes past every hour
  async ({ step }) => {
    logger.info('Starting hourly market discovery');

    // Interest rates
    const rates = await step.run('discover-rates', async () => {
      return await discoveryEngine.discoverInterestRates();
    });

    // Check for significant rate changes
    if (rates.sofr || rates.fedFunds) {
      await step.run('check-rate-changes', async () => {
        const previousRates = await query(
          `SELECT data FROM discovery_cache 
           WHERE source_id = 'fred' AND endpoint_id = 'series'
           ORDER BY fetched_at DESC LIMIT 1`
        );

        // If rates changed significantly (>10bps), alert
        // This would trigger market_data_changed event
        if (previousRates.rows.length > 0) {
          const prev = previousRates.rows[0].data;
          // Compare and potentially dispatch event
        }
      });
    }

    // REIT prices
    const reitPrices = await step.run('discover-reits', async () => {
      return await discoveryEngine.discoverREITPrices();
    });

    // Store summary
    await step.run('store-summary', async () => {
      await query(
        `INSERT INTO market_data_snapshots (snapshot_type, data, created_at)
         VALUES ('hourly', $1, NOW())`,
        [JSON.stringify({ rates, reitPrices })]
      );
    });

    return { rates: Object.keys(rates).length, reits: Object.keys(reitPrices).length };
  }
);

// ============================================================================
// DAILY DISCOVERY
// ============================================================================

/**
 * Daily news discovery
 * Scans news for real estate relevant topics
 */
export const dailyNewsDiscovery = inngest.createFunction(
  { id: 'discovery-daily-news', name: 'Daily News Discovery' , triggers: [{ cron: '0 6 * * *' }] }, // 6 AM daily
  async ({ step }) => {
    logger.info('Starting daily news discovery');

    const topics = [
      // General real estate
      'multifamily real estate market',
      'apartment rent growth',
      'commercial real estate lending',
      'CMBS market',
      'agency lending multifamily',
      
      // Economic
      'federal reserve interest rates',
      'employment report',
      'inflation CPI',
      
      // Major markets
      'Atlanta multifamily',
      'Dallas apartment market',
      'Phoenix real estate',
      'Tampa housing',
      'Austin apartment',
    ];

    let totalDiscoveries = 0;

    for (const topic of topics) {
      await step.run(`news-${topic.slice(0, 20)}`, async () => {
        try {
          const news = await discoveryEngine.discoverNews([topic]);
          totalDiscoveries += news.length;
          logger.info(`Discovered ${news.length} news items for: ${topic}`);
        } catch (error) {
          logger.warn(`News discovery failed for ${topic}:`, error);
        }
      });

      // Rate limit protection
      await step.sleep('rate-limit', '2s');
    }

    return { totalDiscoveries };
  }
);

/**
 * Daily deal-specific news discovery
 * Scans news for each active deal's market
 */
export const dailyDealNewsDiscovery = inngest.createFunction(
  { id: 'discovery-daily-deal-news', name: 'Daily Deal News Discovery' , triggers: [{ cron: '0 7 * * *' }] }, // 7 AM daily (after general news)
  async ({ step }) => {
    logger.info('Starting daily deal news discovery');

    // Get all active deals
    const deals = await step.run('get-deals', async () => {
      const result = await query(
        `SELECT DISTINCT d.id, p.city, p.state
         FROM deals d
         JOIN properties p ON d.property_id = p.id
         WHERE d.status NOT IN ('closed', 'dead')`
      );
      return result.rows;
    });

    let newsFound = 0;

    for (const deal of deals.slice(0, 20)) { // Limit to prevent rate limit issues
      await step.run(`deal-news-${deal.id.slice(0, 8)}`, async () => {
        try {
          const news = await discoveryEngine.discoverDealNews(deal.id);
          newsFound += news.length;
        } catch (error) {
          logger.warn(`Deal news discovery failed for ${deal.id}:`, error);
        }
      });

      await step.sleep('rate-limit', '3s');
    }

    return { dealsScanned: deals.length, newsFound };
  }
);

/**
 * Daily economic data refresh
 */
export const dailyEconomicDiscovery = inngest.createFunction(
  { id: 'discovery-daily-economic', name: 'Daily Economic Discovery' , triggers: [{ cron: '0 8 * * *' }] }, // 8 AM daily
  async ({ step }) => {
    logger.info('Starting daily economic discovery');

    // Refresh interest rates (full history)
    await step.run('rates', async () => {
      await discoveryEngine.discoverInterestRates();
    });

    // Get MSAs with active deals
    const msas = await step.run('get-msas', async () => {
      const result = await query(
        `SELECT DISTINCT m.id, m.cbsa_code, m.name
         FROM msas m
         JOIN properties p ON p.msa_id = m.id
         JOIN deals d ON d.property_id = p.id
         WHERE d.status NOT IN ('closed', 'dead')`
      );
      return result.rows;
    });

    // Refresh employment data for each MSA
    for (const msa of msas.slice(0, 10)) {
      if (msa.cbsa_code) {
        await step.run(`employment-${msa.cbsa_code}`, async () => {
          await discoveryEngine.discoverEmploymentData(msa.cbsa_code);
        });
        await step.sleep('rate-limit', '2s');
      }
    }

    return { msasUpdated: msas.length };
  }
);

/**
 * CRE trade-press discovery
 *
 * Polls the curated free RSS / JSON feeds in `sources/cre-rss.ts` directly
 * (independent of NewsAPI / Google News and *without* keyword filters) so the
 * `news_discoveries` library stays warm even on quiet days when nothing is
 * actively asking for news.
 *
 * Cadence: every 3 hours.
 */
export const creTradePressDiscovery = inngest.createFunction(
  {
    id: 'discovery-cre-trade-press',
    name: 'CRE Trade-Press Discovery',
    triggers: [{ cron: '0 */3 * * *' }],
  },
  async ({ step }) => {
    logger.info('Starting CRE trade-press discovery');

    const runId = await step.run('start-run', async () => {
      const res = await query(
        `INSERT INTO discovery_runs (job_id, job_name, status, started_at)
         VALUES ($1, $2, 'running', NOW())
         RETURNING id`,
        ['discovery-cre-trade-press', 'CRE Trade-Press Discovery']
      );
      return res.rows[0].id as string;
    });

    try {
      const items = await step.run('fetch-feeds', async () => {
        const fetched = await fetchCreTradePressFeeds({
          perFeedLimit: 25,
          maxAgeDays: 7,
        });
        logger.info(`cre-trade-press: fetched ${fetched.length} items across all feeds`);
        return fetched;
      });

      const counts = await step.run('persist-items', async () => {
        let inserted = 0;
        let duplicates = 0;
        let failed = 0;
        for (const item of items) {
          try {
            const outcome = await discoveryEngine.storeNewsDiscovery({
              id: item.id,
              headline: item.headline,
              source: item.source,
              url: item.url,
              publishedAt: new Date(item.publishedAt),
              summary: item.summary,
              category: item.category,
              relevantMsas: item.marketHint ? [item.marketHint] : undefined,
            });
            if (outcome === 'inserted') inserted++;
            else duplicates++;
          } catch (err) {
            failed++;
            logger.warn(
              `cre-trade-press: failed to persist item ${item.id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }
        return { inserted, duplicates, failed };
      });

      await step.run('complete-run', async () => {
        // If any inserts failed we mark the run as 'failed' so operators can
        // see partial-success runs in the discovery_runs table; otherwise it
        // is a clean 'completed'. items_discovered always reflects truly new
        // rows, never duplicates or failures.
        const isPartial = counts.failed > 0;
        await query(
          `UPDATE discovery_runs
             SET status = $1,
                 items_discovered = $2,
                 error = $3,
                 completed_at = NOW()
           WHERE id = $4`,
          [
            isPartial ? 'failed' : 'completed',
            counts.inserted,
            isPartial
              ? `${counts.failed} of ${items.length} items failed to persist`
              : null,
            runId,
          ]
        );
      });

      return {
        itemsFetched: items.length,
        itemsInserted: counts.inserted,
        itemsDuplicates: counts.duplicates,
        itemsFailed: counts.failed,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('CRE trade-press discovery failed:', message);
      await step.run('fail-run', async () => {
        await query(
          `UPDATE discovery_runs
             SET status = 'failed',
                 error = $1,
                 completed_at = NOW()
           WHERE id = $2`,
          [message.slice(0, 1000), runId]
        );
      });
      throw err;
    }
  }
);

// ============================================================================
// WEEKLY DISCOVERY
// ============================================================================

/**
 * Weekly comprehensive market scan
 */
export const weeklyMarketScan = inngest.createFunction(
  { id: 'discovery-weekly-market', name: 'Weekly Market Scan' , triggers: [{ cron: '0 5 * * 0' }] }, // 5 AM every Sunday
  async ({ step }) => {
    logger.info('Starting weekly market scan');

    // Deep scan of all major markets
    const majorMarkets = [
      'Atlanta', 'Dallas', 'Phoenix', 'Tampa', 'Austin', 'Charlotte',
      'Denver', 'Nashville', 'Orlando', 'Jacksonville', 'Raleigh',
      'San Antonio', 'Houston', 'Miami', 'Las Vegas',
    ];

    for (const market of majorMarkets) {
      await step.run(`market-${market}`, async () => {
        // Search for market-specific news
        await discoveryEngine.discoverNews([
          `${market} apartment market 2026`,
          `${market} multifamily construction`,
          `${market} rent trends`,
        ]);

        // Web search for market reports
        await discoveryEngine.webSearch(`${market} multifamily market report 2026`, 'web');
      });

      await step.sleep('rate-limit', '5s');
    }

    // Dispatch market_data_changed event to trigger agent analysis
    await step.run('notify-agents', async () => {
      await eventDispatcher.onMarketDataChanged({
        type: 'weekly_update',
        change: { markets: majorMarkets, scanType: 'comprehensive' },
      });
    });

    return { marketsScanned: majorMarkets.length };
  }
);

// ============================================================================
// ON-DEMAND DISCOVERY (called by agents)
// ============================================================================

/**
 * On-demand news discovery for a specific query
 * Called by Research agent when user asks about market
 */
export const onDemandNewsDiscovery = inngest.createFunction(
  { id: 'discovery-on-demand-news', name: 'On-Demand News Discovery' , triggers: [{ event: 'discovery/news.requested' }] },
  async ({ event, step }) => {
    const { query: searchQuery, dealId, userId } = event.data;

    const news = await step.run('discover', async () => {
      return await discoveryEngine.discoverNews([searchQuery]);
    });

    // If deal-specific, tag the news
    if (dealId) {
      for (const item of news) {
        item.relevantDeals = [dealId];
      }
    }

    return { found: news.length, query: searchQuery };
  }
);

/**
 * On-demand web search
 * Called by agents when they need to look something up
 */
export const onDemandWebSearch = inngest.createFunction(
  { id: 'discovery-on-demand-web', name: 'On-Demand Web Search' , triggers: [{ event: 'discovery/web.search.requested' }] },
  async ({ event, step }) => {
    const { query: searchQuery, type = 'web' } = event.data;

    const results = await step.run('search', async () => {
      return await discoveryEngine.webSearch(searchQuery, type as 'web' | 'news');
    });

    return { found: results.length, query: searchQuery };
  }
);

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export const scheduledDiscoveryFunctions = [
  hourlyMarketDiscovery,
  dailyNewsDiscovery,
  dailyDealNewsDiscovery,
  dailyEconomicDiscovery,
  creTradePressDiscovery,
  weeklyMarketScan,
  onDemandNewsDiscovery,
  onDemandWebSearch,
];
