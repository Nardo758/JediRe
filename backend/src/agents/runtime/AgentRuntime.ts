/**
 * AgentRuntime — Core primitive for all five Layer 1 agents.
 *
 * Implements the 6-step tool-calling loop from AGENT_PLATFORM_SPEC.md:
 *  1. Pre-flight budget check
 *  2. Create agent_run row
 *  3. Load system prompt from prompt_versions
 *  4. Tool-calling loop (Claude ↔ tools, with per-step persistence)
 *  5. Validate output against Zod schema
 *  6. Mark run complete, return validated output
 *
 * See CLAUDE.md "Agents vs Intents vs Personas" for 3-layer architecture.
 */

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { BudgetEnforcer } from './BudgetEnforcer';
import { MeteringAdapter } from './MeteringAdapter';
import {
  BudgetExceededError,
  type AgentConfig,
  type RunContext,
  type LoopResult,
  type AgentRun,
} from './types';

// ── Anthropic tool schema conversion ─────────────────────────────

/**
 * JSON Schema property object as expected by the Anthropic tool-use API.
 * Typed explicitly so there are no `any` casts in the conversion path.
 */
interface AnthropicInputSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string; [k: string]: unknown }>;
  required?: string[];
}

/**
 * Convert a Zod schema to an Anthropic-compatible JSON Schema object.
 *
 * Uses Zod v4's native `z.toJSONSchema()` API — no internal `_def` access
 * or `as any` casts. Falls back to a permissive object schema for types
 * that produce no properties (e.g. ZodUnknown at root level).
 */
function zodToAnthropicInputSchema(schema: z.ZodSchema): AnthropicInputSchema {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;

  const properties =
    json.properties != null &&
    typeof json.properties === 'object' &&
    !Array.isArray(json.properties)
      ? (json.properties as Record<string, { type: string; description?: string }>)
      : {};

  const required =
    Array.isArray(json.required) && json.required.length > 0
      ? (json.required as string[])
      : undefined;

  return { type: 'object', properties, ...(required ? { required } : {}) };
}

function toAnthropicToolSchema(tool: AgentConfig['tools'][number]): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: zodToAnthropicInputSchema(tool.inputSchema),
  };
}

/** Export for reuse in ToolRegistry. */
export { zodToAnthropicInputSchema };

// ── Capability check (supports wildcard read:all / write:all) ─────

/**
 * Check that an agent has the required capability.
 * Supports wildcard shorthand: 'read:all' grants any 'read:*' capability;
 * 'write:all' grants any 'write:*' capability.
 */
function hasCapability(agentCapabilities: string[], required: string): boolean {
  if (agentCapabilities.includes(required)) return true;
  const [prefix] = required.split(':');
  if (agentCapabilities.includes(`${prefix}:all`)) return true;
  return false;
}

// ── AgentRuntime ──────────────────────────────────────────────────

export class AgentRuntime {
  constructor(
    private config: AgentConfig,
    private metering: MeteringAdapter,
    private budget: BudgetEnforcer
  ) {}

