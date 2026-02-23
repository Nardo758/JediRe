/**
 * Email Settings Page
 * Manage Gmail account connections and email sync
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api.client';

interface EmailAccount {
  id: string;
  email_address: string;
  is_primary: boolean;
  last_sync_at: string | null;
  sync_enabled: boolean;
  sync_frequency_minutes: number;
  created_at: string;
  updated_at: string;
}

export function EmailSettings() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    
    // Check for connection success/error in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      alert('Gmail account connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error') === 'auth_failed') {
      const detail = params.get('detail') || '';
      alert(`Failed to connect Gmail account: ${detail || 'Please try again.'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ success: boolean; data: EmailAccount[] }>(
        '/api/v1/gmail/accounts'
      );
      setAccounts(response.data.data || []);
    } catch (error) {
      console.error('Failed to load email accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: { authUrl: string } }>(
        '/api/v1/gmail/auth-url'
      );
      
      if (response.data.success && response.data.data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = response.data.data.authUrl;
      }
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      alert('Failed to initiate Gmail connection. Please try again.');
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    try {
      setSyncing(accountId);
      const response = await apiClient.post<{
        success: boolean;
        data: { fetched: number; stored: number; skipped: number };
      }>(`/api/v1/gmail/sync/${accountId}`);

      if (response.data.success) {
        const { fetched, stored, skipped } = response.data.data;
        alert(
          `Sync complete!\n\nFetched: ${fetched}\nStored: ${stored}\nSkipped: ${skipped}`
        );
        await loadAccounts();
      }
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Failed to sync emails. Please try again.');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (accountId: string, emailAddress: string) => {
    if (!confirm(`Are you sure you want to disconnect ${emailAddress}?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/gmail/disconnect/${accountId}`);
      alert('Account disconnected successfully');
      await loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect account:', error);
      alert('Failed to disconnect account. Please try again.');
    }
  };

  const handleToggleSync = async (accountId: string, currentEnabled: boolean) => {
    try {
      await apiClient.patch(`/api/v1/gmail/accounts/${accountId}`, {
        syncEnabled: !currentEnabled,
      });
      await loadAccounts();
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      alert('Failed to update sync settings. Please try again.');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      );
    }

    return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Connected Accounts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your Gmail connections and sync settings
                </p>
              </div>
              <button
                onClick={handleConnectGmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + Connect Gmail
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📧</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts connected</h3>
                <p className="text-gray-600 mb-4">
                  Connect your Gmail account to start syncing emails
                </p>
                <button
                  onClick={handleConnectGmail}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Connect Gmail Account
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">{account.email_address}</h3>
                          {account.is_primary && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              Primary
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Last Sync:</span>{' '}
                            <span className="text-gray-900">
                              {account.last_sync_at
                                ? new Date(account.last_sync_at).toLocaleString()
                                : 'Never'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Sync Frequency:</span>{' '}
                            <span className="text-gray-900">
                              Every {account.sync_frequency_minutes} minutes
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={account.sync_enabled}
                              onChange={() => handleToggleSync(account.id, account.sync_enabled)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">Auto-sync enabled</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleSyncAccount(account.id)}
                          disabled={syncing === account.id}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          {syncing === account.id ? 'Syncing...' : 'Sync Now'}
                        </button>
                        <button
                          onClick={() => handleDisconnect(account.id, account.email_address)}
                          className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          {accounts.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="font-medium text-blue-900 mb-2">📊 Quick Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-blue-600">Total Accounts</div>
                  <div className="text-xl font-semibold text-blue-900">{accounts.length}</div>
                </div>
                <div>
                  <div className="text-blue-600">Active Sync</div>
                  <div className="text-xl font-semibold text-blue-900">
                    {accounts.filter((a) => a.sync_enabled).length}
                  </div>
                </div>
                <div>
                  <div className="text-blue-600">Last Synced</div>
                  <div className="text-sm font-medium text-blue-900">
                    {accounts.some((a) => a.last_sync_at)
                      ? new Date(
                          Math.max(
                            ...accounts
                              .filter((a) => a.last_sync_at)
                              .map((a) => new Date(a.last_sync_at!).getTime())
                          )
                        ).toLocaleTimeString()
                      : 'Never'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
  };

  // Just render content directly (no ThreePanelLayout when embedded in Settings)
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {renderContent()}
    </div>
  );
}

export default EmailSettings;
