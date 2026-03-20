import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import type {
  ClaudeComputeRequest,
  FinancialAssumptions,
  FinancialOutput,
  ModelType,
} from '../types/financial-model.types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Compute a financial model using Claude's structured output.
 * 
 * Steps:
 * 1. Hash assumptions to check cache
 * 2. If cached, return cached result (fast path)
 * 3. If not cached, call Claude API with structured output
 * 4. Validate output
 * 5. Cache result
 * 6. Return output
 */
export async function computeFinancialModel<T extends FinancialAssumptions>(
  request: ClaudeComputeRequest<T>
): Promise<FinancialOutput> {
  const startTime = Date.now();
  const { assumptions, systemPrompt, outputSchema, meta } = request;

  // Step 1: Hash assumptions for cache lookup
  const assumptionsJson = JSON.stringify(assumptions);
  const assumptionsHash = createHash('sha256').update(assumptionsJson).digest('hex');

  logger.info('[ClaudeCompute] Computing financial model', {
    dealId: meta.dealId,
    modelType: assumptions.modelType,
    hash: assumptionsHash.substring(0, 8),
  });

  // Step 2: Check cache
  const pool = getPool();
  const cacheResult = await pool.query(
    `SELECT output, computation_duration_ms, hit_count
     FROM model_computation_cache
     WHERE assumptions_hash = $1 AND expires_at > NOW()`,
    [assumptionsHash]
  );

  if (cacheResult.rows.length > 0) {
    const cached = cacheResult.rows[0];
    logger.info('[ClaudeCompute] Cache hit', {
      hash: assumptionsHash.substring(0, 8),
      hitCount: cached.hit_count + 1,
    });

    // Update hit count
    await pool.query(
      `UPDATE model_computation_cache 
       SET hit_count = hit_count + 1, last_accessed_at = NOW()
       WHERE assumptions_hash = $1`,
      [assumptionsHash]
    );

    return cached.output as FinancialOutput;
  }

  // Step 3: No cache - call Claude API
  logger.info('[ClaudeCompute] Cache miss - calling Claude API', {
    hash: assumptionsHash.substring(0, 8),
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      temperature: 0, // Deterministic for financial calculations
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Compute the financial model for these assumptions:\n\n${JSON.stringify(assumptions, null, 2)}`,
        },
      ],
      // Use response_format for structured output (if supported by SDK version)
      // @ts-ignore - May not be in all SDK versions yet
      response_format: {
        type: 'json_schema',
        json_schema: outputSchema,
      },
    });

    const duration = Date.now() - startTime;

    // Extract the output
    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error('Expected text content from Claude');
    }

    const output = JSON.parse(contentBlock.text) as FinancialOutput;

    // Step 4: Validate output (basic check)
    if (!output.modelType || !output.computedAt) {
      throw new Error('Invalid output structure from Claude');
    }

    // Step 5: Cache the result (30 day TTL)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO model_computation_cache 
       (assumptions_hash, model_type, assumptions, output, computation_duration_ms, tokens_used, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (assumptions_hash) DO UPDATE SET
         output = EXCLUDED.output,
         computation_duration_ms = EXCLUDED.computation_duration_ms,
         tokens_used = EXCLUDED.tokens_used,
         last_accessed_at = NOW()`,
      [
        assumptionsHash,
        assumptions.modelType,
        assumptionsJson,
        JSON.stringify(output),
        duration,
        response.usage.input_tokens + response.usage.output_tokens,
        expiresAt,
      ]
    );

    logger.info('[ClaudeCompute] Computation complete', {
      dealId: meta.dealId,
      modelType: assumptions.modelType,
      duration,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });

    return output;
  } catch (error: any) {
    logger.error('[ClaudeCompute] Claude API error', {
      error: error.message,
      dealId: meta.dealId,
    });
    throw error;
  }
}

/**
 * Invalidate cache for a deal (when fundamental assumptions change).
 */
export async function invalidateCache(dealId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `DELETE FROM model_computation_cache 
     WHERE assumptions->>'identity'->>'id' = $1`,
    [dealId]
  );
  logger.info('[ClaudeCompute] Cache invalidated for deal', { dealId });
}

/**
 * Get cache statistics for monitoring.
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  hitRate: number;
  avgComputationMs: number;
}> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_entries,
      AVG(hit_count) as avg_hits,
      AVG(computation_duration_ms) as avg_duration_ms
    FROM model_computation_cache
  `);

  const row = result.rows[0];
  return {
    totalEntries: parseInt(row.total_entries) || 0,
    hitRate: parseFloat(row.avg_hits) || 0,
    avgComputationMs: parseFloat(row.avg_duration_ms) || 0,
  };
}
