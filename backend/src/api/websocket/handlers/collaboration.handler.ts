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

interface DealPresenceData {
  dealId: string;
  activeModule?: string;
}

interface DealFieldChangeData {
  dealId: string;
  module: string;
  field: string;
  value: any;
}

interface DealCommentEventData {
  dealId: string;
  comment: {
    id: string;
    content: string;
    module_anchor?: string;
    author_name: string;
    parent_comment_id?: string;
  };
}

interface DealCommentResolvedData {
  dealId: string;
  commentId: string;
  resolvedBy: string;
}

const dealPresence = new Map<string, Map<string, { userId: string; email: string; activeModule?: string; joinedAt: number }>>();

export function collaborationHandler(
  io: SocketIOServer,
  socket: AuthenticatedSocket
): void {
  socket.on('session:join', async (data: SessionJoinData) => {
    try {
      const { sessionId } = data;

      const sessionResult = await query(
        'SELECT * FROM collaboration_sessions WHERE id = $1 AND is_active = TRUE',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      socket.join(`session:${sessionId}`);

      await query(
        `INSERT INTO session_participants (session_id, user_id, last_seen_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (session_id, user_id)
         DO UPDATE SET last_seen_at = NOW()`,
        [sessionId, socket.userId]
      );

      const participantsResult = await query(
        `SELECT sp.*, u.email, u.first_name, u.last_name, u.avatar_url
         FROM session_participants sp
         JOIN users u ON sp.user_id = u.id
         WHERE sp.session_id = $1 AND sp.last_seen_at > NOW() - INTERVAL '5 minutes'`,
        [sessionId]
      );

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

  socket.on('session:leave', async (data: SessionJoinData) => {
    try {
      const { sessionId } = data;

      socket.leave(`session:${sessionId}`);

      io.to(`session:${sessionId}`).emit('session:user_left', {
        sessionId,
        userId: socket.userId,
      });

      logger.info('User left session:', { userId: socket.userId, sessionId });
    } catch (error) {
      logger.error('Error leaving session:', error);
    }
  });

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

  socket.on('pin:delete', async (data: { sessionId: string; pinId: string }) => {
    try {
      const { sessionId, pinId } = data;

      await query('DELETE FROM property_pins WHERE id = $1 AND user_id = $2', [
        pinId,
        socket.userId,
      ]);

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

      if (sessionId) {
        io.to(`session:${sessionId}`).emit('comment:created', {
          comment,
          userId: socket.userId,
          email: socket.email,
        });
      }

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

  socket.on('deal:join', (data: DealPresenceData) => {
    const { dealId, activeModule } = data;
    const room = `deal:${dealId}`;
    socket.join(room);

    if (!dealPresence.has(dealId)) {
      dealPresence.set(dealId, new Map());
    }
    dealPresence.get(dealId)!.set(socket.id, {
      userId: socket.userId!,
      email: socket.email!,
      activeModule,
      joinedAt: Date.now(),
    });

    const participants = Array.from(dealPresence.get(dealId)!.values());
    io.to(room).emit('deal:presence', { dealId, participants });
    logger.info('User joined deal:', { userId: socket.userId, dealId, activeModule });
  });

  socket.on('deal:leave', (data: { dealId: string }) => {
    const { dealId } = data;
    const room = `deal:${dealId}`;
    socket.leave(room);

    if (dealPresence.has(dealId)) {
      dealPresence.get(dealId)!.delete(socket.id);
      if (dealPresence.get(dealId)!.size === 0) {
        dealPresence.delete(dealId);
      } else {
        const participants = Array.from(dealPresence.get(dealId)!.values());
        io.to(room).emit('deal:presence', { dealId, participants });
      }
    }
    logger.info('User left deal:', { userId: socket.userId, dealId });
  });

  socket.on('deal:module_change', (data: DealPresenceData) => {
    const { dealId, activeModule } = data;
    if (dealPresence.has(dealId) && dealPresence.get(dealId)!.has(socket.id)) {
      dealPresence.get(dealId)!.get(socket.id)!.activeModule = activeModule;
      const participants = Array.from(dealPresence.get(dealId)!.values());
      io.to(`deal:${dealId}`).emit('deal:presence', { dealId, participants });
    }
  });

  socket.on('deal:field_change', (data: DealFieldChangeData) => {
    const { dealId, module, field, value } = data;
    socket.to(`deal:${dealId}`).emit('deal:field_updated', {
      dealId,
      module,
      field,
      value,
      userId: socket.userId,
      email: socket.email,
      timestamp: Date.now(),
    });
  });

  socket.on('deal:comment_added', (data: DealCommentEventData) => {
    io.to(`deal:${data.dealId}`).emit('deal:new_comment', {
      dealId: data.dealId,
      comment: data.comment,
      userId: socket.userId,
      email: socket.email,
      timestamp: Date.now(),
    });
  });

  socket.on('deal:comment_resolved', (data: DealCommentResolvedData) => {
    io.to(`deal:${data.dealId}`).emit('deal:comment_resolved', {
      dealId: data.dealId,
      commentId: data.commentId,
      resolvedBy: data.resolvedBy,
      userId: socket.userId,
      email: socket.email,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    for (const [dealId, users] of dealPresence.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        if (users.size === 0) {
          dealPresence.delete(dealId);
        } else {
          const participants = Array.from(users.values());
          io.to(`deal:${dealId}`).emit('deal:presence', { dealId, participants });
        }
      }
    }
  });
}
