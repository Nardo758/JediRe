/**
 * Collaboration WebSocket Handler
 * Real-time collaboration features
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

interface SessionJoinData {
  sessionId: string;
}

interface CursorMoveData {
  sessionId: string;
  lat: number;
  lng: number;
}

interface PinCreateData {
  sessionId: string;
  propertyId: string;
  color?: string;
  icon?: string;
  note?: string;
}

interface CommentCreateData {
  propertyId: string;
  sessionId?: string;
  content: string;
  mentionedUsers?: string[];
}

export function collaborationHandler(
  io: SocketIOServer,
  socket: AuthenticatedSocket
): void {
  /**
   * Join a collaboration session
   */
  socket.on('session:join', async (data: SessionJoinData) => {
    try {
      const { sessionId } = data;

      // Verify session exists and user has access
      const sessionResult = await query(
        'SELECT * FROM collaboration_sessions WHERE id = $1 AND is_active = TRUE',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Join session room
      socket.join(`session:${sessionId}`);

      // Add or update participant
      await query(
        `INSERT INTO session_participants (session_id, user_id, last_seen_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (session_id, user_id)
         DO UPDATE SET last_seen_at = NOW()`,
        [sessionId, socket.userId]
      );

      // Get current participants
      const participantsResult = await query(
        `SELECT sp.*, u.email, u.first_name, u.last_name, u.avatar_url
         FROM session_participants sp
         JOIN users u ON sp.user_id = u.id
         WHERE sp.session_id = $1 AND sp.last_seen_at > NOW() - INTERVAL '5 minutes'`,
        [sessionId]
      );

      // Notify session about new participant
      io.to(`session:${sessionId}`).emit('session:user_joined', {
        sessionId,
        userId: socket.userId,
        email: socket.email,
        participants: participantsResult.rows,
      });

      logger.info('User joined session:', { userId: socket.userId, sessionId });
    } catch (error) {
      logger.error('Error joining session:', error);
      socket.emit('error', { message: 'Failed to join session' });
    }
  });

  /**
   * Leave a collaboration session
   */
  socket.on('session:leave', async (data: SessionJoinData) => {
    try {
      const { sessionId } = data;

      socket.leave(`session:${sessionId}`);

      // Notify session about participant leaving
      io.to(`session:${sessionId}`).emit('session:user_left', {
        sessionId,
        userId: socket.userId,
      });

      logger.info('User left session:', { userId: socket.userId, sessionId });
    } catch (error) {
      logger.error('Error leaving session:', error);
    }
  });

  /**
   * Broadcast cursor position
   */
  socket.on('cursor:move', (data: CursorMoveData) => {
    const { sessionId, lat, lng } = data;

    socket.to(`session:${sessionId}`).emit('cursor:update', {
      userId: socket.userId,
      email: socket.email,
      lat,
      lng,
      timestamp: Date.now(),
    });
  });

  /**
   * Create a pin
   */
  socket.on('pin:create', async (data: PinCreateData) => {
    try {
      const { sessionId, propertyId, color, icon, note } = data;

      const result = await query(
        `INSERT INTO property_pins (session_id, property_id, user_id, color, icon, note)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sessionId, propertyId, socket.userId, color, icon, note]
      );

      const pin = result.rows[0];

      // Broadcast to session
      io.to(`session:${sessionId}`).emit('pin:created', {
        pin,
        userId: socket.userId,
        email: socket.email,
      });

      logger.info('Pin created:', { pinId: pin.id, sessionId });
    } catch (error) {
      logger.error('Error creating pin:', error);
      socket.emit('error', { message: 'Failed to create pin' });
    }
  });

  /**
   * Delete a pin
   */
  socket.on('pin:delete', async (data: { sessionId: string; pinId: string }) => {
    try {
      const { sessionId, pinId } = data;

      await query('DELETE FROM property_pins WHERE id = $1 AND user_id = $2', [
        pinId,
        socket.userId,
      ]);

      // Broadcast to session
      io.to(`session:${sessionId}`).emit('pin:deleted', {
        pinId,
        userId: socket.userId,
      });

      logger.info('Pin deleted:', { pinId, sessionId });
    } catch (error) {
      logger.error('Error deleting pin:', error);
      socket.emit('error', { message: 'Failed to delete pin' });
    }
  });

  /**
   * Create a comment
   */
  socket.on('comment:create', async (data: CommentCreateData) => {
    try {
      const { propertyId, sessionId, content, mentionedUsers } = data;

      const result = await query(
        `INSERT INTO property_comments (property_id, session_id, user_id, content, mentioned_users)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [propertyId, sessionId, socket.userId, content, mentionedUsers || []]
      );

      const comment = result.rows[0];

      // Broadcast to session if applicable
      if (sessionId) {
        io.to(`session:${sessionId}`).emit('comment:created', {
          comment,
          userId: socket.userId,
          email: socket.email,
        });
      }

      // Notify mentioned users
      if (mentionedUsers && mentionedUsers.length > 0) {
        mentionedUsers.forEach((userId) => {
          io.to(`user:${userId}`).emit('notification', {
            type: 'mention',
            message: `${socket.email} mentioned you in a comment`,
            propertyId,
            commentId: comment.id,
          });
        });
      }

      logger.info('Comment created:', { commentId: comment.id, propertyId });
    } catch (error) {
      logger.error('Error creating comment:', error);
      socket.emit('error', { message: 'Failed to create comment' });
    }
  });

  /**
   * Update typing status
   */
  socket.on('typing:start', (data: { sessionId: string; propertyId: string }) => {
    socket.to(`session:${data.sessionId}`).emit('typing:update', {
      userId: socket.userId,
      email: socket.email,
      propertyId: data.propertyId,
      isTyping: true,
    });
  });

  socket.on('typing:stop', (data: { sessionId: string; propertyId: string }) => {
    socket.to(`session:${data.sessionId}`).emit('typing:update', {
      userId: socket.userId,
      email: socket.email,
      propertyId: data.propertyId,
      isTyping: false,
    });
  });
}
