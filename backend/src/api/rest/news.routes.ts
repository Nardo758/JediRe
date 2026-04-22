/**
 * News API Routes
 * 
 * Premium news APIs exposed through credit-metered endpoints.
 * JediRe holds the API keys, users pay credits, margin is profit.
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { newsService } from '../../services/news/news.service';
import { newsletterParserService } from '../../services/news/newsletter-parser.service';
import { NEWS_CREDIT_COSTS } from '../../services/news/news-provider.interface';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require auth
router.use(requireAuth);

// ============================================================================
// PROVIDER INFO
// ============================================================================

/**
 * GET /api/v1/news/providers
 * List available news providers and their status
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = newsService.getProviders();
    const health = await newsService.getProviderHealth();

    res.json({
      success: true,
      data: {
        providers: providers.map(p => ({
          ...p,
          available: health[p.id] ?? false,
        })),
        creditCosts: NEWS_CREDIT_COSTS,
      },
    });
  } catch (error: any) {
    logger.error('Error getting news providers:', error);
    res.status(500).json({ success: false, error: 'Failed to get providers' });
  }
});

// ============================================================================
// SEARCH
// ============================================================================

/**
 * POST /api/v1/news/search
 * Search for news articles
 * 
 * Cost: 1 credit per provider searched
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      query,
      category,
      fromDate,
      toDate,
      pageSize = 10,
      page = 1,
      sortBy = 'relevance',
      providers,
    } = req.body;

    const result = await newsService.search(
      {
        query,
        category,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        pageSize,
        page,
        sortBy,
      },
      { userId, providers }
    );

    res.json({
      success: true,
      data: result,
      creditsUsed: NEWS_CREDIT_COSTS['news.search'],
    });
  } catch (error: any) {
    logger.error('News search error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/**
 * POST /api/v1/news/search/multi
 * Search multiple providers simultaneously
 * 
 * Cost: 1 credit per provider
 */
router.post('/search/multi', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      query,
      category,
      fromDate,
      toDate,
      pageSize = 10,
      sortBy = 'relevance',
      providers,
    } = req.body;

    const { results, totalCredits } = await newsService.searchMulti(
      {
        query,
        category,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        pageSize,
        sortBy,
      },
      { userId, providers }
    );

    res.json({
      success: true,
      data: {
        results,
        providersSearched: results.length,
      },
      creditsUsed: totalCredits,
    });
  } catch (error: any) {
    logger.error('Multi-search error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// ============================================================================
// HEADLINES
// ============================================================================

/**
 * GET /api/v1/news/headlines/:provider
 * Get top headlines from a specific provider
 * 
 * Cost: 1 credit
 */
router.get('/headlines/:provider', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { provider } = req.params;
    const { category, pageSize = 10 } = req.query;

    const result = await newsService.getHeadlines(
      provider,
      {
        category: category as string,
        pageSize: Number(pageSize),
      },
      { userId }
    );

    res.json({
      success: true,
      data: result,
      creditsUsed: NEWS_CREDIT_COSTS['news.search'],
    });
  } catch (error: any) {
    logger.error('Headlines error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    if (error.message.includes('Unknown provider')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to get headlines' });
  }
});

// ============================================================================
// ARTICLES
// ============================================================================

/**
 * GET /api/v1/news/article/:provider/:articleId
 * Get full article content
 * 
 * Cost: 2-3 credits depending on provider
 */
router.get('/article/:provider/:articleId(*)', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { provider, articleId } = req.params;

    const article = await newsService.getFullArticle(
      provider,
      articleId,
      { userId }
    );

    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    res.json({
      success: true,
      data: article,
      creditsUsed: article.content ? NEWS_CREDIT_COSTS['news.article_full'] : NEWS_CREDIT_COSTS['news.article'],
    });
  } catch (error: any) {
    logger.error('Article fetch error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to get article' });
  }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/v1/news/morning-brief
 * Generate a personalized morning news brief
 * 
 * Cost: 5 credits
 */
