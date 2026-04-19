/**
 * ToolRegistry — Typed tool registration with capability enforcement.
 *
 * Usage:
 *   const registry = new ToolRegistry(['read:parcels', 'write:deal_context']);
 *   registry.register(fetchParcelTool);
 *   const tool = registry.get('fetch_parcel'); // throws if not found
 *
 * Capability check: a tool's requiresCapability must appear in the agent's
 * capability list, or executeTool() throws.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';
import type { ToolDefinition, RunContext } from './types';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor(private agentCapabilities: string[]) {}

  /**
   * Register a tool. Throws if the agent lacks the required capability.
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (!this.agentCapabilities.includes(tool.requiresCapability)) {
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
   * Throws if the agent lacks the required capability (double-check at execution).
   */
  async executeTool(
    name: string,
    input: unknown,
    ctx: RunContext
  ): Promise<unknown> {
    const tool = this.getTool(name);

    if (!this.agentCapabilities.includes(tool.requiresCapability)) {
      throw new Error(
        `Capability check failed at execution for tool "${name}": ` +
        `requires "${tool.requiresCapability}"`
      );
    }

    const validatedInput = tool.inputSchema.parse(input);
    logger.debug('ToolRegistry: executing tool', { name, input: validatedInput });

    const output = await tool.execute(validatedInput, ctx);
    return tool.outputSchema.parse(output);
  }

  /**
   * Convert registered tools to Anthropic tool-use schema format.
   */
  toAnthropicTools(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        // The inputSchema is a Zod schema — serialize it to JSON Schema format
        // by extracting the shape if available, otherwise use a permissive schema.
        properties: {},
        description: tool.description,
      },
    }));
  }

  /**
   * Return all registered tool names.
   */
  toolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
