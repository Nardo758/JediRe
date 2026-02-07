/**
 * Outlook Connection Component
 * Settings page integration for connecting/disconnecting Microsoft account
 */

import { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader, ExternalLink } from 'lucide-react';
import axios from 'axios';

interface OutlookStatus {
  configured: boolean;
  connected: boolean;
  account?: {
    email: string;
    displayName: string;
    lastSync: string;
  };
}

interface OutlookConnectProps {
  apiUrl?: string;
  onStatusChange?: (connected: boolean) => void;
}

export default function OutlookConnect({ 
  apiUrl = '/api/v1',
  onStatusChange 
}: OutlookConnectProps) {
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Get JWT token (adjust based on your auth setup)
  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || '';
  };

  // Check connection status
  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${apiUrl}/microsoft/status`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      
      setStatus(response.data);
      onStatusChange?.(response.data.connected);
    } catch (err: any) {
      console.error('Error checking Outlook status:', err);
      setError(err.response?.data?.message || 'Failed to check Outlook status');
    } finally {
      setLoading(false);
    }
  };

  // Connect Outlook account
  const handleConnect = async () => {
    try {
      setError(null);
      
      const response = await axios.get(`${apiUrl}/microsoft/auth/connect`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      
      // Redirect to Microsoft OAuth page
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (err: any) {
      console.error('Error connecting Outlook:', err);
      setError(err.response?.data?.message || 'Failed to connect Outlook');
    }
  };

  // Disconnect Outlook account
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Outlook account?')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);
      
      await axios.post(
        `${apiUrl}/microsoft/auth/disconnect`,
        {},
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );
      
      // Refresh status
      await checkStatus();
    } catch (err: any) {
      console.error('Error disconnecting Outlook:', err);
      setError(err.response?.data?.message || 'Failed to disconnect Outlook');
    } finally {
      setDisconnecting(false);
    }
  };

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Check for OAuth callback (when redirected back from Microsoft)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('microsoft_connected') === 'true') {
      checkStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('microsoft_error')) {
      setError(`Connection failed: ${params.get('microsoft_error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <Loader className="w-5 h-5 text-gray-400 animate-spin" />
          <span className="text-gray-600">Checking Outlook connection...</span>
        </div>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-1">
              Outlook Integration Not Configured
            </h3>
            <p className="text-sm text-yellow-800 mb-3">
              The Microsoft Graph API credentials are not set up on the server. 
              Contact your administrator to configure the integration.
            </p>
            <a
              href="https://github.com/yourusername/jedire/blob/master/MICROSOFT_INTEGRATION_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-yellow-900 underline hover:text-yellow-700"
            >
              View Setup Guide
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Mail className="w-6 h-6 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Microsoft Outlook
          </h3>

          {status.connected && status.account ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700 font-medium">Connected</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account:</span>
                    <span className="font-medium text-gray-900">{status.account.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium text-gray-900">{status.account.displayName}</span>
                  </div>
                  {status.account.lastSync && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last sync:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(status.account.lastSync).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
                <button
                  onClick={checkStatus}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Refresh Status
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Outlook account to manage emails, schedule property showings, 
                and link communications to deals—all within JediRe.
              </p>

              <button
                onClick={handleConnect}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Connect Outlook
              </button>

              <div className="mt-4 text-xs text-gray-500">
                <p className="mb-1">✓ Read and manage emails</p>
                <p className="mb-1">✓ Send and reply to messages</p>
                <p className="mb-1">✓ Access calendar events</p>
                <p>✓ Secure OAuth 2.0 authentication</p>
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
