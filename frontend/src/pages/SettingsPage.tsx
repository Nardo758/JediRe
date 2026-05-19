import { logSwallowedError } from '../utils/swallowedError';
/**
 * Settings Page - User Preferences & Configuration
 * 
 * All user-facing settings in one place with Bloomberg terminal styling.
 * 
 * Sections:
 * - ACCOUNT: Profile, Subscription
 * - PREFERENCES: Markets, Property Types, Intelligence, AI Model
 * - DATA: Data Library, News Subscriptions
 * - PLATFORM: Integrations, Notifications, Templates
 */

import React, { useState, useEffect } from 'react';
import { EmailSettings } from './settings/EmailSettings';
import MarketsPreferencesPage from './settings/MarketsPreferencesPage';
import PropertyTypesSettings from './settings/PropertyTypesSettings';
import { IntelligenceSettings } from './settings/IntelligenceSettings';
import { AIModelSettings } from './settings/AIModelSettings';
import { NotificationSettings } from './settings/NotificationSettings';
import { SubscriptionSettings } from './settings/SubscriptionSettings';
import { BrandingSettings } from './settings/BrandingSettings';
import { DataLibrarySettings } from './settings/DataLibrarySettings';
import SkillsSettingsPage from './settings/SkillsSettingsPage';
import { TemplatesSettings } from './settings/TemplatesSettings';
import { NewsConnectionsPage } from './settings/NewsConnectionsPage';
import { apiClient } from '../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

// ═══════════════════════════════════════════════════════════════════
// TYPES & CONFIG
// ═══════════════════════════════════════════════════════════════════

type SettingsTab = 
  | 'profile' | 'subscription' 
  | 'markets' | 'property-types' | 'intelligence' | 'ai-model' | 'skills'
  | 'data-library' | 'news-connections'
  | 'integrations' | 'notifications' | 'templates' | 'branding';

interface NavItem {
  key: SettingsTab;
  label: string;
  icon: string;
  description: string;
  group: 'account' | 'preferences' | 'data' | 'platform';
}

const NAV_ITEMS: NavItem[] = [
  // Account
  { key: 'profile', label: 'PROFILE', icon: '👤', description: 'Name, email, phone', group: 'account' },
  { key: 'subscription', label: 'SUBSCRIPTION', icon: '💳', description: 'Plan, billing, credits', group: 'account' },
  
  // Preferences
  { key: 'markets', label: 'MARKETS', icon: '🗺️', description: 'Target markets', group: 'preferences' },
  { key: 'property-types', label: 'PROPERTY TYPES', icon: '🏢', description: 'Asset classes', group: 'preferences' },
  { key: 'intelligence', label: 'INTELLIGENCE', icon: '🔍', description: 'Data sources', group: 'preferences' },
  { key: 'ai-model', label: 'AI MODEL', icon: '🧠', description: 'Model preferences', group: 'preferences' },
  { key: 'skills', label: 'AI SKILLS', icon: '⚡', description: 'Skill settings', group: 'preferences' },
  
  // Data
  { key: 'data-library', label: 'DATA LIBRARY', icon: '📚', description: 'Cloud storage, uploads', group: 'data' },
  { key: 'news-connections', label: 'NEWS', icon: '📰', description: 'Newsletter sources', group: 'data' },
  
  // Platform
  { key: 'integrations', label: 'INTEGRATIONS', icon: '🔗', description: 'Gmail, email sync', group: 'platform' },
  { key: 'notifications', label: 'NOTIFICATIONS', icon: '🔔', description: 'Alerts, channels', group: 'platform' },
  { key: 'templates', label: 'TEMPLATES', icon: '📋', description: 'Pro forma, reports', group: 'platform' },
  { key: 'branding', label: 'BRANDING', icon: '🏷️', description: 'Company name, logo, attribution', group: 'platform' },
];

const GROUP_LABELS: Record<string, string> = {
  account: '👤 ACCOUNT',
  preferences: '⚙️ PREFERENCES',
  data: '📊 DATA',
  platform: '🔌 PLATFORM',
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  scout: { label: 'Scout', color: BT.text.secondary },
  operator: { label: 'Operator', color: BT.text.cyan },
  principal: { label: 'Principal', color: BT.text.cyan },
  institutional: { label: 'Institutional', color: BT.text.purple },
  basic: { label: 'Basic', color: BT.text.secondary },
  pro: { label: 'Pro', color: BT.text.cyan },
  enterprise: { label: 'Enterprise', color: BT.text.purple },
};

const VALID_TABS: SettingsTab[] = NAV_ITEMS.map(n => n.key);

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace" };

// ═══════════════════════════════════════════════════════════════════
// PROFILE SECTION (Built-in)
// ═══════════════════════════════════════════════════════════════════

