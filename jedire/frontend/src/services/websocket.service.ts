import { io, Socket } from 'socket.io-client';
import { useAgentStore } from '../stores/agentStore';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.socket?.disconnect();
      }
    });

    // Agent events
    this.socket.on('agent:start', (data: { agentId: string; message?: string }) => {
      useAgentStore.getState().startAgent(data.agentId, data.message);
    });

    this.socket.on('agent:progress', (data: { agentId: string; progress: number; message?: string }) => {
      useAgentStore.getState().updateProgress(data.agentId, data.progress, data.message);
    });

    this.socket.on('agent:complete', (data: { agentId: string; message?: string }) => {
      useAgentStore.getState().completeAgent(data.agentId, data.message);
    });

    this.socket.on('agent:error', (data: { agentId: string; message: string }) => {
      useAgentStore.getState().errorAgent(data.agentId, data.message);
    });

    // Deal events
    this.socket.on('deal:created', (data: any) => {
      console.log('Deal created:', data);
      // Could update dealStore here
    });

    this.socket.on('deal:updated', (data: any) => {
      console.log('Deal updated:', data);
    });

    // Property events
    this.socket.on('property:found', (data: any) => {
      console.log('Property found:', data);
      // Could update propertyStore here
    });

    // Notification events
    this.socket.on('notification', (data: { type: string; message: string; priority?: string }) => {
      console.log('Notification:', data);
      // Could show toast notification
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();

// Hook for using WebSocket in React components
export function useWebSocket() {
  return {
    emit: websocketService.emit.bind(websocketService),
    on: websocketService.on.bind(websocketService),
    off: websocketService.off.bind(websocketService),
    isConnected: websocketService.isConnected(),
  };
}
