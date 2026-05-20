/**
 * News Sentiment Scorer (Task #388)
 *
 * Produces a `{ score, label }` pair for any news article — used by:
 *   - email-news-extraction.service.storeNewsEvent (per-ingest scoring)
 *   - scripts/backfill-news-sentiment.ts        (one-time backfill)
 *
 * `score` is a number in [-1, +1]; `label` is one of 'bullish' | 'neutral'
 * | 'bearish' (matching AgentSentimentLabel used by sentiment-history).
 *
 * Strategy:
 *   1. If an LLM provider is configured (DeepSeek / Claude / OpenAI /
 *      OpenRouter via llm.service.generateCompletion), prompt for a JSON
 *      `{score, label}` reading. Cheap one-shot, ~200 tokens.
 *   2. If the LLM is unavailable, returns null so the caller can decide
 *      whether to fall back to a deterministic lexicon scorer or skip.
 *   3. Lexicon scorer (`scoreNewsItemLexicon`) is always available — used
 *      by the backfill as a zero-cost fallback when the LLM rate-limits
 *      or errors, so the chart still lights up even without API credits.
 */

import { generateCompletion } from './llm.service';
import { logger } from '../utils/logger';

export type SentimentLabel = 'bullish' | 'neutral' | 'bearish';

export interface NewsSentiment {
  score: number;       // [-1, +1], 3-decimal precision
  label: SentimentLabel;
  source: 'llm' | 'lexicon' | 'preset';
}

/**
 * Normalize any free-form sentiment label (or score) into the
 * bullish/neutral/bearish triad. Tolerant of legacy values like
 * 'very_positive', 'positive', 'negative', 'very_negative'.
 */
export function normalizeLabel(score: number, rawLabel?: string | null): SentimentLabel {
  if (rawLabel) {
    const lower = rawLabel.toLowerCase();
    if (lower.includes('bull') || lower.includes('positive') || lower === 'up') return 'bullish';
    if (lower.includes('bear') || lower.includes('negative') || lower === 'down') return 'bearish';
    if (lower === 'neutral' || lower === 'mixed') return 'neutral';
  }
  if (score >= 0.2) return 'bullish';
  if (score <= -0.2) return 'bearish';
  return 'neutral';
}

function clampScore(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, Number(n.toFixed(3))));
}

/**
 * Deterministic lexicon scorer. Looks for bullish/bearish keywords in
 * title + summary and produces a score in [-1, +1]. Used as a fallback
 * when the LLM is unavailable; intentionally conservative so it errs
 * toward neutral rather than fabricating strong opinions.
 */
export function scoreNewsItemLexicon(title: string, summary: string): NewsSentiment {
  const text = `${title ?? ''} ${summary ?? ''}`.toLowerCase();

  const bullish = [
    'expansion', 'expand', 'expanding', 'growth', 'grows', 'growing', 'surge', 'surges',
    'boom', 'rally', 'rallies', 'record high', 'all-time high', 'beats', 'outperform',
    'jobs added', 'hiring', 'hires', 'opens', 'opening', 'investment', 'investing',
    'breaks ground', 'groundbreaking', 'launches', 'acquires', 'acquisition',
    'milestone', 'demand surge', 'rents rise', 'rising rents', 'occupancy gains',
    'new headquarters', 'relocates to', 'incentive package', 'tax credit', 'approved',
  ];
  const bearish = [
    'layoff', 'layoffs', 'fired', 'closes', 'closing', 'closure', 'shutdown',
    'bankrupt', 'bankruptcy', 'default', 'defaults', 'foreclosure', 'foreclosed',
    'lawsuit', 'sued', 'fraud', 'investigation', 'crash', 'crashes', 'plunge',
    'plunges', 'tumble', 'tumbles', 'recession', 'downturn', 'oversupply',
    'vacancy spike', 'rents fall', 'falling rents', 'concessions', 'delinquency',
    'distressed', 'distress sale', 'job cuts', 'cuts jobs', 'pulls out',
    'cancels', 'cancelled', 'denied', 'rejected', 'blocked', 'permits denied',
  ];

  let score = 0;
  let hits = 0;
  for (const kw of bullish) {
    if (text.includes(kw)) { score += 0.18; hits++; }
  }
  for (const kw of bearish) {
    if (text.includes(kw)) { score -= 0.22; hits++; }
  }
  // Cap raw hit influence so a single dramatic article doesn't pin to ±1.
  if (hits === 0) {
    return { score: 0, label: 'neutral', source: 'lexicon' };
  }
  const clamped = clampScore(score);
  return { score: clamped, label: normalizeLabel(clamped), source: 'lexicon' };
}

/**
 * LLM-backed scorer. Returns null when no provider is configured or the
 * call fails — callers (e.g. backfill) decide whether to fall back to the
 * lexicon scorer. Uses a tight prompt + small token budget to keep cost
 * negligible (~200 tokens per article).
 */
export async function scoreNewsItemLLM(
  title: string,
  summary: string,
): Promise<NewsSentiment | null> {
  const titleTrim = (title ?? '').trim();
  const summaryTrim = (summary ?? '').trim();
  if (!titleTrim && !summaryTrim) return null;

  const prompt = `You are a market analyst scoring the sentiment of a real-estate news article for an investor dashboard.

Article title: ${titleTrim.substring(0, 240)}
Article summary: ${summaryTrim.substring(0, 800)}

Return ONLY valid JSON in this exact shape, no prose:
{"score": <number from -1.0 to 1.0>, "label": "bullish"|"neutral"|"bearish"}

Scoring rubric (for commercial real estate / market demand):
- bullish (+0.3 to +1.0): job growth, corporate expansion, infrastructure investment, rising demand, capital inflows, favorable regulation
- neutral (-0.2 to +0.2): mixed signals, routine reporting, or unclear impact
- bearish (-0.3 to -1.0): layoffs, closures, oversupply, regulatory headwinds, falling rents, distress

Return JSON only.`;

  try {
    const response = await generateCompletion({
      prompt,
      maxTokens: 80,
      temperature: 0.1,
    });
    const cleaned = response.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { score?: unknown; label?: unknown };
    const rawScore = typeof parsed.score === 'number' ? parsed.score : Number(parsed.score);
    if (!Number.isFinite(rawScore)) return null;
    const score = clampScore(rawScore);
    const label = normalizeLabel(score, typeof parsed.label === 'string' ? parsed.label : null);
    return { score, label, source: 'llm' };
  } catch (err) {
    logger.debug('news-sentiment-scorer: LLM scoring failed, will fall back', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Convenience wrapper: try LLM, fall back to lexicon. Always returns a
 * sentiment — callers should treat the result as authoritative.
 */
export async function scoreNewsItem(
  title: string,
  summary: string,
): Promise<NewsSentiment> {
  const llm = await scoreNewsItemLLM(title, summary);
  if (llm) return llm;
  return scoreNewsItemLexicon(title, summary);
}

/**
 * Convert a pre-existing numeric sentiment (e.g. from the email extraction
 * pipeline, which already produces a -1..+1 score) into a normalized
 * NewsSentiment with the correct bullish/neutral/bearish label.
 */
export function fromExistingScore(score: number, rawLabel?: string | null): NewsSentiment {
  const clamped = clampScore(score);
  return { score: clamped, label: normalizeLabel(clamped, rawLabel), source: 'preset' };
}
