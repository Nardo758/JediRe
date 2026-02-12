/**
 * OPUS Mock Service
 * 
 * Mock implementation for development and testing without Anthropic API
 * Provides realistic responses based on deal data patterns
 */

import {
  OpusDealContext,
  OpusRecommendationResult,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  Risk,
  Opportunity,
  ActionItem,
  OpusRecommendation
} from '../types/opus.types';

export class OpusMockService {
  
  /**
   * Mock acquisition analysis
   */
  async analyzeAcquisition(context: OpusDealContext): Promise<OpusRecommendationResult> {
    // Simulate API delay
    await this.delay(1500);

    // Generate realistic analysis based on context
    const score = this.calculateMockScore(context);
    const recommendation = this.determineRecommendation(score, context.status);

    return {
      score,
      confidence: this.calculateConfidence(context),
      recommendation,
      reasoning: this.generateReasoning(context, recommendation),
      keyInsights: this.generateInsights(context),
      risks: this.generateRisks(context),
      opportunities: this.generateOpportunities(context),
      actionItems: this.generateActionItems(context, 'acquisition'),
      strengths: this.generateStrengths(context),
      weaknesses: this.generateWeaknesses(context),
      assumptions: this.generateAssumptions(),
      analysisDate: new Date().toISOString(),
      modelVersion: 'mock-v1.0',
      tokensUsed: 2500,
      processingTime: 1500,
      executiveSummary: this.generateExecutiveSummary(context, recommendation)
    };
  }

  /**
   * Mock performance analysis
   */
  async analyzePerformance(context: OpusDealContext): Promise<OpusRecommendationResult> {
    await this.delay(1500);

    const score = this.calculateMockScore(context);
    const recommendation = this.determinePerformanceRecommendation(score);

    return {
      score,
      confidence: this.calculateConfidence(context),
      recommendation,
      reasoning: this.generatePerformanceReasoning(context, recommendation),
      keyInsights: this.generatePerformanceInsights(context),
      risks: this.generatePerformanceRisks(context),
      opportunities: this.generatePerformanceOpportunities(context),
      actionItems: this.generateActionItems(context, 'performance'),
      strengths: this.generatePerformanceStrengths(context),
      weaknesses: this.generatePerformanceWeaknesses(context),
      assumptions: this.generateAssumptions(),
      analysisDate: new Date().toISOString(),
      modelVersion: 'mock-v1.0',
      tokensUsed: 2200,
      processingTime: 1500,
      executiveSummary: this.generatePerformanceExecutiveSummary(context, recommendation)
    };
  }

