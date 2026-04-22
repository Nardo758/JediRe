/**
 * Newsletter Parser Service
 * 
 * Uses LLM to extract articles from forwarded newsletter emails.
 * No brittle regex — handles any format (WSJ, Bloomberg, Bisnow, etc.)
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedArticle {
  title: string;
  url?: string;
  summary?: string;
  source: string;
  author?: string;
  publishedAt?: Date;
  category?: string;
  relevanceToRE?: 'high' | 'medium' | 'low' | 'none';
  keyTopics?: string[];
}

export interface NewsletterParseResult {
  newsletterSource: string;        // e.g., "WSJ", "Bisnow", "Bloomberg"
  newsletterType: string;          // e.g., "daily_brief", "market_update", "deal_alert"
  receivedAt: Date;
  articles: ExtractedArticle[];
  marketMentions?: string[];       // Markets mentioned (Phoenix, Dallas, etc.)
  keyTakeaways?: string[];         // Top insights
  rawEmailId?: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// NEWSLETTER PARSER SERVICE
// ============================================================================

class NewsletterParserService {
  
  /**
   * Parse a newsletter email and extract articles
   */
  async parseNewsletter(
    emailBody: string,
    emailSubject: string,
    fromAddress: string,
    userId: string,
    emailId?: string
  ): Promise<NewsletterParseResult> {
    
    logger.info('Parsing newsletter', { subject: emailSubject, from: fromAddress });

    // Detect if this is actually a newsletter
    const isNewsletter = await this.detectNewsletter(emailSubject, fromAddress, emailBody);
    if (!isNewsletter) {
      logger.debug('Email not detected as newsletter', { subject: emailSubject });
      return {
        newsletterSource: 'unknown',
        newsletterType: 'not_newsletter',
        receivedAt: new Date(),
        articles: [],
      };
    }

    // Extract articles using LLM
    const result = await this.extractWithLLM(emailBody, emailSubject, fromAddress);
    
    // Store parsed newsletter
    if (result.articles.length > 0) {
      await this.storeNewsletterArticles(userId, result, emailId);
    }

    return result;
  }

  /**
   * Quick detection if email is a newsletter
   */
  private async detectNewsletter(subject: string, from: string, body: string): Promise<boolean> {
    // Known newsletter senders
    const knownNewsletters = [
      'wsj.com', 'bloomberg.com', 'bisnow.com', 'globest.com',
      'costar.com', 'therealdeal.com', 'commercialobserver.com',
      'nytimes.com', 'ft.com', 'reuters.com', 'cnbc.com',
      'morningbrew.com', 'axios.com', 'politico.com',
      'marketwatch.com', 'barrons.com', 'fortune.com',
      'crenews', 'multihousingnews', 'nationalmortgagenews',
    ];

    const fromLower = from.toLowerCase();
    if (knownNewsletters.some(n => fromLower.includes(n))) {
      return true;
    }

    // Newsletter-like subject patterns
    const newsletterPatterns = [
      /daily\s*(brief|digest|update|roundup)/i,
      /morning\s*(brief|update|edition)/i,
      /weekly\s*(digest|roundup|update)/i,
      /market\s*(update|recap|report)/i,
      /news\s*(alert|brief|digest)/i,
      /top\s*stories/i,
      /newsletter/i,
    ];

    if (newsletterPatterns.some(p => p.test(subject))) {
      return true;
    }

    // Check body for multiple article links
    const linkCount = (body.match(/https?:\/\/[^\s<>"]+/g) || []).length;
    if (linkCount > 5) {
      return true;
    }

    return false;
  }

  /**
   * Extract articles using LLM
   */
  private async extractWithLLM(
    emailBody: string,
    emailSubject: string,
    fromAddress: string
  ): Promise<NewsletterParseResult> {
    
    // Clean HTML to text (basic)
    const cleanBody = this.cleanEmailBody(emailBody);
    
    // Truncate if too long
    const truncated = cleanBody.slice(0, 15000);

    const prompt = `You are extracting news articles from a newsletter email.

EMAIL SUBJECT: ${emailSubject}
FROM: ${fromAddress}

EMAIL BODY:
${truncated}

Extract all articles/stories mentioned in this newsletter. Return JSON:

{
  "newsletterSource": "<publisher name, e.g., 'WSJ', 'Bisnow', 'Bloomberg'>",
  "newsletterType": "<type: 'daily_brief', 'market_update', 'deal_alert', 'sector_report', 'other'>",
  "articles": [
    {
      "title": "<article headline>",
      "url": "<article URL if present>",
      "summary": "<1-2 sentence summary>",
      "source": "<original source if different from newsletter>",
      "author": "<author if mentioned>",
      "category": "<business, finance, real-estate, markets, etc.>",
      "relevanceToRE": "<high|medium|low|none - relevance to commercial real estate>",
      "keyTopics": ["<topic1>", "<topic2>"]
    }
  ],
  "marketMentions": ["<cities/markets mentioned, e.g., 'Phoenix', 'Dallas'>"],
  "keyTakeaways": ["<top 2-3 insights from this newsletter>"]
}

IMPORTANT:
- Extract ALL distinct articles, not just the first few
- Include URLs when present
- For real estate newsletters (Bisnow, GlobeSt, CoStar), mark relevanceToRE as "high"
- For general business news, assess RE relevance based on content
- If no articles found, return empty articles array`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        newsletterSource: parsed.newsletterSource || this.guessSource(fromAddress),
        newsletterType: parsed.newsletterType || 'other',
        receivedAt: new Date(),
        articles: (parsed.articles || []).map((a: any) => ({
          title: a.title,
          url: a.url,
          summary: a.summary,
          source: a.source || parsed.newsletterSource,
          author: a.author,
          category: a.category,
          relevanceToRE: a.relevanceToRE || 'none',
          keyTopics: a.keyTopics || [],
        })),
        marketMentions: parsed.marketMentions || [],
        keyTakeaways: parsed.keyTakeaways || [],
      };
    } catch (error) {
      logger.error('LLM newsletter extraction failed', { error });
      return {
        newsletterSource: this.guessSource(fromAddress),
        newsletterType: 'unknown',
        receivedAt: new Date(),
        articles: [],
      };
    }
  }

  /**
   * Clean email HTML to plain text
   */
  private cleanEmailBody(html: string): string {
    return html
      // Remove style and script tags with content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Replace common elements
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      // Preserve links
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      // Remove remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Clean whitespace
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Guess source from email address
   */
  private guessSource(from: string): string {
    const fromLower = from.toLowerCase();
    if (fromLower.includes('wsj')) return 'WSJ';
    if (fromLower.includes('bloomberg')) return 'Bloomberg';
    if (fromLower.includes('bisnow')) return 'Bisnow';
    if (fromLower.includes('globest')) return 'GlobeSt';
    if (fromLower.includes('costar')) return 'CoStar';
    if (fromLower.includes('nytimes')) return 'NYT';
    if (fromLower.includes('ft.com')) return 'FT';
    if (fromLower.includes('reuters')) return 'Reuters';
    if (fromLower.includes('cnbc')) return 'CNBC';
    if (fromLower.includes('marketwatch')) return 'MarketWatch';
    if (fromLower.includes('therealdeal')) return 'The Real Deal';
    return 'Unknown';
  }

  /**
   * Store parsed articles in database
   */
  private async storeNewsletterArticles(
    userId: string,
    result: NewsletterParseResult,
    emailId?: string
  ): Promise<void> {
    try {
      // Store the newsletter parse record
      const newsletterRes = await query(
        `INSERT INTO user_newsletter_parses
         (user_id, email_id, source, newsletter_type, market_mentions, 
          key_takeaways, article_count, parsed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [
          userId,
          emailId,
          result.newsletterSource,
          result.newsletterType,
          JSON.stringify(result.marketMentions || []),
          JSON.stringify(result.keyTakeaways || []),
          result.articles.length,
        ]
      );

      const parseId = newsletterRes.rows[0]?.id;

      // Store each article
      for (const article of result.articles) {
        await query(
          `INSERT INTO user_newsletter_articles
           (user_id, parse_id, title, url, summary, source, author,
            category, relevance_to_re, key_topics, extracted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (user_id, url) DO UPDATE SET
             title = EXCLUDED.title,
             summary = EXCLUDED.summary,
             extracted_at = NOW()`,
          [
            userId,
            parseId,
            article.title,
            article.url,
            article.summary,
            article.source,
            article.author,
            article.category,
            article.relevanceToRE,
            JSON.stringify(article.keyTopics || []),
          ]
        );
      }

      logger.info('Stored newsletter articles', {
        userId,
        source: result.newsletterSource,
        articleCount: result.articles.length,
      });
    } catch (error) {
      logger.error('Failed to store newsletter articles', { error });
    }
  }

  /**
   * Get user's extracted newsletter articles
   */
  async getUserArticles(
    userId: string,
    options?: {
      source?: string;
      relevance?: 'high' | 'medium' | 'low';
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ExtractedArticle[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIdx = 2;

    if (options?.source) {
      conditions.push(`source = $${paramIdx++}`);
      params.push(options.source);
    }

    if (options?.relevance) {
      conditions.push(`relevance_to_re = $${paramIdx++}`);
      params.push(options.relevance);
    }

    if (options?.category) {
      conditions.push(`category = $${paramIdx++}`);
      params.push(options.category);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await query(
      `SELECT * FROM user_newsletter_articles
       WHERE ${conditions.join(' AND ')}
       ORDER BY extracted_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    return result.rows.map(row => ({
      title: row.title,
      url: row.url,
      summary: row.summary,
      source: row.source,
      author: row.author,
      category: row.category,
      relevanceToRE: row.relevance_to_re,
      keyTopics: row.key_topics,
    }));
  }

  /**
   * Get articles relevant to a specific market
   */
  async getMarketArticles(userId: string, market: string, limit: number = 20): Promise<ExtractedArticle[]> {
    const result = await query(
      `SELECT a.* 
       FROM user_newsletter_articles a
       JOIN user_newsletter_parses p ON a.parse_id = p.id
       WHERE a.user_id = $1
         AND (
           p.market_mentions::text ILIKE $2
           OR a.title ILIKE $2
           OR a.summary ILIKE $2
           OR a.key_topics::text ILIKE $2
         )
       ORDER BY a.extracted_at DESC
       LIMIT $3`,
      [userId, `%${market}%`, limit]
    );

    return result.rows.map(row => ({
      title: row.title,
      url: row.url,
      summary: row.summary,
      source: row.source,
      author: row.author,
      category: row.category,
      relevanceToRE: row.relevance_to_re,
      keyTopics: row.key_topics,
    }));
  }
}

export const newsletterParserService = new NewsletterParserService();
export default newsletterParserService;
