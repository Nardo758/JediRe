/**
 * Deal Alert Service
 * 
 * Manages alerts for deal-related events, JEDI Score changes, and market shifts.
 * Automatically generates alerts when significant events occur.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { query } from '../database/connection';
import { jediScoreService } from './jedi-score.service';

// ============================================================================
// Types
// ============================================================================

export interface DealAlert {
  id: string;
  userId: string;
  dealId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  suggestedAction?: string;
  jediScoreBefore?: number;
  jediScoreAfter?: number;
  jediScoreChange?: number;
  primarySignal?: string;
  linkedEventIds?: string[];
  linkedTradeAreaId?: string;
  impactSummary?: string;
  impactData?: any;
  isRead: boolean;
  isDismissed: boolean;
  isArchived: boolean;
  snoozedUntil?: Date;
  createdAt: Date;
  readAt?: Date;
  dismissedAt?: Date;
  archivedAt?: Date;
}

export type AlertType = 
  | 'demand_positive' 
  | 'supply_competition' 
  | 'demand_negative' 
  | 'score_change' 
  | 'market_shift';

export type AlertSeverity = 'green' | 'yellow' | 'red';

export interface AlertConfiguration {
  userId: string;
  scoreChangeThreshold: number;
  demandSensitivity: 'low' | 'medium' | 'high';
  supplySensitivity: 'low' | 'medium' | 'high';
  alertFrequency: 'realtime' | 'daily_digest' | 'weekly_digest';
  greenAlertsEnabled: boolean;
  yellowAlertsEnabled: boolean;
  redAlertsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppOnly: boolean;
  minImpactScore: number;
  activeDealsOnly: boolean;
}

export interface AlertGenerationContext {
  dealId: string;
  userId: string;
  eventId?: string;
  scoreBefore?: number;
  scoreAfter?: number;
  triggerType: 'score_change' | 'news_event' | 'market_update';
}

// ============================================================================
// Deal Alert Service Class
// ============================================================================

export class DealAlertService {
  /**
   * Generate alert when JEDI Score changes significantly
   */
  async generateScoreChangeAlert(
    dealId: string,
    userId: string,
    scoreBefore: number,
    scoreAfter: number,
    eventId?: string
  ): Promise<DealAlert | null> {
    const config = await this.getUserConfiguration(userId);
    const scoreDelta = scoreAfter - scoreBefore;
    const absChange = Math.abs(scoreDelta);

    // Check if change exceeds threshold
    if (absChange < config.scoreChangeThreshold) {
      return null;
    }

    // Determine severity and type
    let severity: AlertSeverity;
    let alertType: AlertType;
    let title: string;
    let message: string;

    if (scoreDelta > 0) {
      // Positive change
      if (absChange >= 5.0) {
        severity = 'green';
        alertType = 'demand_positive';
        title = '🎉 Major JEDI Score Increase';
      } else {
        severity = 'green';
        alertType = 'score_change';
        title = '📈 JEDI Score Improved';
      }
      message = `JEDI Score increased by ${absChange.toFixed(1)} points (${scoreBefore.toFixed(1)} → ${scoreAfter.toFixed(1)})`;
    } else {
      // Negative change
      if (absChange >= 5.0) {
        severity = 'red';
        alertType = 'demand_negative';
        title = '⚠️ Major JEDI Score Decline';
      } else {
        severity = 'yellow';
        alertType = 'score_change';
        title = '📉 JEDI Score Decreased';
      }
      message = `JEDI Score decreased by ${absChange.toFixed(1)} points (${scoreBefore.toFixed(1)} → ${scoreAfter.toFixed(1)})`;
    }

    // Check user preferences
    if (!this.shouldSendAlert(severity, config)) {
      return null;
    }

    // Get impact summary from event
    let impactSummary: string | undefined;
    let suggestedAction: string | undefined;

    if (eventId) {
      const eventResult = await query(
        `SELECT event_type, event_category, location_raw, extracted_data
         FROM news_events WHERE id = $1`,
        [eventId]
      );

      if (eventResult.rows.length > 0) {
        const event = eventResult.rows[0];
        impactSummary = this.generateImpactSummary(event, scoreDelta);
        suggestedAction = this.generateSuggestedAction(event, scoreDelta);
      }
    }

    // Create alert
    const alert = await this.createAlert({
      userId,
      dealId,
      alertType,
      severity,
      title,
      message,
      jediScoreBefore: scoreBefore,
      jediScoreAfter: scoreAfter,
      jediScoreChange: scoreDelta,
      linkedEventIds: eventId ? [eventId] : [],
      impactSummary,
      suggestedAction,
    });

    return alert;
  }

  /**
   * Generate alert when a significant news event occurs
   */
  async generateNewsEventAlert(
    dealId: string,
    userId: string,
    eventId: string
  ): Promise<DealAlert | null> {
    const config = await this.getUserConfiguration(userId);

    // Get event details
    const eventResult = await query(
      `SELECT ne.*, taei.impact_score
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE ne.id = $1 AND p.deal_id = $2
       ORDER BY taei.impact_score DESC
       LIMIT 1`,
      [eventId, dealId]
    );

    if (eventResult.rows.length === 0) {
      return null;
    }

    const event = eventResult.rows[0];

    // Check if impact score meets threshold
    if (event.impact_score < config.minImpactScore) {
      return null;
    }

    // Determine alert type and severity based on event
    const { alertType, severity } = this.classifyEvent(event);

    // Check user preferences
    if (!this.shouldSendAlert(severity, config)) {
      return null;
    }

    // Generate alert content
    const title = this.generateEventTitle(event, severity);
    const message = this.generateEventMessage(event);
    const suggestedAction = this.generateSuggestedAction(event);

    // Create alert
    const alert = await this.createAlert({
      userId,
      dealId,
      alertType,
      severity,
      title,
      message,
      linkedEventIds: [eventId],
      linkedTradeAreaId: event.trade_area_id,
      suggestedAction,
      impactSummary: `High-impact ${event.event_category} event within trade area`,
    });

    return alert;
  }

  /**
   * Check all active deals for a user and generate alerts
   */
  async checkDealsForAlerts(userId: string): Promise<number> {
    // Get user's active deals
    const dealsResult = await query(
      `SELECT id FROM deals 
       WHERE user_id = $1 
         AND stage IN ('prospect', 'uw', 'loi', 'psa', 'closing')`,
      [userId]
    );

    let alertsGenerated = 0;

    for (const deal of dealsResult.rows) {
      try {
        // Recalculate JEDI Score
        const previousScore = await jediScoreService.getLatestScore(deal.id);
        const newScore = await jediScoreService.calculateAndSave({
          dealId: deal.id,
          triggerType: 'periodic',
        });

        // Check for score change alert
        if (previousScore) {
          const alert = await this.generateScoreChangeAlert(
            deal.id,
            userId,
            previousScore.totalScore,
            newScore.totalScore
          );
          if (alert) alertsGenerated++;
        }

        // Check for new high-impact events (last 24 hours)
        const eventsResult = await query(
          `SELECT DISTINCT ne.id
           FROM news_events ne
           JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
           JOIN trade_areas ta ON ta.id = taei.trade_area_id
           JOIN properties p ON p.id = ta.property_id
           WHERE p.deal_id = $1
             AND ne.created_at > NOW() - INTERVAL '24 hours'
             AND taei.impact_score >= 50
             AND NOT EXISTS (
               SELECT 1 FROM deal_alerts da
               WHERE da.deal_id = $1 AND $2 = ANY(da.linked_event_ids)
             )`,
          [deal.id, userId]
        );

        for (const eventRow of eventsResult.rows) {
          const alert = await this.generateNewsEventAlert(deal.id, userId, eventRow.id);
          if (alert) alertsGenerated++;
        }
      } catch (error) {
        console.error(`Error checking alerts for deal ${deal.id}:`, error);
      }
    }

    return alertsGenerated;
  }

  /**
   * Create a new alert
   */
  async createAlert(params: {
    userId: string;
    dealId: string;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    jediScoreBefore?: number;
    jediScoreAfter?: number;
    jediScoreChange?: number;
    linkedEventIds?: string[];
    linkedTradeAreaId?: string;
    impactSummary?: string;
    suggestedAction?: string;
  }): Promise<DealAlert> {
    const result = await query(
      `INSERT INTO deal_alerts (
         user_id, deal_id, alert_type, severity, title, message,
         jedi_score_before, jedi_score_after, jedi_score_change,
         linked_event_ids, linked_trade_area_id, impact_summary, suggested_action
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        params.userId,
        params.dealId,
        params.alertType,
        params.severity,
        params.title,
        params.message,
        params.jediScoreBefore,
        params.jediScoreAfter,
        params.jediScoreChange,
        params.linkedEventIds || [],
        params.linkedTradeAreaId,
        params.impactSummary,
        params.suggestedAction,
      ]
    );

    return this.mapAlert(result.rows[0]);
  }

  /**
   * Get alerts for a user
   */
  async getUserAlerts(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
  ): Promise<DealAlert[]> {
    const { unreadOnly = false, limit = 50, offset = 0 } = options;

    const whereClause = unreadOnly
      ? `WHERE da.user_id = $1 AND da.is_read = FALSE AND da.is_dismissed = FALSE`
      : `WHERE da.user_id = $1`;

    const result = await query(
      `SELECT da.*, d.name as deal_name
       FROM deal_alerts da
       JOIN deals d ON d.id = da.deal_id
       ${whereClause}
         AND da.is_archived = FALSE
         AND (da.snoozed_until IS NULL OR da.snoozed_until < NOW())
       ORDER BY da.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => this.mapAlert(row));
  }

  /**
   * Get alerts for a deal
   */
  async getDealAlerts(dealId: string, limit = 20): Promise<DealAlert[]> {
    const result = await query(
      `SELECT * FROM deal_alerts
       WHERE deal_id = $1
         AND is_archived = FALSE
       ORDER BY created_at DESC
       LIMIT $2`,
      [dealId, limit]
    );

    return result.rows.map(row => this.mapAlert(row));
  }

  /**
   * Mark alert as read
   */
  async markAsRead(alertId: string, userId: string): Promise<void> {
    await query(
      `UPDATE deal_alerts
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId: string, userId: string): Promise<void> {
    await query(
      `UPDATE deal_alerts
       SET is_dismissed = TRUE, dismissed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
  }

  /**
   * Get or create user configuration
   */
  async getUserConfiguration(userId: string): Promise<AlertConfiguration> {
    let result = await query(
      `SELECT * FROM alert_configurations WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default configuration
      result = await query(
        `INSERT INTO alert_configurations (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      scoreChangeThreshold: parseFloat(row.score_change_threshold),
      demandSensitivity: row.demand_sensitivity,
      supplySensitivity: row.supply_sensitivity,
      alertFrequency: row.alert_frequency,
      greenAlertsEnabled: row.green_alerts_enabled,
      yellowAlertsEnabled: row.yellow_alerts_enabled,
      redAlertsEnabled: row.red_alerts_enabled,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      inAppOnly: row.in_app_only,
      minImpactScore: parseFloat(row.min_impact_score),
      activeDealsOnly: row.active_deals_only,
    };
  }

  /**
   * Update user configuration
   */
  async updateUserConfiguration(
    userId: string,
    updates: Partial<AlertConfiguration>
  ): Promise<AlertConfiguration> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fieldMap = {
      scoreChangeThreshold: 'score_change_threshold',
      demandSensitivity: 'demand_sensitivity',
      supplySensitivity: 'supply_sensitivity',
      alertFrequency: 'alert_frequency',
      greenAlertsEnabled: 'green_alerts_enabled',
      yellowAlertsEnabled: 'yellow_alerts_enabled',
      redAlertsEnabled: 'red_alerts_enabled',
      emailNotifications: 'email_notifications',
      pushNotifications: 'push_notifications',
      inAppOnly: 'in_app_only',
      minImpactScore: 'min_impact_score',
      activeDealsOnly: 'active_deals_only',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in updates) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        params.push((updates as any)[key]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.getUserConfiguration(userId);
    }

    params.push(userId);

    await query(
      `UPDATE alert_configurations
       SET ${setClauses.join(', ')}
       WHERE user_id = $${paramIndex}`,
      params
    );

    return this.getUserConfiguration(userId);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private shouldSendAlert(severity: AlertSeverity, config: AlertConfiguration): boolean {
    if (severity === 'green' && !config.greenAlertsEnabled) return false;
    if (severity === 'yellow' && !config.yellowAlertsEnabled) return false;
    if (severity === 'red' && !config.redAlertsEnabled) return false;
    return true;
  }

  private classifyEvent(event: any): { alertType: AlertType; severity: AlertSeverity } {
    const category = event.event_category;
    const type = event.event_type;

    // Employment events
    if (category === 'employment') {
      if (type.includes('inbound') || type.includes('expansion') || type.includes('hiring')) {
        return { alertType: 'demand_positive', severity: 'green' };
      }
      if (type.includes('outbound') || type.includes('layoff') || type.includes('closure')) {
        return { alertType: 'demand_negative', severity: 'red' };
      }
    }

    // Development events
    if (category === 'development') {
      return { alertType: 'supply_competition', severity: 'yellow' };
    }

    // Amenity events
    if (category === 'amenities') {
      return { alertType: 'demand_positive', severity: 'green' };
    }

    return { alertType: 'market_shift', severity: 'yellow' };
  }

  private generateEventTitle(event: any, severity: AlertSeverity): string {
    const emoji = severity === 'green' ? '✅' : severity === 'yellow' ? '⚠️' : '🚨';
    const category = event.event_category.replace('_', ' ');
    return `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} Event in Trade Area`;
  }

  private generateEventMessage(event: any): string {
    const location = event.location_raw || 'nearby';
    return `${event.event_type.replace(/_/g, ' ')} at ${location}`;
  }

  private generateImpactSummary(event: any, scoreDelta: number): string {
    const eventName = event.extracted_data?.company_name || event.location_raw || 'Event';
    const direction = scoreDelta > 0 ? 'adds' : 'subtracts';
    const absChange = Math.abs(scoreDelta);
    return `${eventName} ${direction} ${absChange.toFixed(1)} to JEDI Score`;
  }

  private generateSuggestedAction(event: any, scoreDelta?: number): string {
    if (scoreDelta && scoreDelta < -3) {
      return 'Review deal assumptions and consider updating underwriting model';
    }
    if (scoreDelta && scoreDelta > 3) {
      return 'Consider accelerating due diligence timeline to capture opportunity';
    }
    if (event.event_category === 'development') {
      return 'Monitor competitive supply pipeline and adjust rent assumptions';
    }
    if (event.event_category === 'employment') {
      return 'Update demand forecast based on employment trends';
    }
    return 'Monitor situation and update deal notes';
  }

  private mapAlert(row: any): DealAlert {
    return {
      id: row.id,
      userId: row.user_id,
      dealId: row.deal_id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      suggestedAction: row.suggested_action,
      jediScoreBefore: row.jedi_score_before ? parseFloat(row.jedi_score_before) : undefined,
      jediScoreAfter: row.jedi_score_after ? parseFloat(row.jedi_score_after) : undefined,
      jediScoreChange: row.jedi_score_change ? parseFloat(row.jedi_score_change) : undefined,
      primarySignal: row.primary_signal,
      linkedEventIds: row.linked_event_ids || [],
      linkedTradeAreaId: row.linked_trade_area_id,
      impactSummary: row.impact_summary,
      impactData: row.impact_data,
      isRead: row.is_read,
      isDismissed: row.is_dismissed,
      isArchived: row.is_archived,
      snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until) : undefined,
      createdAt: new Date(row.created_at),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const dealAlertService = new DealAlertService();
