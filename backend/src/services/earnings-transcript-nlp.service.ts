import Anthropic from '@anthropic-ai/sdk';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface GuidanceSentimentResult {
  sentiment_score: number;
  headcount_direction: 'expanding' | 'stable' | 'contracting';
  facility_plans: Array<{
    type: 'expansion' | 'contraction' | 'relocation';
    location_hint: string;
    magnitude: string;
  }>;
  key_quotes: string[];
  confidence: number;
}

const GUIDANCE_PROMPT = `You are analyzing an earnings call transcript for real estate demand signals.
Extract ONLY information relevant to:
1. Headcount plans (hiring, layoffs, freeze)
2. Facility/office plans (expansion, consolidation, relocation)
3. Geographic market commentary (growth markets, exit markets)
4. Forward guidance tone (confident expansion vs cautious contraction)

Respond ONLY in JSON:
{
  "sentiment_score": <number -100 to +100>,
  "headcount_direction": "expanding" | "stable" | "contracting",
  "facility_plans": [{ "type": "expansion|contraction|relocation", "location_hint": "<string>", "magnitude": "<string>" }],
  "key_quotes": [<max 3 relevant quotes, under 15 words each>],
  "confidence": <0.0 to 1.0>
}`;

export class EarningsTranscriptNLPService {
  async analyzeTranscript(
    transcript: string,
    ticker: string,
  ): Promise<GuidanceSentimentResult> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0,
        system: GUIDANCE_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Ticker: ${ticker}\n\nTranscript excerpt:\n${transcript.slice(0, 8000)}`,
          },
        ],
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Expected text content from Claude');
      }

      const parsed = JSON.parse(contentBlock.text) as GuidanceSentimentResult;

      logger.info(`[EarningsNLP] Analyzed ${ticker}: sentiment=${parsed.sentiment_score}, headcount=${parsed.headcount_direction}`);
      return parsed;
    } catch (err: any) {
      logger.error(`[EarningsNLP] Error analyzing ${ticker}: ${err.message}`);
      return {
        sentiment_score: 0,
        headcount_direction: 'stable',
        facility_plans: [],
        key_quotes: [],
        confidence: 0,
      };
    }
  }

  async analyzeAndStore(
    transcript: string,
    ticker: string,
    fiscalQuarter: string,
  ): Promise<GuidanceSentimentResult> {
    const result = await this.analyzeTranscript(transcript, ticker);

    const pool = getPool();
    await pool.query(
      `UPDATE corporate_financials
       SET guidance_sentiment = $1,
           guidance_raw_text = $2
       WHERE ticker = $3 AND fiscal_quarter = $4`,
      [result.sentiment_score, JSON.stringify(result), ticker, fiscalQuarter],
    );

    return result;
  }
}

export const earningsNLPService = new EarningsTranscriptNLPService();