  /**
   * Execute a full agent run.
   * Handles DB bookkeeping, loop, schema validation, error capture.
   */
  async run(
    input: unknown,
    ctx: RunContext
  ): Promise<Record<string, unknown>> {
    // Step 1: Pre-flight budget check
    await this.budget.check(ctx, this.config.budgetCaps);

    // Step 2: Create agent_run row
    const runId = uuidv4();
    await query(
      `INSERT INTO agent_runs
         (id, agent_id, agent_version, prompt_version,
          deal_id, user_id, triggered_by, trigger_context,
          status, input, tokens_in, tokens_out, cost_usd, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'running',$9,0,0,0,NOW())`,
      [
        runId,
        this.config.agentId,
        this.config.agentVersion,
        this.config.promptVersion,
        ctx.dealId ?? null,
        ctx.userId ?? null,
        ctx.triggeredBy,
        ctx.triggerContext ? JSON.stringify(ctx.triggerContext) : null,
        JSON.stringify(input),
      ]
    );

    const run: AgentRun = {
      id: runId,
      agent_id: this.config.agentId,
      agent_version: this.config.agentVersion,
      prompt_version: this.config.promptVersion,
      deal_id: ctx.dealId,
      user_id: ctx.userId,
      triggered_by: ctx.triggeredBy,
      trigger_context: ctx.triggerContext,
      status: 'running',
      input: input as Record<string, unknown>,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      started_at: new Date().toISOString(),
    };

    const startMs = Date.now();

    // Shared mutable container so the catch block can persist whatever was
    // accrued before the failure — critical for BudgetEnforcer daily-cap accuracy.
    const accrued = { tokensIn: 0, tokensOut: 0, cost: 0 };

    try {
      // Step 3: Load system prompt
      const promptRow = await query(
        `SELECT system_prompt FROM prompt_versions
         WHERE agent_id = $1 AND active = true
         ORDER BY created_at DESC LIMIT 1`,
        [this.config.agentId]
      );

      const systemPrompt: string =
        promptRow.rows[0]?.system_prompt ??
        `You are the ${this.config.agentId} agent for JEDI RE. ` +
        `Analyze real estate data and respond with structured JSON.`;

      // Step 4: Tool-calling loop
      // Stamp correlationId with run.id and agentId from config so tools use
      // the caller's identity for platformClient.as() instead of hardcoding.
      const ctxWithRun: RunContext = { ...ctx, correlationId: run.id, agentId: this.config.agentId };
      const result = await this.loop({ run, systemPrompt, userMessage: JSON.stringify(input), ctx: ctxWithRun, accrued });

      // Step 5: Validate output
      const validated = this.config.outputSchema.parse(result.content);

      // Step 6: Mark complete
      await query(
        `UPDATE agent_runs
         SET status = 'succeeded', output = $1,
             tokens_in = $2, tokens_out = $3, cost_usd = $4,
             completed_at = NOW(),
             duration_ms = $5
         WHERE id = $6`,
        [
          JSON.stringify(validated),
          result.totalTokensIn,
          result.totalTokensOut,
          result.totalCost,
          Date.now() - startMs,
          runId,
        ]
      );

      logger.info('AgentRuntime: run succeeded', {
        runId,
        agentId: this.config.agentId,
        tokens: result.totalTokensIn + result.totalTokensOut,
        costUsd: result.totalCost,
      });

      return validated as Record<string, unknown>;

    } catch (err) {
      const status = err instanceof BudgetExceededError ? 'budget_exceeded' : 'failed';
      const message = err instanceof Error ? err.message : String(err);

      // Write accrued cost/tokens so BudgetEnforcer.checkRunCap() daily-cap sums
      // are accurate even for failed/budget-exceeded runs.
      await query(
        `UPDATE agent_runs
         SET status = $1, error = $2,
             tokens_in = $3, tokens_out = $4, cost_usd = $5,
             completed_at = NOW(),
             duration_ms = $6
         WHERE id = $7`,
        [status, message, accrued.tokensIn, accrued.tokensOut, accrued.cost, Date.now() - startMs, runId]
      ).catch(dbErr => logger.error('AgentRuntime: failed to mark run failed', { dbErr }));

      throw err;
    }
  }

  // ── Private loop ────────────────────────────────────────────────

