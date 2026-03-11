/**
 * Event Schemas for Kafka Messages
 * 
 * Standardized TypeScript interfaces for all event types across
 * the JEDI RE platform. These schemas ensure type safety and
 * consistency in event-driven communication.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

// ============================================================================
// Base Event Interface
// ============================================================================

export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  version?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// News Events
// ============================================================================

export interface NewsEventMessage extends BaseEvent {
  eventType: 'employment' | 'university' | 'military' | 'infrastructure' | 'permit' | 'construction' | 'completion' | 'other';
  
  // Geographic context
  tradeAreaIds: string[];
  submarketIds: string[];
  msaIds: string[];
  
  // Event details
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  
  // Impact metrics
  magnitude: number; // Quantified impact (jobs, units, sq ft, etc.)
  magnitudeUnit: string; // 'jobs', 'units', 'sqft', etc.
  confidence: number; // 0-100
  
  // Timing
  announcedDate: string;
  effectiveDate?: string;
  completionDate?: string;
  
  // Extracted entities
  entities: {
    companies?: string[];
    locations?: string[];
    people?: string[];
  };
  
  // Raw data
  rawEmailId?: string;
  extractedBy: string; // Service/agent name
}

// ============================================================================
// Demand Signal Events
// ============================================================================

export interface DemandSignalMessage extends BaseEvent {
  eventType: 'demand_calculated' | 'demand_adjusted' | 'demand_validated';
  
  signalId: string;
  tradeAreaId: string;
  
  // Demand metrics
  housingUnitsNeeded: number;
  absorptionRateMonthly: number;
  
  // Phasing
  quarterlyPhasing: Record<string, number>; // { "2026-Q1": 150, "2026-Q2": 200, ... }
  
  // Confidence
  confidenceScore: number; // 0-100
  
  // Source
  triggeringEventId: string; // Reference to news event that triggered this
  calculationMethod: string;
  
  // Deal context
  dealId?: string;
  
  // Assumptions
  assumedOccupancyRate?: number;
  assumedHouseholdSize?: number;
}

// ============================================================================
// Supply Signal Events
// ============================================================================

export interface SupplySignalMessage extends BaseEvent {
  eventType: 'supply_added' | 'supply_removed' | 'supply_delivered' | 'supply_projected';
  
  signalId: string;
  tradeAreaId: string;
  
  // Supply metrics
  pipelineUnits: number;
  deliveredUnits?: number;
  
  // Timeline
  deliveryDate: string;
  permitDate?: string;
  constructionStartDate?: string;
  
  // Property details
  propertyType: 'multifamily' | 'single-family' | 'mixed-use';
  productClass: 'A' | 'B' | 'C';
  
  // Competitiveness
  competitivePosition?: 'direct' | 'indirect' | 'minimal';
  
  // Source
  triggeringEventId?: string;
  dataSource: string;
  
  // Deal context
  dealId?: string;
}

// ============================================================================
// Market Intelligence Signals
// ============================================================================

export interface MomentumSignalMessage extends BaseEvent {
  eventType: 'momentum_updated';
  
  signalId: string;
  tradeAreaId: string;
  
  // Momentum metrics
  rentGrowthRate: number; // Percentage
  occupancyRate: number; // Percentage
  absorptionTrend: 'accelerating' | 'stable' | 'decelerating';
  
  // Market phase
  marketPhase: 'expansion' | 'peak' | 'contraction' | 'trough';
  
  confidenceScore: number;
  
  dealId?: string;
}

export interface PositionSignalMessage extends BaseEvent {
  eventType: 'position_updated';
  
  signalId: string;
  tradeAreaId: string;
  
  // Competitive position
  marketSharePercent: number;
  rankInSubmarket: number;
  totalCompetitors: number;
  
  // Relative performance
  rentPremiumPercent: number; // vs. submarket average
  occupancyDifferential: number; // vs. submarket average
  
  dealId?: string;
}

// ============================================================================
// Risk Scoring Events
// ============================================================================

export interface RiskSignalMessage extends BaseEvent {
  eventType: 'risk_calculated' | 'risk_threshold_breached';
  
  signalId: string;
  tradeAreaId: string;
  dealId: string;
  
  // Risk scores
  overallRiskScore: number; // 0-100
  demandRiskScore: number;
  supplyRiskScore: number;
  concentrationRiskScore: number;
  
  // Risk factors
  riskFactors: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: number;
  }>;
  
  // Trend
  trendDirection: 'improving' | 'stable' | 'deteriorating';
  previousScore?: number;
  
  // Triggers
  triggeringEventIds: string[];
}

// ============================================================================
// JEDI Score Events
// ============================================================================

export interface JEDIScoreMessage extends BaseEvent {
  eventType: 'jedi_calculated' | 'jedi_significant_change';
  
  scoreId: string;
  dealId: string;
  tradeAreaId: string;
  
  // JEDI Score
  jediScore: number; // 0-100
  previousScore?: number;
  scoreDelta?: number;
  
  // Component scores
  components: {
    jobs: number;
    economic: number;
    demographics: number;
    infrastructure: number;
  };
  
  // Classification
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  tier: 'tier1' | 'tier2' | 'tier3';
  
  // Confidence
  confidenceScore: number;
  
  // Input signals
  triggeringEventIds: string[];
}

// ============================================================================
// Pro Forma Events
// ============================================================================

export interface ProFormaAssumptionMessage extends BaseEvent {
  eventType: 'proforma_recalculated' | 'assumption_adjusted';
  
  adjustmentId: string;
  dealId: string;
  tradeAreaId: string;
  
  // Adjusted assumptions
  adjustments: Array<{
    metric: string; // e.g., "rent_growth_rate", "vacancy_rate"
    oldValue: number;
    newValue: number;
    delta: number;
    unit: string;
    reason: string;
  }>;
  
  // Financial impact
  estimatedNOIImpact?: number;
  estimatedValueImpact?: number;
  
  // Triggers
  triggeringEventIds: string[];
  triggerType: 'demand_signal' | 'supply_signal' | 'risk_update' | 'manual';
}

// ============================================================================
// Strategy Arbitrage Events
// ============================================================================

export interface StrategyRankingMessage extends BaseEvent {
  eventType: 'strategy_ranked' | 'strategy_recommendation_changed';
  
  rankingId: string;
  dealId: string;
  
  // Rankings
  rankings: Array<{
    strategy: 'buy_hold' | 'value_add' | 'development' | 'avoid';
    score: number;
    confidence: number;
    reasoning: string;
  }>;
  
  // Recommendation
  recommendedStrategy: string;
  previousRecommendation?: string;
  
  // Triggers
  triggeringEventIds: string[];
}

// ============================================================================
// Alert Events
// ============================================================================

export interface UserAlertMessage extends BaseEvent {
  eventType: 'threshold_breached' | 'significant_change' | 'opportunity_detected' | 'risk_alert';
  
  alertId: string;
  userId: string;
  dealId?: string;
  tradeAreaId?: string;
  
  // Alert details
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionRequired?: boolean;
  
  // Context
  triggeringEventId: string;
  affectedMetrics: string[];
  
  // Notification
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// ============================================================================
// Event Wrapper for Publishing
// ============================================================================

export interface KafkaMessage<T extends BaseEvent> {
  key: string; // Partition key (usually dealId or tradeAreaId)
  value: T;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isNewsEvent(event: BaseEvent): event is NewsEventMessage {
  return 'tradeAreaIds' in event && 'magnitude' in event && 'source' in event;
}

export function isDemandSignal(event: BaseEvent): event is DemandSignalMessage {
  return 'housingUnitsNeeded' in event && 'triggeringEventId' in event;
}

export function isSupplySignal(event: BaseEvent): event is SupplySignalMessage {
  return 'pipelineUnits' in event && 'deliveryDate' in event;
}

export function isRiskSignal(event: BaseEvent): event is RiskSignalMessage {
  return 'overallRiskScore' in event && 'riskFactors' in event;
}

export function isJEDIScore(event: BaseEvent): event is JEDIScoreMessage {
  return 'jediScore' in event && 'components' in event;
}

export function isProFormaAdjustment(event: BaseEvent): event is ProFormaAssumptionMessage {
  return 'adjustments' in event && Array.isArray((event as any).adjustments);
}

export function isUserAlert(event: BaseEvent): event is UserAlertMessage {
  return 'severity' in event && 'title' in event && 'message' in event;
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateEvent(event: BaseEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!event.eventId) errors.push('Missing eventId');
  if (!event.eventType) errors.push('Missing eventType');
  if (!event.timestamp) errors.push('Missing timestamp');
  
  // Validate timestamp format
  if (event.timestamp && isNaN(Date.parse(event.timestamp))) {
    errors.push('Invalid timestamp format');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Topic Mapping
// ============================================================================

export const KAFKA_TOPICS = {
  NEWS_EVENTS: 'news.events.extracted',
  DEMAND_SIGNALS: 'signals.demand.updated',
  SUPPLY_SIGNALS: 'signals.supply.updated',
  MOMENTUM_SIGNALS: 'signals.momentum.updated',
  POSITION_SIGNALS: 'signals.position.updated',
  RISK_SIGNALS: 'signals.risk.updated',
  JEDI_SCORES: 'scores.jedi.updated',
  PROFORMA_ASSUMPTIONS: 'proforma.assumptions.updated',
  STRATEGY_RANKINGS: 'strategy.rankings.updated',
  USER_ALERTS: 'alerts.user.generated',
  DLQ: 'dlq.failed.events',
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];
