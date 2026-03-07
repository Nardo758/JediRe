/**
 * AI Chat Routes
 * Conversational AI endpoint with tool-calling for JediRe analysis agents
 */

import { Router, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const SYSTEM_PROMPT = `You are the JediRe AI Assistant — an expert in commercial real estate investment analysis.

You help users:
- Analyze market conditions, supply, competition, and rent trends
- Run financial models (ROI, cap rate, IRR, cash flow)
- Understand zoning regulations and development potential
- Compare properties and markets
- Make informed investment decisions

You have access to JediRe's analysis tools. Use them when users ask questions about specific markets, properties, or deals.

Be concise, professional, and data-driven. Format numbers clearly (use commas, $, %). When presenting tool results, summarize the key insights rather than dumping raw data. Always note that analysis is for informational purposes only — not financial, legal, or tax advice.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "analyze_market_supply",
    description: "Analyze market inventory, rent data, absorption, vacancy, and competition for a city/market area. Use when user asks about market conditions, competition, inventory, vacancy rates, rent trends, or supply/demand.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name (e.g., 'Atlanta', 'Tampa', 'Miami')" },
        stateCode: { type: "string", description: "2-letter state code (e.g., 'GA', 'FL', 'TX')" },
        propertyType: { type: "string", description: "Property type (default: 'multifamily')", enum: ["multifamily", "office", "retail", "industrial"] }
      },
      required: ["city", "stateCode"]
    }
  },
  {
    name: "analyze_cashflow",
    description: "Run cash flow and ROI analysis on a real estate investment. Use when user asks about returns, profitability, cash flow, ROI, investment metrics, or 'is this a good deal?'",
    input_schema: {
      type: "object" as const,
      properties: {
        purchasePrice: { type: "number", description: "Purchase price in dollars" },
        downPaymentPercent: { type: "number", description: "Down payment percentage (e.g., 25 for 25%)" },
        interestRate: { type: "number", description: "Annual interest rate (e.g., 6.5)" },
        loanTermYears: { type: "number", description: "Loan term in years (e.g., 30)" },
        monthlyRent: { type: "number", description: "Total monthly rental income" },
        annualTaxes: { type: "number", description: "Annual property taxes" },
        annualInsurance: { type: "number", description: "Annual insurance cost" },
        vacancyRate: { type: "number", description: "Expected vacancy rate percentage (e.g., 5)" },
        managementFeePercent: { type: "number", description: "Property management fee percentage (e.g., 8)" },
        maintenancePercent: { type: "number", description: "Maintenance/reserves percentage (e.g., 5)" }
      },
      required: ["purchasePrice", "monthlyRent"]
    }
  },
  {
    name: "analyze_zoning",
    description: "Analyze zoning regulations and development potential for a property address. Use when user asks about what can be built, zoning restrictions, unit capacity, height limits, development potential, or allowed uses.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: { type: "string", description: "Full property address including city and state" },
        lotSizeSqft: { type: "number", description: "Lot size in square feet. If user provides acres, convert: acres * 43560 = sqft" }
      },
      required: ["address"]
    }
  },
  {
    name: "search_properties",
    description: "Search JediRe's property database for properties matching criteria. Use when user asks about specific properties, comparisons, or property data in a city.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City to search in" },
        state: { type: "string", description: "2-letter state code" },
        minUnits: { type: "number", description: "Minimum number of units" },
        maxUnits: { type: "number", description: "Maximum number of units" },
        limit: { type: "number", description: "Max results to return (default 10)" }
      },
      required: ["city", "state"]
    }
  }
];

async function executeAgentTask(taskType: string, inputData: any): Promise<any> {
  try {
    const insertResult = await query(
      `INSERT INTO agent_tasks (task_type, input_data, user_id, priority, status)
       VALUES ($1, $2, 'chat-agent', 1, 'pending')
       RETURNING id`,
      [taskType, JSON.stringify(inputData)]
    );
    const taskId = insertResult.rows[0].id;

    const maxWait = 30000;
    const pollInterval = 500;
    let elapsed = 0;

    while (elapsed < maxWait) {
      const result = await query('SELECT status, output_data, error_message FROM agent_tasks WHERE id = $1', [taskId]);
      const task = result.rows[0];

      if (task.status === 'completed') {
        return task.output_data;
      } else if (task.status === 'failed') {
        return { error: task.error_message || 'Analysis failed' };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    }

    return { error: 'Analysis timed out after 30 seconds' };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function searchProperties(params: any): Promise<any> {
  try {
    const { city, state, minUnits, maxUnits, limit = 10 } = params;
    let sql = `SELECT address, city, state, units, year_built, building_sqft, stories, 
               assessed_value, land_acres, property_type, owner_name
               FROM property_records WHERE city ILIKE $1 AND state ILIKE $2`;
    const sqlParams: any[] = [city, state];
    let paramIdx = 3;

    if (minUnits) {
      sql += ` AND units >= $${paramIdx}`;
      sqlParams.push(minUnits);
      paramIdx++;
    }
    if (maxUnits) {
      sql += ` AND units <= $${paramIdx}`;
      sqlParams.push(maxUnits);
      paramIdx++;
    }

    sql += ` ORDER BY units DESC NULLS LAST LIMIT $${paramIdx}`;
    sqlParams.push(Math.min(limit, 20));

    const result = await query(sql, sqlParams);
    return {
      properties: result.rows,
      count: result.rows.length,
      city,
      state
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function executeTool(name: string, input: any): Promise<string> {
  let result: any;

  switch (name) {
    case 'analyze_market_supply':
      result = await executeAgentTask('supply_analysis', input);
      break;
    case 'analyze_cashflow': {
      const normalized: any = {
        purchasePrice: input.purchasePrice,
        downPaymentPercent: input.downPaymentPercent ?? 20,
        interestRate: input.interestRate ?? 7.0,
        loanTermYears: input.loanTermYears ?? 30,
        monthlyRent: input.monthlyRent,
      };
      if (input.annualTaxes && input.purchasePrice) {
        normalized.propertyTaxRate = (input.annualTaxes / input.purchasePrice) * 100;
      }
      if (input.annualInsurance) {
        normalized.insurance = input.annualInsurance;
      }
      if (input.vacancyRate != null) {
        normalized.vacancy = input.vacancyRate / 100;
      }
      if (input.maintenancePercent != null && input.monthlyRent) {
        normalized.maintenance = (input.maintenancePercent / 100) * input.monthlyRent * 12;
      }
      result = await executeAgentTask('cashflow_analysis', normalized);
      break;
    }
    case 'analyze_zoning':
      result = await executeAgentTask('zoning_analysis', input);
      break;
    case 'search_properties':
      result = await searchProperties(input);
      break;
    default:
      result = { error: `Unknown tool: ${name}` };
  }

  return JSON.stringify(result, null, 2);
}

const conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();

router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'AI service not configured' });
      return;
    }

    const client = new Anthropic({ apiKey });
    const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let messages: Anthropic.MessageParam[] = conversationHistory.get(convId) || [];
    messages.push({ role: 'user', content: message });

    if (messages.length > 20) {
      messages = messages.slice(-20);
    }

    const toolsUsed: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    let response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    let rounds = 0;
    const maxRounds = 4;

    while (response.stop_reason === 'tool_use' && rounds < maxRounds) {
      rounds++;

      const toolBlocks = response.content.filter(
        (block): block is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: any } =>
          block.type === 'tool_use'
      );

      if (toolBlocks.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolBlocks) {
        toolsUsed.push(tool.name);
        logger.info(`Chat executing tool: ${tool.name}`, { input: tool.input });
        const result = await executeTool(tool.name, tool.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result,
        });
      }

      messages.push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
    }

    let finalText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
      }
    }

    if (!finalText.trim()) {
      finalText = 'I processed the analysis but couldn\'t generate a summary. Please try rephrasing your question.';
    }

    messages.push({ role: 'assistant', content: response.content });
    conversationHistory.set(convId, messages);

    if (conversationHistory.size > 100) {
      const oldest = conversationHistory.keys().next().value;
      if (oldest) conversationHistory.delete(oldest);
    }

    res.json({
      response: finalText,
      conversationId: convId,
      toolsUsed,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      }
    });

  } catch (error: any) {
    logger.error('Chat error:', error);
    logger.error('Chat request failed:', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Failed to process message. Please try again.'
    });
  }
});

export default router;
