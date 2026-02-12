/**
 * Alert Consumer
 * 
 * Monitors JEDI scores and risk signals for threshold breaches
 * and generates user alerts.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import {
  JEDIScoreMessage,
  RiskSignalMessage,
  KAFKA_TOPICS,
  UserAlertMessage,
} from '../event-schemas';
import { query } from '../../../database/connection';
import { kafkaProducer } from '../kafka-producer.service';
import { v4 as uuidv4 } from 'uuid';

const logger = {
  info: (...args: any[]) => console.log('[Alert Consumer]', ...args),
  error: (...args: any[]) => console.error('[Alert Consumer]', ...args),
  warn: (...args: any[]) => console.warn('[Alert Consumer]', ...args),
};

// ============================================================================
// Alert Thresholds
// ============================================================================

const ALERT_THRESHOLDS = {
  JEDI_SCORE_CHANGE: 5, // Alert if JEDI score changes by more than 5 points
  JEDI_SCORE_LOW: 50, // Alert if JEDI score drops below 50
  JEDI_SCORE_HIGH: 85, // Alert if JEDI score rises above 85
  RISK_SCORE_HIGH: 70, // Alert if risk score exceeds 70
  RISK_SCORE_CRITICAL: 85, // Critical alert if risk exceeds 85
};

// ============================================================================
// JEDI Score Alert Handler
// ============================================================================

const jediScoreAlertHandler: MessageHandler<JEDIScoreMessage> = async (event, metadata) => {
  logger.info('Checking JEDI score for alerts', {
    eventId: event.eventId,
    dealId: event.dealId,
    jediScore: event.jediScore,
    scoreDelta: event.scoreDelta,
  });

  const alerts: UserAlertMessage[] = [];

  // Alert 1: Significant score change
  if (event.scoreDelta && Math.abs(event.scoreDelta) >= ALERT_THRESHOLDS.JEDI_SCORE_CHANGE) {
    const direction = event.scoreDelta > 0 ? 'increased' : 'decreased';
    alerts.push({
      eventId: uuidv4(),
      eventType: 'significant_change',
      timestamp: new Date().toISOString(),
      alertId: uuidv4(),
      userId: await getUserIdForDeal(event.dealId),
      dealId: event.dealId,
      tradeAreaId: event.tradeAreaId,
      severity: Math.abs(event.scoreDelta) > 10 ? 'warning' : 'info',
      title: `JEDI Score ${direction} significantly`,
      message: `Your deal's JEDI Score ${direction} by ${Math.abs(event.scoreDelta).toFixed(1)} points (${event.previousScore} → ${event.jediScore})`,
      actionRequired: false,
      triggeringEventId: event.eventId,
      affectedMetrics: ['jedi_score'],
      channels: ['in_app', 'email'],
      priority: 'medium',
    });
  }

  // Alert 2: Score dropped below threshold
  if (
    event.jediScore < ALERT_THRESHOLDS.JEDI_SCORE_LOW &&
    (!event.previousScore || event.previousScore >= ALERT_THRESHOLDS.JEDI_SCORE_LOW)
  ) {
    alerts.push({
      eventId: uuidv4(),
      eventType: 'threshold_breached',
      timestamp: new Date().toISOString(),
      alertId: uuidv4(),
      userId: await getUserIdForDeal(event.dealId),
      dealId: event.dealId,
      tradeAreaId: event.tradeAreaId,
      severity: 'warning',
      title: 'JEDI Score Below Threshold',
      message: `Your deal's JEDI Score dropped to ${event.jediScore}, below the recommended threshold of ${ALERT_THRESHOLDS.JEDI_SCORE_LOW}`,
      actionRequired: true,
      triggeringEventId: event.eventId,
      affectedMetrics: ['jedi_score'],
      channels: ['in_app', 'email'],
      priority: 'high',
    });
  }

  // Alert 3: Score rose above high threshold (opportunity)
  if (
    event.jediScore > ALERT_THRESHOLDS.JEDI_SCORE_HIGH &&
    (!event.previousScore || event.previousScore <= ALERT_THRESHOLDS.JEDI_SCORE_HIGH)
  ) {
    alerts.push({
      eventId: uuidv4(),
      eventType: 'opportunity_detected',
      timestamp: new Date().toISOString(),
      alertId: uuidv4(),
      userId: await getUserIdForDeal(event.dealId),
      dealId: event.dealId,
      tradeAreaId: event.tradeAreaId,
      severity: 'info',
      title: 'High JEDI Score Opportunity',
      message: `Your deal's JEDI Score rose to ${event.jediScore}, indicating strong market conditions`,
      actionRequired: false,
      triggeringEventId: event.eventId,
      affectedMetrics: ['jedi_score'],
      channels: ['in_app'],
      priority: 'medium',
    });
  }

  // Publish alerts
  for (const alert of alerts) {
    await publishAlert(alert);
  }

  if (alerts.length > 0) {
    logger.info(`Published ${alerts.length} alerts for JEDI score event ${event.eventId}`);
  }
};

// ============================================================================
// Risk Score Alert Handler
// ============================================================================

const riskScoreAlertHandler: MessageHandler<RiskSignalMessage> = async (event, metadata) => {
  logger.info('Checking risk score for alerts', {
    eventId: event.eventId,
    dealId: event.dealId,
    riskScore: event.overallRiskScore,
  });

  const alerts: UserAlertMessage[] = [];

  // Alert 1: High risk
  if (
    event.overallRiskScore >= ALERT_THRESHOLDS.RISK_SCORE_HIGH &&
    event.overallRiskScore < ALERT_THRESHOLDS.RISK_SCORE_CRITICAL
  ) {
    alerts.push({
      eventId: uuidv4(),
      eventType: 'risk_alert',
      timestamp: new Date().toISOString(),
      alertId: uuidv4(),
      userId: await getUserIdForDeal(event.dealId),
      dealId: event.dealId,
      tradeAreaId: event.tradeAreaId,
      severity: 'warning',
      title: 'Elevated Risk Detected',
      message: `Deal risk score is ${event.overallRiskScore}. Key factors: ${event.riskFactors.slice(0, 2).map(f => f.category).join(', ')}`,
      actionRequired: true,
      triggeringEventId: event.eventId,
      affectedMetrics: ['risk_score', 'demand_risk', 'supply_risk'],
      channels: ['in_app', 'email'],
      priority: 'high',
    });
  }

  // Alert 2: Critical risk
  if (event.overallRiskScore >= ALERT_THRESHOLDS.RISK_SCORE_CRITICAL) {
    alerts.push({
      eventId: uuidv4(),
      eventType: 'risk_alert',
      timestamp: new Date().toISOString(),
      alertId: uuidv4(),
      userId: await getUserIdForDeal(event.dealId),
      dealId: event.dealId,
      tradeAreaId: event.tradeAreaId,
      severity: 'critical',
      title: 'Critical Risk Alert',
      message: `Deal risk score is ${event.overallRiskScore} (CRITICAL). Immediate review recommended.`,
      actionRequired: true,
      triggeringEventId: event.eventId,
      affectedMetrics: ['risk_score'],
      channels: ['in_app', 'email', 'sms'],
      priority: 'urgent',
    });
  }

  // Alert 3: Risk deteriorating
  if (event.trendDirection === 'deteriorating') {
    alerts.push({
      eventId: uuidv4(),
      eventType: 'risk_alert',
      timestamp: new Date().toISOString(),
      alertId: uuidv4(),
      userId: await getUserIdForDeal(event.dealId),
      dealId: event.dealId,
      tradeAreaId: event.tradeAreaId,
      severity: 'warning',
      title: 'Risk Trend Deteriorating',
      message: `Deal risk is trending worse. Previous: ${event.previousScore}, Current: ${event.overallRiskScore}`,
      actionRequired: false,
      triggeringEventId: event.eventId,
      affectedMetrics: ['risk_score'],
      channels: ['in_app'],
      priority: 'medium',
    });
  }

  // Publish alerts
  for (const alert of alerts) {
    await publishAlert(alert);
  }

  if (alerts.length > 0) {
    logger.info(`Published ${alerts.length} alerts for risk event ${event.eventId}`);
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user ID for a deal
 */
