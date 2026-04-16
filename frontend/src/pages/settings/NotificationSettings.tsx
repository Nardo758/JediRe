import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Phone, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

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
      const notifPrefs = data.notificationPreferences && Object.keys(data.notificationPreferences).length > 0
        ? data.notificationPreferences
        : {};
      setPreferences({
        ...defaultPreferences,
        ...notifPrefs,
        emailAlerts: {
          ...defaultPreferences.emailAlerts,
          ...(notifPrefs.emailAlerts || {}),
        },
        phoneNumber: data.phone || notifPrefs.phoneNumber || '',
      });
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{
          height: 32, width: 32,
          border: `2px solid ${BT.border.subtle}`,
          borderBottom: `2px solid ${BT.text.cyan}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <MessageSquare style={{ width: 18, height: 18, color: BT.text.green }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary }}>SMS Notifications</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.smsEnabled}
              onChange={(e) => setPreferences({ ...preferences, smsEnabled: e.target.checked })}
              style={{ marginTop: 3, accentColor: BT.text.cyan }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: BT.text.primary }}>Enable SMS Notifications</div>
              <div style={{ fontSize: 11, color: BT.text.secondary, marginTop: 4 }}>
                Receive critical alerts via text message for urgent deal updates and market events
              </div>
            </div>
          </label>

          {preferences.smsEnabled && (
            <div style={{ paddingLeft: 28 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: BT.text.secondary, marginBottom: 6 }}>
                <Phone style={{ width: 14, height: 14 }} />
                Phone Number
              </label>
              <input
                type="tel"
                value={preferences.phoneNumber}
                onChange={(e) => setPreferences({ ...preferences, phoneNumber: e.target.value })}
                placeholder="+1 (555) 123-4567"
                style={{
                  width: '100%',
                  maxWidth: 280,
                  padding: '8px 12px',
                  background: BT.bg.input,
                  border: `1px solid ${BT.border.medium}`,
                  color: BT.text.primary,
                  fontSize: 12,
                  outline: 'none',
                  ...mono,
                }}
              />
              <p style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>Standard messaging rates may apply</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Mail style={{ width: 18, height: 18, color: BT.text.cyan }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary }}>Email Alerts</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {emailAlertOptions.map((option) => (
            <label key={option.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences.emailAlerts[option.key]}
                onChange={(e) => updateEmailAlert(option.key, e.target.checked)}
                style={{ marginTop: 3, accentColor: BT.text.cyan }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: BT.text.primary }}>{option.label}</div>
                <div style={{ fontSize: 11, color: BT.text.secondary, marginTop: 4 }}>{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {saveMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          fontSize: 12,
          background: BT.bg.panelAlt,
          color: saveMessage.type === 'success' ? BT.text.green : BT.text.red,
          border: `1px solid ${saveMessage.type === 'success' ? BT.text.green : BT.text.red}`,
        }}>
          {saveMessage.type === 'success'
            ? <CheckCircle style={{ width: 14, height: 14 }} />
            : <AlertTriangle style={{ width: 14, height: 14 }} />
          }
          {saveMessage.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${BT.border.subtle}` }}>
        <div style={{ fontSize: 11, color: BT.text.muted }}>Changes take effect immediately</div>
        <button
          onClick={savePreferences}
          disabled={saving}
          style={{
            padding: '8px 20px',
            background: BT.text.cyan,
            color: BT.bg.terminal,
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            ...mono,
          }}
        >
          {saving ? (
            <>
              <div style={{
                height: 14, width: 14,
                border: '2px solid transparent',
                borderBottom: `2px solid ${BT.bg.terminal}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle style={{ width: 14, height: 14 }} />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}
