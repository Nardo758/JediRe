/**
 * Alerts Panel Component
 * 
 * Displays active alerts for deals with JEDI Score changes and market events
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import React, { useState, useEffect } from 'react';
import { Bell, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, X, Eye } from 'lucide-react';

interface Alert {
  id: string;
  dealId: string;
  dealName?: string;
  alertType: string;
  severity: 'green' | 'yellow' | 'red';
  title: string;
  message: string;
  suggestedAction?: string;
  jediScoreBefore?: number;
  jediScoreAfter?: number;
  jediScoreChange?: number;
  impactSummary?: string;
  isRead: boolean;
  createdAt: string;
}

interface AlertsPanelProps {
  onAlertClick?: (alertId: string, dealId: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ onAlertClick }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [showUnreadOnly]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const unreadParam = showUnreadOnly ? '?unread_only=true' : '';
      
      const response = await fetch(`/api/v1/jedi/alerts${unreadParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/v1/jedi/alerts/${alertId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, isRead: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleDismiss = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/v1/jedi/alerts/${alertId}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Remove from local state
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.severity === filter);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'green': return 'bg-green-50 border-green-200 text-green-800';
      case 'yellow': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'red': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'green': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'yellow': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'red': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getScoreIcon = (change?: number) => {
    if (!change) return null;
    return change > 0 
      ? <TrendingUp className="w-4 h-4 text-green-600" />
      : <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const unreadCount = alerts.filter(a => !a.isRead).length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Unread only
          </label>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('green')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'green'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Positive
          </button>
          <button
            onClick={() => setFilter('yellow')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'yellow'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Caution
          </button>
          <button
            onClick={() => setFilter('red')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'red'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Negative
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No alerts to display</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => onAlertClick?.(alert.id, alert.dealId)}
              className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                !alert.isRead ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex gap-3">
                {/* Severity Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(alert.severity)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {alert.title}
                        </h3>
                        {!alert.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>
                      {alert.dealName && (
                        <p className="text-xs text-gray-500 mb-1">
                          Deal: {alert.dealName}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 mb-2">
                        {alert.message}
                      </p>

                      {/* JEDI Score Change */}
                      {alert.jediScoreChange && (
                        <div className="flex items-center gap-2 mb-2">
                          {getScoreIcon(alert.jediScoreChange)}
                          <span className="text-sm font-medium text-gray-900">
                            {alert.jediScoreBefore?.toFixed(1)} → {alert.jediScoreAfter?.toFixed(1)}
                          </span>
                          <span className={`text-sm font-medium ${
                            alert.jediScoreChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ({alert.jediScoreChange > 0 ? '+' : ''}{alert.jediScoreChange.toFixed(1)})
                          </span>
                        </div>
                      )}

                      {/* Impact Summary */}
                      {alert.impactSummary && (
                        <p className="text-xs text-gray-600 mb-2 italic">
                          {alert.impactSummary}
                        </p>
                      )}

                      {/* Suggested Action */}
                      {alert.suggestedAction && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-md">
                          <p className="text-xs text-blue-800">
                            <strong>Suggested Action:</strong> {alert.suggestedAction}
                          </p>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {!alert.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(alert.id, e)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDismiss(alert.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
