import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Phone, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface NotificationPreferences {
  smsEnabled: boolean;
  phoneNumber: string;
  emailAlerts: {
    dealUpdates: boolean;
    marketAlerts: boolean;
    creditLowWarnings: boolean;
    weeklyDigest: boolean;
    agentResults: boolean;
  };
}

const defaultPreferences: NotificationPreferences = {
  smsEnabled: false,
  phoneNumber: '',
  emailAlerts: {
    dealUpdates: true,
    marketAlerts: true,
    creditLowWarnings: true,
    weeklyDigest: false,
    agentResults: true,
  },
};

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await apiClient.get('/api/v1/auth/me');
      const data = response.data;
      if (data.notificationPreferences && Object.keys(data.notificationPreferences).length > 0) {
        setPreferences({
          ...defaultPreferences,
          ...data.notificationPreferences,
          emailAlerts: {
            ...defaultPreferences.emailAlerts,
            ...(data.notificationPreferences.emailAlerts || {}),
          },
        });
      }
      if (data.phone) {
        setPreferences(prev => ({ ...prev, phoneNumber: data.phone }));
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await apiClient.put('/api/v1/auth/profile', {
        phone: preferences.phoneNumber,
        notificationPreferences: {
          smsEnabled: preferences.smsEnabled,
          phoneNumber: preferences.phoneNumber,
          emailAlerts: preferences.emailAlerts,
        },
      });
      setSaveMessage({ type: 'success', text: 'Notification preferences saved successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const updateEmailAlert = (key: keyof NotificationPreferences['emailAlerts'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      emailAlerts: { ...prev.emailAlerts, [key]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const emailAlertOptions = [
    { key: 'dealUpdates' as const, label: 'Deal Updates', description: 'Get notified when deal status changes, new documents are uploaded, or analysis completes' },
    { key: 'marketAlerts' as const, label: 'Market Alerts', description: 'Receive alerts for significant market changes in your tracked markets' },
    { key: 'creditLowWarnings' as const, label: 'Credit Low Warnings', description: 'Get warned when your AI credit balance drops below 20%' },
    { key: 'weeklyDigest' as const, label: 'Weekly Digest', description: 'Receive a weekly summary of deal activity, market trends, and agent insights' },
    { key: 'agentResults' as const, label: 'Agent Results', description: 'Get notified when AI agents complete analysis tasks' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">SMS Notifications</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.smsEnabled}
              onChange={(e) => setPreferences({ ...preferences, smsEnabled: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Enable SMS Notifications</div>
              <div className="text-sm text-gray-600 mt-1">
                Receive critical alerts via text message for urgent deal updates and market events
              </div>
            </div>
          </label>

          {preferences.smsEnabled && (
            <div className="pl-7">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                value={preferences.phoneNumber}
                onChange={(e) => setPreferences({ ...preferences, phoneNumber: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Standard messaging rates may apply</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Email Alerts</h2>
        </div>

        <div className="space-y-4">
          {emailAlertOptions.map((option) => (
            <label key={option.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.emailAlerts[option.key]}
                onChange={(e) => updateEmailAlert(option.key, e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600 mt-1">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {saveMessage.type === 'success' 
            ? <CheckCircle className="w-4 h-4" /> 
            : <AlertTriangle className="w-4 h-4" />
          }
          {saveMessage.text}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          Changes take effect immediately
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}
