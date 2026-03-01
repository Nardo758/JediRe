import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface WebTrafficMetrics {
  sessions: number;
  users: number;
  new_users: number;
  pageviews: number;
  avg_session_duration: number;
  bounce_rate: number;
  traffic_sources: {
    organic: number;
    paid: number;
    direct: number;
    referral: number;
    social: number;
  };
  device_breakdown: Record<string, number>;
  top_landing_pages: Array<{ path: string; sessions: number }>;
  period_start: string;
  period_end: string;
  is_comp_proxy: boolean;
  proxy_source_properties?: string[];
  organic_value?: number;
  organic_keywords?: number;
  paid_keywords?: number;
  domain_strength?: number;
}

export interface DomainConnection {
  id: number;
  property_id: string;
  ga_property_id: string;
  connection_status: string;
  last_synced: string | null;
  sync_error: string | null;
}

export interface WebTrafficScore {
  score: number;
  tier: string;
  sessions_30d: number;
  trend_direction: string;
  trend_pct: number;
}

interface SpyFuDomainStats {
  monthlyOrganicClicks: number;
  monthlyPaidClicks: number;
  monthlyOrganicValue: number;
  totalOrganicResults: number;
  totalAdsPurchased: number;
  averageOrganicRank: number;
  strength: number;
  searchMonth: number;
  searchYear: number;
}

const SPYFU_BASE = 'https://www.spyfu.com/apis';

export class PropertyAnalyticsService {
  constructor(private pool: Pool) {}

