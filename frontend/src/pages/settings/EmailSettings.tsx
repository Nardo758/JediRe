import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

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
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ id: string; email: string } | null>(null);

  const showMessage = (type: 'success' | 'error' | 'info', text: string, autoDismiss = true) => {
    setMessage({ type, text });
    if (autoDismiss) {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  useEffect(() => {
    loadAccounts();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      showMessage('success', 'Gmail account connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error') === 'auth_failed') {
      const detail = params.get('detail') || '';
      showMessage('error', `Failed to connect Gmail account: ${detail || 'Please try again.'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ success: boolean; data: EmailAccount[] }>('/api/v1/gmail/accounts');
      setAccounts(response.data.data || []);
    } catch (error) {
      console.error('Failed to load email accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: { authUrl: string } }>('/api/v1/gmail/auth-url');
      if (response.data.success && response.data.data.authUrl) {
        window.location.href = response.data.data.authUrl;
      }
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      showMessage('error', 'Failed to initiate Gmail connection. Please try again.');
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
        showMessage('success', `Sync complete! Fetched: ${fetched}, Stored: ${stored}, Skipped: ${skipped}`);
        await loadAccounts();
      }
    } catch (error) {
      console.error('Sync failed:', error);
      showMessage('error', 'Failed to sync emails. Please try again.');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (accountId: string, emailAddress: string) => {
    setConfirmDisconnect({ id: accountId, email: emailAddress });
  };

  const executeDisconnect = async () => {
    if (!confirmDisconnect) return;
    try {
      await apiClient.delete(`/api/v1/gmail/disconnect/${confirmDisconnect.id}`);
      showMessage('success', 'Account disconnected successfully');
      await loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect account:', error);
      showMessage('error', 'Failed to disconnect account. Please try again.');
    } finally {
      setConfirmDisconnect(null);
    }
  };

  const handleToggleSync = async (accountId: string, currentEnabled: boolean) => {
    try {
      await apiClient.patch(`/api/v1/gmail/accounts/${accountId}`, { syncEnabled: !currentEnabled });
      await loadAccounts();
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      showMessage('error', 'Failed to update sync settings. Please try again.');
    }
  };

  const msgColors: Record<string, { color: string; border: string }> = {
    success: { color: BT.text.green, border: BT.text.green },
    error: { color: BT.text.red, border: BT.text.red },
    info: { color: BT.text.cyan, border: BT.text.cyan },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{ color: BT.text.muted, ...mono }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
        {message && (() => {
          const mc = msgColors[message.type] || msgColors.info;
          return (
            <div style={{
              padding: '10px 16px',
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: BT.bg.panelAlt,
              color: mc.color,
              border: `1px solid ${mc.border}`,
            }}>
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)} style={{ marginLeft: 12, fontWeight: 600, color: mc.color, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          );
        })()}

        {confirmDisconnect && (
          <div style={{ padding: 16, border: `1px solid ${BT.text.amber}`, background: BT.bg.panelAlt }}>
            <p style={{ fontSize: 12, color: BT.text.amber, marginBottom: 12 }}>
              Are you sure you want to disconnect <strong style={{ color: BT.text.primary }}>{confirmDisconnect.email}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={executeDisconnect}
                style={{ padding: '6px 14px', fontSize: 11, background: BT.text.red, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Disconnect
              </button>
              <button
                onClick={() => setConfirmDisconnect(null)}
                style={{ padding: '6px 14px', fontSize: 11, background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, letterSpacing: '0.04em' }}>Connected Accounts</h2>
              <p style={{ fontSize: 11, color: BT.text.secondary, marginTop: 4 }}>Manage your Gmail connections and sync settings</p>
            </div>
            <button
              onClick={handleConnectGmail}
              style={{ padding: '8px 16px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...mono }}
            >
              + Connect Gmail
            </button>
          </div>

          {accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 12, color: BT.text.muted, ...mono }}>NO ACCOUNTS CONNECTED</div>
              <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>Connect your Gmail account to start syncing emails</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accounts.map((account) => (
                <div key={account.id} style={{ border: `1px solid ${BT.border.subtle}`, padding: 14, background: BT.bg.panelAlt }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: BT.text.primary }}>{account.email_address}</span>
                        {account.is_primary && (
                          <span style={{ padding: '2px 8px', fontSize: 9, fontWeight: 700, background: BT.bg.active, color: BT.text.cyan, ...mono }}>PRIMARY</span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
                        <div>
                          <span style={{ color: BT.text.muted }}>Last Sync: </span>
                          <span style={{ color: BT.text.secondary, ...mono }}>
                            {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'Never'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: BT.text.muted }}>Frequency: </span>
                          <span style={{ color: BT.text.secondary, ...mono }}>Every {account.sync_frequency_minutes} min</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: BT.text.secondary, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={account.sync_enabled}
                            onChange={() => handleToggleSync(account.id, account.sync_enabled)}
                            style={{ accentColor: BT.text.cyan }}
                          />
                          Auto-sync enabled
                        </label>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
                      <button
                        onClick={() => handleSyncAccount(account.id)}
                        disabled={syncing === account.id}
                        style={{
                          padding: '6px 14px',
                          fontSize: 10,
                          border: `1px solid ${BT.border.subtle}`,
                          background: 'transparent',
                          color: BT.text.secondary,
                          cursor: syncing === account.id ? 'wait' : 'pointer',
                          opacity: syncing === account.id ? 0.5 : 1,
                          ...mono,
                        }}
                      >
                        {syncing === account.id ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={() => handleDisconnect(account.id, account.email_address)}
                        style={{
                          padding: '6px 14px',
                          fontSize: 10,
                          color: BT.text.red,
                          border: `1px solid ${BT.text.red}`,
                          background: 'transparent',
                          cursor: 'pointer',
                          ...mono,
                        }}
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

        {accounts.length > 0 && (
          <div style={{ padding: 14, background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.08em', marginBottom: 10, ...mono }}>QUICK STATS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: BT.text.muted }}>Total Accounts</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary, ...mono }}>{accounts.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: BT.text.muted }}>Active Sync</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green, ...mono }}>
                  {accounts.filter((a) => a.sync_enabled).length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: BT.text.muted }}>Last Synced</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, ...mono }}>
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
    </div>
  );
}

export default EmailSettings;