  /**
   * Mock chat response
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    await this.delay(800);

    const responseContent = this.generateChatResponse(request.message);

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date().toISOString(),
      metadata: {
        tokensUsed: 500,
        model: 'mock-opus',
        temperature: 0.7
      }
    };

    return {
      message,
      sessionId: request.sessionId || `session-${request.dealId}-${Date.now()}`,
      suggestions: this.generateFollowUpSuggestions(request.message)
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateMockScore(context: OpusDealContext): number {
    let score = 5.0;

    // Adjust based on financial metrics
    if (context.financial?.proForma?.noi) {
      const capRate = context.overview?.metrics?.capRate || 0;
      if (capRate > 6) score += 1.5;
      else if (capRate > 5) score += 0.5;
      else if (capRate < 4) score -= 1;
    }

    // Adjust based on market competition
    if (context.competition?.marketPosition) {
      const pos = context.competition.marketPosition;
      if (pos.pricingCompetitiveness < -10) score += 1; // Below market = good for buyer
      if (pos.demandLevel === 'very-high' || pos.demandLevel === 'high') score += 0.5;
    }

    // Adjust based on supply
    if (context.supply?.impactAnalysis) {
      const impact = context.supply.impactAnalysis.overallImpact;
      if (impact === 'severe') score -= 2;
      else if (impact === 'significant') score -= 1;
      else if (impact === 'minimal') score += 0.5;
    }

    // Clamp to 0-10
    return Math.max(0, Math.min(10, score));
  }

  private calculateConfidence(context: OpusDealContext): number {
    let confidence = 50;

    // Increase confidence based on data availability
    if (context.overview) confidence += 10;
    if (context.financial) confidence += 15;
    if (context.competition) confidence += 10;
    if (context.supply) confidence += 5;
    if (context.debt) confidence += 5;
    if (context.market) confidence += 5;

    return Math.min(95, confidence);
  }

  private determineRecommendation(score: number, status: string): OpusRecommendation {
    if (score >= 8.5) return 'strong-buy';
    if (score >= 7) return 'buy';
    if (score >= 5.5) return 'hold';
    if (score >= 4) return 'pass';
    return 'strong-pass';
  }

  private determinePerformanceRecommendation(score: number): OpusRecommendation {
    if (score >= 8) return 'hold-asset';
    if (score >= 6) return 'optimize';
    return 'sell';
  }

  private generateReasoning(context: OpusDealContext, rec: OpusRecommendation): string {
    const reasons = [];

    if (rec === 'strong-buy' || rec === 'buy') {
      reasons.push('The property demonstrates strong fundamentals and attractive risk-adjusted returns.');
      if (context.competition?.marketPosition?.pricingCompetitiveness && context.competition.marketPosition.pricingCompetitiveness < 0) {
        reasons.push('Pricing is below market, presenting immediate value capture opportunity.');
      }
      if (context.supply?.impactAnalysis?.overallImpact === 'minimal') {
        reasons.push('Limited new supply pipeline reduces competitive pressure.');
      }
    } else if (rec === 'hold') {
      reasons.push('The deal shows potential but requires further analysis and risk mitigation.');
      reasons.push('Consider negotiating better terms or exploring value-add strategies.');
    } else {
      reasons.push('Risk-adjusted returns do not justify the investment at current terms.');
      if (context.supply?.impactAnalysis?.overallImpact === 'severe') {
        reasons.push('Significant supply pressure threatens rental growth and occupancy.');
      }
    }

    return reasons.join(' ');
  }

  private generatePerformanceReasoning(context: OpusDealContext, rec: OpusRecommendation): string {
    if (rec === 'hold-asset') {
      return 'Asset is performing well above expectations with strong market fundamentals. Continue current strategy while monitoring for optimization opportunities.';
    } else if (rec === 'optimize') {
      return 'Asset shows solid performance but has untapped potential. Implementing recommended optimizations could significantly enhance returns.';
    } else {
      return 'Asset underperformance and changing market dynamics suggest exploring exit strategies. Market timing may favor divestiture.';
    }
  }

  private generateInsights(context: OpusDealContext): string[] {
    const insights = [];

    if (context.overview?.location) {
      insights.push(`Located in ${context.overview.location.neighborhood || context.overview.location.city}, a ${this.getRandomMarketQuality()} market with ${this.getRandomGrowthTrend()} growth trends`);
    }

    if (context.financial?.proForma) {
      insights.push(`Current NOI of ${this.formatCurrency(context.financial.proForma.noi)} represents ${this.getRandomPercentage()} market value`);
    }

    if (context.competition?.comps && context.competition.comps.length > 0) {
      insights.push(`Analysis of ${context.competition.comps.length} comparable properties shows ${this.getRandomComparisonResult()}`);
    }

    if (context.debt?.currentRates) {
      insights.push(`Current financing environment ${context.debt.currentRates.marketTrend === 'increasing' ? 'favors locking rates now' : 'may improve in coming months'}`);
    }

    insights.push('Execution timeline of 60-90 days achievable with proper resource allocation');

    return insights;
  }

  private generatePerformanceInsights(context: OpusDealContext): string[] {
    return [
      'Year-over-year NOI growth outpacing market average by 150 basis points',
      'Occupancy trends stable at 94%, above submarket average of 91%',
      'Expense ratio optimization could unlock additional $75K-$100K annually',
      'Market rent growth supports 3-4% annual rate increases without occupancy risk',
      'Capital deployment for amenity upgrades shows 18-22% IRR potential'
    ];
  }

  private generateRisks(context: OpusDealContext): Risk[] {
    const risks: Risk[] = [
      {
        id: 'risk-1',
        category: 'Market',
        description: 'Macroeconomic uncertainty could impact rental demand and pricing power',
        level: 'medium',
        impact: 'medium',
        probability: 45,
        mitigation: 'Maintain conservative underwriting and flexible exit strategies',
        priority: 6
      }
    ];

    if (context.supply && context.supply.pipelineProjects.length > 0) {
      risks.push({
        id: 'risk-2',
        category: 'Competition',
        description: `${context.supply.impactAnalysis.totalPipelineUnitsWithin3Miles} units in pipeline within 3 miles could pressure occupancy`,
        level: context.supply.impactAnalysis.overallImpact === 'severe' ? 'high' : 'medium',
        impact: 'medium',
        probability: 60,
        mitigation: 'Enhance differentiation through amenities and service quality',
        priority: 7
      });
    }

    if (context.debt?.currentRates?.marketTrend === 'increasing') {
      risks.push({
        id: 'risk-3',
        category: 'Financing',
        description: 'Rising interest rates could compress yields and reduce exit values',
        level: 'medium',
        impact: 'high',
        probability: 55,
        mitigation: 'Consider rate caps or fixed-rate financing',
        priority: 8
      });
    }

    risks.push({
      id: 'risk-4',
      category: 'Execution',
      description: 'Property condition may reveal additional capital needs during due diligence',
      level: 'low',
      impact: 'medium',
      probability: 30,
      mitigation: 'Comprehensive inspections and adequate contingency reserves',
      priority: 5
    });

    return risks;
  }

  private generatePerformanceRisks(context: OpusDealContext): Risk[] {
    return [
      {
        id: 'risk-1',
        category: 'Market',
        description: 'New supply delivery in Q3-Q4 may create temporary occupancy pressure',
        level: 'medium',
        impact: 'medium',
        probability: 50,
        mitigation: 'Proactive retention program and competitive positioning review',
        priority: 6
      },
      {
        id: 'risk-2',
        category: 'Operational',
        description: 'Aging HVAC systems approaching end of useful life',
        level: 'medium',
        impact: 'high',
        probability: 70,
        mitigation: 'Budget capital reserves and plan phased replacement program',
        priority: 7
      }
    ];
  }

  private generateOpportunities(context: OpusDealContext): Opportunity[] {
    const opportunities: Opportunity[] = [
      {
        id: 'opp-1',
        type: 'value-add',
        description: 'Unit interior upgrades could support 8-12% rent premiums',
        potentialValue: 180000,
        probability: 75,
        requirements: ['Capital investment of $450K', 'Phased renovation plan', 'Tenant coordination'],
        timeline: '12-18 months',
        priority: 8
      }
    ];

    if (context.overview?.propertySpecs?.occupancy && context.overview.propertySpecs.occupancy < 90) {
      opportunities.push({
        id: 'opp-2',
        type: 'operational',
        description: 'Occupancy improvement from current levels to market average',
        potentialValue: 125000,
        probability: 80,
        requirements: ['Enhanced marketing', 'Competitive pricing review', 'Leasing incentives'],
        timeline: '6-9 months',
        priority: 9
      });
    }

    if (context.debt?.refinanceOpportunity) {
      opportunities.push({
        id: 'opp-3',
        type: 'financing',
        description: 'Debt refinancing could reduce annual debt service',
        potentialValue: 85000,
        probability: 65,
        requirements: ['Current market rates analysis', 'Lender negotiations', 'Prepayment penalty assessment'],
        timeline: '3-6 months',
        priority: 7
      });
    }

    return opportunities;
  }

  private generatePerformanceOpportunities(context: OpusDealContext): Opportunity[] {
    return [
      {
        id: 'opp-1',
        type: 'operational',
        description: 'Utility expense reduction through LED retrofits and smart thermostats',
        potentialValue: 45000,
        probability: 85,
        requirements: ['Capital investment of $85K', 'Vendor selection', '6-month implementation'],
        timeline: '6-12 months',
        priority: 7
      },
      {
        id: 'opp-2',
        type: 'value-add',
        description: 'Amenity package upgrade to command market-leading rents',
        potentialValue: 220000,
        probability: 70,
        requirements: ['Design and construction', 'Resident communication', 'Marketing repositioning'],
        timeline: '12-18 months',
        priority: 8
      }
    ];
  }

  private generateActionItems(context: OpusDealContext, mode: 'acquisition' | 'performance'): ActionItem[] {
    if (mode === 'acquisition') {
      return [
        {
          id: 'action-1',
          action: 'Complete comprehensive property condition assessment',
          category: 'Due Diligence',
          priority: 'urgent',
          timeframe: '1-2 weeks',
          owner: 'Due Diligence Team'
        },
        {
          id: 'action-2',
          action: 'Validate rent roll and occupancy data with property management',
          category: 'Due Diligence',
          priority: 'high',
          timeframe: '1 week',
          owner: 'Asset Management'
        },
        {
          id: 'action-3',
          action: 'Secure financing quotes from 3+ lenders',
          category: 'Financing',
          priority: 'high',
          timeframe: '2-3 weeks',
          owner: 'Finance Team'
        },
        {
          id: 'action-4',
          action: 'Conduct detailed market study and competitive analysis',
          category: 'Market Analysis',
          priority: 'medium',
          timeframe: '2 weeks',
          owner: 'Research Team'
        }
      ];
    } else {
      return [
        {
          id: 'action-1',
          action: 'Develop detailed capital improvement plan with ROI analysis',
          category: 'Asset Management',
          priority: 'high',
          timeframe: '2-3 weeks',
          owner: 'Asset Manager'
        },
        {
          id: 'action-2',
          action: 'Launch resident retention program to maintain occupancy',
          category: 'Operations',
          priority: 'high',
          timeframe: 'Immediate',
          owner: 'Property Manager'
        },
        {
          id: 'action-3',
          action: 'Evaluate refinancing options with current lenders',
          category: 'Financing',
          priority: 'medium',
          timeframe: '4-6 weeks',
          owner: 'Finance Team'
        }
      ];
    }
  }

  private generateStrengths(context: OpusDealContext): string[] {
    const strengths = ['Prime location with strong demographic fundamentals'];
    
    if (context.overview?.propertySpecs?.yearBuilt && new Date().getFullYear() - context.overview.propertySpecs.yearBuilt < 10) {
      strengths.push('Newer construction with lower near-term capital needs');
    }
    
    strengths.push('Below-market in-place rents support value-add potential');
    strengths.push('Strong historical occupancy and rent collection');
    
    return strengths;
  }

  private generatePerformanceStrengths(context: OpusDealContext): string[] {
    return [
      'Consistent occupancy above market average',
      'Well-maintained property with proactive capital planning',
      'Strong resident satisfaction and retention rates',
      'Operating expense ratio below market benchmark'
    ];
  }

  private generateWeaknesses(context: OpusDealContext): string[] {
    const weaknesses = [];
    
    if (context.overview?.propertySpecs?.condition === 'fair' || context.overview?.propertySpecs?.condition === 'poor') {
      weaknesses.push('Deferred maintenance requiring immediate capital investment');
    }
    
    weaknesses.push('Limited on-site amenities compared to newer competition');
    weaknesses.push('Current management systems lack optimization');
    
    return weaknesses;
  }

  private generatePerformanceWeaknesses(context: OpusDealContext): string[] {
    return [
      'Amenity package trails newest competitive supply',
      'Unit turnover costs above market average',
      'Marketing reach limited compared to institutional competitors'
    ];
  }

  private generateAssumptions(): string[] {
    return [
      'Market rent growth of 3.0% annually over hold period',
      'Expense growth of 2.5% annually',
      'Exit cap rate 50 basis points above entry',
      'Occupancy stabilization at 95% within 12 months',
      'No major regulatory changes affecting operations'
    ];
  }

  private generateExecutiveSummary(context: OpusDealContext, rec: OpusRecommendation): string {
    const property = context.overview?.propertySpecs?.address || context.dealName;
    
    if (rec === 'strong-buy' || rec === 'buy') {
      return `${property} presents a compelling acquisition opportunity with strong fundamentals, favorable market positioning, and clear value creation pathways. The asset aligns with investment thesis and offers attractive risk-adjusted returns with multiple exit scenarios. Recommend proceeding with comprehensive due diligence while maintaining negotiating flexibility on final terms.`;
    } else if (rec === 'hold') {
      return `${property} shows mixed signals requiring deeper analysis. While certain fundamentals are attractive, risk factors and market dynamics warrant careful consideration. Recommend continuing evaluation with focus on risk mitigation strategies and improved deal terms before commitment.`;
    } else {
      return `${property} does not meet investment criteria at current pricing and terms. Risk-return profile is unfavorable given market conditions, competitive dynamics, and execution complexity. Recommend passing on this opportunity while maintaining market relationships for future deals.`;
    }
  }

  private generatePerformanceExecutiveSummary(context: OpusDealContext, rec: OpusRecommendation): string {
    if (rec === 'hold-asset') {
      return 'Asset is performing at or above underwriting projections with strong fundamentals and positive market trajectory. Current strategy is effective. Recommend maintaining current course while implementing targeted optimizations to enhance returns.';
    } else if (rec === 'optimize') {
      return 'Asset shows solid baseline performance but has significant untapped potential. Market conditions support value enhancement initiatives. Recommend implementing comprehensive optimization plan focusing on revenue growth, expense management, and capital improvements.';
    } else {
      return 'Asset underperformance relative to market and changing competitive dynamics suggest strategic review. Market conditions may favor divestiture. Recommend developing comprehensive disposition strategy with timing optimization.';
    }
  }

  private generateChatResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('risk')) {
      return 'Based on the deal analysis, the primary risks to consider are:\n\n1. **Market Risk**: New supply in the pipeline could pressure occupancy and rents. However, this is partially mitigated by strong demographic trends and limited land for additional development.\n\n2. **Execution Risk**: Property condition assessments may reveal additional capital needs. I recommend budgeting a 10-15% contingency reserve.\n\n3. **Financing Risk**: If rates continue rising, it could compress returns. Consider locking rates sooner rather than later.\n\nWould you like me to dive deeper into any of these risk categories?';
    }

    if (lowerMessage.includes('opportunity') || lowerMessage.includes('opportunities')) {
      return 'The most significant opportunities I see are:\n\n1. **Rent Optimization**: Current rents are 8-12% below market. This represents immediate value capture of approximately $180K annually through strategic rent increases and unit upgrades.\n\n2. **Operational Efficiency**: Expense ratio analysis shows potential savings of $75-100K through vendor renegotiation and utility optimization.\n\n3. **Repositioning**: Market positioning could be enhanced through targeted amenity upgrades, potentially supporting premium rents.\n\nThe rent optimization opportunity should be your first priority given the high probability and immediate impact.';
    }

    if (lowerMessage.includes('recommend') || lowerMessage.includes('should i')) {
      return 'Based on my comprehensive analysis, I recommend proceeding with this acquisition. The deal scores 7.5/10 with 85% confidence.\n\n**Key reasons:**\n- Strong location fundamentals\n- Below-market pricing creates immediate equity\n- Clear value-add pathways with measurable returns\n- Favorable financing environment\n\n**Next steps:**\n1. Complete full due diligence (2-3 weeks)\n2. Secure financing commitments\n3. Develop detailed value-add implementation plan\n\nThe risk-return profile is favorable, but maintain flexibility in negotiations. What specific aspect would you like to explore further?';
    }

    if (lowerMessage.includes('financial') || lowerMessage.includes('returns') || lowerMessage.includes('irr')) {
      return 'The financial analysis shows strong projected returns:\n\n**Base Case:**\n- IRR: 16.2%\n- Cash-on-Cash: 8.7% (Year 1) → 11.3% (Year 5)\n- Equity Multiple: 2.1x over 5-year hold\n\n**Value-Add Case:**\n- IRR: 19.4%\n- Cash-on-Cash: 7.9% (Year 1) → 14.2% (Year 5)\n- Equity Multiple: 2.4x\n\nThe value-add scenario assumes $450K in capital improvements generating $180K in additional NOI. This shows an 18% return on the improvement capital alone.\n\nSensitivity analysis indicates returns remain attractive even with 10% lower rents or 5% higher expenses. Would you like to see different hold period scenarios?';
    }

    if (lowerMessage.includes('market') || lowerMessage.includes('competition')) {
      return 'Market analysis reveals favorable positioning:\n\n**Supply/Demand Balance:**\n- Current submarket vacancy: 6.2% (healthy)\n- 12-month absorption: 450 units\n- Pipeline supply: 380 units over next 18 months\n\nThe market can absorb new supply without significant stress. Your property benefits from:\n\n1. **Location advantage**: Closer to employment centers than most new development\n2. **Price positioning**: 15% below newest product allows you to capture price-sensitive demand\n3. **Existing improvements**: Mature landscaping and established community vs. new construction\n\n**Competitive Strategy:**\nPosition as "established value" rather than competing directly with Class A new product. Focus on reliability, community, and value proposition.\n\nMarket rent growth of 3-4% annually is sustainable for next 3-5 years based on employment and income trends.';
    }

    // Default response
    return 'I\'m here to help analyze this deal from any angle. I can discuss:\n\n- **Financial analysis** - returns, sensitivities, financing\n- **Market dynamics** - competition, supply/demand, positioning  \n- **Risk assessment** - identification and mitigation strategies\n- **Opportunities** - value-add, operational improvements\n- **Execution strategy** - timeline, priorities, resource allocation\n\nWhat specific aspect would you like to explore?';
  }

  private generateFollowUpSuggestions(message: string): string[] {
    return [
      'What are the biggest risks?',
      'How does this compare to similar deals?',
      'What should be our top priorities?',
      'Walk me through the financial projections'
    ];
  }

  // Helper methods for generating realistic mock data
  private getRandomMarketQuality(): string {
    const qualities = ['high-growth', 'stable', 'emerging', 'mature'];
    return qualities[Math.floor(Math.random() * qualities.length)];
  }

  private getRandomGrowthTrend(): string {
    const trends = ['strong', 'moderate', 'steady', 'accelerating'];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  private getRandomPercentage(): string {
    const percentages = ['above-market', 'at-market', 'below-market'];
    return percentages[Math.floor(Math.random() * percentages.length)];
  }

  private getRandomComparisonResult(): string {
    const results = [
      'favorable pricing position',
      'competitive pricing with upside potential',
      'aligned with market fundamentals',
      'below-market entry point'
    ];
    return results[Math.floor(Math.random() * results.length)];
  }

  private formatCurrency(value: number | undefined): string {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
}

// Export singleton instance
export const opusMockService = new OpusMockService();
export default OpusMockService;
