/**
 * WebSocket Service for Asset Map Intelligence
 * Manages real-time sync for notes, replies, and news events
 */

import { Server as SocketIOServer } from 'socket.io';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import {
  AssetNote,
  NoteReply,
  AssetNewsLink,
  NotePermissionLevel,
} from '../types/assetMapIntelligence.types';

interface BroadcastOptions {
  excludeUserId?: string;
  onlyUserIds?: string[];
}

export class WebSocketService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Get room name for an asset
   */
  private getAssetRoom(assetId: string): string {
    return `asset:${assetId}`;
  }

  /**
   * Check if user has permission to view asset notes
   */
  private async checkUserPermission(
    assetId: string,
    userId: string
  ): Promise<{ hasPermission: boolean; level: NotePermissionLevel | null }> {
    try {
      // Check if user is deal creator (implicit admin)
      const dealCreatorResult = await query(
        `SELECT creator_id FROM deals WHERE id = $1`,
        [assetId]
      );

      if (dealCreatorResult.rows.length > 0) {
        const creatorId = dealCreatorResult.rows[0].creator_id;
        if (creatorId === userId) {
          return { hasPermission: true, level: 'admin' };
        }
      }

      // Check explicit permissions
      const permissionResult = await query(
        `SELECT permission FROM asset_note_permissions 
         WHERE asset_id = $1 AND user_id = $2`,
        [assetId, userId]
      );

      if (permissionResult.rows.length > 0) {
        return {
          hasPermission: true,
          level: permissionResult.rows[0].permission as NotePermissionLevel,
        };
      }

      return { hasPermission: false, level: null };
    } catch (error) {
      logger.error('Error checking user permission:', error);
      return { hasPermission: false, level: null };
    }
  }

  /**
   * Get all users with permission to view an asset
   */
  private async getAssetViewers(assetId: string): Promise<string[]> {
    try {
      // Get deal creator
      const creatorResult = await query(
        `SELECT creator_id FROM deals WHERE id = $1`,
        [assetId]
      );

      const userIds = new Set<string>();

      if (creatorResult.rows.length > 0) {
        userIds.add(creatorResult.rows[0].creator_id);
      }

      // Get users with explicit permissions
      const permissionsResult = await query(
        `SELECT user_id FROM asset_note_permissions WHERE asset_id = $1`,
        [assetId]
      );

      permissionsResult.rows.forEach((row) => {
        userIds.add(row.user_id);
      });

      return Array.from(userIds);
    } catch (error) {
      logger.error('Error getting asset viewers:', error);
      return [];
    }
  }

  /**
   * Broadcast event to asset room with permission filtering
   */
  private async broadcastToAsset(
    assetId: string,
    event: string,
    data: any,
    options: BroadcastOptions = {}
  ): Promise<void> {
    try {
      const roomName = this.getAssetRoom(assetId);
      const room = this.io.sockets.adapter.rooms.get(roomName);

      if (!room) {
        logger.debug(`No active connections for asset ${assetId}`);
        return;
      }

      // Get authorized viewers
      const authorizedUserIds = await this.getAssetViewers(assetId);

      // Broadcast to each socket in the room
      for (const socketId of room) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) continue;

        const userId = (socket as any).userId;

        // Skip if no userId
        if (!userId) continue;

        // Skip excluded user
        if (options.excludeUserId && userId === options.excludeUserId) {
          continue;
        }

        // Only send to specific users if specified
        if (options.onlyUserIds && !options.onlyUserIds.includes(userId)) {
          continue;
        }

        // Check if user has permission
        if (!authorizedUserIds.includes(userId)) {
          continue;
        }

        socket.emit(event, data);
      }

      logger.debug(`Broadcasted ${event} to asset ${assetId}`);
    } catch (error) {
      logger.error('Error broadcasting to asset:', error);
    }
  }

  /**
   * Subscribe user to asset updates
   */
  async subscribeToAsset(socketId: string, assetId: string, userId: string): Promise<boolean> {
    try {
      // Check permission
      const { hasPermission } = await this.checkUserPermission(assetId, userId);

      if (!hasPermission) {
        logger.warn(`User ${userId} denied access to asset ${assetId}`);
        return false;
      }

      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) {
        logger.warn(`Socket ${socketId} not found`);
        return false;
      }

      const roomName = this.getAssetRoom(assetId);
      socket.join(roomName);

      logger.info(`User ${userId} subscribed to asset ${assetId}`);
      return true;
    } catch (error) {
      logger.error('Error subscribing to asset:', error);
      return false;
    }
  }

  /**
   * Unsubscribe user from asset updates
   */
  unsubscribeFromAsset(socketId: string, assetId: string): void {
    try {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) {
        return;
      }

      const roomName = this.getAssetRoom(assetId);
      socket.leave(roomName);

      logger.info(`Socket ${socketId} unsubscribed from asset ${assetId}`);
    } catch (error) {
      logger.error('Error unsubscribing from asset:', error);
    }
  }

  /**
   * Broadcast note created event
   */
  async broadcastNoteCreated(note: AssetNote, author: any): Promise<void> {
    // Don't broadcast private notes
    if (note.isPrivate) {
      logger.debug(`Skipping broadcast for private note ${note.id}`);
      return;
    }

    await this.broadcastToAsset(note.assetId, 'note:created', {
      note,
      author: {
        id: author.id,
        name: author.name || `${author.first_name} ${author.last_name}`,
        email: author.email,
        avatar: author.avatar_url,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast note updated event
   */
  async broadcastNoteUpdated(
    note: AssetNote,
    changes: Partial<AssetNote>,
    author: any
  ): Promise<void> {
    // Don't broadcast private notes
    if (note.isPrivate) {
      return;
    }

    await this.broadcastToAsset(note.assetId, 'note:updated', {
      noteId: note.id,
      assetId: note.assetId,
      changes,
      author: {
        id: author.id,
        name: author.name || `${author.first_name} ${author.last_name}`,
        email: author.email,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast note deleted event
   */
  async broadcastNoteDeleted(assetId: string, noteId: string, userId: string): Promise<void> {
    await this.broadcastToAsset(assetId, 'note:deleted', {
      noteId,
      assetId,
      deletedBy: userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast reply created event
   */
  async broadcastReplyCreated(
    assetId: string,
    noteId: string,
    reply: NoteReply,
    author: any
  ): Promise<void> {
    await this.broadcastToAsset(assetId, 'note:reply', {
      noteId,
      assetId,
      reply,
      author: {
        id: author.id,
        name: author.name || `${author.first_name} ${author.last_name}`,
        email: author.email,
        avatar: author.avatar_url,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast reply updated event
   */
  async broadcastReplyUpdated(
    assetId: string,
    noteId: string,
    replyId: string,
    content: string
  ): Promise<void> {
    await this.broadcastToAsset(assetId, 'reply:updated', {
      noteId,
      replyId,
      assetId,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast reply deleted event
   */
  async broadcastReplyDeleted(assetId: string, noteId: string, replyId: string): Promise<void> {
    await this.broadcastToAsset(assetId, 'reply:deleted', {
      noteId,
      replyId,
      assetId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast news linked event
   */
  async broadcastNewsLinked(link: AssetNewsLink, newsEvent: any): Promise<void> {
    // Don't broadcast dismissed links
    if (link.linkType === 'dismissed') {
      return;
    }

    await this.broadcastToAsset(link.assetId, 'news:linked', {
      link,
      newsEvent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast news dismissed event
   */
  async broadcastNewsDismissed(assetId: string, newsEventId: string, userId: string): Promise<void> {
    await this.broadcastToAsset(assetId, 'news:dismissed', {
      assetId,
      newsEventId,
      dismissedBy: userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId: string, notification: any): void {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  /**
   * Get active connections for an asset
   */
  getActiveConnections(assetId: string): number {
    const roomName = this.getAssetRoom(assetId);
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Get all active asset rooms
   */
  getActiveAssets(): string[] {
    const assets: string[] = [];
    this.io.sockets.adapter.rooms.forEach((_, roomName) => {
      if (roomName.startsWith('asset:')) {
        assets.push(roomName.replace('asset:', ''));
      }
    });
    return assets;
  }
}
