/**
 * Event Dispatcher
 * 
 * Listens for platform events and dispatches them to the agent orchestrator.
 * Integrates with various platform systems to trigger agent workflows.
 * 
 * Events:
 * - Document uploads → Document agents
 * - Email received → Acquisitions, Research
 * - Deal created → Strategy, Acquisitions, Lender
 * - Financials updated → CFO, Asset Manager
 * - Market data changed → Research, Strategy, Lender
 * - News alerts → Research, Strategy
 * - Scheduled → Various (daily/weekly reports)
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { agentOrchestrator, EventPayload } from './agent-orchestrator';
import { TriggerEvent } from './agent-personas';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ============================================================================
// EVENT DISPATCHER CLASS
// ============================================================================

class EventDispatcher {
  private eventQueue: EventPayload[] = [];
  private processing = false;

  /**
   * Emit an event to trigger agents
   */
  async emit(event: TriggerEvent, data: Record<string, any>): Promise<void> {
    const payload: EventPayload = {
      event,
      dealId: data.dealId,
      userId: data.userId,
      data,
    };

    logger.info(`Event emitted: ${event}`, { dealId: data.dealId });

    // Queue the event
    this.eventQueue.push(payload);

    // Process queue (non-blocking)
    this.processQueue();
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) return;
    
    this.processing = true;

    while (this.eventQueue.length > 0) {
      const payload = this.eventQueue.shift()!;
      
      try {
        // Log the event
        await this.logEvent(payload);

        // Dispatch to agents
        const responses = await agentOrchestrator.dispatchEvent(payload);

        // Log responses
        for (const response of responses) {
          logger.info(`Agent ${response.agentId} responded to ${payload.event}`, {
            skillsUsed: response.skillsUsed,
            notificationCount: response.notifications?.length || 0,
          });
        }

      } catch (error: any) {
        logger.error(`Failed to process event ${payload.event}:`, error);
      }
    }

    this.processing = false;
  }

  /**
   * Log event to database
   */
  private async logEvent(payload: EventPayload): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_events (event_type, deal_id, user_id, payload, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [payload.event, payload.dealId, payload.userId, JSON.stringify(payload.data)]
      );
    } catch {
      // Non-critical, just log
      logger.warn('Failed to log event to database');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS FOR COMMON EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Document was uploaded
   */
  async onDocumentUploaded(dealId: string, userId: string, document: {
    fileId: string;
    filename: string;
    category: string;
    mimeType: string;
  }): Promise<void> {
    await this.emit('document_uploaded', {
      dealId,
      userId,
      ...document,
    });
  }

  /**
   * Email was received (from sync)
   */
  async onEmailReceived(userId: string, email: {
    emailId: string;
    subject: string;
    from: string;
    hasAttachments: boolean;
    dealId?: string;
    type?: 'broker_om' | 'lender' | 'general';
  }): Promise<void> {
    await this.emit('email_received', {
      userId,
      dealId: email.dealId,
      ...email,
    });
  }

  /**
   * New deal was created
   */
  async onDealCreated(dealId: string, userId: string, deal: {
    name: string;
    propertyType: string;
    city: string;
    state: string;
    units?: number;
    askingPrice?: number;
  }): Promise<void> {
    await this.emit('deal_created', {
      dealId,
      userId,
      ...deal,
    });
  }

  /**
   * Deal status changed
   */
  async onDealStatusChanged(dealId: string, userId: string, change: {
    previousStatus: string;
    newStatus: string;
    reason?: string;
  }): Promise<void> {
    await this.emit('deal_status_changed', {
      dealId,
      userId,
      status: change.newStatus,
      ...change,
    });
  }

  /**
   * Financials were updated (T-12 uploaded, actuals entered)
   */
  async onFinancialsUpdated(dealId: string, userId: string, update: {
    updateType: 't12' | 'rent_roll' | 'actuals' | 'budget';
    period?: string;
    source?: string;
  }): Promise<void> {
    await this.emit('financials_updated', {
      dealId,
      userId,
      ...update,
    });
  }

  /**
   * Market data changed (new comps, rate changes, etc.)
   */
  async onMarketDataChanged(data: {
    type: 'rents' | 'cap_rates' | 'rates' | 'supply';
    msaId?: string;
    dealId?: string;
    change: Record<string, any>;
  }): Promise<void> {
    await this.emit('market_data_changed', data);
  }

  /**
   * News alert received
   */
  async onNewsAlert(alert: {
    headline: string;
    source: string;
    category: string;
    relevantMsas?: string[];
    relevantDeals?: string[];
    url?: string;
  }): Promise<void> {
    await this.emit('news_alert', alert);
  }

  /**
   * Threshold breach detected
   */
  async onThresholdBreach(dealId: string, breach: {
    metric: string;
    threshold: number;
    actualValue: number;
    direction: 'above' | 'below';
    type?: string;
    days?: number;
  }): Promise<void> {
    await this.emit('threshold_breach', {
      dealId,
      ...breach,
    });
  }

  /**
   * Task is due
   */
  async onTaskDue(dealId: string, userId: string, task: {
    taskId: string;
    title: string;
    dueDate: string;
    priority: string;
  }): Promise<void> {
    await this.emit('task_due', {
      dealId,
      userId,
      ...task,
    });
  }
}

// Export singleton
export const eventDispatcher = new EventDispatcher();
export default eventDispatcher;
