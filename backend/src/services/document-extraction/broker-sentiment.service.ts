/**
 * broker-sentiment — converts a Broker OM's narrative text into a discrete
 * sentiment signal that feeds into the existing market_sentiment_history
 * time-series (Task #383, building on #382).
 *
 * Approach:
 *   1. If `investmentThesis` and `investmentHighlights` are both empty there
 *      is nothing to score → return null. We never invent a signal.
 *   2. Otherwise we send the narrative to the same `jediAI.generate` channel
 *      the OM parser already uses (so usage hits the metering ledger) with a
 *      strict JSON schema response: { label, score, rationale }.
 *   3. The label is mapped to the existing -1 / 0 / +1 agent_score the
 *      sentiment-history writer expects, and recorded with source='broker_om'.
 *
 * The function is fail-soft at the persistence layer (recordSentimentSnapshot
 * already returns ok/error) but fail-hard at the LLM layer — if the model
 * returns malformed output we throw so the calling pipeline can surface the
 * error in the file's parsing_errors column instead of silently dropping.
 */

import { jediAI } from '../ai/aiService';
import type { AICallContext } from '../../types/dealContext';
import {
  recordSentimentSnapshot,
  labelToScore,
  type AgentSentimentLabel,
} from '../sentiment-history.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface BrokerSentimentResult {
  label: AgentSentimentLabel;
  score: -1 | 0 | 1;
  rationale: string;
  recordedFor: Array<{ entityType: 'msa' | 'submarket'; entityId: string; ok: boolean; error?: string }>;
}

interface ScoreArgs {
  thesis: string | null;
  highlights: string[];
  msaKey: string | null;
  submarketKey: string | null;
  userId?: string | null;
  fileId: number;
}

const SYSTEM_PROMPT = `You are a real estate investment-sentiment classifier.
Given a broker's investment thesis and selling-point highlights for one
property, classify the broker's overall sentiment toward the LOCAL MARKET
(not the property condition itself) as one of: bullish, neutral, bearish.

Brokers naturally exaggerate; weight the strength of macro/market language
(growth drivers, supply pressure, rent trajectory) more heavily than
property-level claims. Return STRICT JSON only — no prose, no markdown.`;

const RESPONSE_SCHEMA = `{
  "label": "bullish | neutral | bearish",
  "score": -1 | 0 | 1,           // mirrors label: bearish=-1, neutral=0, bullish=1
  "rationale": "<= 240 chars explaining the call"
}`;

function entityIdFromKey(key: string): string | null {
  // canonicalMsaKey  → "msa:<id>"
  // canonicalSubmarketKey → "submarket:<source>:<id>"
  const parts = key.split(':');
  if (parts[0] === 'msa' && parts.length >= 2) return parts.slice(1).join(':');
  if (parts[0] === 'submarket' && parts.length >= 3) return parts[2];
  return null;
}

function parseScored(raw: string): { label: AgentSentimentLabel; rationale: string } {
  let body = raw.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) body = fenced[1].trim();
  const parsed = JSON.parse(body) as { label?: unknown; rationale?: unknown };

  if (parsed.label !== 'bullish' && parsed.label !== 'neutral' && parsed.label !== 'bearish') {
    throw new Error(`broker sentiment: invalid label "${String(parsed.label)}"`);
  }
  return {
    label: parsed.label,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 240) : '',
  };
}

export async function scoreBrokerSentiment(args: ScoreArgs): Promise<BrokerSentimentResult | null> {
  const blocks: string[] = [];
  if (args.thesis && args.thesis.trim().length > 0) {
    blocks.push(`THESIS:\n${args.thesis.trim()}`);
  }
  const cleanHighlights = (args.highlights ?? [])
    .filter(h => typeof h === 'string' && h.trim().length > 0)
    .map(h => `- ${h.trim()}`)
    .slice(0, 20);
  if (cleanHighlights.length > 0) {
    blocks.push(`HIGHLIGHTS:\n${cleanHighlights.join('\n')}`);
  }
  if (blocks.length === 0) {
    logger.debug('[broker-sentiment] no narrative content — skipping', { fileId: args.fileId });
    return null;
  }

  const userMessage = `${blocks.join('\n\n')}\n\nReturn JSON matching:\n${RESPONSE_SCHEMA}`;

  let stripeCustomerId = '';
  if (args.userId) {
    try {
      const r = await query(
        `SELECT stripe_customer_id FROM user_credit_balances WHERE user_id = $1`,
        [args.userId],
      );
      stripeCustomerId = r.rows[0]?.stripe_customer_id ?? '';
    } catch {
      // metering surface degrades to default — never block the pipeline on it
    }
  }

  const callContext: AICallContext = {
    userId: args.userId ?? '',
    stripeCustomerId,
    operationType: 'om_parsing',
    agentId: 'research',
    surface: 'autonomous',
    routingSurface: { type: 'pipeline', id: 'om_parsing' },
  };

  const message = await jediAI.generate(
    callContext,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userMessage }],
    { maxTokens: 400, temperature: 0 },
  );

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('broker sentiment: LLM returned non-text response');
  }
  const { label, rationale } = parseScored(block.text);
  const score = labelToScore(label);

  const targets: Array<{ entityType: 'msa' | 'submarket'; entityId: string }> = [];
  if (args.msaKey) {
    const id = entityIdFromKey(args.msaKey);
    if (id) targets.push({ entityType: 'msa', entityId: id });
  }
  if (args.submarketKey) {
    const id = entityIdFromKey(args.submarketKey);
    if (id) targets.push({ entityType: 'submarket', entityId: id });
  }

  const recordedFor: BrokerSentimentResult['recordedFor'] = [];
  for (const t of targets) {
    const out = await recordSentimentSnapshot({
      entityType: t.entityType,
      entityId: t.entityId,
      agentScore: score,
      source: 'broker_om',
    });
    recordedFor.push({
      entityType: t.entityType,
      entityId: t.entityId,
      ok: out.ok,
      error: out.error,
    });
  }

  logger.info('[broker-sentiment] recorded', {
    fileId: args.fileId, label, score,
    targets: recordedFor.length, rationale,
  });

  // Ingest sentiment into Knowledge Graph
  try {
    const { getKnowledgeGraph } = await import('../neural-network/knowledge-graph.service');
    const { getPool } = await import('../../database/connection');
    const kg = getKnowledgeGraph(getPool());
    await kg.upsertNode({
      type: 'Event',
      externalId: `broker-sentiment-${args.fileId}`,
      name: `Broker Sentiment: ${label} (${score})`,
      properties: {
        eventType: 'broker_sentiment',
        fileId: args.fileId,
        sentimentLabel: label,
        sentimentScore: score,
        rationale,
        targets: recordedFor,
      }
    });
  } catch (graphErr) { /* Non-fatal */ }

  return { label, score, rationale, recordedFor };
}
