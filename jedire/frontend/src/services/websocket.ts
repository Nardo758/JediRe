import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(sessionId?: string) {
    if (this.socket?.connected) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    
    this.socket = io(WS_URL, {
      auth: { token },
      query: { sessionId },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Handle incoming messages
    this.socket.onAny((event, data) => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach((callback) => callback(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return cleanup function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit:', event);
    }
  }

  // Specific event emitters
  joinSession(sessionId: string) {
    this.emit('join_session', { sessionId });
  }

  leaveSession(sessionId: string) {
    this.emit('leave_session', { sessionId });
  }

  updateCursor(lat: number, lng: number) {
    this.emit('cursor_move', { lat, lng });
  }

  pinProperty(propertyId: string) {
    this.emit('pin_property', { propertyId });
  }

  addAnnotation(propertyId: string, text: string, type: string) {
    this.emit('add_annotation', { propertyId, text, type });
  }

  selectProperty(propertyId: string) {
    this.emit('select_property', { propertyId });
  }
}

export const wsService = new WebSocketService();
