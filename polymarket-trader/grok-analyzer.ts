/**
 * Grok (xAI) Analyzer
 * Uses Grok's real-time X/Twitter data for sentiment analysis
 */

import OpenAI from 'openai';
import type { Config, Market, GrokAnalysis } from './types.js';

export class GrokAnalyzer {
  private grok: OpenAI;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.grok = new OpenAI({
      apiKey: config.apis.xai.apiKey,
      baseURL: 'https://api.x.ai/v1',
    });
  }

  /**
   * Analyze a market using Grok's real-time data access
   */
  async analyzeMarket(market: Market): Promise<GrokAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(market);
      
      const response = await this.grok.chat.completions.create({
        model: this.config.apis.xai.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more factual analysis
        max_tokens: 2000,
      });

      const analysisText = response.choices[0]?.message?.content || '';
      return this.parseAnalysis(analysisText, market);
    } catch (error) {
      console.error('Error analyzing with Grok:', error);
      
      // Return neutral fallback analysis
      return {
        sentiment: 'NEUTRAL',
        confidence: 0,
        summary: 'Analysis unavailable due to API error',
        twitterTrends: [],
        newsHighlights: [],
        riskFactors: ['Analysis service temporarily unavailable'],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build the analysis prompt for Grok
   */
  private buildAnalysisPrompt(market: Market): string {
    return `Analyze this prediction market using your real-time X/Twitter data and news access:

**Market Question:** ${market.question}

**Current Prices:**
- YES: ${market.yesPrice.toFixed(2)}%
- NO: ${market.noPrice.toFixed(2)}%

**Market Details:**
- Volume: $${market.volume.toLocaleString()}
- Category: ${market.category}
- End Date: ${market.endDate}

Please provide:
1. **Sentiment**: Overall market sentiment (BULLISH/BEARISH/NEUTRAL/MIXED)
2. **Confidence**: Your confidence in this sentiment (0-100)
3. **Twitter Trends**: Key trending topics or hashtags related to this market
4. **News Highlights**: Recent news that could impact the outcome
5. **Risk Factors**: Potential risks or uncertainty factors
6. **Summary**: Brief 2-3 sentence analysis

Format your response as JSON:
{
  "sentiment": "BULLISH|BEARISH|NEUTRAL|MIXED",
  "confidence": 75,
  "summary": "Brief analysis here...",
  "twitterTrends": ["#trend1", "#trend2"],
  "newsHighlights": ["News item 1", "News item 2"],
  "riskFactors": ["Risk 1", "Risk 2"]
}`;
  }

  /**
   * System prompt for Grok
   */
  private getSystemPrompt(): string {
    return `You are a prediction market analyst with access to real-time Twitter/X data and breaking news. Your job is to analyze sentiment, trends, and news related to prediction markets.

Key strengths:
- Real-time social media sentiment tracking
- Breaking news analysis
- Trend identification
- Detecting market-moving events

Be objective, data-driven, and highlight both bullish and bearish signals. Focus on facts over speculation.`;
  }

  /**
   * Parse Grok's response into structured analysis
   */
  private parseAnalysis(analysisText: string, market: Market): GrokAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: this.normalizeSentiment(parsed.sentiment),
          confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
          summary: parsed.summary || analysisText.slice(0, 300),
          twitterTrends: parsed.twitterTrends || [],
          newsHighlights: parsed.newsHighlights || [],
          riskFactors: parsed.riskFactors || [],
          timestamp: Date.now(),
        };
      }
    } catch (e) {
      // JSON parsing failed, extract what we can
    }

    // Fallback: analyze text sentiment
    const sentiment = this.detectSentimentFromText(analysisText);
    
    return {
      sentiment,
      confidence: 50,
      summary: analysisText.slice(0, 300),
      twitterTrends: [],
      newsHighlights: [],
      riskFactors: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Normalize sentiment string
   */
  private normalizeSentiment(sentiment: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' {
    const s = sentiment.toUpperCase();
    if (s.includes('BULL')) return 'BULLISH';
    if (s.includes('BEAR')) return 'BEARISH';
    if (s.includes('MIX')) return 'MIXED';
    return 'NEUTRAL';
  }

  /**
   * Detect sentiment from text (fallback)
   */
  private detectSentimentFromText(text: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' {
    const lower = text.toLowerCase();
    const bullishWords = ['positive', 'bullish', 'optimistic', 'strong', 'growth', 'increase'];
    const bearishWords = ['negative', 'bearish', 'pessimistic', 'weak', 'decline', 'decrease'];
    
    const bullishCount = bullishWords.filter(word => lower.includes(word)).length;
    const bearishCount = bearishWords.filter(word => lower.includes(word)).length;
    
    if (bullishCount > bearishCount + 1) return 'BULLISH';
    if (bearishCount > bullishCount + 1) return 'BEARISH';
    if (bullishCount > 0 && bearishCount > 0) return 'MIXED';
    return 'NEUTRAL';
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.grok.chat.completions.create({
        model: this.config.apis.xai.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      return true;
    } catch (error) {
      console.error('Grok API health check failed:', error);
      return false;
    }
  }
}
