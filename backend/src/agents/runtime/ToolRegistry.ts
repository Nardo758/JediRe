/**
 * ToolRegistry — Typed tool registration with capability enforcement.
 *
 * Usage:
 *   const registry = new ToolRegistry(['read:all', 'write:deal_context']);
 *   registry.register(fetchParcelTool);
 *   const result = await registry.executeTool('fetch_parcel', input, ctx);
 *
 * Capability check: a tool's requiresCapability must be present in the agent's
 * capability list. Wildcards are supported: 'read:all' grants any 'read:*'
 * capability, 'write:all' grants any 'write:*' capability. This matches the
 * wildcard-aware check in AgentRuntime.executeTool() exactly.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';
import { zodToAnthropicInputSchema } from './AgentRuntime';
import type { ToolDefinition, RunContext } from './types';

// ── Shared wildcard-aware capability helper ───────────────────────

/**
 * Returns true if agentCapabilities satisfies the required capability string.
 * Supports wildcard shorthand: 'read:all' grants any 'read:*' capability;
 * 'write:all' grants any 'write:*' capability.
 * Must stay in sync with hasCapability() in AgentRuntime.ts.
 */
function hasCapability(agentCapabilities: string[], required: string): boolean {
  if (agentCapabilities.includes(required)) return true;
  const [prefix] = required.split(':');
  if (agentCapabilities.includes(`${prefix}:all`)) return true;
  return false;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor(private agentCapabilities: string[]) {}

  /**
   * Register a tool. Throws if the agent lacks the required capability.
   * Supports wildcard capabilities (read:all, write:all).
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (!hasCapability(this.agentCapabilities, tool.requiresCapability)) {
      throw new Error(
        `Cannot register tool "${tool.name}": agent lacks capability "${tool.requiresCapability}". ` +
        `Agent has: [${this.agentCapabilities.join(', ')}]`
      );
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /**
   * Look up a registered tool by name.
   */
  getTool(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: "${name}"`);
    return tool;
  }

  /**
   * Execute a tool by name, validating input and output via Zod schemas.
   * Re-checks capability at execution time (defence in depth).
   * Supports wildcard capabilities (read:all, write:all).
   */
  async executeTool(
    name: string,
    input: unknown,
    ctx: RunContext
  ): Promise<unknown> {
    const tool = this.getTool(name);

    if (!hasCapability(this.agentCapabilities, tool.requiresCapability)) {
      throw new Error(
        `Capability check failed at execution for tool "${name}": ` +
        `requires "${tool.requiresCapability}", ` +
        `agent has [${this.agentCapabilities.join(', ')}]`
      );
    }

    const validatedInput = tool.inputSchema.parse(input);
    logger.debug('ToolRegistry: executing tool', { name, input: validatedInput });

    const output = await tool.execute(validatedInput, ctx);
    return tool.outputSchema.parse(output);
  }

  /**
   * Convert registered tools to Anthropic tool-use schema format.
   * Uses zodToAnthropicInputSchema (Zod v4 z.toJSONSchema, no `as any`) to
   * emit real input_schema with properties and required fields.
   */
  toAnthropicTools(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToAnthropicInputSchema(tool.inputSchema),
    }));
  }

  /**
   * Return all registered tool names.
   */
  toolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
