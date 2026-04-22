/**
 * Morning Brief API
 * 
 * Generates and serves the daily morning briefing content.
 * Can be called on-demand (for widget) or by scheduled job.
 * 
 * NOT a duplicate of tasks — this is a synthesized AI summary including:
 * - Portfolio status changes overnight
 * - Market news affecting your deals
 * - Upcoming deadlines & expirations
 * - Agent activity & insights
 * - Tasks are just ONE input, not the whole brief
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// TYPES
// ============================================================================

interface MorningBriefData {
  generatedAt: string;
  greeting: string;
  summary: string;
  
  // Portfolio snapshot
  portfolio: {
    totalDeals: number;
    byStatus: Record<string, number>;
    changesOvernight: { dealId: string; dealName: string; change: string }[];
  };
  
  // Urgent items
  urgent: {
    type: 'deadline' | 'expiration' | 'alert' | 'threshold';
    title: string;
    detail: string;
    dealId?: string;
    dealName?: string;
    dueDate?: string;
  }[];
  
  // Market insights
  marketInsights: {
    headline: string;
    summary: string;
    relevantDeals?: string[];
  }[];
  
  // Tasks due today/this week
  tasksSummary: {
    dueToday: number;
    dueThisWeek: number;
    overdue: number;
    topTasks: { id: string; title: string; dealName: string; dueDate: string; priority: string }[];
  };
  
  // Agent activity
  agentActivity: {
    agentId: string;
    agentName: string;
    insight: string;
    dealName?: string;
  }[];
  
  // AI-generated narrative
  narrative: string;
}

// ============================================================================
// GET MORNING BRIEF
// ============================================================================

/**
 * GET /api/v1/morning-brief
 * Get today's morning brief (generates if needed)
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = new Date().toISOString().slice(0, 10);

    // Check for cached brief from today
    const cached = await query(
      `SELECT content FROM morning_briefs 
       WHERE user_id = $1 AND DATE(generated_at) = $2
       ORDER BY generated_at DESC LIMIT 1`,
      [userId, today]
    );

    if (cached.rows.length > 0) {
      return res.json({
        success: true,
        brief: cached.rows[0].content,
        cached: true,
      });
    }

    // Generate fresh brief
    const brief = await generateMorningBrief(userId);

    // Cache it
    await query(
      `INSERT INTO morning_briefs (user_id, content, generated_at) VALUES ($1, $2, NOW())`,
      [userId, JSON.stringify(brief)]
    );

    return res.json({
      success: true,
      brief,
      cached: false,
    });

  } catch (error: any) {
    logger.error('Morning brief error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/morning-brief/refresh
 * Force regenerate morning brief
 */
