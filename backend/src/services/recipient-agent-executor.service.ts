/**
 * Recipient Agent Executor — Capsule Sharing Piece 4
 *
 * Validates a recipient's API key and routes queries through the provider SDK
 * with deal-scoped context. Usage logged to recipient_query_log.
 *
 * Stripe Token Billing wrapper is a follow-up; tonight ships the runtime core
 * with usage logging.
 *
 * @version 1.0.0
 * @date 2026-05-19
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { buildRecipientDealContext } from './recipient-context.service';
import { decryptToken } from './encryption';
import type { RecipientDealContext } from './recipient-context.service';

export interface AgentQueryRequest {
  accessToken: string;
  message: string;
}

export interface AgentQueryResponse {
  response: string;
  tokens_input: number;
  tokens_output: number;
  cost_basis_usd: number;
  platform_margin_usd: number;
  total_charged_usd: number;
}

interface ConnectionRow {
  connection_id: string;
  share_id: string;
  provider: string;
  api_key_encrypted: string;
  stripe_customer_id: string | null;
  disconnected_at: string | null;
}

/**
 * Build a recipient system prompt from deal context.
 */
function buildRecipientSystemPrompt(context: RecipientDealContext): string {
  return `You are a deal underwriting analysis assistant working on behalf of a recipient of a shared deal capsule.

You have access to ONE deal's data. Do not reference any other deals or the sender's portfolio — that information is not available to you.

## Deal Overview
- Name: ${context.deal_name}
- Location: ${context.property.city ?? 'Unknown'}, ${context.property.state ?? 'Unknown'}
- Type: ${context.property.property_type ?? 'Unknown'}
- Units: ${context.property.total_units ?? 'Unknown'}
- Year Built: ${context.property.year_built ?? 'Unknown'}

## Market Context
${context.market.market_id ? `- Market ID: ${context.market.market_id}
- Cycle Phase: ${context.market.cycle_phase ?? 'Not available'}
- Rent Growth Baseline: ${context.market.rent_growth_baseline != null ? `${context.market.rent_growth_baseline}%` : 'Not available'}
- Cap Rate Forecast: ${context.market.cap_rate_forecast != null ? `${context.market.cap_rate_forecast}%` : 'Not available'}` : '- Market data not available'}

## Cohort Comparison
${context.cohort.cohort_baseline_p50 != null ? `- Cohort P50: ${context.cohort.cohort_baseline_p50}
- Cohort n: ${context.cohort.cohort_n ?? 'Unknown'}
- Delta from cohort: ${context.cohort.delta_from_cohort_p50 != null ? `${(context.cohort.delta_from_cohort_p50 * 100).toFixed(1)}%` : 'Unknown'}
- Status: ${context.cohort.cohort_comparison_status ?? 'Unknown'}` : '- Cohort comparison not available'}

## Source Documents
${context.source_documents.length > 0
    ? context.source_documents.map(d => `- [${d.document_type}] ${d.filename} (${d.extracted_at?.slice(0, 10) || 'Unknown'})`).join('\n')
    : '- No source documents available'}

## Scenario
${context.scenario.scenario_id ? `- Scenario: ${context.scenario.scenario_name ?? 'Shared Scenario'}\n- Assumptions: ${JSON.stringify(context.scenario.assumptions, null, 2).slice(0, 2000)}` : '- No scenario data available'}

## Confidentiality Notice
This analysis is based on deal data shared with you by the deal owner. You may discuss the deal data but must not share the underlying documents or extracted values outside this conversation. Do not fabricate data — if information is not available, say so.

Answer questions about this specific deal only. You cannot access other deals, the sender's portfolio, or broader platform data.`;
}

/**
 * Execute a recipient agent query.
 * Routes through the recipient's own API key, not the platform's.
 */
