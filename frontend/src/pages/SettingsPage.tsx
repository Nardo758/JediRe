import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EmailSettings } from './settings/EmailSettings';
import MarketsPreferencesPage from './settings/MarketsPreferencesPage';
import PropertyTypesSettings from './settings/PropertyTypesSettings';
import { IntelligenceSettings } from './settings/IntelligenceSettings';
import { AIModelSettings } from './settings/AIModelSettings';
import { NotificationSettings } from './settings/NotificationSettings';
import { SubscriptionSettings } from './settings/SubscriptionSettings';
import { DataLibrarySettings } from './settings/DataLibrarySettings';
import AgentSettingsPage from './settings/AgentSettingsPage';
import { TemplatesSettings } from './settings/TemplatesSettings';
import { apiClient } from '../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

type SettingsTab = 'profile' | 'subscription' | 'modules' | 'integrations' | 'notifications' | 'markets' | 'property-types' | 'intelligence' | 'ai-model' | 'data-library' | 'agents' | 'templates';

const TIER_LABELS: Record<string, { label: string; textColor: string; bgColor: string }> = {
  scout: { label: 'Scout', textColor: BT.text.secondary, bgColor: BT.bg.panelAlt },
  operator: { label: 'Operator', textColor: BT.text.cyan, bgColor: BT.bg.active },
  principal: { label: 'Principal', textColor: BT.text.cyan, bgColor: BT.bg.active },
  institutional: { label: 'Institutional', textColor: BT.text.purple, bgColor: BT.bg.active },
  basic: { label: 'Basic', textColor: BT.text.secondary, bgColor: BT.bg.panelAlt },
  pro: { label: 'Pro', textColor: BT.text.cyan, bgColor: BT.bg.active },
  enterprise: { label: 'Enterprise', textColor: BT.text.purple, bgColor: BT.bg.active },
};

const VALID_TABS: SettingsTab[] = ['profile', 'subscription', 'modules', 'integrations', 'notifications', 'markets', 'property-types', 'intelligence', 'ai-model', 'data-library', 'agents', 'templates'];

function getInitialTab(): SettingsTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && VALID_TABS.includes(tab as SettingsTab)) {
    return tab as SettingsTab;
  }
  return 'profile';
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true' || params.get('error') === 'auth_failed') {
      return 'integrations';
    }
    return getInitialTab();
  });
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    tier: 'scout',
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab]);

  const loadProfile = async () => {
    setProfileLoading(true);
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
        } catch { }
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      await apiClient.put('/api/v1/auth/profile', {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
      });
      const storedUser = localStorage.getItem('jedi_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          user.name = `${profileData.firstName} ${profileData.lastName}`.trim();
          localStorage.setItem('jedi_user', JSON.stringify(user));
        } catch { }
      }
      setProfileMessage({ type: 'success', text: 'Profile saved successfully' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const tierInfo = TIER_LABELS[profileData.tier] || TIER_LABELS.scout;

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? BT.bg.active : 'transparent',
    color: isActive ? BT.text.cyan : BT.text.secondary,
    borderRadius: 0,
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <div className="p-6" style={{ background: BT.bg.terminal, minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-sm font-bold mb-2" style={{ color: BT.text.primary, fontSize: 13, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>SETTINGS</h1>
        <p style={{ color: BT.text.secondary }}>Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab('profile')}
            className="w-full text-left px-4 py-3 font-medium"
            style={tabButtonStyle(activeTab === 'profile')}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'subscription')}
          >
            Subscription
          </button>
          {/* AI Modules, Module Libraries, Strategy Builder removed — routes deprecated */}
          <button
            onClick={() => setActiveTab('markets')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'markets')}
          >
            Markets & Coverage
          </button>
          <button
            onClick={() => setActiveTab('property-types')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'property-types')}
          >
            Property Types & Strategies
          </button>
          <button
            onClick={() => setActiveTab('intelligence')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'intelligence')}
          >
            Intelligence & Data
          </button>
          <button
            onClick={() => setActiveTab('data-library')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'data-library')}
          >
            Data Library
          </button>
          <button
            onClick={() => setActiveTab('ai-model')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'ai-model')}
          >
            AI Model
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'agents')}
          >
            Agent AI Settings
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'integrations')}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'notifications')}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className="w-full text-left px-4 py-3"
            style={tabButtonStyle(activeTab === 'templates')}
          >
            Templates
          </button>
        </div>

        <div className="col-span-2">
          {activeTab === 'profile' && (
            <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
              <h2 className="text-sm font-semibold mb-6" style={{ color: BT.text.primary, fontSize: 11, letterSpacing: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>PROFILE SETTINGS</h2>

              {profileLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8" style={{ border: `2px solid ${BT.text.cyan}`, borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>First Name</label>
                      <input
                        type="text"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                        className="w-full px-4 py-2"
                        style={{ background: BT.bg.input, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>Last Name</label>
                      <input
                        type="text"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                        className="w-full px-4 py-2"
                        style={{ background: BT.bg.input, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary, outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-2 cursor-not-allowed"
                      style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.muted }}
                    />
                    <p className="text-xs mt-1" style={{ color: BT.text.muted }}>Contact support to change your email address</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>Phone</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-2"
                      style={{ background: BT.bg.input, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>Subscription Tier</label>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-2 font-semibold" style={{ background: tierInfo.bgColor, color: tierInfo.textColor, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                        {tierInfo.label}
                      </span>
                      <a href="/pricing" className="text-sm" style={{ color: BT.text.cyan }}>
                        Change Plan
                      </a>
                    </div>
                  </div>

                  {profileMessage && (
                    <div className="px-4 py-3 text-sm" style={{
                      borderRadius: 0,
                      background: BT.bg.panelAlt,
                      color: profileMessage.type === 'success' ? BT.text.green : BT.text.red,
                      border: `1px solid ${profileMessage.type === 'success' ? BT.text.green : BT.text.red}`,
                    }}>
                      {profileMessage.text}
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={saveProfile}
                      disabled={profileSaving}
                      className="px-6 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}
                    >
                      {profileSaving ? (
                        <>
                          <div className="h-4 w-4" style={{ border: `2px solid ${BT.bg.terminal}`, borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'integrations' && <EmailSettings />}

          {activeTab === 'subscription' && <SubscriptionSettings />}

          {activeTab === 'notifications' && <NotificationSettings />}

          {activeTab === 'markets' && (
            <div style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
              <MarketsPreferencesPage />
            </div>
          )}

          {activeTab === 'property-types' && (
            <div className="h-[calc(100vh-200px)]" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
              <PropertyTypesSettings />
            </div>
          )}

          {activeTab === 'intelligence' && (
            <IntelligenceSettings />
          )}

          {activeTab === 'ai-model' && (
            <AIModelSettings />
          )}

          {activeTab === 'data-library' && (
            <DataLibrarySettings />
          )}

          {activeTab === 'agents' && (
            <AgentSettingsPage />
          )}

          {activeTab === 'templates' && (
            <TemplatesSettings />
          )}
        </div>
      </div>
    </div>
  );
}
