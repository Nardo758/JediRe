/**
 * Agent Event Bus - Central nervous system for JediRE agent communication
 * 
 * Enables agents to communicate with each other and with the main orchestrator
 * that handles user notifications via mobile.
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

class EventEmitter {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, fn: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
    return this;
  }

  off(event: string, fn: (...args: any[]) => void): this {
    const fns = this.listeners.get(event);
    if (fns) this.listeners.set(event, fns.filter(f => f !== fn));
    return this;
  }

  once(event: string, fn: (...args: any[]) => void): this {
    const onceFn = (...args: any[]) => {
      this.off(event, onceFn);
      fn(...args);
    };
    return this.on(event, onceFn);
  }

  emit(event: string, ...args: any[]): boolean {
    const fns = this.listeners.get(event);
    if (!fns || fns.length === 0) return false;
    fns.forEach(fn => fn(...args));
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }

  setMaxListeners(_n: number): this {
    return this;
  }
}

// ============================================================================
// Types
// ============================================================================

export type AgentCode = 
  // Core Agents
  | 'ORCHESTRATOR'  // Main coordinator
  | 'STRATEGY'      // Investment strategy
  // Analyst Agents (AN01-AN16)
  | 'AN01'  // CFO - Returns, risk
  | 'AN02'  // Accountant - Tax, GAAP
  | 'AN03'  // Marketing - Positioning, lease-up
  | 'AN04'  // Developer - Construction, value-add
  | 'AN05'  // Legal - Contracts, compliance
  | 'AN06'  // Lender - Debt, underwriting
  | 'AN07'  // Acquisitions - Deal sourcing, negotiations
  | 'AN08'  // Asset Manager - NOI optimization
  | 'AN09'  // Property Manager - Tenant relations, maintenance
  | 'AN10'  // Leasing Director - Vacancy, renewals
  | 'AN11'  // Facilities Manager - CapEx, vendors
  | 'AN12'  // Investment Analyst - Hold/sell, refinance
  | 'AN13'  // ESG - Energy, sustainability
  | 'AN14'  // Compliance - Insurance, permits
  | 'AN15'  // Tax Strategist - Cost seg, 1031s
  | 'AN16'; // Researcher - Market research, demographics

export type MessageType = 
  | 'data'          // Raw data payload
  | 'request'       // Asking another agent for something
  | 'response'      // Answering a request
  | 'alert'         // Something needs attention
  | 'insight'       // Analytical finding
  | 'user_query'    // User asking a question
  | 'user_notify'   // Send notification to user
  | 'status';       // Agent status update

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentMessage {
  id: string;
  from: AgentCode;
  to: AgentCode | '*';
  type: MessageType;
  topic: string;
  payload: unknown;
  timestamp: number;
  priority: MessagePriority;
  correlationId?: string;
  dealId?: string;
  msaId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentStatus {
  code: AgentCode;
  status: 'online' | 'busy' | 'idle' | 'offline' | 'error';
  lastActive: number;
  currentTask?: string;
  progress?: number;
  messageCount: number;
  errorCount: number;
}

export interface UserNotification {
  id: string;
  title: string;
  body: string;
  priority: MessagePriority;
  dealId?: string;
  dealName?: string;
  actionUrl?: string;
  actionLabel?: string;
  agentSource: AgentCode;
  timestamp: number;
  delivered?: boolean;
  read?: boolean;
}

// ============================================================================
// Agent Bus Implementation
// ============================================================================

class AgentBus extends EventEmitter {
  private messageLog: AgentMessage[] = [];
  private agentStatuses: Map<AgentCode, AgentStatus> = new Map();
  private pendingNotifications: UserNotification[] = [];
  private maxLogSize = 1000;

  constructor() {
    super();
    this.initializeAgentStatuses();
  }

  private initializeAgentStatuses() {
    const defaultStatus = (code: AgentCode): AgentStatus => ({
      code,
      status: 'online',
      lastActive: Date.now(),
      messageCount: 0,
      errorCount: 0,
    });

    const agents: AgentCode[] = [
      'ORCHESTRATOR', 'STRATEGY',
      'AN01', 'AN02', 'AN03', 'AN04', 'AN05', 'AN06', 'AN07', 'AN08',
      'AN09', 'AN10', 'AN11', 'AN12', 'AN13', 'AN14', 'AN15', 'AN16',
    ];
    
    agents.forEach(code => {
      this.agentStatuses.set(code, defaultStatus(code));
    });
  }

  send(msg: Omit<AgentMessage, 'id' | 'timestamp'>): string {
    const fullMsg: AgentMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      priority: msg.priority || 'normal',
    };
    
    this.messageLog.push(fullMsg);
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog = this.messageLog.slice(-this.maxLogSize);
    }

    const senderStatus = this.agentStatuses.get(msg.from);
    if (senderStatus) {
      senderStatus.lastActive = Date.now();
      senderStatus.messageCount++;
      senderStatus.status = 'online';
    }

    if (msg.to === '*') {
      this.emit('broadcast', fullMsg);
    } else {
      this.emit(`agent:${msg.to}`, fullMsg);
    }
    
    this.emit('message', fullMsg);
    
    if (msg.type === 'user_notify') {
      this.queueUserNotification(fullMsg);
    }

    return fullMsg.id;
  }

  async request(
    from: AgentCode,
    to: AgentCode,
    topic: string,
    payload: unknown,
    timeoutMs = 30000
  ): Promise<AgentMessage> {
    const correlationId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off(`response:${correlationId}`, handler);
        reject(new Error(`Request timeout: ${topic}`));
      }, timeoutMs);

      const handler = (response: AgentMessage) => {
        clearTimeout(timeout);
        resolve(response);
      };

      this.once(`response:${correlationId}`, handler);
      
      this.send({
        from,
        to,
        type: 'request',
        topic,
        payload,
        correlationId,
        priority: 'normal',
      });
    });
  }

  respond(originalMsg: AgentMessage, from: AgentCode, payload: unknown) {
    if (!originalMsg.correlationId) return;

    const responseMsg = this.send({
      from,
      to: originalMsg.from,
      type: 'response',
      topic: `${originalMsg.topic}:response`,
      payload,
      correlationId: originalMsg.correlationId,
      priority: originalMsg.priority,
      dealId: originalMsg.dealId,
      msaId: originalMsg.msaId,
    });

    this.emit(`response:${originalMsg.correlationId}`, {
      ...this.messageLog.find(m => m.id === responseMsg),
    });
  }

  subscribe(agentCode: AgentCode, handler: (msg: AgentMessage) => void): () => void {
    this.on(`agent:${agentCode}`, handler);
    this.on('broadcast', handler);
    
    const status = this.agentStatuses.get(agentCode);
    if (status) {
      status.status = 'online';
      status.lastActive = Date.now();
    }

    return () => {
      this.off(`agent:${agentCode}`, handler);
      this.off('broadcast', handler);
      const s = this.agentStatuses.get(agentCode);
      if (s) s.status = 'offline';
    };
  }

  subscribeToTopic(topic: string, handler: (msg: AgentMessage) => void): () => void {
    const wrappedHandler = (msg: AgentMessage) => {
      if (msg.topic === topic || msg.topic.startsWith(`${topic}:`)) {
        handler(msg);
      }
    };
    this.on('message', wrappedHandler);
    return () => this.off('message', wrappedHandler);
  }

  updateStatus(code: AgentCode, update: Partial<AgentStatus>) {
    const current = this.agentStatuses.get(code);
    if (current) {
      Object.assign(current, update, { lastActive: Date.now() });
      this.emit('status:update', { code, status: current });
    }
  }

  getStatus(code: AgentCode): AgentStatus | undefined {
    return this.agentStatuses.get(code);
  }

  getAllStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  private queueUserNotification(msg: AgentMessage) {
    const notification: UserNotification = {
      id: msg.id,
      title: (msg.payload as Record<string, string>)?.title || 'JediRE Alert',
      body: (msg.payload as Record<string, string>)?.body || String(msg.payload),
      priority: msg.priority,
      dealId: msg.dealId,
      dealName: (msg.payload as Record<string, string>)?.dealName,
      actionUrl: (msg.payload as Record<string, string>)?.actionUrl,
      actionLabel: (msg.payload as Record<string, string>)?.actionLabel,
      agentSource: msg.from,
      timestamp: msg.timestamp,
      delivered: false,
      read: false,
    };

    this.pendingNotifications.push(notification);
    this.emit('notification:queued', notification);
    
    this.send({
      from: msg.from,
      to: 'ORCHESTRATOR',
      type: 'user_notify',
      topic: 'deliver_notification',
      payload: notification,
      priority: msg.priority,
    });
  }

  getPendingNotifications(): UserNotification[] {
    return this.pendingNotifications.filter(n => !n.delivered);
  }

  markNotificationDelivered(id: string) {
    const notif = this.pendingNotifications.find(n => n.id === id);
    if (notif) notif.delivered = true;
  }

  markNotificationRead(id: string) {
    const notif = this.pendingNotifications.find(n => n.id === id);
    if (notif) notif.read = true;
  }

  getRecentMessages(limit = 50): AgentMessage[] {
    return this.messageLog.slice(-limit);
  }

  getMessagesForAgent(code: AgentCode, limit = 50): AgentMessage[] {
    return this.messageLog
      .filter(m => m.from === code || m.to === code || m.to === '*')
      .slice(-limit);
  }

  getMessagesForDeal(dealId: string, limit = 50): AgentMessage[] {
    return this.messageLog
      .filter(m => m.dealId === dealId)
      .slice(-limit);
  }

  clearLog() {
    this.messageLog = [];
  }
}

export const agentBus = new AgentBus();
export { AgentBus };