function ProfileSection() {
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    tier: 'scout',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/auth/me');
      const data = response.data;
      setProfileData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        tier: data.tier || 'scout',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback to localStorage
      const storedUser = localStorage.getItem('jedi_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setProfileData({
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            email: user.email || '',
            phone: '',
            tier: user.tier || 'scout',
          });
        } catch (err) { logSwallowedError('pages/SettingsPage', err); }
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await apiClient.put('/api/v1/auth/profile', {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
      });
      
      // Update localStorage
      const storedUser = localStorage.getItem('jedi_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          user.name = `${profileData.firstName} ${profileData.lastName}`.trim();
          localStorage.setItem('jedi_user', JSON.stringify(user));
        } catch (err) { logSwallowedError('pages/SettingsPage', err); }
      }
      
      setMessage({ type: 'success', text: 'Profile saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const tierInfo = TIER_LABELS[profileData.tier] || TIER_LABELS.scout;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 12,
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    color: BT.text.primary,
    outline: 'none',
    ...mono,
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted }}>
        Loading profile...
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: BT.text.primary, letterSpacing: 1, marginBottom: 24, ...mono }}>
        👤 PROFILE SETTINGS
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: BT.text.secondary, marginBottom: 6, ...mono }}>
            FIRST NAME
          </label>
          <input
            type="text"
            value={profileData.firstName}
            onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: BT.text.secondary, marginBottom: 6, ...mono }}>
            LAST NAME
          </label>
          <input
            type="text"
            value={profileData.lastName}
            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 10, color: BT.text.secondary, marginBottom: 6, ...mono }}>
          EMAIL
        </label>
        <input
          type="email"
          value={profileData.email}
          disabled
          style={{ ...inputStyle, background: BT.bg.panelAlt, color: BT.text.muted, cursor: 'not-allowed' }}
        />
        <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 4 }}>
          Contact support to change your email address
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 10, color: BT.text.secondary, marginBottom: 6, ...mono }}>
          PHONE
        </label>
        <input
          type="tel"
          value={profileData.phone}
          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
          placeholder="+1 (555) 123-4567"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 10, color: BT.text.secondary, marginBottom: 6, ...mono }}>
          SUBSCRIPTION TIER
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            padding: '8px 16px',
            fontSize: 11,
            fontWeight: 700,
            background: BT.bg.panelAlt,
            border: `1px solid ${BT.border.subtle}`,
            color: tierInfo.color,
            ...mono,
          }}>
            {tierInfo.label}
          </span>
          <a href="/pricing" style={{ fontSize: 11, color: BT.text.cyan, textDecoration: 'none' }}>
            Change Plan →
          </a>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 11,
          background: message.type === 'success' ? BT.text.green + '11' : BT.text.red + '11',
          border: `1px solid ${message.type === 'success' ? BT.text.green : BT.text.red}`,
          color: message.type === 'success' ? BT.text.green : BT.text.red,
        }}>
          {message.text}
        </div>
      )}

      <button
        onClick={saveProfile}
        disabled={saving}
        style={{
          padding: '10px 24px',
          fontSize: 11,
          fontWeight: 700,
          background: BT.text.cyan,
          border: 'none',
          color: BT.bg.terminal,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          ...mono,
        }}
      >
        {saving ? 'SAVING...' : 'SAVE CHANGES'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

function getInitialTab(): SettingsTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && VALID_TABS.includes(tab as SettingsTab)) {
    return tab as SettingsTab;
  }
  // Handle OAuth callback
  if (params.get('connected') === 'true' || params.get('error') === 'auth_failed') {
    return 'integrations';
  }
  return 'profile';
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>(getInitialTab);

  const renderNavGroup = (groupId: string) => {
    const items = NAV_ITEMS.filter(item => item.group === groupId);
    const label = GROUP_LABELS[groupId];

    return (
      <div key={groupId} style={{ marginBottom: 16 }}>
        <div style={{ 
          fontSize: 9, 
          color: BT.text.muted, 
          padding: '8px 12px', 
          letterSpacing: 0.8, 
          ...mono 
        }}>
          {label}
        </div>
        {items.map(item => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 2,
                background: isActive ? BT.bg.active : 'transparent',
                border: 'none',
                borderLeft: isActive ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <div>
                <div style={{ 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: isActive ? BT.text.cyan : BT.text.primary,
                  ...mono 
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 9, color: BT.text.muted }}>
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection />;
      case 'subscription':
        return <SubscriptionSettings />;
      case 'markets':
        return (
          <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, height: '100%' }}>
            <MarketsPreferencesPage />
          </div>
        );
      case 'property-types':
        return (
          <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, height: '100%' }}>
            <PropertyTypesSettings />
          </div>
        );
      case 'intelligence':
        return <IntelligenceSettings />;
      case 'ai-model':
        return <AIModelSettings />;
      case 'skills':
        return <SkillsSettingsPage />;
      case 'data-library':
        return <DataLibrarySettings />;
      case 'news-connections':
        return <NewsConnectionsPage />;
      case 'integrations':
        return <EmailSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'templates':
        return <TemplatesSettings />;
      case 'branding':
        return <BrandingSettings />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: BT.bg.terminal,
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: BT.bg.panel,
        borderRight: `1px solid ${BT.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 12px', 
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <h1 style={{ 
            fontSize: 12, 
            fontWeight: 700, 
            color: BT.text.primary, 
            letterSpacing: 1,
            margin: 0,
            ...mono 
          }}>
            SETTINGS
          </h1>
          <p style={{ fontSize: 10, color: BT.text.secondary, margin: '4px 0 0 0' }}>
            Manage your account
          </p>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
          {renderNavGroup('account')}
          {renderNavGroup('preferences')}
          {renderNavGroup('data')}
          {renderNavGroup('platform')}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        overflow: 'auto',
        background: BT.bg.terminal,
      }}>
        <div style={{ 
          background: BT.bg.panel, 
          border: `1px solid ${BT.border.subtle}`,
          margin: 20,
          minHeight: 'calc(100% - 40px)',
        }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default SettingsPage;