export async function executeRecipientQuery(
  accessToken: string,
  message: string
): Promise<AgentQueryResponse> {
  const pool = getPool();
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

  // 1. Validate share + fetch connection
  const connectionResult = await pool.query<ConnectionRow>(
    `SELECT rc.connection_id, rc.share_id, rc.provider, rc.api_key_encrypted,
            rc.stripe_customer_id, rc.disconnected_at
     FROM recipient_api_connections rc
     JOIN capsule_external_shares ces ON ces.share_id = rc.share_id
     WHERE ces.access_token = $1
       AND ces.revoked_at IS NULL
       AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       AND rc.disconnected_at IS NULL
     LIMIT 1`,
    [tokenHash]
  );

  if (connectionResult.rows.length === 0) {
    throw new Error('No active API connection found for this capsule. Connect an API key first via POST /capsule-links/:accessToken/connect_api');
  }

  const connection = connectionResult.rows[0];

  // 2. Decrypt the API key (AES-256-GCM via services/encryption.ts)
  let rawKey: string;
  try {
    rawKey = decryptToken(connection.api_key_encrypted);
  } catch (decryptErr: any) {
    logger.error('Failed to decrypt recipient API key', {
      error: decryptErr?.message,
      connectionId: connection.connection_id,
    });
    throw new Error('API key decryption failed. The key may have been corrupted or the encryption key rotated. Please reconnect your API key.');
  }

  // 3. Build recipient context
  const context = await buildRecipientDealContext(connection.share_id);
  if (!context) {
    throw new Error('Deal data not found for this capsule. It may have been deleted.');
  }

  // 4. Build system prompt from context
  const systemPrompt = buildRecipientSystemPrompt(context);

  // 5. Route through the provider SDK with recipient's key
  let aiResponse: string;
  let tokensInput = 0;
  let tokensOutput = 0;

  if (connection.provider === 'anthropic') {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: rawKey });

    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    aiResponse = result.content.map((block: any) => block.text ?? '').join('\n');

    // Estimate token usage from usage metadata
    tokensInput = (result as any).usage?.input_tokens ?? 0;
    tokensOutput = (result as any).usage?.output_tokens ?? 0;
  } else if (connection.provider === 'openai') {
    const OpenAI = await import('openai');
    const client = new OpenAI.default({ apiKey: rawKey });

    const result = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    aiResponse = result.choices[0]?.message?.content ?? '';

    tokensInput = result.usage?.prompt_tokens ?? 0;
    tokensOutput = result.usage?.completion_tokens ?? 0;
  } else {
    throw new Error(`Unsupported provider: ${connection.provider}`);
  }

  // 6. Calculate costs (approximate: Anthropic ~$3/M input, $15/M output)
  const COST_INPUT_PER_TOKEN = connection.provider === 'anthropic' ? 3.0 / 1_000_000 : 2.5 / 1_000_000;
  const COST_OUTPUT_PER_TOKEN = connection.provider === 'anthropic' ? 15.0 / 1_000_000 : 10.0 / 1_000_000;

  const costBasis = (tokensInput * COST_INPUT_PER_TOKEN) + (tokensOutput * COST_OUTPUT_PER_TOKEN);
  const platformMargin = costBasis * 0.3; // 30% margin
  const totalCharged = costBasis + platformMargin;

  // 7. Log usage to recipient_query_log (before Stripe to capture even if Stripe fails)
  try {
    await pool.query(
      `INSERT INTO recipient_query_log
         (connection_id, tokens_input, tokens_output, cost_basis_usd,
          platform_margin_usd, total_charged_usd, query_category, response_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [connection.connection_id, tokensInput, tokensOutput, costBasis,
       platformMargin, totalCharged, 'deal_query', 'success']
    );
  } catch (logErr: any) {
    logger.warn('Failed to log recipient query', { error: logErr?.message, connectionId: connection.connection_id });
  }

  // 8. Report to Stripe metered billing (per-query platform fee, not LLM costs)
  if (connection.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Report the number of queries (unit-based metering)
      await stripe.billing.meterEvents.create({
        event_name: 'capsule_query_count',
        payload: {
          stripe_customer_id: connection.stripe_customer_id,
          value: '1',
        },
      });

      // Report token usage as separate meter events for informational billing
      // This enables future per-token pricing models
      await stripe.billing.meterEvents.create({
        event_name: 'capsule_input_tokens',
        payload: {
          stripe_customer_id: connection.stripe_customer_id,
          value: String(tokensInput),
        },
      });

      await stripe.billing.meterEvents.create({
        event_name: 'capsule_output_tokens',
        payload: {
          stripe_customer_id: connection.stripe_customer_id,
          value: String(tokensOutput),
        },
      });

      logger.debug('Recipient query metered to Stripe', {
        connectionId: connection.connection_id,
        stripeCustomerId: connection.stripe_customer_id,
        tokensInput,
        tokensOutput,
      });
    } catch (stripeErr: any) {
      logger.warn('Stripe metering failed (usage will be retried or reconciled later)', {
        error: stripeErr?.message,
        connectionId: connection.connection_id,
      });
    }
  } else {
    logger.debug('Stripe metering skipped (no stripe_customer_id or STRIPE_SECRET_KEY)', {
      connectionId: connection.connection_id,
      hasStripeCustomer: !!connection.stripe_customer_id,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    });
  }

  // 9. Update connection usage counters
  try {
    await pool.query(
      `UPDATE recipient_api_connections
       SET total_queries = total_queries + 1,
           total_tokens_consumed = total_tokens_consumed + $2,
           total_charges_usd = total_charges_usd + $3,
           platform_margin_usd = platform_margin_usd + $4,
           last_used_at = NOW()
       WHERE connection_id = $1`,
      [connection.connection_id, tokensInput + tokensOutput, totalCharged, platformMargin]
    );
  } catch (updateErr: any) {
    logger.warn('Failed to update connection counters', { error: updateErr?.message, connectionId: connection.connection_id });
  }

  return {
    response: aiResponse,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    cost_basis_usd: Math.round(costBasis * 100) / 100,
    platform_margin_usd: Math.round(platformMargin * 100) / 100,
    total_charged_usd: Math.round(totalCharged * 100) / 100,
  };
}
