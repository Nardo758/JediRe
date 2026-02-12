import React, { useState } from 'react';
import { EmailSettings } from './settings/EmailSettings';

type SettingsTab = 'profile' | 'subscription' | 'modules' | 'integrations' | 'notifications';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Navigation */}
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

        {/* Content */}
        <div className="col-span-2">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    id="settings-name"
                    name="settingsName"
                    defaultValue="Leon D"
                    aria-label="Name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    id="settings-email"
                    name="settingsEmail"
                    defaultValue="leon@example.com"
                    aria-label="Email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier</label>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 bg-purple-100 text-purple-700 font-semibold rounded-lg">
                      Enterprise
                    </span>
                    <button className="text-blue-600 hover:text-blue-700">Change Plan</button>
                  </div>
                </div>

                <div className="pt-4">
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && <EmailSettings />}

          {activeTab === 'subscription' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription</h2>
              <p className="text-gray-600">Manage your subscription settings here.</p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h2>
              <p className="text-gray-600">Manage your notification preferences here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
