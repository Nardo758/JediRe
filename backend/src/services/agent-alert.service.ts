/**
 * Agent Alert Service
 * 
 * Central service for all 18 agents to push alerts to the ALERTS tab.
 * Each agent has specific alert types they can generate.
 * 
 * CREATE: backend/src/services/agent-alert.service.ts
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type AgentCode = 
  | 'ORCHESTRATOR' | 'STRATEGY'
  | 'AN01' | 'AN02' | 'AN03' | 'AN04' | 'AN05' | 'AN06' | 'AN07' | 'AN08'
  | 'AN09' | 'AN10' | 'AN11' | 'AN12' | 'AN13' | 'AN14' | 'AN15' | 'AN16';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertType = 
  | 'risk_flag'           // Something risky detected
  | 'opportunity'         // Potential upside
  | 'action_required'     // User needs to do something
  | 'info'                // FYI, no action needed
  | 'compliance'          // Regulatory/compliance issue
  | 'deadline'            // Time-sensitive
  | 'anomaly';            // Unusual pattern detected

export interface AgentAlertParams {
  dealId?: string;           // Optional - some alerts are portfolio-wide
  propertyId?: string;
  userId: string;
  agentCode: AgentCode;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, any>;
  suggestedActions?: string[];
  expiresAt?: Date;          // Auto-dismiss after this time
  dedupeKey?: string;        // Prevent duplicate alerts
}

// ============================================================================
// Agent Alert Definitions
// ============================================================================

export const AGENT_ALERT_TYPES: Record<AgentCode, { types: AlertType[]; focus: string }> = {
  ORCHESTRATOR: { 
    types: ['info', 'action_required', 'deadline'], 
    focus: 'Portfolio-wide coordination and notifications' 
  },
  STRATEGY: { 
    types: ['opportunity', 'risk_flag', 'action_required'], 
    focus: 'Investment recommendations and JEDI score changes' 
  },
  AN01: { // CFO
    types: ['risk_flag', 'anomaly', 'info'], 
    focus: 'Returns below threshold, risk metric breaches' 
  },
  AN02: { // Accountant
    types: ['deadline', 'compliance', 'action_required'], 
    focus: 'Tax deadlines, GAAP issues, reporting requirements' 
  },
  AN03: { // Marketing
    types: ['opportunity', 'info', 'action_required'], 
    focus: 'Lease-up velocity, pricing opportunities, comp movements' 
  },
  AN04: { // Developer
    types: ['risk_flag', 'deadline', 'action_required'], 
    focus: 'Construction delays, cost overruns, permit issues' 
  },
  AN05: { // Legal
    types: ['risk_flag', 'compliance', 'deadline'], 
    focus: 'Contract issues, compliance violations, legal deadlines' 
  },
  AN06: { // Lender
    types: ['opportunity', 'risk_flag', 'deadline'], 
    focus: 'Rate changes, covenant breaches, refinance windows' 
  },
  AN07: { // Acquisitions
    types: ['opportunity', 'deadline', 'info'], 
    focus: 'New deal opportunities, LOI deadlines, market timing' 
  },
  AN08: { // Asset Manager
    types: ['risk_flag', 'opportunity', 'anomaly'], 
    focus: 'NOI underperformance, expense anomalies, revenue opportunities' 
  },
  AN09: { // Property Manager
    types: ['action_required', 'risk_flag', 'info'], 
    focus: 'Tenant issues, maintenance emergencies, vendor problems' 
  },
  AN10: { // Leasing Director
    types: ['risk_flag', 'opportunity', 'deadline'], 
    focus: 'Vacancy spikes, renewal expirations, pricing alerts' 
  },
  AN11: { // Facilities Manager
    types: ['action_required', 'deadline', 'risk_flag'], 
    focus: 'CapEx needs, equipment failures, vendor contract renewals' 
  },
  AN12: { // Investment Analyst
    types: ['opportunity', 'risk_flag', 'info'], 
    focus: 'Hold/sell triggers, market timing, refinance opportunities' 
  },
  AN13: { // ESG
    types: ['compliance', 'opportunity', 'info'], 
    focus: 'ESG compliance, energy efficiency opportunities, certifications' 
  },
  AN14: { // Compliance
    types: ['compliance', 'deadline', 'risk_flag'], 
    focus: 'Regulatory violations, permit expirations, insurance gaps' 
  },
  AN15: { // Tax Strategist
    types: ['opportunity', 'deadline', 'action_required'], 
    focus: 'Cost seg opportunities, 1031 deadlines, tax strategy changes' 
  },
  AN16: { // Researcher
    types: ['info', 'opportunity', 'risk_flag'], 
    focus: 'Market insights, demographic shifts, competitive intelligence' 
  },
};

// ============================================================================
// Agent Alert Service
// ============================================================================

class AgentAlertService {
  /**
   * Create an alert from any of the 18 agents
   */
  async createAlert(params: AgentAlertParams): Promise<{ id: string; created: boolean }> {
    const {
      dealId,
      propertyId,
      userId,
      agentCode,
      alertType,
      severity,
      title,
      message,
      data,
      suggestedActions,
      expiresAt,
      dedupeKey,
    } = params;

    // Validate agent can create this alert type
    const agentConfig = AGENT_ALERT_TYPES[agentCode];
    if (!agentConfig) {
      throw new Error(`Unknown agent code: ${agentCode}`);
    }
    if (!agentConfig.types.includes(alertType)) {
      logger.warn(`Agent ${agentCode} creating unusual alert type: ${alertType}`);
    }

    // Check for duplicate if dedupeKey provided
    if (dedupeKey) {
      const existing = await query(
        `SELECT id FROM deal_alerts 
         WHERE metadata->>'dedupeKey' = $1 
         AND is_dismissed = FALSE 
         AND created_at > NOW() - INTERVAL '24 hours'`,
        [dedupeKey]
      );
      if (existing.rows.length > 0) {
        return { id: existing.rows[0].id, created: false };
      }
    }

    // Map severity to color
    const severityColor = {
      critical: 'red',
      high: 'red',
      medium: 'yellow',
      low: 'green',
    }[severity];

    // Build metadata
    const metadata = {
      agentCode,
      agentFocus: agentConfig.focus,
      data: data || {},
      suggestedActions: suggestedActions || [],
      dedupeKey,
    };

    // Insert alert
    const result = await query(
      `INSERT INTO deal_alerts (
        deal_id, property_id, user_id, 
        alert_type, severity, title, message,
        source_type, source_ref, metadata,
        expires_at, is_read, is_dismissed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, FALSE)
      RETURNING id`,
      [
        dealId || null,
        propertyId || null,
        userId,
        alertType,
        severityColor,
        title,
        message,
        'agent',
        agentCode,
        JSON.stringify(metadata),
        expiresAt || null,
      ]
    );

    const alertId = result.rows[0].id;

    logger.info(`[${agentCode}] Alert created: ${title}`, {
      alertId,
      dealId,
      alertType,
      severity,
    });

    return { id: alertId, created: true };
  }

  /**
   * Bulk create alerts from agent analysis
   */
  async createBulkAlerts(
    userId: string,
    agentCode: AgentCode,
    findings: Omit<AgentAlertParams, 'userId' | 'agentCode'>[]
  ): Promise<{ created: number; skipped: number; ids: string[] }> {
    let created = 0;
    let skipped = 0;
    const ids: string[] = [];

    for (const finding of findings) {
      const result = await this.createAlert({
        ...finding,
        userId,
        agentCode,
      });
      
      if (result.created) {
        created++;
      } else {
        skipped++;
      }
      ids.push(result.id);
    }

    return { created, skipped, ids };
  }

  /**
   * Get alerts for user with agent metadata
   */
  async getAlerts(
    userId: string,
    options: {
      dealId?: string;
      agentCode?: AgentCode;
      alertType?: AlertType;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ alerts: any[]; total: number; unread: number }> {
    const { dealId, agentCode, alertType, unreadOnly, limit = 50, offset = 0 } = options;

    let whereConditions = ['user_id = $1', 'is_dismissed = FALSE'];
    const params: any[] = [userId];
    let paramIndex = 2;

    // Filter expired
    whereConditions.push(`(expires_at IS NULL OR expires_at > NOW())`);

    if (dealId) {
      whereConditions.push(`deal_id = $${paramIndex}`);
      params.push(dealId);
      paramIndex++;
    }

    if (agentCode) {
      whereConditions.push(`source_ref = $${paramIndex}`);
      params.push(agentCode);
      paramIndex++;
    }

    if (alertType) {
      whereConditions.push(`alert_type = $${paramIndex}`);
      params.push(alertType);
      paramIndex++;
    }

    if (unreadOnly) {
      whereConditions.push('is_read = FALSE');
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    params.push(limit);
    params.push(offset);

    const result = await query(
      `SELECT 
        da.*,
        d.name as deal_name,
        d.address_line1 as deal_address
      FROM deal_alerts da
      LEFT JOIN deals d ON da.deal_id = d.id
      ${whereClause}
      ORDER BY 
        CASE da.severity 
          WHEN 'red' THEN 1 
          WHEN 'yellow' THEN 2 
          WHEN 'green' THEN 3 
        END,
        da.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    // Get counts
    const countResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = FALSE) as unread
      FROM deal_alerts da
      ${whereClause.replace(/LIMIT.*|OFFSET.*/g, '')}`,
      params.slice(0, -2)
    );

    // Transform for frontend
    const alerts = result.rows.map(row => {
      const metadata = row.metadata || {};
      return {
        id: row.id,
        type: row.alert_type,
        severity: row.severity === 'red' ? 
          (metadata.data?.isCritical ? 'critical' : 'high') : 
          (row.severity === 'yellow' ? 'medium' : 'low'),
        deal_id: row.deal_id,
        deal_name: row.deal_name || row.deal_address,
        message: row.message,
        title: row.title,
        created_at: row.created_at,
        read: row.is_read,
        dismissed: row.is_dismissed,
        source: metadata.agentCode || row.source_ref,
        agentFocus: metadata.agentFocus,
        suggestedActions: metadata.suggestedActions || [],
        data: metadata.data,
      };
    });

    return {
      alerts,
      total: parseInt(countResult.rows[0].total),
      unread: parseInt(countResult.rows[0].unread),
    };
  }

  /**
   * Mark alert as read
   */
  async markRead(alertId: string, userId: string): Promise<void> {
    await query(
      `UPDATE deal_alerts SET is_read = TRUE, read_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
  }

  /**
   * Mark all alerts as read
   */
  async markAllRead(userId: string, dealId?: string): Promise<number> {
    let sql = `UPDATE deal_alerts SET is_read = TRUE, read_at = NOW() 
               WHERE user_id = $1 AND is_read = FALSE`;
    const params: any[] = [userId];

    if (dealId) {
      sql += ` AND deal_id = $2`;
      params.push(dealId);
    }

    const result = await query(sql + ' RETURNING id', params);
    return result.rowCount || 0;
  }

  /**
   * Dismiss alert
   */
  async dismiss(alertId: string, userId: string): Promise<void> {
    await query(
      `UPDATE deal_alerts SET is_dismissed = TRUE, dismissed_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
  }

  /**
   * Cleanup expired alerts
   */
  async cleanupExpired(): Promise<number> {
    const result = await query(
      `DELETE FROM deal_alerts WHERE expires_at < NOW() RETURNING id`
    );
    return result.rowCount || 0;
  }
}

export const agentAlertService = new AgentAlertService();
export default agentAlertService;