router.post('/morning-brief', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      topics,
      includeMarketNews = true,
      includeRealEstateNews = true,
      maxArticles = 20,
    } = req.body;

    const result = await newsService.generateMorningBrief({
      userId,
      topics,
      includeMarketNews,
      includeRealEstateNews,
      maxArticles,
    });

    res.json({
      success: true,
      data: {
        articles: result.articles,
        count: result.articles.length,
      },
      creditsUsed: result.creditsUsed,
    });
  } catch (error: any) {
    logger.error('Morning brief error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to generate brief' });
  }
});

/**
 * POST /api/v1/news/market-scan
 * Scan for real estate market news
 * 
 * Cost: 5 credits
 */
router.post('/market-scan', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { markets = [] } = req.body;

    const result = await newsService.marketNewsScan(userId, markets);

    res.json({
      success: true,
      data: {
        articles: result.articles,
        count: result.articles.length,
        marketsSearched: markets,
      },
      creditsUsed: result.creditsUsed,
    });
  } catch (error: any) {
    logger.error('Market scan error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to scan market news' });
  }
});

// ============================================================================
// REAL ESTATE SPECIFIC
// ============================================================================

/**
 * GET /api/v1/news/real-estate
 * Shortcut for real estate headlines
 * 
 * Cost: 1 credit
 */
router.get('/real-estate', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { pageSize = 15 } = req.query;

    // Use NYT's real estate desk if available, else search
    const result = await newsService.search(
      {
        query: 'real estate investment OR multifamily OR commercial property',
        pageSize: Number(pageSize),
        sortBy: 'publishedAt',
      },
      { userId }
    );

    res.json({
      success: true,
      data: result,
      creditsUsed: NEWS_CREDIT_COSTS['news.search'],
    });
  } catch (error: any) {
    logger.error('RE news error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to get RE news' });
  }
});

// ============================================================================
// UNIFIED FEED (API + Newsletters)
// ============================================================================

/**
 * GET /api/v1/news/feed
 * Unified news feed: user's newsletters + API sources
 * 
 * Newsletter articles: FREE
 * API articles: 1 credit (if included)
 */
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      category,
      market,
      includeNewsletters = 'true',
      includeApi = 'true',
      limit = 30,
    } = req.query;

    const result = await newsService.getUnifiedFeed(userId, {
      category: category as string,
      market: market as string,
      includeNewsletters: includeNewsletters === 'true',
      includeApiSources: includeApi === 'true',
      maxArticles: Number(limit),
    });

    // Task #329 — interleave the caller's premium subscription items
    // (forwarded newsletters + authenticated RSS) with the public RSS feed so
    // they show up in the dashboard ticker. Marked is_premium=true so the UI
    // can badge them as "FROM YOUR <publisher> SUBSCRIPTION".
    if (userId) {
      try {
        const userItems = await query(
          `SELECT id, source, publisher, url, title, summary, published_at, fetched_at
             FROM user_news_items
            WHERE user_id = $1
            ORDER BY COALESCE(published_at, fetched_at) DESC
            LIMIT 25`,
          [userId]
        );
        interface UserItemRow {
          id: string;
          source: string;
          publisher: string | null;
          url: string;
          title: string;
          summary: string | null;
          published_at: string | Date | null;
          fetched_at: string | Date;
        }
        interface FeedArticle {
          id: string;
          headline: string;
          summary: string;
          link: string;
          published_at: string;
          source: string;
          sourceId: string;
          sourceColor: string;
          impact: string | null;
          jedi_delta: number | null;
          is_premium?: boolean;
        }
        const premium: FeedArticle[] = (userItems.rows as UserItemRow[]).map((it) => ({
          id: `user-${it.id}`,
          headline: it.title,
          summary: it.summary || '',
          link: it.url,
          published_at:
            (it.published_at && new Date(it.published_at).toISOString()) ||
            new Date(it.fetched_at).toISOString(),
          source: it.publisher || 'Your Subscription',
          sourceId: it.source,
          sourceColor: '#FFCC00',
          impact: null,
          jedi_delta: null,
          is_premium: true,
        }));
        articles = [...premium, ...(articles as FeedArticle[])]
          .sort(
            (a: FeedArticle, b: FeedArticle) =>
              new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          )
          .slice(0, parseInt(limit as string));
      } catch (e) {
        logger.error('Failed to merge user news items into feed:', e);
      }
    }

    res.json({
      success: true,
      data: {
        articles: result.articles,
        count: result.articles.length,
        sources: {
          newsletters: result.newsletterCount,
          api: result.apiCount,
        },
      },
      creditsUsed: result.creditsUsed,
    });
  } catch (error: any) {
    logger.error('Unified feed error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to get feed' });
  }
});

