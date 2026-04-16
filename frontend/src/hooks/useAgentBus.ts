/**
 * React hooks for Agent Bus integration
 */

import { useState, useEffect, useCallback } from 'react';
import { agentBus, AgentMessage, AgentStatus, AgentCode, UserNotification } from '../services/agentBus';
import { getAgentByCode, AGENT_DEFINITIONS } from '../services/agentRegistry';

// Get recent messages across all agents
export function useAgentMessages(limit = 30) {
  const [messages, setMessages] = useState<AgentMessage[]>(() => agentBus.getRecentMessages(limit));

  useEffect(() => {
    const handler = (msg: AgentMessage) => {
      setMessages(prev => [...prev.slice(-(limit - 1)), msg]);
    };
    agentBus.on('message', handler);
    return () => { agentBus.off('message', handler); };
  }, [limit]);

  return messages;
}

// Get messages for a specific agent
export function useAgentChat(agentCode: AgentCode) {
  const [messages, setMessages] = useState<AgentMessage[]>(() => 
    agentBus.getMessagesForAgent(agentCode, 50)
  );

  useEffect(() => {
    setMessages(agentBus.getMessagesForAgent(agentCode, 50));
    
    const handler = (msg: AgentMessage) => {
      if (msg.from === agentCode || msg.to === agentCode || msg.to === '*') {
        setMessages(prev => [...prev.slice(-49), msg]);
      }
    };
    agentBus.on('message', handler);
    return () => { agentBus.off('message', handler); };
  }, [agentCode]);

  const sendMessage = useCallback((text: string, dealId?: string) => {
    return agentBus.send({
      from: 'ORCHESTRATOR',
      to: agentCode,
      type: 'user_query',
      topic: 'chat',
      payload: { text, fromUser: true },
      priority: 'normal',
      dealId,
    });
  }, [agentCode]);

  return { messages, sendMessage };
}

// Get all agent statuses
export function useAgentStatuses() {
  const [statuses, setStatuses] = useState<AgentStatus[]>(() => agentBus.getAllStatuses());

  useEffect(() => {
    const handler = () => setStatuses(agentBus.getAllStatuses());
    agentBus.on('status:update', handler);
    const interval = setInterval(handler, 5000);
    return () => {
      agentBus.off('status:update', handler);
      clearInterval(interval);
    };
  }, []);

  return statuses;
}

// Get status for single agent
export function useAgentStatus(code: AgentCode) {
  const [status, setStatus] = useState<AgentStatus | undefined>(() => agentBus.getStatus(code));

  useEffect(() => {
    const handler = (update: { code: AgentCode; status: AgentStatus }) => {
      if (update.code === code) setStatus(update.status);
    };
    agentBus.on('status:update', handler);
    return () => { agentBus.off('status:update', handler); };
  }, [code]);

  return status;
}

// Get pending notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<UserNotification[]>(() => 
    agentBus.getPendingNotifications()
  );

  useEffect(() => {
    const handler = () => setNotifications(agentBus.getPendingNotifications());
    agentBus.on('notification:queued', handler);
    return () => { agentBus.off('notification:queued', handler); };
  }, []);

  const markRead = useCallback((id: string) => {
    agentBus.markNotificationRead(id);
    setNotifications(agentBus.getPendingNotifications());
  }, []);

  return { notifications, markRead };
}

// Combined agent info (definition + status)
export function useAgents() {
  const statuses = useAgentStatuses();
  
  return AGENT_DEFINITIONS.map(def => ({
    ...def,
    status: statuses.find(s => s.code === def.code) || {
      code: def.code,
      status: 'offline' as const,
      lastActive: 0,
      messageCount: 0,
      errorCount: 0,
    },
  })).sort((a, b) => a.priority - b.priority);
}
