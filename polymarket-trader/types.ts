/**
 * TypeScript type definitions for Polymarket Trading Bot
 */

export interface Config {
  enabled: boolean;
  monitoring: {
    pollIntervalMinutes: number;
    maxMarkets: number;
    minSpreadPercent: number;
    minLiquidity: number;
    categories: string[];
  };
  trading: {
    maxPositionSize: number;
    defaultPositionSize: number;
    autoApprove: boolean;
    riskTolerance: 'low' | 'medium' | 'high';
  };
  alerts: {
    telegram: boolean;
    telegramChatId: string | null;
    minRiskScore: number;
  };
  apis: {
    polymarket: {
      apiKey: string | null;
      privateKey: string | null;
      baseUrl: string;
    };
    xai: {
      apiKey: string;
      model: string;
    };
  };
}

export interface Market {
  id: string;
  question: string;
  description: string;
  category: string;
  endDate: string;
  volume: number;
  liquidity: number;
  yesPrice: number;
  noPrice: number;
  yesTokenId: string;
  noTokenId: string;
  active: boolean;
  spread?: number;
  url?: string;
}

export interface ArbitrageOpportunity {
  market: Market;
  spread: number;
  spreadPercent: number;
  expectedProfit: number;
  recommendedSide: 'YES' | 'NO' | 'BOTH';
  timestamp: number;
}

export interface GrokAnalysis {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  confidence: number;
  summary: string;
  twitterTrends: string[];
  newsHighlights: string[];
  riskFactors: string[];
  timestamp: number;
}

export interface ClaudeAnalysis {
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID';
  riskScore: number; // 1-10
  arbitrageValid: boolean;
  positionSize: number;
  reasoning: string;
  exitStrategy: string;
  concerns: string[];
  timestamp: number;
}

export interface TradingAlert {
  id: string;
  opportunity: ArbitrageOpportunity;
  grokAnalysis: GrokAnalysis;
  claudeAnalysis: ClaudeAnalysis;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  createdAt: number;
  resolvedAt?: number;
}

export interface Trade {
  id: string;
  alertId: string;
  marketId: string;
  marketQuestion: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  status: 'PENDING' | 'SUBMITTED' | 'FILLED' | 'FAILED' | 'CANCELLED';
  txHash?: string;
  executedAt?: number;
  filledAmount?: number;
  averagePrice?: number;
}

export interface Position {
  marketId: string;
  marketQuestion: string;
  side: 'YES' | 'NO';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  openedAt: number;
}

export interface BotState {
  running: boolean;
  lastCheckTime: number;
  totalAlertsGenerated: number;
  totalTradesExecuted: number;
  activePositions: Position[];
  pendingAlerts: TradingAlert[];
}
