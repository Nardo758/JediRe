/**
 * Orchestrator Agent Service
 * 
 * Main AI coordinator that:
 * - Manages communication between all agents
 * - Sends notifications to user's mobile device
 * - Routes user queries to appropriate agents
 * - Synthesizes multi-agent responses
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { agentBus, AgentCode, AgentMessage, UserNotification } from './agentBus';
import { getAgentByCode, getAgentsThatPublish, AGENT_DEFINITIONS } from './agentRegistry';
import api from '../lib/api';

// ============================================================================
// Types
// ============================================================================

interface MobileNotificationPayload {
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  data?: {
    dealId?: string;
    dealName?: string;
    actionUrl?: string;
    agentSource?: string;
  };
  sound?: boolean;
  badge?: number;
}

interface UserPreferences {
  notificationsEnabled: boolean;
  quietHoursStart?: string;  // "22:00"
  quietHoursEnd?: string;    // "08:00"
  priorityThreshold: 'low' | 'normal' | 'high' | 'critical';
  preferredChannels: ('push' | 'email' | 'sms')[];
  agentPreferences: Record<AgentCode, { enabled: boolean; frequency: 'realtime' | 'digest' }>;
}

interface OrchestratorState {
  isRunning: boolean;
  lastHeartbeat: number;
  pendingNotifications: UserNotification[];
  activeWorkflows: string[];
  userPreferences: UserPreferences | null;
}

// ============================================================================
// Default Preferences
// ============================================================================

const DEFAULT_PREFERENCES: UserPreferences = {
  notificationsEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  priorityThreshold: 'normal',
  preferredChannels: ['push'],
  agentPreferences: {
    ORCHESTRATOR: { enabled: true, frequency: 'realtime' },
    SUPPLY: { enabled: true, frequency: 'digest' },
    DEMAND: { enabled: true, frequency: 'digest' },
    NEWS: { enabled: true, frequency: 'realtime' },
    DEBT: { enabled: true, frequency: 'realtime' },
    STRATEGY: { enabled: true, frequency: 'realtime' },
    CASH: { enabled: true, frequency: 'digest' },
    ZONING: { enabled: true, frequency: 'digest' },
    COMPS: { enabled: true, frequency: 'digest' },
    RISK: { enabled: true, frequency: 'realtime' },
  },
};

// ============================================================================
// Orchestrator Class
// ============================================================================

class OrchestratorService {
  private state: OrchestratorState = {
    isRunning: false,
    lastHeartbeat: 0,
    pendingNotifications: [],
    activeWorkflows: [],
    userPreferences: null,
  };

  private unsubscribe: (() => void) | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async start() {
    if (this.state.isRunning) return;

    console.log('[Orchestrator] Starting...');
    
    // Load user preferences
    await this.loadPreferences();

    // Subscribe to all agent messages
    this.unsubscribe = agentBus.subscribe('ORCHESTRATOR', this.handleMessage.bind(this));

    // Also listen to broadcasts
    agentBus.on('broadcast', this.handleBroadcast.bind(this));

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 30000);

    // Update status
    agentBus.updateStatus('ORCHESTRATOR', { 
      status: 'online',
      currentTask: 'Monitoring agents',
    });

    this.state.isRunning = true;
    console.log('[Orchestrator] Started successfully');
  }

  stop() {
    if (!this.state.isRunning) return;

    console.log('[Orchestrator] Stopping...');

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    agentBus.off('broadcast', this.handleBroadcast.bind(this));
    agentBus.updateStatus('ORCHESTRATOR', { status: 'offline' });

    this.state.isRunning = false;
  }

  // -------------------------------------------------------------------------
  // Message Handling
  // -------------------------------------------------------------------------

  private async handleMessage(msg: AgentMessage) {
    console.log('[Orchestrator] Received message:', msg.topic, 'from', msg.from);

    switch (msg.type) {
      case 'user_query':
        await this.handleUserQuery(msg);
        break;
      case 'user_notify':
        await this.handleNotification(msg);
        break;
      case 'alert':
        await this.handleAlert(msg);
        break;
      case 'request':
        await this.handleAgentRequest(msg);
        break;
      default:
        // Log for debugging
        console.log('[Orchestrator] Unhandled message type:', msg.type);
    }
  }

  private handleBroadcast(msg: AgentMessage) {
    // Track important broadcasts for situational awareness
    if (msg.type === 'alert' && msg.priority === 'critical') {
      this.escalateAlert(msg);
    }
  }

  private async handleUserQuery(msg: AgentMessage) {
    const payload = msg.payload as { text: string; dealId?: string };
    const query = payload.text.toLowerCase();

    // Route to appropriate agent based on query content
    let targetAgent: AgentCode = 'STRATEGY';  // Default to strategy

    if (query.includes('pipeline') || query.includes('construction') || query.includes('supply')) {
      targetAgent = 'SUPPLY';
    } else if (query.includes('demand') || query.includes('absorption') || query.includes('employment')) {
      targetAgent = 'DEMAND';
    } else if (query.includes('news') || query.includes('headline') || query.includes('sentiment')) {
      targetAgent = 'NEWS';
    } else if (query.includes('rate') || query.includes('financing') || query.includes('debt') || query.includes('loan')) {
      targetAgent = 'DEBT';
    } else if (query.includes('cash') || query.includes('irr') || query.includes('distribution')) {
      targetAgent = 'CASH';
    } else if (query.includes('zoning') || query.includes('entitlement') || query.includes('permit')) {
      targetAgent = 'ZONING';
    } else if (query.includes('comp') || query.includes('sale') || query.includes('benchmark')) {
      targetAgent = 'COMPS';
    } else if (query.includes('risk') || query.includes('alert')) {
      targetAgent = 'RISK';
    }

    // Forward to target agent
    agentBus.send({
      from: 'ORCHESTRATOR',
      to: targetAgent,
      type: 'request',
      topic: 'user_query',
      payload: {
        originalQuery: payload.text,
        dealId: payload.dealId || msg.dealId,
        respondTo: msg.from,
      },
      correlationId: msg.correlationId,
      priority: 'high',
      dealId: payload.dealId || msg.dealId,
    });
  }

  private async handleNotification(msg: AgentMessage) {
    const notification = msg.payload as UserNotification;
    
    // Check if we should deliver this notification
    if (!this.shouldDeliver(notification)) {
      console.log('[Orchestrator] Notification suppressed:', notification.title);
      return;
    }

    // Deliver via configured channels
    await this.deliverNotification(notification);
  }

  private async handleAlert(msg: AgentMessage) {
    const agent = getAgentByCode(msg.from);
    
    // Create notification from alert
    const notification: UserNotification = {
      id: msg.id,
      title: `${agent?.emoji || '🔔'} ${agent?.shortName || msg.from} Alert`,
      body: typeof msg.payload === 'string' ? msg.payload : (msg.payload as any)?.message || JSON.stringify(msg.payload),
      priority: msg.priority,
      dealId: msg.dealId,
      agentSource: msg.from,
      timestamp: msg.timestamp,
    };

    if (this.shouldDeliver(notification)) {
      await this.deliverNotification(notification);
    }
  }

  private async handleAgentRequest(msg: AgentMessage) {
    // Handle inter-agent coordination requests
    if (msg.topic === 'coordinate_workflow') {
      await this.coordinateWorkflow(msg);
    }
  }

  // -------------------------------------------------------------------------
  // Notification Delivery
  // -------------------------------------------------------------------------

  private shouldDeliver(notification: UserNotification): boolean {
    const prefs = this.state.userPreferences || DEFAULT_PREFERENCES;

    // Check if notifications are enabled
    if (!prefs.notificationsEnabled) return false;

    // Check priority threshold
    const priorityOrder = ['low', 'normal', 'high', 'critical'];
    const notifPriority = priorityOrder.indexOf(notification.priority);
    const threshold = priorityOrder.indexOf(prefs.priorityThreshold);
    if (notifPriority < threshold) return false;

    // Check quiet hours
    if (prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Only enforce quiet hours for non-critical
      if (notification.priority !== 'critical') {
        if (prefs.quietHoursStart > prefs.quietHoursEnd) {
          // Quiet hours span midnight
          if (currentTime >= prefs.quietHoursStart || currentTime < prefs.quietHoursEnd) {
            return false;
          }
        } else {
          if (currentTime >= prefs.quietHoursStart && currentTime < prefs.quietHoursEnd) {
            return false;
          }
        }
      }
    }

    // Check agent-specific preferences
    const agentPref = prefs.agentPreferences[notification.agentSource];
    if (agentPref && !agentPref.enabled) return false;

    return true;
  }

  private async deliverNotification(notification: UserNotification) {
    const prefs = this.state.userPreferences || DEFAULT_PREFERENCES;

    for (const channel of prefs.preferredChannels) {
      try {
        switch (channel) {
          case 'push':
            await this.sendPushNotification(notification);
            break;
          case 'email':
            await this.sendEmailNotification(notification);
            break;
          case 'sms':
            await this.sendSmsNotification(notification);
            break;
        }
      } catch (err) {
        console.error(`[Orchestrator] Failed to deliver via ${channel}:`, err);
      }
    }

    // Mark as delivered
    agentBus.markNotificationDelivered(notification.id);
  }

  private async sendPushNotification(notification: UserNotification) {
    const payload: MobileNotificationPayload = {
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      data: {
        dealId: notification.dealId,
        dealName: notification.dealName,
        actionUrl: notification.actionUrl,
        agentSource: notification.agentSource,
      },
      sound: notification.priority === 'critical' || notification.priority === 'high',
    };

    // Send to backend notification service
    try {
      await api.post('/notifications/push', payload);
      console.log('[Orchestrator] Push notification sent:', notification.title);
    } catch (err) {
      // Fallback: store for next sync
      console.warn('[Orchestrator] Push delivery failed, queuing for sync');
      this.state.pendingNotifications.push(notification);
    }
  }

  private async sendEmailNotification(notification: UserNotification) {
    await api.post('/notifications/email', {
      subject: notification.title,
      body: notification.body,
      dealId: notification.dealId,
      agentSource: notification.agentSource,
    });
    console.log('[Orchestrator] Email notification sent:', notification.title);
  }

  private async sendSmsNotification(notification: UserNotification) {
    // Only for critical alerts
    if (notification.priority !== 'critical') return;

    await api.post('/notifications/sms', {
      message: `${notification.title}: ${notification.body}`,
    });
    console.log('[Orchestrator] SMS notification sent:', notification.title);
  }

  // -------------------------------------------------------------------------
  // Workflow Coordination
  // -------------------------------------------------------------------------

  private async coordinateWorkflow(msg: AgentMessage) {
    const workflow = msg.payload as { type: string; dealId?: string; steps: AgentCode[] };

    this.state.activeWorkflows.push(workflow.type);

    // Execute workflow steps sequentially
    for (const agentCode of workflow.steps) {
      agentBus.send({
        from: 'ORCHESTRATOR',
        to: agentCode,
        type: 'request',
        topic: `workflow:${workflow.type}`,
        payload: { dealId: workflow.dealId },
        priority: 'normal',
        dealId: workflow.dealId,
      });

      // Wait for completion (simplified - real impl would track responses)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Remove from active workflows
    this.state.activeWorkflows = this.state.activeWorkflows.filter(w => w !== workflow.type);
  }

  private escalateAlert(msg: AgentMessage) {
    // Critical alerts bypass normal delivery rules
    const agent = getAgentByCode(msg.from);
    
    this.sendPushNotification({
      id: msg.id,
      title: `🚨 CRITICAL: ${agent?.shortName || msg.from}`,
      body: typeof msg.payload === 'string' ? msg.payload : (msg.payload as any)?.message || 'Critical alert',
      priority: 'critical',
      dealId: msg.dealId,
      agentSource: msg.from,
      timestamp: msg.timestamp,
    });
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  private async loadPreferences() {
    try {
      const response = await api.get('/preferences/notifications');
      this.state.userPreferences = { ...DEFAULT_PREFERENCES, ...response.data.data };
    } catch {
      this.state.userPreferences = DEFAULT_PREFERENCES;
    }
  }

  async updatePreferences(updates: Partial<UserPreferences>) {
    this.state.userPreferences = { 
      ...this.state.userPreferences || DEFAULT_PREFERENCES, 
      ...updates 
    };

    try {
      await api.put('/preferences/notifications', this.state.userPreferences);
    } catch (err) {
      console.error('[Orchestrator] Failed to save preferences:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Heartbeat & Status
  // -------------------------------------------------------------------------

  private heartbeat() {
    this.state.lastHeartbeat = Date.now();

    agentBus.updateStatus('ORCHESTRATOR', {
      status: 'online',
      lastActive: Date.now(),
      currentTask: this.state.activeWorkflows.length > 0 
        ? `Running ${this.state.activeWorkflows.length} workflows`
        : 'Monitoring agents',
    });

    // Process any pending notifications
    this.processPendingNotifications();
  }

  private async processPendingNotifications() {
    if (this.state.pendingNotifications.length === 0) return;

    const toProcess = [...this.state.pendingNotifications];
    this.state.pendingNotifications = [];

    for (const notification of toProcess) {
      try {
        await this.sendPushNotification(notification);
      } catch {
        // Re-queue if still failing
        this.state.pendingNotifications.push(notification);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getState(): OrchestratorState {
    return { ...this.state };
  }

  // Send a message to user (from orchestrator)
  notifyUser(title: string, body: string, options: Partial<UserNotification> = {}) {
    const notification: UserNotification = {
      id: crypto.randomUUID(),
      title,
      body,
      priority: options.priority || 'normal',
      dealId: options.dealId,
      dealName: options.dealName,
      actionUrl: options.actionUrl,
      agentSource: 'ORCHESTRATOR',
      timestamp: Date.now(),
    };

    this.deliverNotification(notification);
  }

  // Broadcast a message to all agents
  broadcastToAgents(topic: string, payload: unknown, priority: 'low' | 'normal' | 'high' = 'normal') {
    agentBus.send({
      from: 'ORCHESTRATOR',
      to: '*',
      type: 'data',
      topic,
      payload,
      priority,
    });
  }

  // Request analysis from specific agent (gated by identity completeness)
  async requestAnalysis(agentCode: AgentCode, dealId: string, analysisType: string): Promise<unknown> {
    const { useDealStore } = await import('../stores/dealStore');
    const identityComplete = useDealStore.getState().isIdentityComplete();
    if (!identityComplete) {
      throw new Error('IDENTITY_GATE: Deal identity is incomplete. Complete required fields (name, address, city, state, mode) before running agent analysis.');
    }

    const response = await agentBus.request(
      'ORCHESTRATOR',
      agentCode,
      `analysis:${analysisType}`,
      { dealId },
      60000  // 60s timeout for analysis
    );

    return response.payload;
  }
}

// Singleton export
export const orchestrator = new OrchestratorService();

// Auto-start when imported (can be disabled for testing)
if (typeof window !== 'undefined') {
  orchestrator.start();
}