/**
 * POST /api/v1/news/enhanced-brief
 * Morning brief that prioritizes user's newsletters, supplements with API
 * 
 * Cost: 0-5 credits depending on how much API content needed
 */
router.post('/enhanced-brief', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      topics,
      includeMarketNews = true,
      includeRealEstateNews = true,
      maxArticles = 25,
    } = req.body;

    const result = await newsService.getEnhancedMorningBrief({
      userId,
      topics,
      includeMarketNews,
      includeRealEstateNews,
      maxArticles,
    });

    res.json({
      success: true,
      data: {
        articles: result.articles,
        count: result.articles.length,
        sources: {
          fromNewsletters: result.fromNewsletters,
          fromApi: result.fromApi,
        },
        keyTakeaways: result.keyTakeaways,
      },
      creditsUsed: result.creditsUsed,
    });
  } catch (error: any) {
    logger.error('Enhanced brief error:', error);
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to generate brief' });
  }
});

// ============================================================================
// USER NEWSLETTER ARTICLES (from subscriptions)
// ============================================================================

/**
 * GET /api/v1/news/my-articles
 * Get articles extracted from user's newsletter subscriptions
 * 
 * Cost: FREE (already paid for via subscription)
 */
router.get('/my-articles', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { source, relevance, category, limit = 50, offset = 0 } = req.query;

    const articles = await newsletterParserService.getUserArticles(userId, {
      source: source as string,
      relevance: relevance as 'high' | 'medium' | 'low',
      category: category as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      success: true,
      data: {
        articles,
        count: articles.length,
      },
      creditsUsed: 0, // Free - from user's own subscriptions
    });
  } catch (error: any) {
    logger.error('My articles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get articles' });
  }
});

/**
 * GET /api/v1/news/my-articles/re
 * Get RE-relevant articles from user's newsletters
 * 
 * Cost: FREE
 */
router.get('/my-articles/re', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { limit = 30 } = req.query;

    // Get high and medium relevance articles
    const highRelevance = await newsletterParserService.getUserArticles(userId, {
      relevance: 'high',
      limit: Number(limit),
    });

    const mediumRelevance = await newsletterParserService.getUserArticles(userId, {
      relevance: 'medium',
      limit: Math.max(0, Number(limit) - highRelevance.length),
    });

    const articles = [...highRelevance, ...mediumRelevance];

    res.json({
      success: true,
      data: {
        articles,
        count: articles.length,
        highRelevanceCount: highRelevance.length,
      },
      creditsUsed: 0,
    });
  } catch (error: any) {
    logger.error('RE articles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get RE articles' });
  }
});

/**
 * GET /api/v1/news/my-articles/market/:market
 * Get articles mentioning a specific market
 * 
 * Cost: FREE
 */
router.get('/my-articles/market/:market', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { market } = req.params;
    const { limit = 20 } = req.query;

    const articles = await newsletterParserService.getMarketArticles(
      userId,
      market,
      Number(limit)
    );

    res.json({
      success: true,
      data: {
        articles,
        count: articles.length,
        market,
      },
      creditsUsed: 0,
    });
  } catch (error: any) {
    logger.error('Market articles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get market articles' });
  }
});

/**
 * GET /api/v1/news/my-sources
 * Get list of newsletter sources user receives
 * 
 * Cost: FREE
 */
