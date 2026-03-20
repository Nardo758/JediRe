/**
 * Asset Map Intelligence WebSocket Client
 * Manages real-time updates for notes, replies, and news events
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export interface AssetUpdateEvent {
  type: 'note:created' | 'note:updated' | 'note:deleted' | 'note:reply' | 
        'reply:updated' | 'reply:deleted' | 'news:linked' | 'news:dismissed';
  data: any;
  timestamp: string;
}

export type AssetUpdateHandler = (event: AssetUpdateEvent) => void;

class AssetMapWebSocketClient {
  private socket: Socket | null = null;
  private subscribedAssets: Set<string> = new Set();
  private handlers: Map<string, Set<AssetUpdateHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        setTimeout(() => resolve(), 100);
        return;
      }

      this.isConnecting = true;

      try {
        this.socket = io(WS_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: 30000,
          reconnectionAttempts: this.maxReconnectAttempts,
        });

        this.setupEventListeners();

        this.socket.on('connect', () => {
          console.log('✅ Asset Map WebSocket connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          
          // Resubscribe to all assets
          this.resubscribeAll();
          
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Asset Map WebSocket connection error:', error);
          this.reconnectAttempts++;
          this.isConnecting = false;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Max reconnection attempts reached'));
          }
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Setup event listeners for WebSocket events
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      console.log('⚠️ Asset Map WebSocket disconnected:', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Asset Map WebSocket reconnected after ${attemptNumber} attempts`);
    });

    // Asset subscription confirmations
    this.socket.on('asset:subscribed', (data: { assetId: string; timestamp: number }) => {
      console.log(`✓ Subscribed to asset: ${data.assetId}`);
    });

    this.socket.on('asset:unsubscribed', (data: { assetId: string; timestamp: number }) => {
      console.log(`✓ Unsubscribed from asset: ${data.assetId}`);
    });

    // Note events
    this.socket.on('note:created', (data) => {
      this.emitToHandlers(data.assetId, { type: 'note:created', data, timestamp: data.timestamp });
    });

    this.socket.on('note:updated', (data) => {
      this.emitToHandlers(data.assetId, { type: 'note:updated', data, timestamp: data.timestamp });
    });

    this.socket.on('note:deleted', (data) => {
      this.emitToHandlers(data.assetId, { type: 'note:deleted', data, timestamp: data.timestamp });
    });

    this.socket.on('note:reply', (data) => {
      this.emitToHandlers(data.assetId, { type: 'note:reply', data, timestamp: data.timestamp });
    });

    // Reply events
    this.socket.on('reply:updated', (data) => {
      this.emitToHandlers(data.assetId, { type: 'reply:updated', data, timestamp: data.timestamp });
    });

    this.socket.on('reply:deleted', (data) => {
      this.emitToHandlers(data.assetId, { type: 'reply:deleted', data, timestamp: data.timestamp });
    });

    // News events
    this.socket.on('news:linked', (data) => {
      this.emitToHandlers(data.link.assetId, { type: 'news:linked', data, timestamp: data.timestamp });
    });

    this.socket.on('news:dismissed', (data) => {
      this.emitToHandlers(data.assetId, { type: 'news:dismissed', data, timestamp: data.timestamp });
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Asset Map WebSocket error:', error);
    });
  }

  /**
   * Emit event to all registered handlers for an asset
   */
  private emitToHandlers(assetId: string, event: AssetUpdateEvent): void {
    const handlers = this.handlers.get(assetId);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in asset update handler:', error);
        }
      });
    }
  }

  /**
   * Subscribe to updates for an asset
   */
  async subscribeToAsset(assetId: string, handler: AssetUpdateHandler): Promise<() => void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('WebSocket not connected');
    }

    // Add handler
    if (!this.handlers.has(assetId)) {
      this.handlers.set(assetId, new Set());
    }
    this.handlers.get(assetId)!.add(handler);

    // Subscribe if this is the first handler for this asset
    if (!this.subscribedAssets.has(assetId)) {
      this.socket.emit('asset:subscribe', { assetId });
      this.subscribedAssets.add(assetId);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribeHandler(assetId, handler);
    };
  }

  /**
   * Unsubscribe a specific handler from an asset
   */
  private unsubscribeHandler(assetId: string, handler: AssetUpdateHandler): void {
    const handlers = this.handlers.get(assetId);
    if (handlers) {
      handlers.delete(handler);

      // If no more handlers, unsubscribe from asset
      if (handlers.size === 0) {
        this.unsubscribeFromAsset(assetId);
      }
    }
  }

  /**
   * Unsubscribe from all updates for an asset
   */
  unsubscribeFromAsset(assetId: string): void {
    if (this.socket && this.subscribedAssets.has(assetId)) {
      this.socket.emit('asset:unsubscribe', { assetId });
      this.subscribedAssets.delete(assetId);
      this.handlers.delete(assetId);
    }
  }

  /**
   * Resubscribe to all assets after reconnection
   */
  private resubscribeAll(): void {
    if (!this.socket) return;

    const assets = Array.from(this.subscribedAssets);
    this.subscribedAssets.clear();

    assets.forEach((assetId) => {
      this.socket!.emit('asset:subscribe', { assetId });
      this.subscribedAssets.add(assetId);
    });

    if (assets.length > 0) {
      console.log(`🔄 Resubscribed to ${assets.length} asset(s)`);
    }
  }

  /**
   * Send heartbeat for an asset
   */
  sendHeartbeat(assetId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('asset:heartbeat', { assetId, timestamp: Date.now() });
    }
  }

  /**
   * Get active connection count for an asset
   */
  getActiveConnections(assetId: string): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(0);
        return;
      }

      this.socket.emit('asset:get_active', { assetId });

      const handler = (data: { assetId: string; count: number }) => {
        if (data.assetId === assetId) {
          this.socket?.off('asset:active_count', handler);
          resolve(data.count);
        }
      };

      this.socket.on('asset:active_count', handler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket?.off('asset:active_count', handler);
        resolve(0);
      }, 5000);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.subscribedAssets.clear();
      this.handlers.clear();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get subscribed assets
   */
  getSubscribedAssets(): string[] {
    return Array.from(this.subscribedAssets);
  }
}

// Singleton instance
export const assetMapWsClient = new AssetMapWebSocketClient();
