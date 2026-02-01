/**
 * WebSocket Server Setup
 * Real-time collaboration and updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../../auth/jwt';
import { logger } from '../../utils/logger';
import { collaborationHandler } from './handlers/collaboration.handler';
import { notificationHandler } from './handlers/notification.handler';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

export function setupWebSocket(io: SocketIOServer): void {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      logger.warn('WebSocket connection without token');
      return next(new Error('Authentication required'));
    }

    const payload = verifyAccessToken(token as string);

    if (!payload) {
      logger.warn('WebSocket connection with invalid token');
      return next(new Error('Invalid token'));
    }

    socket.userId = payload.userId;
    socket.email = payload.email;

    logger.info('WebSocket authenticated:', socket.email);
    next();
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket connected:', {
      socketId: socket.id,
      userId: socket.userId,
      email: socket.email,
    });

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to JediRe API',
      userId: socket.userId,
      socketId: socket.id,
    });

    // Setup handlers
    collaborationHandler(io, socket as AuthenticatedSocket);
    notificationHandler(io, socket as AuthenticatedSocket);

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket disconnected:', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
      });

      // Notify session participants
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        timestamp: Date.now(),
      });
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error('WebSocket error:', {
        socketId: socket.id,
        userId: socket.userId,
        error,
      });
    });
  });

  logger.info('WebSocket server initialized');
}
