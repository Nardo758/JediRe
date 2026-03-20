import React, { useState, useEffect } from 'react';
import {
  Loader2, X, Search, Check, Users, Mail, Building2,
  RefreshCw, Download
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface UnifiedContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  source: 'microsoft' | 'google';
}

interface ConnectionStatus {
  microsoft: { connected: boolean; email?: string; displayName?: string };
  google: { connected: boolean; email?: string };
}

interface ContactImportModalProps {
  dealId: string;
  onClose: () => void;
  onImported: () => void;
}

export function ContactImportModal({ dealId, onClose, onImported }: ContactImportModalProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSource, setActiveSource] = useState<'microsoft' | 'google' | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: { email: string; reason: string }[];
  } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/api/v1/contacts/status');
      setStatus(res.data);

      if (res.data.microsoft.connected) {
        setActiveSource('microsoft');
        fetchContacts('microsoft');
      } else if (res.data.google.connected) {
        setActiveSource('google');
        fetchContacts('google');
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching connection status:', error);
      setLoading(false);
    }
  };

  const fetchContacts = async (source: 'microsoft' | 'google') => {
    setFetching(true);
    setActiveSource(source);
    try {
      const endpoint = source === 'microsoft'
        ? '/api/v1/contacts/microsoft?includeRelevant=true'
        : '/api/v1/contacts/google';
      const res = await apiClient.get(endpoint);
      setContacts(res.data.contacts || []);
    } catch (error: any) {
      console.error(`Error fetching ${source} contacts:`, error);
      setContacts([]);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  const handleImport = async () => {
    const toImport = contacts.filter(c => selected.has(c.id));
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const res = await apiClient.post(`/api/v1/deals/${dealId}/team/members/import`, {
        contacts: toImport,
      });
      setImportResult({
        imported: res.data.summary.imported,
        skipped: res.data.skipped,
      });
      if (res.data.summary.imported > 0) {
        onImported();
      }
    } catch (error) {
      console.error('Error importing contacts:', error);
    } finally {
      setImporting(false);
    }
  };

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q))
    );
  });

  const connectMicrosoft = async () => {
    try {
      const res = await apiClient.get('/api/v1/microsoft/auth/connect');
      if (res.data.authUrl) {
        window.open(res.data.authUrl, '_blank', 'width=600,height=700');
      }
    } catch (error) {
      console.error('Error connecting Microsoft:', error);
    }
  };

  const connectGoogle = async () => {
    try {
      const res = await apiClient.get('/api/v1/gmail/auth-url');
      if (res.data.url) {
        window.open(res.data.url, '_blank', 'width=600,height=700');
      }
    } catch (error) {
      console.error('Error connecting Google:', error);
    }
  };

  if (importResult) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Check size={24} className="text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  {importResult.imported} contact{importResult.imported !== 1 ? 's' : ''} imported successfully
                </p>
              </div>
            </div>

            {importResult.skipped.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {importResult.skipped.length} skipped:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.skipped.map((s, i) => (
                    <div key={i} className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="truncate">{s.email}</span>
                      <span className="text-gray-400">—</span>
                      <span className="text-gray-400">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Import Contacts</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Sync contacts from your email to add as team members
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-500 text-sm">Checking connections...</span>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => status?.microsoft.connected ? fetchContacts('microsoft') : connectMicrosoft()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    activeSource === 'microsoft'
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  {status?.microsoft.connected
                    ? (status.microsoft.email || 'Outlook')
                    : 'Connect Outlook'}
                </button>

                <button
                  onClick={() => status?.google.connected ? fetchContacts('google') : connectGoogle()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    activeSource === 'google'
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  {status?.google.connected
                    ? (status.google.email || 'Google')
                    : 'Connect Google'}
                </button>

                {(status?.microsoft.connected || status?.google.connected) && (
                  <button
                    onClick={() => activeSource && fetchContacts(activeSource)}
                    disabled={fetching}
                    className="ml-auto p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="Refresh contacts"
                  >
                    <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>
            </div>

            {!status?.microsoft.connected && !status?.google.connected ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Mail size={40} className="text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium mb-2">No email accounts connected</p>
                <p className="text-sm text-gray-400 mb-6 max-w-sm">
                  Connect your Outlook or Google account to import contacts as team members.
                  Go to Settings to connect your email first.
                </p>
              </div>
            ) : (
              <>
                {contacts.length > 0 && (
                  <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={selectAll}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                      >
                        {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-2">
                  {fetching ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      <span className="ml-3 text-gray-500 text-sm">Fetching contacts...</span>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Users size={32} className="text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500">
                        {search ? 'No contacts match your search' : 'No contacts found in this account'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filtered.map(contact => (
                        <label
                          key={contact.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            selected.has(contact.id)
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                            {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                            <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                          </div>
                          {(contact.company || contact.title) && (
                            <div className="text-right flex-shrink-0 hidden sm:block">
                              {contact.title && (
                                <p className="text-xs text-gray-500 truncate max-w-[160px]">{contact.title}</p>
                              )}
                              {contact.company && (
                                <p className="text-xs text-gray-400 truncate max-w-[160px] flex items-center gap-1 justify-end">
                                  <Building2 size={10} />
                                  {contact.company}
                                </p>
                              )}
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {contacts.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
                    <p className="text-sm text-gray-500">
                      {selected.size} of {filtered.length} selected
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={selected.size === 0 || importing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {importing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            Import {selected.size} Contact{selected.size !== 1 ? 's' : ''}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