router.get('/my-sources', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { query: dbQuery } = await import('../../database/connection');
    const result = await dbQuery(
      `SELECT source, first_seen, last_seen, total_parsed, is_active
       FROM user_newsletter_sources
       WHERE user_id = $1
       ORDER BY last_seen DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        sources: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error: any) {
    logger.error('My sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sources' });
  }
});

/**
 * GET /api/v1/news/discoveries
 * Trade-press items discovered by the cre-rss source (and friends).
 * Filterable by deal_id (returns items tagged with that deal) or source.
 */
router.get('/discoveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { deal_id, source, limit = 50 } = req.query;

    if (!deal_id) {
      return res.status(400).json({
        success: false,
        message: 'deal_id is required',
      });
    }
    if (!isValidUUID(String(deal_id))) {
      return res.status(400).json({ success: false, message: 'Invalid deal_id' });
    }

    // Authorization: caller must own the deal directly or share an org with it.
    const accessRes = await query(
      `SELECT d.id
       FROM deals d
       LEFT JOIN org_members om
         ON om.org_id = d.org_id AND om.user_id = $2
       WHERE d.id = $1
         AND (d.user_id = $2 OR om.user_id IS NOT NULL)`,
      [deal_id, userId]
    );
    if (accessRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const where: string[] = [`relevant_deals @> $1::jsonb`];
    const params: any[] = [JSON.stringify([deal_id])];
    let i = 2;

    if (source) {
      where.push(`source ILIKE $${i}`);
      params.push(`%${source}%`);
      i++;
    }

    params.push(Math.min(parseInt(limit as string, 10) || 50, 200));

    const sql = `
      SELECT id, headline, source, url, published_at, summary, category,
             relevant_msas
      FROM news_discoveries
      WHERE ${where.join(' AND ')}
      ORDER BY published_at DESC
      LIMIT $${i}
    `;
    const result = await query(sql, params);

    interface DiscoveryRow {
      id: string;
      headline: string;
      source: string;
      url: string;
      published_at: string | Date | null;
      summary: string | null;
      category: string | null;
      relevant_msas: string[] | null;
    }
    const publicDiscoveries = (result.rows as DiscoveryRow[]).map((r) => ({
      id: r.id,
      headline: r.headline,
      source: r.source,
      url: r.url,
      publishedAt: r.published_at,
      summary: r.summary,
      category: r.category,
      relevantMsas: r.relevant_msas,
      isPremium: false as const,
    }));

    // Task #329 — also surface the caller's premium newsletter/RSS items
    // for this deal. Until auto-tagging (#334) lands, we naive-match by
    // looking for the deal's name/address in the title or summary.
    interface PremiumDealItemRow {
      id: string;
      title: string;
      summary: string | null;
      url: string;
      publisher: string | null;
      published_at: string | Date | null;
    }
    let premiumItems: ReturnType<typeof publicDiscoveries.map> = [];
    try {
      const dealRes = await query(
        `SELECT name, address FROM deals WHERE id = $1`,
        [deal_id]
      );
      const dealName: string = dealRes.rows[0]?.name || '';
      const dealAddr: string = dealRes.rows[0]?.address || '';
      const needles = [dealName, dealAddr].filter((s) => s && s.length >= 4);
      if (needles.length > 0) {
        const orClauses = needles
          .map((_, idx) => `(uni.title ILIKE $${idx + 2} OR uni.summary ILIKE $${idx + 2})`)
          .join(' OR ');
        const premiumSql = `
          SELECT uni.id, uni.title, uni.summary, uni.url,
                 uni.publisher, uni.published_at
            FROM user_news_items uni
           WHERE uni.user_id = $1
             AND (${orClauses})
           ORDER BY COALESCE(uni.published_at, uni.fetched_at) DESC
           LIMIT 25`;
        const premiumParams: unknown[] = [userId, ...needles.map((n) => `%${n}%`)];
        const pr = await query(premiumSql, premiumParams);
        premiumItems = (pr.rows as PremiumDealItemRow[]).map((r) => ({
          id: `user-${r.id}`,
          headline: r.title,
          source: r.publisher || 'Your Subscription',
          url: r.url,
          publishedAt: r.published_at,
          summary: r.summary,
          category: null,
          relevantMsas: null,
          isPremium: true as const,
        }));
      }
    } catch (err) {
      logger.error('[news/discoveries] failed to merge premium items', err);
    }

    const merged = [...premiumItems, ...publicDiscoveries];
    res.json({
      success: true,
      data: merged,
      count: merged.length,
    });
  } catch (error) {
    logger.error('Error fetching news discoveries:', error);
    next(error);
  }
});

export default router;