  private async loop(params: {
    run: AgentRun;
    systemPrompt: string;
    userMessage: string;
    ctx: RunContext;
    /** Mutable container updated each step so execute() catch block can persist
     *  accrued spend even when the loop terminates early (budget cap, tool error). */
    accrued: { tokensIn: number; tokensOut: number; cost: number };
  }): Promise<LoopResult> {
    const { run, systemPrompt, userMessage, ctx, accrued } = params;
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCost = 0;
    let stepIndex = 0;

    for (let i = 0; i < this.config.budgetCaps.maxStepsPerRun; i++) {
      // Per-step budget check
      await this.budget.checkRunCap(run.id, totalCost, this.config.budgetCaps);

      // Call Claude via metering adapter
      const response = await this.metering.createMessage({
        model: this.config.modelName,
        system: systemPrompt,
        messages,
        tools: this.config.tools.map(toAnthropicToolSchema),
        max_tokens: 4096,
        metadata: {
          actor_type: 'agent',
          actor_id: this.config.agentId,
          agent_run_id: run.id,
          deal_id: ctx.dealId,
          user_id: ctx.userId,
          triggered_by: ctx.triggeredBy,
        },
      });

      totalTokensIn += response.usage.input_tokens;
      totalTokensOut += response.usage.output_tokens;
      totalCost += response.usage.cost_usd;

      // Keep shared container in sync so catch block can persist partial spend
      accrued.tokensIn = totalTokensIn;
      accrued.tokensOut = totalTokensOut;
      accrued.cost = totalCost;

      // Per-run cap check AFTER the call so over-limit is caught even on last step
      await this.budget.checkRunCap(run.id, totalCost, this.config.budgetCaps);

      // Log prompt step
      await this.persistStep({
        agent_run_id: run.id,
        step_index: stepIndex++,
        step_type: 'prompt',
        payload: { stop_reason: response.stop_reason },
        tokens_in: response.usage.input_tokens,
        tokens_out: response.usage.output_tokens,
      });

      // Handle tool calls
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUses.length === 0) {
        // Final output — expect last text block to be JSON
        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        );
        let content: Record<string, unknown> = {};
        if (textBlock?.text) {
          try {
            content = JSON.parse(textBlock.text);
          } catch {
            content = { raw: textBlock.text };
          }
        }
        return { content, totalTokensIn, totalTokensOut, totalCost };
      }

      // Execute tools in parallel
      const toolResults = await Promise.all(
        toolUses.map(tu => this.executeTool(tu, run, ctx, stepIndex++))
      );

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    throw new Error(
      `Agent "${this.config.agentId}" exceeded maxStepsPerRun ` +
      `(${this.config.budgetCaps.maxStepsPerRun})`
    );
  }

  private async executeTool(
    toolUse: Anthropic.ToolUseBlock,
    run: AgentRun,
    ctx: RunContext,
    stepIndex: number
  ): Promise<Anthropic.ToolResultBlockParam> {
    const tool = this.config.tools.find(t => t.name === toolUse.name);
    if (!tool) {
      throw new Error(`Unknown tool requested by model: "${toolUse.name}"`);
    }

    // Capability enforcement at execution time (supports wildcard read:all/write:all)
    const agentCaps: string[] = this.config.capabilities ?? [];
    if (tool.requiresCapability && !hasCapability(agentCaps, tool.requiresCapability)) {
      throw new Error(
        `Capability check failed: tool "${tool.name}" requires "${tool.requiresCapability}" ` +
        `but agent "${this.config.agentId}" has [${agentCaps.join(', ')}]`
      );
    }

    const input = tool.inputSchema.parse(toolUse.input);

    // Log tool call
    await this.persistStep({
      agent_run_id: run.id,
      step_index: stepIndex,
      step_type: 'tool_call',
      tool_name: tool.name,
      payload: input as Record<string, unknown>,
    });

    const start = Date.now();
    let output: unknown;

    try {
      output = await tool.execute(input, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('AgentRuntime: tool execution failed', {
        tool: tool.name,
        err: message,
      });
      // Return error to model so it can recover
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({ error: message }),
      };
    }

    const validated = tool.outputSchema.parse(output);
    const duration = Date.now() - start;

    // Log tool result
    await this.persistStep({
      agent_run_id: run.id,
      step_index: stepIndex,
      step_type: 'tool_result',
      tool_name: tool.name,
      payload: validated as Record<string, unknown>,
      duration_ms: duration,
    });

    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: JSON.stringify(validated),
    };
  }

  private async persistStep(params: {
    agent_run_id: string;
    step_index: number;
    step_type: string;
    tool_name?: string;
    payload: Record<string, unknown>;
    tokens_in?: number;
    tokens_out?: number;
    duration_ms?: number;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_run_steps
           (id, agent_run_id, step_index, step_type,
            tool_name, payload, tokens_in, tokens_out, duration_ms, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [
          uuidv4(),
          params.agent_run_id,
          params.step_index,
          params.step_type,
          params.tool_name ?? null,
          JSON.stringify(params.payload),
          params.tokens_in ?? null,
          params.tokens_out ?? null,
          params.duration_ms ?? null,
        ]
      );
    } catch (err) {
      // Non-fatal: don't let step persistence break the run
      logger.warn('AgentRuntime: failed to persist step', { err, params });
    }
  }
}
