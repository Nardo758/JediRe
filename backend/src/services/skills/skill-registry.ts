/**
 * Skill Registry
 * 
 * Central registry of all skills (tools) available to the AI assistant.
 * Each skill has a JSON schema definition and an executor function.
 */

import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'analysis' | 'document' | 'action' | 'report';
  parameters: z.ZodObject<any>;
  execute: (params: any, context: SkillContext) => Promise<SkillResult>;
}

export interface SkillContext {
  dealId: string;
  userId: string;
  conversationId?: string;
}

export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
  displayType?: 'json' | 'table' | 'chart' | 'markdown' | 'confirmation';
}

export interface ToolCallRequest {
  skillId: string;
  parameters: Record<string, any>;
}

// ============================================================================
// SKILL REGISTRY CLASS
// ============================================================================

class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  /**
   * Register a skill
   */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * Get a skill by ID
   */
  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  /**
   * Get all skills
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillDefinition['category']): SkillDefinition[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Generate tool definitions for Claude API
   */
  getToolDefinitions(): any[] {
    return this.getAll().map(skill => ({
      name: skill.id,
      description: skill.description,
      input_schema: this.zodToJsonSchema(skill.parameters),
    }));
  }

  /**
   * Execute a skill
   */
  async execute(skillId: string, params: any, context: SkillContext): Promise<SkillResult> {
    const skill = this.get(skillId);
    if (!skill) {
      return { success: false, error: `Unknown skill: ${skillId}` };
    }

    try {
      // Validate parameters
      const validated = skill.parameters.parse(params);
      return await skill.execute(validated, context);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return { 
          success: false, 
          error: `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
        };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert Zod schema to JSON Schema for Claude
   */
  private zodToJsonSchema(schema: z.ZodObject<any>): any {
    const shape = schema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodType;
      properties[key] = this.zodTypeToJsonSchema(zodType);
      
      // Check if required (not optional)
      if (!zodType.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  private zodTypeToJsonSchema(zodType: z.ZodType): any {
    if (zodType instanceof z.ZodString) {
      return { type: 'string' };
    }
    if (zodType instanceof z.ZodNumber) {
      return { type: 'number' };
    }
    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }
    if (zodType instanceof z.ZodArray) {
      return { type: 'array', items: this.zodTypeToJsonSchema(zodType.element) };
    }
    if (zodType instanceof z.ZodEnum) {
      return { type: 'string', enum: zodType.options };
    }
    if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    }
    if (zodType instanceof z.ZodObject) {
      return this.zodToJsonSchema(zodType);
    }
    return { type: 'string' };
  }
}

// Export singleton
export const skillRegistry = new SkillRegistry();
export default skillRegistry;
