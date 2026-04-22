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

export default router;
