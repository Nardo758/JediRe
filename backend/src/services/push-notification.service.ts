/**
 * Push Notification Service
 * 
 * Handles sending push notifications to mobile devices via Firebase Cloud Messaging.
 * Supports iOS, Android, and Web push.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';

// ============================================================================
// Types
// ============================================================================

export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  badge?: number;
  sound?: string;
  imageUrl?: string;
  clickAction?: string;
}

interface FCMMessage {
  token: string;
  notification: {
    title: string;
    body: string;
    image?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: 'high' | 'normal';
    notification?: {
      sound?: string;
      clickAction?: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        sound?: string;
        badge?: number;
        'mutable-content'?: number;
      };
    };
  };
  webpush?: {
    notification?: {
      icon?: string;
    };
    fcmOptions?: {
      link?: string;
    };
  };
}

interface FCMResponse {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Firebase Configuration
// ============================================================================

let firebaseAdmin: any = null;

async function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;

  // Check for Firebase credentials
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!serviceAccountJson && !projectId) {
    logger.warn('Firebase not configured - push notifications disabled');
    return null;
  }

  try {
    // Dynamic import to avoid issues if firebase-admin not installed
    const admin = await import('firebase-admin');

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (projectId) {
      // Use default credentials (for Replit/GCP environments)
      admin.initializeApp({
        projectId,
      });
    }

    firebaseAdmin = admin;
    logger.info('Firebase Admin SDK initialized');
    return firebaseAdmin;
  } catch (error: any) {
    logger.error('Failed to initialize Firebase:', error.message);
    return null;
  }
}

// ============================================================================
// Token Management
// ============================================================================

export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  deviceName?: string
): Promise<boolean> {
  try {
    // Upsert token
    await query(
      `INSERT INTO user_push_tokens (user_id, token, platform, device_name, last_used_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (token) 
       DO UPDATE SET 
         user_id = $1,
         platform = $3,
         device_name = COALESCE($4, user_push_tokens.device_name),
         last_used_at = NOW(),
         is_active = true`,
      [userId, token, platform, deviceName]
    );

    logger.info('Push token registered:', { userId, platform });
    return true;
  } catch (error) {
    logger.error('Failed to register push token:', error);
    return false;
  }
}

export async function unregisterPushToken(token: string): Promise<boolean> {
  try {
    await query(
      `UPDATE user_push_tokens SET is_active = false WHERE token = $1`,
      [token]
    );
    return true;
  } catch (error) {
    logger.error('Failed to unregister push token:', error);
    return false;
  }
}

async function getUserTokens(userId: string): Promise<Array<{ token: string; platform: string }>> {
  try {
    const result = await query(
      `SELECT token, platform FROM user_push_tokens 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get user tokens:', error);
    return [];
  }
}

// ============================================================================
// Send Notifications
// ============================================================================

export async function sendPushNotification(payload: PushNotificationPayload): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const admin = await getFirebaseAdmin();
  
  if (!admin) {
    // Firebase not configured - log notification but don't fail
    logger.info('Push notification queued (Firebase not configured):', {
      userId: payload.userId,
      title: payload.title,
    });
    
    // Still store in notifications table
    await storeNotification(payload);
    
    return { sent: 0, failed: 0, errors: ['Firebase not configured'] };
  }

  const tokens = await getUserTokens(payload.userId);
  
  if (tokens.length === 0) {
    logger.info('No push tokens for user:', payload.userId);
    await storeNotification(payload);
    return { sent: 0, failed: 0, errors: ['No registered devices'] };
  }

  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Send to all user devices
  for (const { token, platform } of tokens) {
    try {
      const message = buildFCMMessage(token, payload, platform);
      const response = await admin.messaging().send(message);
      
      results.sent++;
      logger.debug('Push sent:', { token: token.slice(0, 20) + '...', messageId: response });
      
    } catch (error: any) {
      results.failed++;
      results.errors.push(error.message);
      
      // Handle invalid tokens
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await unregisterPushToken(token);
        logger.info('Deactivated invalid push token');
      }
    }
  }

  // Store notification record
  await storeNotification(payload, results.sent > 0);

  logger.info('Push notification batch complete:', {
    userId: payload.userId,
    sent: results.sent,
    failed: results.failed,
  });

  return results;
}

function buildFCMMessage(
  token: string,
  payload: PushNotificationPayload,
  platform: string
): FCMMessage {
  const message: FCMMessage = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
  };

  if (payload.imageUrl) {
    message.notification.image = payload.imageUrl;
  }

  // Android-specific options
  message.android = {
    priority: payload.priority || 'high',
    notification: {
      sound: payload.sound || 'default',
      clickAction: payload.clickAction,
    },
  };

  // iOS-specific options
  message.apns = {
    payload: {
      aps: {
        sound: payload.sound || 'default',
        badge: payload.badge,
        'mutable-content': 1,
      },
    },
  };

  // Web-specific options
  if (platform === 'web') {
    message.webpush = {
      notification: {
        icon: '/icon-192.png',
      },
      fcmOptions: {
        link: payload.clickAction,
      },
    };
  }

  return message;
}

async function storeNotification(
  payload: PushNotificationPayload,
  pushSent = false
): Promise<void> {
  try {
    await query(
      `INSERT INTO user_notifications (
        user_id, title, body, priority, agent_source, action_url,
        push_sent_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        payload.userId,
        payload.title,
        payload.body,
        payload.priority || 'normal',
        payload.data?.agentSource || 'ORCHESTRATOR',
        payload.clickAction,
        pushSent ? new Date() : null,
      ]
    );
  } catch (error) {
    logger.warn('Failed to store notification:', error);
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

export async function sendBatchNotifications(
  notifications: PushNotificationPayload[]
): Promise<{ total: number; sent: number; failed: number }> {
  const results = { total: notifications.length, sent: 0, failed: 0 };

  for (const notification of notifications) {
    const result = await sendPushNotification(notification);
    results.sent += result.sent;
    results.failed += result.failed;
  }

  return results;
}

// ============================================================================
// Topic Subscriptions (for broadcast notifications)
// ============================================================================

export async function subscribeToTopic(
  token: string,
  topic: string
): Promise<boolean> {
  const admin = await getFirebaseAdmin();
  if (!admin) return false;

  try {
    await admin.messaging().subscribeToTopic([token], topic);
    return true;
  } catch (error) {
    logger.error('Failed to subscribe to topic:', error);
    return false;
  }
}

export async function sendTopicNotification(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const admin = await getFirebaseAdmin();
  if (!admin) return false;

  try {
    await admin.messaging().send({
      topic,
      notification: { title, body },
      data,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send topic notification:', error);
    return false;
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function isPushServiceAvailable(): Promise<boolean> {
  const admin = await getFirebaseAdmin();
  return admin !== null;
}
