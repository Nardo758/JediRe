/**
 * NotificationCenter Component
 * Displays user notifications with filtering and actions
 */

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ============================================================================
// TYPES
// ============================================================================

export enum NotificationType {
  // Decision points
  DECISION_TRIAGE_COMPLETE = 'decision_triage_complete',
  DECISION_INTELLIGENCE_COMPLETE = 'decision_intelligence_complete',
  DECISION_UNDERWRITING_COMPLETE = 'decision_underwriting_complete',
  DECISION_DEAL_STALLED = 'decision_deal_stalled',
  
  // Milestones
  MILESTONE_DEAL_CREATED = 'milestone_deal_created',
  MILESTONE_STAGE_CHANGED = 'milestone_stage_changed',
  MILESTONE_ANALYSIS_COMPLETE = 'milestone_analysis_complete',
  MILESTONE_PROPERTY_LINKED = 'milestone_property_linked',
  
  // Alerts
  ALERT_RISK_DETECTED = 'alert_risk_detected',
  ALERT_DEAL_OVERDUE = 'alert_deal_overdue',
  ALERT_BUDGET_EXCEEDED = 'alert_budget_exceeded',
  ALERT_TIMELINE_DELAYED = 'alert_timeline_delayed',
  
  // Info
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

export interface Notification {
  id: string;
  userId: string;
  dealId?: string;
  dealName?: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface NotificationCounts {
  totalUnread: number;
  decisionsUnread: number;
  alertsUnread: number;
  milestonesUnread: number;
  infoUnread: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    totalUnread: 0,
    decisionsUnread: 0,
    alertsUnread: 0,
    milestonesUnread: 0,
    infoUnread: 0,
  });
  
  const [filter, setFilter] = useState<'all' | 'unread' | 'decisions' | 'alerts'>('all');
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchCounts();
    }
  }, [isOpen, filter]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('unreadOnly', 'true');
      if (filter === 'decisions') params.append('type', 'decision');
      if (filter === 'alerts') params.append('type', 'alert');

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const response = await fetch('/api/notifications/counts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
        fetchCounts();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        fetchCounts();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.actionUrl) {
      setIsOpen(false);
      navigate(notification.actionUrl);
    }
  };

  const getNotificationIcon = (type: NotificationType): string => {
    if (type.startsWith('decision_')) return '🎯';
    if (type.startsWith('milestone_')) return '✅';
    if (type.startsWith('alert_')) return '⚠️';
    return '📢';
  };

  const getPriorityColor = (priority: NotificationPriority): string => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 'bg-red-100 border-red-300';
      case NotificationPriority.HIGH:
        return 'bg-orange-100 border-orange-300';
      case NotificationPriority.MEDIUM:
        return 'bg-blue-100 border-blue-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {counts.totalUnread > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {counts.totalUnread > 99 ? '99+' : counts.totalUnread}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <div className="flex items-center gap-2">
                {counts.totalUnread > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50">
              <Filter className="w-4 h-4 text-gray-500" />
              {['all', 'unread', 'decisions', 'alerts'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'unread' && counts.totalUnread > 0 && ` (${counts.totalUnread})`}
                  {f === 'decisions' && counts.decisionsUnread > 0 && ` (${counts.decisionsUnread})`}
                  {f === 'alerts' && counts.alertsUnread > 0 && ` (${counts.alertsUnread})`}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                      } ${getPriorityColor(notification.priority)} border-l-4`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                            {notification.message}
                          </p>

                          {notification.dealName && (
                            <p className="text-xs text-gray-500 mb-2">
                              Deal: {notification.dealName}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                            
                            {notification.actionLabel && (
                              <span className="text-xs font-medium text-blue-600">
                                {notification.actionLabel} →
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="w-full text-sm text-center text-blue-600 hover:text-blue-800 font-medium"
              >
                View All Notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
