/**
 * OPUS (Claude 3 Opus) AI Service
 * 
 * Main service for AI-powered deal analysis using Anthropic's Claude 3 Opus
 * Handles acquisition analysis, performance analysis, and conversational chat
 */

import {
  OpusDealContext,
  OpusRecommendationResult,
  OpusRecommendation,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  OpusConfig,
  OpusUsageMetrics,
  OpusError,
  OpusErrorCode,
  AnalysisMode,
  Risk,
  Opportunity,
  ActionItem
} from '../types/opus.types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: OpusConfig = {
  model: 'claude-3-opus-20240229',
  maxTokens: 4096,
  temperature: 0.7,
  useMockData: false, // Set to true for development without API key
  enableCaching: true,
  enableStreaming: false,
  retryAttempts: 3,
  timeoutMs: 60000
};

// ============================================================================
// Opus Service Class
// ============================================================================

class OpusService {
  private config: OpusConfig;
  private usageMetrics: OpusUsageMetrics;
  private activeSessions: Map<string, ChatMessage[]>;

  constructor(config?: Partial<OpusConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.usageMetrics = {
      totalRequests: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      averageResponseTime: 0,
      errorRate: 0
    };
    this.activeSessions = new Map();

    // Check for API key in environment
    if (!this.config.apiKey && !this.config.useMockData) {
      const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (envKey) {
        this.config.apiKey = envKey;
      }
    }
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Analyze deal for acquisition decision
   */
  async analyzeAcquisition(context: OpusDealContext): Promise<OpusRecommendationResult> {
    return this.analyze(context, 'acquisition');
  }

  /**
   * Analyze owned asset performance and optimization opportunities
   */
  async analyzePerformance(context: OpusDealContext): Promise<OpusRecommendationResult> {
    return this.analyze(context, 'performance');
  }

  /**
   * Chat with Opus about a specific deal
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      if (!request.dealId || !request.message) {
        throw this.createError('INVALID_REQUEST', 'Deal ID and message are required');
      }

      // Get or create session
      const sessionId = request.sessionId || this.generateSessionId(request.dealId);
      const sessionMessages = this.activeSessions.get(sessionId) || [];

      // Build message history
      const messages: ChatMessage[] = [
        ...sessionMessages,
        {
          id: this.generateMessageId(),
          role: 'user',
          content: request.message,
          timestamp: new Date().toISOString()
        }
      ];

      // Get AI response
      const assistantMessage = await this.getAIResponse(
        messages,
        request.includeContext ? this.buildChatSystemPrompt() : undefined,
        request.temperature,
        request.maxTokens
      );

      // Update session
      messages.push(assistantMessage);
      this.activeSessions.set(sessionId, messages);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, assistantMessage.metadata?.tokensUsed || 0);

      return {
        message: assistantMessage,
        sessionId,
        suggestions: this.generateSuggestions(assistantMessage.content)
      };

    } catch (error) {
      this.usageMetrics.errorRate = 
        (this.usageMetrics.errorRate * this.usageMetrics.totalRequests + 1) / 
        (this.usageMetrics.totalRequests + 1);
      throw error;
    }
  }

  /**
   * Clear chat session
   */
  clearSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get current usage metrics
   */
  getUsageMetrics(): OpusUsageMetrics {
    return { ...this.usageMetrics };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OpusConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==========================================================================
  // Private Methods - Core Analysis
  // ==========================================================================

  private async analyze(
    context: OpusDealContext,
    mode: AnalysisMode
  ): Promise<OpusRecommendationResult> {
    const startTime = Date.now();

    try {
      // Validate context
      this.validateContext(context);

      // Build system prompt
      const systemPrompt = this.getSystemPrompt(mode);

      // Build analysis prompt
      const userPrompt = this.buildAnalysisPrompt(context, mode);

      // Get AI analysis
      const response = await this.callAnthropicAPI(systemPrompt, userPrompt);

      // Parse response
      const result = this.parseAnalysisResponse(response, mode);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, response.tokensUsed || 0);

      return result;

    } catch (error) {
      this.usageMetrics.errorRate = 
        (this.usageMetrics.errorRate * this.usageMetrics.totalRequests + 1) / 
        (this.usageMetrics.totalRequests + 1);
      throw error;
    }
  }

  // ==========================================================================
  // Private Methods - API Communication
  // ==========================================================================

  private async callAnthropicAPI(
    systemPrompt: string,
    userPrompt: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<any> {
    // Check if using mock data
    if (this.config.useMockData) {
      return this.getMockResponse(userPrompt);
    }

    // Check for API key
    if (!this.config.apiKey) {
      throw this.createError(
        'API_KEY_MISSING',
        'Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY or enable mock mode.'
      );
    }

    // Make API call with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < (this.config.retryAttempts || 3); attempt++) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens || this.config.maxTokens,
            temperature: temperature !== undefined ? temperature : this.config.temperature,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: userPrompt
              }
            ]
          }),
          signal: AbortSignal.timeout(this.config.timeoutMs || 60000)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle rate limiting
          if (response.status === 429) {
            if (attempt < (this.config.retryAttempts || 3) - 1) {
              await this.sleep(Math.pow(2, attempt) * 1000);
              continue;
            }
            throw this.createError('RATE_LIMIT_EXCEEDED', 'API rate limit exceeded');
          }

          throw this.createError(
            'API_ERROR',
            errorData.error?.message || `API error: ${response.status}`
          );
        }

        const data = await response.json();
        
        return {
          content: data.content[0].text,
          tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
          model: data.model
        };

      } catch (error: any) {
        lastError = error;
        if (error.name === 'AbortError') {
          throw this.createError('TIMEOUT', 'API request timed out');
        }
        if (attempt === (this.config.retryAttempts || 3) - 1) {
          throw error;
        }
        await this.sleep(1000 * (attempt + 1));
      }
    }

    throw lastError || this.createError('UNKNOWN_ERROR', 'Failed to complete API request');
  }

  private async getAIResponse(
    messages: ChatMessage[],
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<ChatMessage> {
    const lastMessage = messages[messages.length - 1];
    
    // Build conversation history
    const conversationHistory = messages
      .slice(-10) // Last 10 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = systemPrompt 
      ? `${systemPrompt}\n\nConversation:\n${conversationHistory}`
      : conversationHistory;

    const response = await this.callAnthropicAPI(
      systemPrompt || this.buildChatSystemPrompt(),
      lastMessage.content,
      temperature,
      maxTokens
    );

    return {
      id: this.generateMessageId(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString(),
      metadata: {
        tokensUsed: response.tokensUsed,
        model: response.model,
        temperature: temperature || this.config.temperature
      }
    };
  }

  // ==========================================================================
  // Private Methods - System Prompts
  // ==========================================================================

  private getSystemPrompt(mode: AnalysisMode): string {
    const basePrompt = `You are an expert real estate investment analyst with decades of experience in commercial real estate acquisition and asset management. You provide data-driven, comprehensive analysis with clear recommendations.`;

    const acquisitionPrompt = `${basePrompt}

Your task is to analyze a potential real estate acquisition and provide a clear buy/pass/hold recommendation. Consider:

1. **Financial Viability**: Returns, cash flow, financing terms, value proposition
2. **Market Dynamics**: Competition, supply/demand, market trends, pricing
3. **Risk Assessment**: Market risks, execution risks, financing risks, operational risks
4. **Strategic Fit**: Strategy alignment, opportunity type, value creation potential
5. **Execution Complexity**: Due diligence requirements, timeline, stakeholder alignment

Provide your analysis in a structured JSON format with:
- Overall score (0-10)
- Confidence level (0-100%)
- Clear recommendation (strong-buy, buy, hold, pass, strong-pass)
- Executive summary reasoning
- Key insights (3-5 critical points)
- Detailed risks with mitigation strategies
- Opportunities with value estimates
- Prioritized action items

Be direct, quantitative where possible, and highlight both upside and downside.`;

    const performancePrompt = `${basePrompt}

Your task is to analyze a currently owned real estate asset and recommend optimization strategies. Consider:

1. **Performance Analysis**: Current vs. projected returns, cash flow trends, value appreciation
2. **Operational Efficiency**: Occupancy, expense ratios, revenue optimization opportunities
3. **Market Position**: Competitive standing, market changes, positioning strategy
4. **Value Enhancement**: Capital improvements, operational improvements, repositioning
5. **Exit Strategy**: Hold/optimize vs. sell timing and scenarios

Provide your analysis in a structured JSON format with:
- Overall performance score (0-10)
- Confidence level (0-100%)
- Clear recommendation (optimize, hold-asset, sell)
- Executive summary of current performance
- Key insights on strengths and weaknesses
- Optimization opportunities with value impact
- Risks to current performance
- Prioritized action items for improvement

Focus on actionable recommendations with clear ROI implications.`;

    return mode === 'acquisition' ? acquisitionPrompt : performancePrompt;
  }

  private buildChatSystemPrompt(): string {
    return `You are an expert real estate investment advisor assisting with deal analysis. 

You have access to comprehensive deal data including property specs, financial projections, market analysis, competitive positioning, and supply/demand dynamics.

Provide clear, concise, data-driven answers. When discussing numbers, be specific. When making recommendations, explain your reasoning. Keep responses focused and actionable.

If you need more information to provide a complete answer, ask specific questions about what data would be helpful.`;
  }

  // ==========================================================================
  // Private Methods - Prompt Building
  // ==========================================================================

  private buildAnalysisPrompt(context: OpusDealContext, mode: AnalysisMode): string {
    const sections: string[] = [
      `# Deal Analysis Request`,
      ``,
      `**Deal**: ${context.dealName} (${context.dealId})`,
      `**Status**: ${context.status}`,
      `**Analysis Mode**: ${mode === 'acquisition' ? 'Acquisition Decision' : 'Performance Optimization'}`,
      ``
    ];

    // Add overview data
    if (context.overview) {
      sections.push(`## Property Overview`);
      sections.push(this.formatOverview(context.overview));
      sections.push(``);
    }

    // Add competition data
    if (context.competition) {
      sections.push(`## Market Competition`);
      sections.push(this.formatCompetition(context.competition));
      sections.push(``);
    }

    // Add supply data
    if (context.supply) {
      sections.push(`## Supply Pipeline`);
      sections.push(this.formatSupply(context.supply));
      sections.push(``);
    }

    // Add debt market data
    if (context.debt) {
      sections.push(`## Debt Market`);
      sections.push(this.formatDebt(context.debt));
      sections.push(``);
    }

    // Add financial data
    if (context.financial) {
      sections.push(`## Financial Analysis`);
      sections.push(this.formatFinancial(context.financial));
      sections.push(``);
    }

    // Add strategy data
    if (context.strategy) {
      sections.push(`## Strategy & Arbitrage`);
      sections.push(this.formatStrategy(context.strategy));
      sections.push(``);
    }

    // Add market data
    if (context.market) {
      sections.push(`## Market Analysis`);
      sections.push(this.formatMarket(context.market));
      sections.push(``);
    }

    // Add due diligence if in acquisition mode
    if (mode === 'acquisition' && context.dueDiligence) {
      sections.push(`## Due Diligence Status`);
      sections.push(this.formatDueDiligence(context.dueDiligence));
      sections.push(``);
    }

    sections.push(`---`);
    sections.push(``);
    sections.push(`Provide a comprehensive analysis and recommendation in valid JSON format matching the OpusRecommendationResult interface.`);

    return sections.join('\n');
  }

  // Helper methods for formatting different data sections
  private formatOverview(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatCompetition(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatSupply(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatDebt(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatFinancial(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatStrategy(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatMarket(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatDueDiligence(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  // ==========================================================================
  // Private Methods - Response Parsing
  // ==========================================================================

  private parseAnalysisResponse(response: any, mode: AnalysisMode): OpusRecommendationResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : response.content;
      const parsed = JSON.parse(jsonContent);

      // Build result with defaults
      const result: OpusRecommendationResult = {
        score: parsed.score || 5,
        confidence: parsed.confidence || 50,
        recommendation: parsed.recommendation || 'hold',
        reasoning: parsed.reasoning || parsed.executiveSummary || 'Analysis pending',
        keyInsights: parsed.keyInsights || [],
        risks: this.parseRisks(parsed.risks || []),
        opportunities: this.parseOpportunities(parsed.opportunities || []),
        actionItems: this.parseActionItems(parsed.actionItems || []),
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        assumptions: parsed.assumptions || [],
        analysisDate: new Date().toISOString(),
        modelVersion: this.config.model,
        tokensUsed: response.tokensUsed,
        executiveSummary: parsed.executiveSummary || parsed.reasoning
      };

      return result;

    } catch (error) {
      // Fallback if JSON parsing fails
      return this.createFallbackResult(response.content, mode);
    }
  }

  private parseRisks(risks: any[]): Risk[] {
    return risks.map((r, i) => ({
      id: `risk-${i}`,
      category: r.category || 'General',
      description: r.description || r.toString(),
      level: r.level || 'medium',
      impact: r.impact || 'medium',
      probability: r.probability || 50,
      mitigation: r.mitigation,
      priority: r.priority || 5
    }));
  }

  private parseOpportunities(opportunities: any[]): Opportunity[] {
    return opportunities.map((o, i) => ({
      id: `opp-${i}`,
      type: o.type || 'operational',
      description: o.description || o.toString(),
      potentialValue: o.potentialValue,
      probability: o.probability || 50,
      requirements: o.requirements || [],
      timeline: o.timeline,
      priority: o.priority || 5
    }));
  }

  private parseActionItems(items: any[]): ActionItem[] {
    return items.map((item, i) => ({
      id: `action-${i}`,
      action: item.action || item.toString(),
      category: item.category || 'General',
      priority: item.priority || 'medium',
      timeframe: item.timeframe || 'Near-term',
      owner: item.owner,
      dependencies: item.dependencies
    }));
  }

  private createFallbackResult(content: string, mode: AnalysisMode): OpusRecommendationResult {
    return {
      score: 5,
      confidence: 50,
      recommendation: 'hold',
      reasoning: content,
      keyInsights: ['Analysis provided in text format'],
      risks: [],
      opportunities: [],
      actionItems: [],
      strengths: [],
      weaknesses: [],
      assumptions: [],
      analysisDate: new Date().toISOString(),
      modelVersion: this.config.model
    };
  }

  // ==========================================================================
  // Private Methods - Utilities
  // ==========================================================================

  private validateContext(context: OpusDealContext): void {
    if (!context.dealId || !context.dealName) {
      throw this.createError('INVALID_REQUEST', 'Deal ID and name are required');
    }

    // Check data completeness
    const hasData = context.overview || context.financial || context.competition;
    if (!hasData) {
      throw this.createError(
        'INSUFFICIENT_DATA',
        'Insufficient deal data for analysis. Please provide overview, financial, or competition data.'
      );
    }
  }

  private updateMetrics(responseTime: number, tokensUsed: number): void {
    this.usageMetrics.totalRequests++;
    this.usageMetrics.totalTokensUsed += tokensUsed;
    
    // Estimate cost (Claude Opus: $15/M input, $75/M output - rough average $45/M)
    this.usageMetrics.totalCost += (tokensUsed / 1000000) * 45;
    
    // Update average response time
    this.usageMetrics.averageResponseTime = 
      (this.usageMetrics.averageResponseTime * (this.usageMetrics.totalRequests - 1) + responseTime) / 
      this.usageMetrics.totalRequests;
    
    this.usageMetrics.lastRequest = new Date().toISOString();
  }

  private generateSessionId(dealId: string): string {
    return `${dealId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSuggestions(content: string): string[] {
    // Simple suggestion generation - could be enhanced
    const suggestions = [
      'What are the key risks?',
      'What opportunities should we focus on?',
      'What is the recommended strategy?'
    ];
    return suggestions;
  }

  private createError(code: OpusErrorCode, message: string, details?: any): OpusError {
    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      retryable: code === 'RATE_LIMIT_EXCEEDED' || code === 'TIMEOUT' || code === 'NETWORK_ERROR'
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getMockResponse(prompt: string): any {
    // Return mock response for development
    return {
      content: JSON.stringify({
        score: 7.5,
        confidence: 85,
        recommendation: 'buy',
        executiveSummary: 'Strong acquisition opportunity with favorable market dynamics and solid financial fundamentals.',
        keyInsights: [
          'Property is well-positioned in high-growth submarket',
          'Below-market rents present value-add opportunity',
          'Limited new supply expected in near term',
          'Strong financing terms available in current market'
        ],
        risks: [
          {
            category: 'Market',
            description: 'Potential oversupply if planned developments proceed',
            level: 'medium',
            impact: 'medium',
            probability: 40,
            mitigation: 'Monitor pipeline closely and maintain flexibility in repositioning strategy'
          }
        ],
        opportunities: [
          {
            type: 'value-add',
            description: 'Rent optimization through unit renovations',
            potentialValue: 250000,
            probability: 80,
            requirements: ['Capital for renovations', 'Tenant coordination']
          }
        ],
        actionItems: [
          {
            action: 'Complete Phase I environmental assessment',
            category: 'Due Diligence',
            priority: 'high',
            timeframe: '2 weeks'
          }
        ],
        strengths: ['Strong location', 'Below-market pricing', 'Solid fundamentals'],
        weaknesses: ['Deferred maintenance', 'Below-market occupancy'],
        assumptions: ['Market rent growth of 3% annually', 'Exit cap rate of 5.5%']
      }),
      tokensUsed: 1500,
      model: this.config.model
    };
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const opusService = new OpusService();
export default OpusService;