async function getUserIdForDeal(dealId: string): Promise<string> {
  try {
    const result = await query('SELECT user_id FROM deals WHERE id = $1', [dealId]);
    return result.rows.length > 0 ? result.rows[0].user_id : 'system';
  } catch (error) {
    logger.error('Error getting user ID for deal:', error);
    return 'system';
  }
}

/**
 * Publish alert to Kafka and database
 */
async function publishAlert(alert: UserAlertMessage): Promise<void> {
  try {
    // Save to database
    await query(
      `INSERT INTO user_alerts (
        id, user_id, deal_id, severity, title, message,
        event_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        alert.alertId,
        alert.userId,
        alert.dealId,
        alert.severity,
        alert.title,
        alert.message,
        alert.triggeringEventId,
      ]
    );

    // Publish to Kafka
    await kafkaProducer.publish(KAFKA_TOPICS.USER_ALERTS, alert, {
      key: alert.userId,
      publishedBy: 'alert-consumer',
    });

    logger.info('Alert published', {
      alertId: alert.alertId,
      userId: alert.userId,
      severity: alert.severity,
    });
  } catch (error) {
    logger.error('Failed to publish alert:', error);
    throw error;
  }
}

// ============================================================================
// Consumer Registration
// ============================================================================

export async function registerAlertConsumer(): Promise<void> {
  // Register JEDI score monitor
  await consumerManager.registerConsumer({
    groupId: 'alert-jedi-group',
    name: 'jedi-score-monitor',
    topics: [KAFKA_TOPICS.JEDI_SCORES],
    handler: jediScoreAlertHandler,
    fromBeginning: false,
    autoCommit: true,
    maxRetries: 2,
  });

  // Register risk score monitor
  await consumerManager.registerConsumer({
    groupId: 'alert-risk-group',
    name: 'risk-score-monitor',
    topics: [KAFKA_TOPICS.RISK_SIGNALS],
    handler: riskScoreAlertHandler,
    fromBeginning: false,
    autoCommit: true,
    maxRetries: 2,
  });

  logger.info('Alert consumers registered and running');
}
