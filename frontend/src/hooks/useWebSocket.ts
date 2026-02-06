import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const messageQueue = useRef<Array<{ event: string; data: any }>>([]);
  
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
      
      // Process queued messages
      if (messageQueue.current.length > 0) {
        console.log(`Sending ${messageQueue.current.length} queued messages`);
        messageQueue.current.forEach(({ event, data }) => {
          newSocket.emit(event, data);
        });
        messageQueue.current = [];
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnected(false);
      reconnectAttempts.current++;
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const emit = (event: string, data: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.log('Queuing message:', event);
      messageQueue.current.push({ event, data });
    }
  };

  return { socket, connected, emit };
}
