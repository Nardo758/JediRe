/**
 * Notification WebSocket Handler
 * Real-time notifications and updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../../../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

export function notificationHandler(
  io: SocketIOServer,
  socket: AuthenticatedSocket
): void {
  /**
   * Subscribe to property updates
   */
  socket.on('subscribe:property', (data: { propertyId: string }) => {
    socket.join(`property:${data.propertyId}`);
    logger.debug('Subscribed to property:', {
      userId: socket.userId,
      propertyId: data.propertyId,
    });
  });

  /**
   * Unsubscribe from property updates
   */
  socket.on('unsubscribe:property', (data: { propertyId: string }) => {
    socket.leave(`property:${data.propertyId}`);
    logger.debug('Unsubscribed from property:', {
      userId: socket.userId,
      propertyId: data.propertyId,
    });
  });

  /**
   * Subscribe to agent task updates
   */
  socket.on('subscribe:task', (data: { taskId: string }) => {
    socket.join(`task:${data.taskId}`);
    logger.debug('Subscribed to task:', {
      userId: socket.userId,
      taskId: data.taskId,
    });
  });

  /**
   * Unsubscribe from agent task updates
   */
  socket.on('unsubscribe:task', (data: { taskId: string }) => {
    socket.leave(`task:${data.taskId}`);
    logger.debug('Unsubscribed from task:', {
      userId: socket.userId,
      taskId: data.taskId,
    });
  });
}

/**
 * Helper functions to emit notifications from anywhere in the app
 */

export function notifyPropertyUpdate(
  io: SocketIOServer,
  propertyId: string,
  data: any
): void {
  io.to(`property:${propertyId}`).emit('property:updated', {
    propertyId,
    ...data,
    timestamp: Date.now(),
  });
}

export function notifyTaskUpdate(
  io: SocketIOServer,
  taskId: string,
  data: any
): void {
  io.to(`task:${taskId}`).emit('task:updated', {
    taskId,
    ...data,
    timestamp: Date.now(),
  });
}

export function notifyUser(
  io: SocketIOServer,
  userId: string,
  notification: any
): void {
  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: Date.now(),
  });
}
