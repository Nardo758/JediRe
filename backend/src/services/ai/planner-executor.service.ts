/**
 * Planner-Executor Service
 * 
 * Architecture:
 * - PLANNER (Claude Haiku): Fast, smart, creates execution plans
 * - EXECUTOR (DeepSeek V3): Cheap, reliable, executes structured tasks
 * 
 * Cost comparison per 1M tokens:
 * - Claude Sonnet: $3 in / $15 out
 * - Claude Haiku:  $0.80 in / $4 out  
 * - DeepSeek V3:   $0.27 in / $1.10 out  ← 10x cheaper than Sonnet
 * 
 * Flow:
 * 1. User request comes in
 * 2. Planner (Haiku) analyzes and creates structured plan
 * 3. Executor (DeepSeek) runs each step
 * 4. Results aggregated and returned
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionStep {
  id: string;
  type: 'extract' | 'transform' | 'analyze' | 'generate' | 'validate' | 'summarize';
  description: string;
  input: Record<string, any>;
  dependsOn?: string[];  // Step IDs this depends on
  model?: 'deepseek' | 'haiku' | 'sonnet';  // Override model for this step
}

export interface ExecutionPlan {
  goal: string;
  steps: ExecutionStep[];
  expectedOutput: string;
  estimatedCost: {
    tokens: number;
    usd: number;
  };
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output: any;
  tokensUsed: { input: number; output: number };
  durationMs: number;
  error?: string;
}

export interface ExecutionResult {
  plan: ExecutionPlan;
  results: StepResult[];
  finalOutput: any;
  totalCost: {
    tokens: { input: number; output: number };
    usd: number;
  };
  totalDurationMs: number;
}

// ============================================================================
// PRICING
// ============================================================================

const PRICING = {
  'haiku': { input: 0.80, output: 4.00 },      // per 1M tokens
  'sonnet': { input: 3.00, output: 15.00 },
  'deepseek': { input: 0.27, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 }
} as const;

// ============================================================================
// SERVICE
// ============================================================================

export class PlannerExecutorService {
  private anthropic: Anthropic;
  private openRouterKey: string;
  private openRouterBase = 'https://openrouter.ai/api/v1';

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
    this.openRouterKey = process.env.OPENROUTER_API_KEY || '';
  }

  // ==========================================================================
  // PLANNER (Claude Haiku)
  // ==========================================================================

  async plan(request: {
    task: string;
    context?: Record<string, any>;
    constraints?: string[];
    maxSteps?: number;
  }): Promise<ExecutionPlan> {
    const systemPrompt = `You are a task planner. Given a request, break it down into executable steps.

Each step should be:
- Self-contained with clear inputs/outputs
- Executable by a simpler model (DeepSeek)
- Structured for reliable parsing

Output JSON only:
{
  "goal": "What we're trying to achieve",
  "steps": [
    {
      "id": "step_1",
      "type": "extract|transform|analyze|generate|validate|summarize",
      "description": "What this step does",
      "input": { ... },
      "dependsOn": [],
      "model": "deepseek"  // or "haiku" for complex reasoning
    }
  ],
  "expectedOutput": "What the final result looks like",
  "estimatedCost": { "tokens": 5000, "usd": 0.01 }
}

Step types:
- extract: Pull specific data from text
- transform: Convert data format
- analyze: Derive insights from data
- generate: Create new content
- validate: Check data quality/accuracy
- summarize: Condense information

Use "haiku" model override only for steps requiring nuanced judgment.
Default everything to "deepseek" for cost efficiency.`;

    const userPrompt = `Task: ${request.task}

${request.context ? `Context:\n${JSON.stringify(request.context, null, 2)}` : ''}

${request.constraints?.length ? `Constraints:\n${request.constraints.map(c => `- ${c}`).join('\n')}` : ''}

${request.maxSteps ? `Maximum steps: ${request.maxSteps}` : ''}

Create an execution plan.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Planner did not return valid JSON');
    }

    return JSON.parse(jsonMatch[0]) as ExecutionPlan;
  }

  // ==========================================================================
  // EXECUTOR (DeepSeek via OpenRouter)
  // ==========================================================================

  async executeStep(step: ExecutionStep, previousResults: Record<string, any>): Promise<StepResult> {
    const startTime = Date.now();
    const model = step.model || 'deepseek';

    try {
      // Resolve dependencies
      const resolvedInput = this.resolveDependencies(step.input, previousResults);

      // Build prompt based on step type
      const prompt = this.buildStepPrompt(step, resolvedInput);

      let output: any;
      let tokensUsed = { input: 0, output: 0 };

      if (model === 'deepseek' || model === 'deepseek-reasoner') {
        const result = await this.callDeepSeek(prompt, model);
        output = result.output;
        tokensUsed = result.tokens;
      } else {
        const result = await this.callClaude(prompt, model);
        output = result.output;
        tokensUsed = result.tokens;
      }

      return {
        stepId: step.id,
        success: true,
        output,
        tokensUsed,
        durationMs: Date.now() - startTime
      };

    } catch (error: any) {
      return {
        stepId: step.id,
        success: false,
        output: null,
        tokensUsed: { input: 0, output: 0 },
        durationMs: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private buildStepPrompt(step: ExecutionStep, input: Record<string, any>): string {
    const typeInstructions: Record<string, string> = {
      extract: 'Extract the requested data from the input. Return structured JSON.',
      transform: 'Transform the input data into the requested format. Return the transformed data.',
      analyze: 'Analyze the input and provide insights. Return structured findings.',
      generate: 'Generate the requested content based on the input. Be precise and follow any templates.',
      validate: 'Validate the input data. Return { valid: boolean, errors: string[], warnings: string[] }.',
      summarize: 'Summarize the input concisely. Focus on key points.'
    };

    return `Task: ${step.description}

Instructions: ${typeInstructions[step.type] || 'Complete the task as described.'}

Input:
${JSON.stringify(input, null, 2)}

Respond with JSON only. No explanation.`;
  }

  private resolveDependencies(
    input: Record<string, any>, 
    previousResults: Record<string, any>
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Reference to previous step output: $step_1.fieldName
        const [stepId, ...path] = value.slice(1).split('.');
        let result = previousResults[stepId];
        
        for (const p of path) {
          if (result && typeof result === 'object') {
            result = result[p];
          }
        }
        
        resolved[key] = result;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  private async callDeepSeek(
    prompt: string, 
    model: 'deepseek' | 'deepseek-reasoner' = 'deepseek'
  ): Promise<{ output: any; tokens: { input: number; output: number } }> {
    const modelId = model === 'deepseek-reasoner' 
      ? 'deepseek/deepseek-r1'
      : 'deepseek/deepseek-chat-v3-0324';

    const response = await fetch(`${this.openRouterBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jedire.com',
        'X-Title': 'JediRe'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.1  // Low temp for structured output
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    
    // Try to parse as JSON
    let output: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      output = jsonMatch ? JSON.parse(jsonMatch[0]) : text;
    } catch {
      output = text;
    }

    return {
      output,
      tokens: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0
      }
    };
  }

  private async callClaude(
    prompt: string,
    model: 'haiku' | 'sonnet' = 'haiku'
  ): Promise<{ output: any; tokens: { input: number; output: number } }> {
    const modelId = model === 'sonnet' 
      ? 'claude-sonnet-4-20250514'
      : 'claude-haiku-4-5-20251001';

    const response = await this.anthropic.messages.create({
      model: modelId,
      max_tokens: 4000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Try to parse as JSON
    let output: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      output = jsonMatch ? JSON.parse(jsonMatch[0]) : text;
    } catch {
      output = text;
    }

    return {
      output,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens
      }
    };
  }

  // ==========================================================================
  // ORCHESTRATION
  // ==========================================================================

  async execute(request: {
    task: string;
    context?: Record<string, any>;
    constraints?: string[];
    maxSteps?: number;
  }): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Step 1: Plan
    const plan = await this.plan(request);

    // Step 2: Execute steps in order (respecting dependencies)
    const results: StepResult[] = [];
    const stepOutputs: Record<string, any> = {};

    for (const step of plan.steps) {
      // Check if dependencies are met
      if (step.dependsOn?.length) {
        const unmet = step.dependsOn.filter(dep => !stepOutputs[dep]);
        if (unmet.length > 0) {
          results.push({
            stepId: step.id,
            success: false,
            output: null,
            tokensUsed: { input: 0, output: 0 },
            durationMs: 0,
            error: `Unmet dependencies: ${unmet.join(', ')}`
          });
          continue;
        }
      }

      const result = await this.executeStep(step, stepOutputs);
      results.push(result);

      if (result.success) {
        stepOutputs[step.id] = result.output;
      }
    }

    // Calculate total cost
    const totalTokens = results.reduce(
      (acc, r) => ({
        input: acc.input + r.tokensUsed.input,
        output: acc.output + r.tokensUsed.output
      }),
      { input: 0, output: 0 }
    );

    // Estimate cost (mostly DeepSeek)
    const estimatedCost = 
      (totalTokens.input * PRICING.deepseek.input / 1_000_000) +
      (totalTokens.output * PRICING.deepseek.output / 1_000_000);

    // Get final output from last successful step
    const lastSuccess = [...results].reverse().find(r => r.success);
    const finalOutput = lastSuccess?.output || null;

    return {
      plan,
      results,
      finalOutput,
      totalCost: {
        tokens: totalTokens,
        usd: estimatedCost
      },
      totalDurationMs: Date.now() - startTime
    };
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Quick extraction - plan + execute in one call
   */
  async extract(text: string, schema: Record<string, string>): Promise<any> {
    const result = await this.execute({
      task: `Extract the following fields from the text: ${Object.keys(schema).join(', ')}`,
      context: { text, schema },
      maxSteps: 1
    });
    return result.finalOutput;
  }

  /**
   * Quick analysis - plan + execute in one call
   */
  async analyze(data: any, question: string): Promise<any> {
    const result = await this.execute({
      task: question,
      context: { data },
      maxSteps: 3
    });
    return result.finalOutput;
  }

  /**
   * Quick transform - plan + execute in one call
   */
  async transform(data: any, targetFormat: string): Promise<any> {
    const result = await this.execute({
      task: `Transform the data into ${targetFormat} format`,
      context: { data },
      maxSteps: 1
    });
    return result.finalOutput;
  }

  /**
   * Batch process with single plan
   */
  async batchProcess(items: any[], task: string): Promise<any[]> {
    // Create plan once
    const plan = await this.plan({
      task: `Process a single item: ${task}`,
      context: { sampleItem: items[0] },
      maxSteps: 3
    });

    // Execute plan for each item
    const results: any[] = [];
    
    for (const item of items) {
      const stepOutputs: Record<string, any> = { input: item };
      
      for (const step of plan.steps) {
        const resolvedInput = { ...step.input, item };
        const result = await this.executeStep(
          { ...step, input: resolvedInput },
          stepOutputs
        );
        
        if (result.success) {
          stepOutputs[step.id] = result.output;
        }
      }
      
      const lastStep = plan.steps[plan.steps.length - 1];
      results.push(stepOutputs[lastStep.id] || null);
    }

    return results;
  }
}

// Singleton
let instance: PlannerExecutorService | null = null;

export function getPlannerExecutor(): PlannerExecutorService {
  if (!instance) {
    instance = new PlannerExecutorService();
  }
  return instance;
}

export default PlannerExecutorService;
