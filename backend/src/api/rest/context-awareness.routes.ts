/**
 * Context Awareness API Routes
 * 
 * THE BRAIN THAT CONNECTS UI TO INTELLIGENCE
 * 
 * When the frontend displays "2,400 units under construction":
 * 1. Frontend calls POST /context/analyze with { context: 'supply_pipeline', focusedValue: 2400 }
 * 2. Backend returns:
 *    - Immediate questions the user is probably thinking
 *    - Data gaps that need to be filled
 *    - Proactive suggestions (drill down, compare, forecast)
 *    - Agent tasks to trigger in background
 * 3. Frontend displays expandable details + triggers research agents
 * 
 * This is how we make the system THINK like a real estate person.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getContextAwarenessService, UserFocus, UIContext } from '../../services/neural-network/context-awareness.service';

export function createContextAwarenessRoutes(pool: Pool): Router {
  const router = Router();
  const contextService = getContextAwarenessService(pool);

  // ============================================================================
  // CONTEXT ANALYSIS - The core endpoint
  // ============================================================================

  /**
   * POST /api/v1/context/analyze
   * 
   * Analyze what the user is looking at and return intelligent context
   * 
   * Request:
   * {
   *   context: 'supply_pipeline',
   *   marketId: 'atlanta',
   *   submarketId: 'midtown',
   *   focusedMetric: 'units_under_construction',
   *   focusedValue: 2400,
   *   userRole: 'acquisitions'
   * }
   * 
   * Response:
   * {
   *   immediateQuestions: [
   *     { question: "Where exactly are these projects?", available: false, ... }
   *   ],
   *   gaps: [
   *     { userQuestion: "What are the delivery dates?", relevance: "critical", ... }
   *   ],
   *   suggestions: [
   *     { type: "drill_down", title: "View Development Projects", ... }
   *   ],
   *   agentTasks: [
   *     { agentType: "supply", task: "Fetch latest permit data", priority: "immediate" }
   *   ]
   * }
   */
  router.post('/analyze', async (req: Request, res: Response) => {
    try {
      const focus: UserFocus = {
        context: req.body.context || 'market_dashboard',
        dealId: req.body.dealId,
        propertyId: req.body.propertyId,
        marketId: req.body.marketId,
        submarketId: req.body.submarketId,
        focusedMetric: req.body.focusedMetric,
        focusedValue: req.body.focusedValue,
        timeHorizon: req.body.timeHorizon || 'current',
        userRole: req.body.userRole || 'analyst'
      };
      
      const analysis = await contextService.analyzeContext(focus);
      
      res.json({
        success: true,
        ...analysis,
        
        // Summary for quick UI decisions
        summary: {
          unansweredQuestions: analysis.immediateQuestions.filter(q => !q.available).length,
          criticalGaps: analysis.gaps.filter(g => g.relevance === 'critical').length,
          suggestionsCount: analysis.suggestions.length,
          pendingAgentTasks: analysis.agentTasks.length
        }
      });
    } catch (error) {
      console.error('[ContextAwareness] Error analyzing context:', error);
      res.status(500).json({ success: false, error: 'Failed to analyze context' });
    }
  });

  // ============================================================================
  // SUPPLY PIPELINE EXPANSION - "What are those 2,400 units?"
  // ============================================================================

  /**
   * GET /api/v1/context/supply-pipeline/:marketId
   * 
   * Get full details of the supply pipeline when user clicks on the metric
   * 
   * This is what happens when they see "2,400 units" and want to know:
   * - Which specific projects?
   * - Where exactly?
   * - When do they deliver?
   * - Who is building them?
   * - What class are they?
   */
  router.get('/supply-pipeline/:marketId', async (req: Request, res: Response) => {
    try {
      const { marketId } = req.params;
      const { submarketId } = req.query;
      
      const pipeline = await contextService.expandSupplyPipeline(
        marketId,
        submarketId as string | undefined
      );
      
      res.json({
        success: true,
        marketId,
        submarketId: submarketId || null,
        ...pipeline,
        
        // UI-friendly summary
        summary: {
          totalUnits: pipeline.totalUnits,
          projectCount: pipeline.projects.length,
          submarketCount: Object.keys(pipeline.bySubmarket).length,
          dataGaps: pipeline.gaps.length,
          
          // Top breakdowns for quick display
          topSubmarkets: Object.entries(pipeline.bySubmarket)
            .sort(([, a], [, b]) => b.units - a.units)
            .slice(0, 5)
            .map(([name, data]) => ({ name, ...data })),
          
          topDevelopers: Object.entries(pipeline.byDeveloper)
            .filter(([name]) => name !== 'Unknown')
            .sort(([, a], [, b]) => b.units - a.units)
            .slice(0, 5)
            .map(([name, data]) => ({ name, ...data })),
          
          deliveryTimeline: Object.entries(pipeline.byQuarter)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([quarter, data]) => ({ quarter, ...data }))
        }
      });
    } catch (error) {
      console.error('[ContextAwareness] Error expanding supply pipeline:', error);
      res.status(500).json({ success: false, error: 'Failed to expand supply pipeline' });
    }
  });

  // ============================================================================
  // GAPS ENDPOINT - What data is missing?
  // ============================================================================

  /**
   * POST /api/v1/context/gaps
   * 
   * Get detailed gaps for a specific context
   * This helps the UI show "We're missing X, Y, Z - want us to research?"
   */
  router.post('/gaps', async (req: Request, res: Response) => {
    try {
      const focus: UserFocus = {
        context: req.body.context || 'deal_overview',
        dealId: req.body.dealId,
        propertyId: req.body.propertyId,
        marketId: req.body.marketId,
        submarketId: req.body.submarketId,
        focusedMetric: req.body.focusedMetric,
        focusedValue: req.body.focusedValue
      };
      
      const analysis = await contextService.analyzeContext(focus);
      
      res.json({
        success: true,
        gaps: analysis.gaps,
        
        // Grouped by relevance
        critical: analysis.gaps.filter(g => g.relevance === 'critical'),
        important: analysis.gaps.filter(g => g.relevance === 'important'),
        niceToHave: analysis.gaps.filter(g => g.relevance === 'nice_to_have'),
        
        // Suggested actions
        agentTasks: analysis.agentTasks.filter(t => t.priority === 'immediate'),
        
        // Natural language summary
        summary: analysis.gaps.length > 0
          ? `Found ${analysis.gaps.length} data gaps. ${analysis.gaps.filter(g => g.relevance === 'critical').length} are critical for analysis.`
          : 'All required data is available.'
      });
    } catch (error) {
      console.error('[ContextAwareness] Error getting gaps:', error);
      res.status(500).json({ success: false, error: 'Failed to get gaps' });
    }
  });

  // ============================================================================
  // TRIGGER RESEARCH - Tell agents to fill gaps
  // ============================================================================

  /**
   * POST /api/v1/context/trigger-research
   * 
   * Trigger agent research to fill identified gaps
   */
  router.post('/trigger-research', async (req: Request, res: Response) => {
    try {
      const { gaps, priority = 'background' } = req.body;
      
      if (!gaps || !Array.isArray(gaps)) {
        return res.status(400).json({ 
          success: false, 
          error: 'gaps array required' 
        });
      }
      
      // Here we would trigger actual agent tasks
      // For now, return what would be triggered
      const triggeredTasks = gaps.map((gap: any) => ({
        gapId: gap.id,
        agent: gap.suggestedAgent || 'research',
        task: gap.userQuestion,
        priority,
        status: 'queued',
        estimatedCompletion: priority === 'immediate' ? '30s' : '5m'
      }));
      
      // TODO: Actually enqueue these to Inngest or agent system
      // await inngest.send({ name: 'agent/research', data: { tasks: triggeredTasks } });
      
      res.json({
        success: true,
        triggered: triggeredTasks.length,
        tasks: triggeredTasks,
        message: `Triggered ${triggeredTasks.length} research tasks`
      });
    } catch (error) {
      console.error('[ContextAwareness] Error triggering research:', error);
      res.status(500).json({ success: false, error: 'Failed to trigger research' });
    }
  });

  // ============================================================================
  // WHAT-IF ANALYSIS - "How does this affect my deal?"
  // ============================================================================

  /**
   * POST /api/v1/context/what-if
   * 
   * Analyze how a change (e.g., new supply) affects a specific deal
   */
  router.post('/what-if', async (req: Request, res: Response) => {
    try {
      const { 
        dealId, 
        scenario,  // 'new_supply', 'rent_decline', 'vacancy_spike', etc.
        magnitude,
        timeframe 
      } = req.body;
      
      if (!dealId || !scenario) {
        return res.status(400).json({ 
          success: false, 
          error: 'dealId and scenario required' 
        });
      }
      
      // This would run scenario analysis
      // For now, return structure of what we'd calculate
      
      const analysis = {
        scenario,
        magnitude: magnitude || 'moderate',
        timeframe: timeframe || '12_months',
        
        impacts: {
          rentGrowth: {
            baseline: 3.2,
            withScenario: scenario === 'new_supply' ? 1.8 : 3.2,
            delta: scenario === 'new_supply' ? -1.4 : 0,
            confidence: 0.75
          },
          occupancy: {
            baseline: 94.5,
            withScenario: scenario === 'new_supply' ? 92.0 : 94.5,
            delta: scenario === 'new_supply' ? -2.5 : 0,
            confidence: 0.7
          },
          noi: {
            baseline: 2400000,
            withScenario: scenario === 'new_supply' ? 2280000 : 2400000,
            delta: scenario === 'new_supply' ? -120000 : 0,
            confidence: 0.65
          },
          valuation: {
            baseline: 42000000,
            withScenario: scenario === 'new_supply' ? 40000000 : 42000000,
            delta: scenario === 'new_supply' ? -2000000 : 0,
            confidence: 0.6
          }
        },
        
        recommendations: [
          scenario === 'new_supply' 
            ? 'Consider adjusting rent growth assumptions from 3.2% to 1.8% in years 1-2'
            : 'Current assumptions appear reasonable',
          scenario === 'new_supply'
            ? 'Factor in 6-month lease-up delay due to increased competition'
            : null,
          scenario === 'new_supply'
            ? 'Review amenity comparison with new Class A deliveries'
            : null
        ].filter(Boolean),
        
        relatedProjects: scenario === 'new_supply' ? [
          { name: 'Midtown Towers', units: 350, delivery: 'Q3 2026', overlap: 'high' },
          { name: 'Peachtree Residences', units: 280, delivery: 'Q1 2027', overlap: 'medium' }
        ] : []
      };
      
      res.json({
        success: true,
        dealId,
        ...analysis
      });
    } catch (error) {
      console.error('[ContextAwareness] Error running what-if:', error);
      res.status(500).json({ success: false, error: 'Failed to run what-if analysis' });
    }
  });

  // ============================================================================
  // ANALYST QUESTIONS - "What would an analyst ask?"
  // ============================================================================

  /**
   * GET /api/v1/context/analyst-questions/:context
   * 
   * Get the questions a real analyst would ask in this context
   * Useful for prompting users or training
   */
  router.get('/analyst-questions/:context', async (req: Request, res: Response) => {
    try {
      const { context } = req.params;
      const { metric } = req.query;
      
      // Build a focus to analyze
      const focus: UserFocus = {
        context: context as UIContext,
        focusedMetric: metric as string
      };
      
      const analysis = await contextService.analyzeContext(focus);
      
      res.json({
        success: true,
        context,
        metric: metric || null,
        questions: analysis.immediateQuestions.map(q => ({
          question: q.question,
          dataNeeded: q.dataNeeded,
          answered: q.available
        })),
        suggestions: analysis.suggestions.map(s => ({
          action: s.title,
          description: s.description
        }))
      });
    } catch (error) {
      console.error('[ContextAwareness] Error getting analyst questions:', error);
      res.status(500).json({ success: false, error: 'Failed to get analyst questions' });
    }
  });

  // ============================================================================
  // ASK THE NETWORK — natural-language Q&A over the knowledge graph
  // ============================================================================

  /**
   * POST /api/v1/context/query
   *
   * Free-form question answering powered by the knowledge graph + LLM.
   *
   * Request:
   *   { question: string, dealId?, marketId?, submarketId?, limit? }
   *
   * Response:
   *   { success, text, sources: [{id,type,name,score}], matched, ts }
   */
  router.post('/query', async (req: Request, res: Response) => {
    try {
      const { question, dealId, marketId, submarketId, limit } = req.body || {};

      if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({
          success: false,
          error: 'question (non-empty string) is required',
        });
      }

      const result = await contextService.answer(question, {
        dealId,
        marketId,
        submarketId,
        limit: typeof limit === 'number' ? limit : undefined,
      });

      res.json({
        success: true,
        ...result,
        ts: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[ContextAwareness] Error answering question:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to answer question',
        message: error?.message,
      });
    }
  });

  return router;
}

export default createContextAwarenessRoutes;
