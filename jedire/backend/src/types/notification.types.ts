/**
 * Notification Type Definitions
 * Types and enums for the notification/decision point system
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum NotificationType {
  // Decision points (require user action)
  DECISION_TRIAGE_COMPLETE = 'decision_triage_complete',
  DECISION_INTELLIGENCE_COMPLETE = 'decision_intelligence_complete',
  DECISION_UNDERWRITING_COMPLETE = 'decision_underwriting_complete',
  DECISION_DEAL_STALLED = 'decision_deal_stalled',
  
  // Milestones (informational)
  MILESTONE_DEAL_CREATED = 'milestone_deal_created',
  MILESTONE_STAGE_CHANGED = 'milestone_stage_changed',
  MILESTONE_ANALYSIS_COMPLETE = 'milestone_analysis_complete',
  MILESTONE_PROPERTY_LINKED = 'milestone_property_linked',
  
  // Alerts (warnings/issues)
  ALERT_RISK_DETECTED = 'alert_risk_detected',
  ALERT_DEAL_OVERDUE = 'alert_deal_overdue',
  ALERT_BUDGET_EXCEEDED = 'alert_budget_exceeded',
  ALERT_TIMELINE_DELAYED = 'alert_timeline_delayed',
  
  // System notifications
  INFO_COLLABORATOR_ADDED = 'info_collaborator_added',
  INFO_COMMENT_MENTION = 'info_comment_mention',
  INFO_TASK_ASSIGNED = 'info_task_assigned',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationDeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  dealId?: string;
  
  // Content
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  
  // Metadata
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
  
  // State
  isRead: boolean;
  readAt?: Date;
  
  // Delivery
  inAppStatus: NotificationDeliveryStatus;
  emailStatus: NotificationDeliveryStatus;
  pushStatus: NotificationDeliveryStatus;
  
  // Timestamps
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  
  // Channel preferences
  enableInApp: boolean;
  enableEmail: boolean;
  enablePush: boolean;
  
  // Type preferences
  decisionPointsEnabled: boolean;
  milestonesEnabled: boolean;
  alertsEnabled: boolean;
  infoEnabled: boolean;
  
  // Digest settings
  enableDailyDigest: boolean;
  dailyDigestTime: string;
  
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface DealStateTracking {
  id: string;
  dealId: string;
  currentStage: string;
  stageEnteredAt: Date;
  daysInStage: number;
  lastActivityAt: Date;
  daysSinceActivity: number;
  isStalled: boolean;
  stallThresholdDays: number;
  stallNotifiedAt?: Date;
  updatedAt: Date;
}

export interface DecisionLog {
  id: string;
  dealId: string;
  userId: string;
  notificationId?: string;
  decisionPoint: string;
  decisionMade: string;
  decisionNotes?: string;
  presentedAt: Date;
  decidedAt: Date;
  responseTimeMinutes: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface NotificationCounts {
  totalUnread: number;
  decisionsUnread: number;
  alertsUnread: number;
  milestonesUnread: number;
  infoUnread: number;
}

// ============================================================================
// REQUEST/RESPONSE DTOs
// ============================================================================

export interface CreateNotificationRequest {
  userId: string;
  dealId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export interface MarkNotificationReadRequest {
  notificationId: string;
  userId: string;
}

export interface GetNotificationsQuery {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: NotificationType;
  priority?: NotificationPriority;
}

export interface DecisionRequiredPayload {
  dealId: string;
  dealName: string;
  stage: string;
  message: string;
  context?: Record<string, any>;
}

export interface MilestoneReachedPayload {
  dealId: string;
  dealName: string;
  milestone: string;
  details?: string;
  metrics?: Record<string, any>;
}

export interface StallAlertPayload {
  dealId: string;
  dealName: string;
  daysStalled: number;
  lastActivity: Date;
  currentStage: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type DecisionPoint = 
  | 'triage_complete'
  | 'intelligence_complete'
  | 'underwriting_complete'
  | 'deal_stalled';

export type MilestoneType = 
  | 'deal_created'
  | 'stage_changed'
  | 'analysis_complete'
  | 'property_linked';

export type AlertType = 
  | 'risk_detected'
  | 'deal_overdue'
  | 'budget_exceeded'
  | 'timeline_delayed';