router.post('/refresh', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const brief = await generateMorningBrief(userId);

    // Cache it
    await query(
      `INSERT INTO morning_briefs (user_id, content, generated_at) VALUES ($1, $2, NOW())`,
      [userId, JSON.stringify(brief)]
    );

    return res.json({
      success: true,
      brief,
    });

  } catch (error: any) {
    logger.error('Morning brief refresh error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// BRIEF GENERATION
// ============================================================================

/**
 * Task #329 — pull the caller's premium-subscription items (forwarded
 * newsletters + authenticated RSS) from `user_news_items` so the morning
 * brief surfaces "what your WSJ/Bloomberg/FT subs reported overnight"
 * alongside agent insights.
 */
async function fetchUserPremiumMarketInsights(
  userId: string
): Promise<MorningBriefData['marketInsights']> {
  try {
    // Pull from BOTH:
    //   1. user_news_items   — forwarded newsletters + authenticated RSS (Task #329)
    //   2. user_newsletter_articles — LLM-parsed articles from subscription emails
    // Highest-relevance newsletter articles surface first, then chronological mix.
    const result = await query(
      `SELECT title, summary, publisher, url, ts FROM (
         SELECT title, summary, publisher, url,
                COALESCE(published_at, fetched_at) AS ts
           FROM user_news_items
          WHERE user_id = $1
            AND COALESCE(published_at, fetched_at) > NOW() - INTERVAL '24 hours'
         UNION ALL
         SELECT title, summary, source AS publisher, url,
                extracted_at AS ts
           FROM user_newsletter_articles
          WHERE user_id = $1
            AND extracted_at > NOW() - INTERVAL '24 hours'
            AND relevance_to_re IN ('high', 'medium')
       ) merged
       ORDER BY ts DESC
       LIMIT 8`,
      [userId]
    );
    interface PremiumRow {
      title: string;
      summary: string | null;
      publisher: string | null;
      url: string;
    }
    return (result.rows as PremiumRow[]).map((r) => ({
      headline: `[${r.publisher || 'Your Subscription'}] ${r.title}`,
      summary: r.summary || r.url,
    }));
  } catch (err) {
    logger.error('[morning-brief] failed to fetch premium news items', err);
    return [];
  }
}

async function generateMorningBrief(userId: string): Promise<MorningBriefData> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get user's first name for greeting
  const userRes = await query(`SELECT first_name FROM users WHERE id = $1`, [userId]);
  const firstName = userRes.rows[0]?.first_name || 'there';

  // Portfolio snapshot
  const portfolioRes = await query(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'screening' THEN 1 END) as screening,
       COUNT(CASE WHEN status = 'underwriting' THEN 1 END) as underwriting,
       COUNT(CASE WHEN status = 'loi' THEN 1 END) as loi,
       COUNT(CASE WHEN status = 'due_diligence' THEN 1 END) as due_diligence,
       COUNT(CASE WHEN status = 'closing' THEN 1 END) as closing
     FROM deals WHERE user_id = $1 AND status NOT IN ('closed', 'dead')`,
    [userId]
  );
  const portfolio = portfolioRes.rows[0];

  // Changes overnight (deal events in last 24h)
  const changesRes = await query(
    `SELECT de.deal_id, d.name as deal_name, de.title as change
     FROM deal_events de
     JOIN deals d ON de.deal_id = d.id
     WHERE d.user_id = $1 AND de.created_at > $2
     ORDER BY de.created_at DESC LIMIT 10`,
    [userId, yesterday]
  );

  // Urgent items (deadlines, expirations in next 7 days)
  const urgentItems: MorningBriefData['urgent'] = [];

  // Check insurance expirations
  const insuranceRes = await query(
    `SELECT di.*, d.name as deal_name, d.id as deal_id
     FROM deal_insurance di
     JOIN deals d ON di.deal_id = d.id
     WHERE d.user_id = $1 AND di.expires_at BETWEEN NOW() AND $2`,
    [userId, weekFromNow]
  );
  for (const ins of insuranceRes.rows) {
    urgentItems.push({
      type: 'expiration',
      title: 'Insurance Expiring',
      detail: `${ins.coverage_type} coverage expires ${new Date(ins.expires_at).toLocaleDateString()}`,
      dealId: ins.deal_id,
      dealName: ins.deal_name,
      dueDate: ins.expires_at,
    });
  }

  // Check task deadlines
  const tasksRes = await query(
    `SELECT t.*, d.name as deal_name
     FROM tasks t
     LEFT JOIN deals d ON t.deal_id = d.id
     WHERE t.assigned_to = $1 AND t.status != 'completed'
     AND t.due_date <= $2
     ORDER BY t.due_date ASC`,
    [userId, weekFromNow]
  );

  const todayStr = now.toISOString().slice(0, 10);
  const dueToday = tasksRes.rows.filter(t => t.due_date?.slice(0, 10) === todayStr).length;
  const overdue = tasksRes.rows.filter(t => new Date(t.due_date) < now).length;

  for (const task of tasksRes.rows.slice(0, 3)) {
    if (new Date(task.due_date) < now || task.due_date?.slice(0, 10) === todayStr) {
      urgentItems.push({
        type: 'deadline',
        title: task.title,
        detail: task.priority === 'critical' ? 'CRITICAL priority' : `${task.priority} priority`,
        dealId: task.deal_id,
        dealName: task.deal_name,
        dueDate: task.due_date,
      });
    }
  }

  // Agent activity (notifications from last 24h)
  const agentActivityRes = await query(
    `SELECT an.agent_id, an.title, an.message, d.name as deal_name
     FROM agent_notifications an
     LEFT JOIN deals d ON an.deal_id = d.id
     WHERE an.user_id = $1 AND an.created_at > $2
     ORDER BY an.created_at DESC LIMIT 5`,
    [userId, yesterday]
  );

  const agentNameMap: Record<string, string> = {
    cfo: 'CFO', legal: 'Legal', compliance: 'Compliance', strategy: 'Strategy',
    research: 'Research', acquisitions: 'Acquisitions', asset_manager: 'Asset Manager',
  };

  // Build the data structure
  const briefData: MorningBriefData = {
    generatedAt: now.toISOString(),
    greeting: getGreeting(firstName),
    summary: '',  // Will be AI-generated
    
    portfolio: {
      totalDeals: Number(portfolio.total),
      byStatus: {
        screening: Number(portfolio.screening),
        underwriting: Number(portfolio.underwriting),
        loi: Number(portfolio.loi),
        due_diligence: Number(portfolio.due_diligence),
        closing: Number(portfolio.closing),
      },
      changesOvernight: changesRes.rows.map(r => ({
        dealId: r.deal_id,
        dealName: r.deal_name,
        change: r.change,
      })),
    },
    
    urgent: urgentItems,
    
    marketInsights: await fetchUserPremiumMarketInsights(userId),
    
    tasksSummary: {
      dueToday,
      dueThisWeek: tasksRes.rows.length,
      overdue,
      topTasks: tasksRes.rows.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        dealName: t.deal_name || 'General',
        dueDate: t.due_date,
        priority: t.priority,
      })),
    },
    
    agentActivity: agentActivityRes.rows.map(a => ({
      agentId: a.agent_id,
      agentName: agentNameMap[a.agent_id] || a.agent_id,
      insight: a.title,
      dealName: a.deal_name,
    })),
    
    narrative: '',  // Will be AI-generated
  };

  // Generate AI narrative summary
  briefData.narrative = await generateNarrative(briefData, firstName);
  briefData.summary = briefData.narrative.split('\n')[0]; // First line as summary

  return briefData;
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

async function generateNarrative(data: MorningBriefData, firstName: string): Promise<string> {
  const prompt = `Generate a brief, friendly morning briefing for ${firstName}, a real estate investor. Be concise and actionable.

Data:
- Portfolio: ${data.portfolio.totalDeals} active deals (${data.portfolio.byStatus.closing} closing, ${data.portfolio.byStatus.due_diligence} in DD)
- Overnight changes: ${data.portfolio.changesOvernight.length} updates
- Urgent items: ${data.urgent.length} items needing attention
- Tasks: ${data.tasksSummary.overdue} overdue, ${data.tasksSummary.dueToday} due today
- Agent insights: ${data.agentActivity.length} new insights

Write 3-4 sentences highlighting what's most important today. Start with the most urgent item if any. Be specific with deal names and deadlines when relevant.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || 'Your morning brief is ready. Check the sections below for details.';
  } catch {
    // Fallback if AI fails
    let fallback = `You have ${data.portfolio.totalDeals} active deals. `;
    if (data.urgent.length > 0) {
      fallback += `${data.urgent.length} items need your attention. `;
    }
    if (data.tasksSummary.overdue > 0) {
      fallback += `${data.tasksSummary.overdue} tasks are overdue. `;
    }
    return fallback;
  }
}

export default router;
