/**
 * Asset Map Intelligence WebSocket Handler
 * Handles real-time subscriptions and events for asset notes and news
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { WebSocketService } from '../../../services/websocket.service';
import { logger } from '../../../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

interface SubscribeData {
  assetId: string;
}

interface UnsubscribeData {
  assetId: string;
}

interface HeartbeatData {
  assetId: string;
  timestamp: number;
}

let wsService: WebSocketService;

/**
 * Initialize WebSocket service singleton
 */
export function initializeAssetMapWebSocket(io: SocketIOServer): void {
  wsService = new WebSocketService(io);
}

/**
 * Get WebSocket service instance
 */
export function getWebSocketService(): WebSocketService {
  if (!wsService) {
    throw new Error('WebSocket service not initialized');
  }
  return wsService;
}

/**
 * Asset Map WebSocket Handler
 */
export function assetMapHandler(
  io: SocketIOServer,
  socket: AuthenticatedSocket
): void {
  /**
   * Subscribe to asset updates
   */
  socket.on('asset:subscribe', async (data: SubscribeData) => {
    try {
      const { assetId } = data;

      if (!assetId) {
        socket.emit('error', { message: 'Asset ID is required' });
        return;
      }

      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      const success = await wsService.subscribeToAsset(socket.id, assetId, socket.userId);

      if (success) {
        socket.emit('asset:subscribed', {
          assetId,
          timestamp: Date.now(),
        });

        logger.info('User subscribed to asset:', {
          userId: socket.userId,
          assetId,
          socketId: socket.id,
        });
      } else {
        socket.emit('error', {
          message: 'Permission denied or asset not found',
          assetId,
        });
      }
    } catch (error) {
      logger.error('Error subscribing to asset:', error);
      socket.emit('error', { message: 'Failed to subscribe to asset' });
    }
  });

  /**
   * Unsubscribe from asset updates
   */
  socket.on('asset:unsubscribe', (data: UnsubscribeData) => {
    try {
      const { assetId } = data;

      if (!assetId) {
        return;
      }

      wsService.unsubscribeFromAsset(socket.id, assetId);

      socket.emit('asset:unsubscribed', {
        assetId,
        timestamp: Date.now(),
      });

      logger.info('User unsubscribed from asset:', {
        userId: socket.userId,
        assetId,
        socketId: socket.id,
      });
    } catch (error) {
      logger.error('Error unsubscribing from asset:', error);
    }
  });

  /**
   * Heartbeat to keep subscription alive
   */
  socket.on('asset:heartbeat', (data: HeartbeatData) => {
    socket.emit('asset:heartbeat_ack', {
      assetId: data.assetId,
      timestamp: Date.now(),
    });
  });

  /**
   * Get active connections for an asset
   */
  socket.on('asset:get_active', (data: { assetId: string }) => {
    try {
      const activeCount = wsService.getActiveConnections(data.assetId);
      socket.emit('asset:active_count', {
        assetId: data.assetId,
        count: activeCount,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Error getting active connections:', error);
    }
  });

  /**
   * Handle disconnect - clean up subscriptions
   */
  socket.on('disconnect', () => {
    // Socket.io automatically removes socket from rooms on disconnect
    logger.info('Asset map socket disconnected:', {
      userId: socket.userId,
      socketId: socket.id,
    });
  });
}
