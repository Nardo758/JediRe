import React, { useState, useEffect } from 'react';
import { EmailSettings } from './settings/EmailSettings';
import MarketsPreferencesPage from './settings/MarketsPreferencesPage';
import PropertyTypesSettings from './settings/PropertyTypesSettings';
import { IntelligenceSettings } from './settings/IntelligenceSettings';
import { AIModelSettings } from './settings/AIModelSettings';
import { NotificationSettings } from './settings/NotificationSettings';
import { SubscriptionSettings } from './settings/SubscriptionSettings';
import { apiClient } from '../services/api.client';

type SettingsTab = 'profile' | 'subscription' | 'modules' | 'integrations' | 'notifications' | 'markets' | 'property-types' | 'intelligence' | 'ai-model';

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  scout: { label: 'Scout', color: 'bg-gray-100 text-gray-700' },
  operator: { label: 'Operator', color: 'bg-blue-100 text-blue-700' },
  principal: { label: 'Principal', color: 'bg-indigo-100 text-indigo-700' },
  institutional: { label: 'Institutional', color: 'bg-purple-100 text-purple-700' },
  basic: { label: 'Basic', color: 'bg-gray-100 text-gray-700' },
  pro: { label: 'Pro', color: 'bg-blue-100 text-blue-700' },
  enterprise: { label: 'Enterprise', color: 'bg-purple-100 text-purple-700' },
};

const VALID_TABS: SettingsTab[] = ['profile', 'subscription', 'modules', 'integrations', 'notifications', 'markets', 'property-types', 'intelligence', 'ai-model'];

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full text-left px-4 py-3 font-medium rounded-lg ${
              activeTab === 'profile' 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Profile
          </button>
          <button 
            onClick={() => setActiveTab('subscription')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'subscription' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Subscription
          </button>
          <a 
            href="/settings/modules"
            className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            AI Modules
          </a>
          <a 
            href="/settings/module-libraries"
            className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            Module Libraries
          </a>
          <button 
            onClick={() => setActiveTab('markets')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'markets' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Markets & Coverage
          </button>
          <button 
            onClick={() => setActiveTab('property-types')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'property-types' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Property Types & Strategies
          </button>
          <button 
            onClick={() => setActiveTab('intelligence')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'intelligence' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Intelligence & Data
          </button>
          <button 
            onClick={() => setActiveTab('ai-model')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'ai-model' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            AI Model
          </button>
          <button 
            onClick={() => setActiveTab('integrations')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'integrations' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Integrations
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full text-left px-4 py-3 rounded-lg ${
              activeTab === 'notifications' 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Notifications
          </button>
        </div>

        <div className="col-span-2">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Settings</h2>

              {profileLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                      <input
                        type="text"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Contact support to change your email address</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier</label>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-2 font-semibold rounded-lg ${tierInfo.color}`}>
                        {tierInfo.label}
                      </span>
                      <a href="/pricing" className="text-blue-600 hover:text-blue-700 text-sm">
                        Change Plan
                      </a>
                    </div>
                  </div>

                  {profileMessage && (
                    <div className={`px-4 py-3 rounded-lg text-sm ${
                      profileMessage.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {profileMessage.text}
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={saveProfile}
                      disabled={profileSaving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {profileSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <MarketsPreferencesPage />
            </div>
          )}

          {activeTab === 'property-types' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-200px)]">
              <PropertyTypesSettings />
            </div>
          )}

          {activeTab === 'intelligence' && (
            <IntelligenceSettings />
          )}

          {activeTab === 'ai-model' && (
            <AIModelSettings />
          )}
        </div>
      </div>
    </div>
  );
}