  async connectPropertyDomain(propertyId: string, domain: string): Promise<DomainConnection> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
    const result = await this.pool.query(
      `INSERT INTO property_ga_connections (property_id, ga_property_id, connection_status, created_at, updated_at)
       VALUES ($1, $2, 'active', NOW(), NOW())
       ON CONFLICT (property_id, ga_property_id)
       DO UPDATE SET connection_status = 'active', sync_error = NULL, updated_at = NOW()
       RETURNING *`,
      [propertyId, cleanDomain]
    );
    logger.info(`[PropertyAnalytics] Connected property ${propertyId} to domain ${cleanDomain}`);
    return result.rows[0];
  }

  async disconnectPropertyDomain(propertyId: string, domain: string): Promise<void> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
    await this.pool.query(
      `UPDATE property_ga_connections SET connection_status = 'disconnected', updated_at = NOW()
       WHERE property_id = $1 AND ga_property_id = $2`,
      [propertyId, cleanDomain]
    );
    logger.info(`[PropertyAnalytics] Disconnected property ${propertyId} from domain ${cleanDomain}`);
  }

  async getDomainConnection(propertyId: string): Promise<DomainConnection | null> {
    const result = await this.pool.query(
      `SELECT * FROM property_ga_connections
       WHERE property_id = $1 AND connection_status = 'active'
       ORDER BY updated_at DESC LIMIT 1`,
      [propertyId]
    );
    return result.rows[0] || null;
  }

  async fetchPropertyWebTraffic(
    propertyId: string,
    dateRange?: { start: string; end: string }
  ): Promise<WebTrafficMetrics | null> {
    const connection = await this.getDomainConnection(propertyId);

    if (!connection) {
      logger.debug(`[PropertyAnalytics] No domain connection for property ${propertyId}`);
      return null;
    }

    const domain = connection.ga_property_id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = dateRange?.start || thirtyDaysAgo.toISOString().split('T')[0];
    const end = dateRange?.end || now.toISOString().split('T')[0];

    try {
      const spyFuData = await this._fetchLatestDomainStats(domain);

      if (!spyFuData) {
        logger.warn(`[PropertyAnalytics] SpyFu returned no data for domain ${domain}`);
        return this._getCachedAnalytics(propertyId, start, end);
      }

      const totalSessions = (spyFuData.monthlyOrganicClicks || 0) + (spyFuData.monthlyPaidClicks || 0);

      await this.pool.query(
        `INSERT INTO property_website_analytics
         (property_id, ga_property_id, period_start, period_end,
          sessions, users, new_users, pageviews, avg_session_duration, bounce_rate,
          organic_sessions, paid_sessions, direct_sessions, referral_sessions, social_sessions,
          top_landing_pages, device_breakdown, is_comp_proxy, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, false, NOW())
         ON CONFLICT (property_id, period_start, period_end)
         DO UPDATE SET
           sessions = EXCLUDED.sessions,
           users = EXCLUDED.users,
           new_users = EXCLUDED.new_users,
           pageviews = EXCLUDED.pageviews,
           avg_session_duration = EXCLUDED.avg_session_duration,
           bounce_rate = EXCLUDED.bounce_rate,
           organic_sessions = EXCLUDED.organic_sessions,
           paid_sessions = EXCLUDED.paid_sessions,
           direct_sessions = EXCLUDED.direct_sessions,
           referral_sessions = EXCLUDED.referral_sessions,
           social_sessions = EXCLUDED.social_sessions,
           top_landing_pages = EXCLUDED.top_landing_pages,
           device_breakdown = EXCLUDED.device_breakdown`,
        [
          propertyId, domain, start, end,
          totalSessions, totalSessions, 0, 0,
          0, 0,
          spyFuData.monthlyOrganicClicks || 0,
          spyFuData.monthlyPaidClicks || 0,
          0, 0, 0,
          JSON.stringify([]),
          JSON.stringify({
            organic_value: spyFuData.monthlyOrganicValue || 0,
            organic_keywords: spyFuData.totalOrganicResults || 0,
            paid_keywords: spyFuData.totalAdsPurchased || 0,
            domain_strength: spyFuData.strength || 0,
            avg_organic_rank: spyFuData.averageOrganicRank || 0,
          }),
        ]
      );

      await this.pool.query(
        `UPDATE property_ga_connections SET last_synced = NOW(), sync_error = NULL, updated_at = NOW()
         WHERE property_id = $1 AND ga_property_id = $2`,
        [propertyId, domain]
      );

      return {
        sessions: totalSessions,
        users: totalSessions,
        new_users: 0,
        pageviews: 0,
        avg_session_duration: 0,
        bounce_rate: 0,
        traffic_sources: {
          organic: spyFuData.monthlyOrganicClicks || 0,
          paid: spyFuData.monthlyPaidClicks || 0,
          direct: 0,
          referral: 0,
          social: 0,
        },
        device_breakdown: {},
        top_landing_pages: [],
        period_start: start,
        period_end: end,
        is_comp_proxy: false,
        organic_value: spyFuData.monthlyOrganicValue || 0,
        organic_keywords: spyFuData.totalOrganicResults || 0,
        paid_keywords: spyFuData.totalAdsPurchased || 0,
        domain_strength: spyFuData.strength || 0,
      };
    } catch (error: any) {
      logger.error(`[PropertyAnalytics] SpyFu fetch failed for ${domain}`, { error: error.message });
      await this.pool.query(
        `UPDATE property_ga_connections SET sync_error = $3, updated_at = NOW()
         WHERE property_id = $1 AND ga_property_id = $2`,
        [propertyId, domain, error.message]
      );

      return this._getCachedAnalytics(propertyId, start, end);
    }
  }

  async getCompProxyTraffic(
    propertyId: string,
    tradeAreaId: string
  ): Promise<WebTrafficMetrics | null> {
    if (!tradeAreaId) {
      logger.warn(`[PropertyAnalytics] No trade area for comp proxy, property ${propertyId}`);
      return null;
    }

    const compsResult = await this.pool.query(
      `SELECT pwa.property_id, pwa.sessions, pwa.users, pwa.new_users, pwa.pageviews,
              pwa.avg_session_duration, pwa.bounce_rate,
              pwa.organic_sessions, pwa.paid_sessions, pwa.direct_sessions,
              pwa.referral_sessions, pwa.social_sessions,
              pwa.top_landing_pages, pwa.device_breakdown
       FROM property_website_analytics pwa
       INNER JOIN property_ga_connections pgc ON pgc.property_id = pwa.property_id AND pgc.connection_status = 'active'
       INNER JOIN traffic_comp_snapshots tcs ON tcs.property_id = pwa.property_id AND tcs.trade_area_id = $1
       WHERE pwa.is_comp_proxy = false
         AND pwa.property_id != $2
         AND pwa.period_end >= (CURRENT_DATE - INTERVAL '60 days')
       ORDER BY pwa.period_end DESC`,
      [tradeAreaId, propertyId]
    );

    const seen = new Set<string>();
    const uniqueComps: typeof compsResult.rows = [];
    for (const row of compsResult.rows) {
      if (!seen.has(row.property_id)) {
        seen.add(row.property_id);
        uniqueComps.push(row);
      }
    }

    if (uniqueComps.length === 0) {
      logger.info(`[PropertyAnalytics] No comps with domain data in trade area ${tradeAreaId}`);
      return null;
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const avgDec = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const extractSpyFu = (row: any) => {
      const db = row.device_breakdown || {};
      return {
        organic_value: db.organic_value || 0,
        organic_keywords: db.organic_keywords || 0,
        paid_keywords: db.paid_keywords || 0,
        domain_strength: db.domain_strength || 0,
      };
    };

    const proxyMetrics: WebTrafficMetrics = {
      sessions: avg(uniqueComps.map(c => c.sessions || 0)),
      users: avg(uniqueComps.map(c => c.users || 0)),
      new_users: avg(uniqueComps.map(c => c.new_users || 0)),
      pageviews: avg(uniqueComps.map(c => c.pageviews || 0)),
      avg_session_duration: avgDec(uniqueComps.map(c => parseFloat(c.avg_session_duration) || 0)),
      bounce_rate: 0,
      traffic_sources: {
        organic: avg(uniqueComps.map(c => c.organic_sessions || 0)),
        paid: avg(uniqueComps.map(c => c.paid_sessions || 0)),
        direct: 0,
        referral: 0,
        social: 0,
      },
      device_breakdown: {},
      top_landing_pages: [],
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      period_end: new Date().toISOString().split('T')[0],
      is_comp_proxy: true,
      proxy_source_properties: uniqueComps.map(c => c.property_id),
      organic_value: avgDec(uniqueComps.map(c => extractSpyFu(c).organic_value)),
      organic_keywords: avg(uniqueComps.map(c => extractSpyFu(c).organic_keywords)),
      paid_keywords: avg(uniqueComps.map(c => extractSpyFu(c).paid_keywords)),
      domain_strength: avgDec(uniqueComps.map(c => extractSpyFu(c).domain_strength)),
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    await this.pool.query(
      `INSERT INTO property_website_analytics
       (property_id, period_start, period_end,
        sessions, users, new_users, pageviews, avg_session_duration, bounce_rate,
        organic_sessions, paid_sessions, direct_sessions, referral_sessions, social_sessions,
        is_comp_proxy, proxy_source_properties, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, NOW())
       ON CONFLICT (property_id, period_start, period_end)
       DO UPDATE SET
         sessions = EXCLUDED.sessions,
         users = EXCLUDED.users,
         new_users = EXCLUDED.new_users,
         pageviews = EXCLUDED.pageviews,
         avg_session_duration = EXCLUDED.avg_session_duration,
         bounce_rate = EXCLUDED.bounce_rate,
         organic_sessions = EXCLUDED.organic_sessions,
         paid_sessions = EXCLUDED.paid_sessions,
         direct_sessions = EXCLUDED.direct_sessions,
         referral_sessions = EXCLUDED.referral_sessions,
         social_sessions = EXCLUDED.social_sessions,
         is_comp_proxy = true,
         proxy_source_properties = EXCLUDED.proxy_source_properties`,
      [
        propertyId,
        thirtyDaysAgo.toISOString().split('T')[0],
        now.toISOString().split('T')[0],
        proxyMetrics.sessions, proxyMetrics.users, proxyMetrics.new_users,
        proxyMetrics.pageviews, proxyMetrics.avg_session_duration, proxyMetrics.bounce_rate,
        proxyMetrics.traffic_sources.organic, proxyMetrics.traffic_sources.paid,
        proxyMetrics.traffic_sources.direct, proxyMetrics.traffic_sources.referral,
        proxyMetrics.traffic_sources.social,
        JSON.stringify(proxyMetrics.proxy_source_properties),
      ]
    );

    logger.info(`[PropertyAnalytics] Comp proxy created for ${propertyId} from ${uniqueComps.length} comps`);
    return proxyMetrics;
  }

  async getWebTrafficScore(propertyId: string): Promise<WebTrafficScore> {
    const result = await this.pool.query(
      `SELECT sessions, users, pageviews, bounce_rate, device_breakdown,
              period_start, period_end, is_comp_proxy
       FROM property_website_analytics
       WHERE property_id = $1
       ORDER BY period_end DESC
       LIMIT 2`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return { score: 0, tier: 'No Data', sessions_30d: 0, trend_direction: 'flat', trend_pct: 0 };
    }

    const current = result.rows[0];
    const sessions = current.sessions || 0;
    const db = current.device_breakdown || {};
    const domainStrength = db.domain_strength || 0;

    let volumeScore: number;
    if (sessions >= 5000) volumeScore = 95;
    else if (sessions >= 3000) volumeScore = 85;
    else if (sessions >= 1500) volumeScore = 70;
    else if (sessions >= 500) volumeScore = 50;
    else if (sessions >= 100) volumeScore = 30;
    else volumeScore = 10;

    const score = Math.round(volumeScore * 0.6 + domainStrength * 0.4);

    let trend_direction = 'flat';
    let trend_pct = 0;
    if (result.rows.length > 1) {
      const prev = result.rows[1];
      const prevSessions = prev.sessions || 1;
      trend_pct = ((sessions - prevSessions) / prevSessions) * 100;
      trend_direction = trend_pct > 5 ? 'up' : trend_pct < -5 ? 'down' : 'flat';
    }

    const tier = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

    return { score, tier, sessions_30d: sessions, trend_direction, trend_pct: Math.round(trend_pct * 100) / 100 };
  }

  async syncAllPropertyAnalytics(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const connections = await this.pool.query(
      `SELECT property_id, ga_property_id FROM property_ga_connections WHERE connection_status = 'active'`
    );

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conn of connections.rows) {
      try {
        await this.fetchPropertyWebTraffic(conn.property_id);
        synced++;
      } catch (error: any) {
        failed++;
        errors.push(`${conn.property_id}: ${error.message}`);
      }
    }

    logger.info(`[PropertyAnalytics] Bulk sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed, errors };
  }

  async getStoredAnalytics(propertyId: string, limit = 12): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM property_website_analytics
       WHERE property_id = $1
       ORDER BY period_end DESC
       LIMIT $2`,
      [propertyId, limit]
    );
    return result.rows;
  }

  async getDomainHistory(domain: string): Promise<SpyFuDomainStats[] | null> {
    return this._fetchDomainHistory(domain);
  }

  private async _fetchLatestDomainStats(domain: string): Promise<SpyFuDomainStats | null> {
    const apiKey = process.env.SPYFU_API_KEY;
    if (!apiKey) {
      logger.warn('[PropertyAnalytics] SPYFU_API_KEY not configured');
      return null;
    }

    const url = `${SPYFU_BASE}/domain_stats_api/v2/getLatestDomainStats?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    logger.debug(`[PropertyAnalytics] Fetching SpyFu latest stats for ${domain}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`SpyFu API error: ${response.status} ${response.statusText} — ${text.substring(0, 200)}`);
    }

    const data = await response.json() as any;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    const stats = Array.isArray(data) ? data[0] : data;

    return {
      monthlyOrganicClicks: stats.monthlyOrganicClicks || 0,
      monthlyPaidClicks: stats.monthlyPaidClicks || 0,
      monthlyOrganicValue: stats.monthlyOrganicValue || 0,
      totalOrganicResults: stats.totalOrganicResults || 0,
      totalAdsPurchased: stats.totalAdsPurchased || 0,
      averageOrganicRank: stats.averageOrganicRank || 0,
      strength: stats.strength || 0,
      searchMonth: stats.searchMonth || new Date().getMonth() + 1,
      searchYear: stats.searchYear || new Date().getFullYear(),
    };
  }

  private async _fetchDomainHistory(domain: string): Promise<SpyFuDomainStats[] | null> {
    const apiKey = process.env.SPYFU_API_KEY;
    if (!apiKey) {
      logger.warn('[PropertyAnalytics] SPYFU_API_KEY not configured');
      return null;
    }

    const url = `${SPYFU_BASE}/domain_stats_api/v2/getAllDomainStats?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    logger.debug(`[PropertyAnalytics] Fetching SpyFu history for ${domain}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`SpyFu history API error: ${response.status} ${response.statusText} — ${text.substring(0, 200)}`);
    }

    const data = await response.json() as any;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    return data.map((row: any) => ({
      monthlyOrganicClicks: row.monthlyOrganicClicks || 0,
      monthlyPaidClicks: row.monthlyPaidClicks || 0,
      monthlyOrganicValue: row.monthlyOrganicValue || 0,
      totalOrganicResults: row.totalOrganicResults || 0,
      totalAdsPurchased: row.totalAdsPurchased || 0,
      averageOrganicRank: row.averageOrganicRank || 0,
      strength: row.strength || 0,
      searchMonth: row.searchMonth || 0,
      searchYear: row.searchYear || 0,
    }));
  }

  private async _getCachedAnalytics(
    propertyId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<WebTrafficMetrics | null> {
    const result = await this.pool.query(
      `SELECT * FROM property_website_analytics
       WHERE property_id = $1
       ORDER BY period_end DESC LIMIT 1`,
      [propertyId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const db = row.device_breakdown || {};
    return {
      sessions: row.sessions,
      users: row.users,
      new_users: row.new_users,
      pageviews: row.pageviews,
      avg_session_duration: parseFloat(row.avg_session_duration) || 0,
      bounce_rate: 0,
      traffic_sources: {
        organic: row.organic_sessions || 0,
        paid: row.paid_sessions || 0,
        direct: row.direct_sessions || 0,
        referral: row.referral_sessions || 0,
        social: row.social_sessions || 0,
      },
      device_breakdown: row.device_breakdown || {},
      top_landing_pages: row.top_landing_pages || [],
      period_start: row.period_start,
      period_end: row.period_end,
      is_comp_proxy: row.is_comp_proxy,
      proxy_source_properties: row.proxy_source_properties,
      organic_value: db.organic_value || 0,
      organic_keywords: db.organic_keywords || 0,
      paid_keywords: db.paid_keywords || 0,
      domain_strength: db.domain_strength || 0,
    };
  }
}
