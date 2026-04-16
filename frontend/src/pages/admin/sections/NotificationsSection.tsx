/**
 * Notifications Section
 * Alert preferences and notification channels
 */

import React, { useState } from 'react';

const BT = {
  bg: { panel: '#0F1319', header: '#1A1F2E' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};
const MONO = "'JetBrains Mono', monospace";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  slack: boolean;
}

const NOTIFICATIONS: NotificationSetting[] = [
  { id: 'deal_updates', label: 'Deal Updates', description: 'Stage changes, new activity', email: true, push: true, slack: true },
  { id: 'documents', label: 'Document Activity', description: 'Uploads, signatures, views', email: true, push: false, slack: true },
  { id: 'tasks', label: 'Task Reminders', description: 'Due dates, assignments', email: true, push: true, slack: false },
  { id: 'team', label: 'Team Activity', description: 'New members, role changes', email: true, push: false, slack: true },
  { id: 'market', label: 'Market Alerts', description: 'JEDI intelligence alerts', email: false, push: true, slack: true },
  { id: 'billing', label: 'Billing', description: 'Invoices, usage warnings', email: true, push: false, slack: false },
];

export default function NotificationsSection() {
  const [settings, setSettings] = useState<NotificationSetting[]>(NOTIFICATIONS);

  const toggleSetting = (id: string, channel: 'email' | 'push' | 'slack') => {
    setSettings(settings.map(s => 
      s.id === id ? { ...s, [channel]: !s[channel] } : s
    ));
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: BT.text.amber, fontFamily: MONO, marginBottom: 8 }}>
          NOTIFICATIONS
        </h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO }}>
          Configure how and when you receive alerts
        </p>
      </div>

      {/* Notification Channels */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 80px 80px 80px',
          padding: '12px 16px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>
            Notification Type
          </span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase', textAlign: 'center' }}>
            Email
          </span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase', textAlign: 'center' }}>
            Push
          </span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase', textAlign: 'center' }}>
            Slack
          </span>
        </div>

        {/* Rows */}
        {settings.map((setting) => (
          <div
            key={setting.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 80px 80px 80px',
              padding: '16px',
              borderBottom: `1px solid ${BT.border.subtle}`,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO, fontWeight: 500 }}>
                {setting.label}
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>
                {setting.description}
              </div>
            </div>
            
            {(['email', 'push', 'slack'] as const).map((channel) => (
              <div key={channel} style={{ textAlign: 'center' }}>
                <button
                  onClick={() => toggleSetting(setting.id, channel)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: 'none',
                    background: setting[channel] ? BT.text.green : BT.bg.header,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: BT.text.primary,
                    position: 'absolute',
                    top: 3,
                    left: setting[channel] ? 21 : 3,
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Quiet Hours */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 12, color: BT.text.amber, fontFamily: MONO, marginBottom: 16, textTransform: 'uppercase' }}>
          Quiet Hours
        </h3>
        
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: 6,
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input type="checkbox" id="quietHours" />
            <label htmlFor="quietHours" style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO }}>
              Enable quiet hours
            </label>
          </div>
          
          <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>From</span>
            <input
              type="time"
              defaultValue="22:00"
              style={{
                padding: '6px 10px',
                background: BT.bg.header,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontFamily: MONO,
                fontSize: 11,
              }}
            />
            <span style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>to</span>
            <input
              type="time"
              defaultValue="08:00"
              style={{
                padding: '6px 10px',
                background: BT.bg.header,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontFamily: MONO,
                fontSize: 11,
              }}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: 24 }}>
        <button style={{
          padding: '12px 24px',
          background: BT.text.cyan,
          color: BT.bg.panel,
          border: 'none',
          borderRadius: 4,
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          textTransform: 'uppercase',
        }}>
          Save Preferences
        </button>
      </div>
    </div>
  );
}
