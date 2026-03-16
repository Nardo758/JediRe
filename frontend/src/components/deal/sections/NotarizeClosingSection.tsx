import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';
import {
  FileSignature, Send, X, CheckCircle, AlertCircle, Clock,
  UserCheck, Shield, Download, RefreshCw, Plus, Trash2
} from 'lucide-react';

interface NotarizeSigner {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  status?: string;
  kba_verified?: boolean;
  id_verified?: boolean;
  signed_at?: string;
}

interface NotarizeSession {
  id: string;
  status: string;
  provider: string;
  document_names: string[];
  signer_count: number;
  signers_verified: number;
  signers_completed: number;
  notary_name?: string;
  notary_state?: string;
  initiated_at: string;
  completed_at?: string;
  cancelled_at?: string;
  error_message?: string;
  certificate_url?: string;
}

interface DealFile {
  id: string;
  original_filename: string;
  filename: string;
  category?: string;
  file_size?: number;
}

interface NotarizeClosingSectionProps {
  dealId?: string;
  deal?: any;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-slate-600', bg: 'bg-slate-100', icon: <Clock size={12} />, label: 'Draft' },
  initiated: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Send size={12} />, label: 'Initiated' },
  in_progress: { color: 'text-amber-600', bg: 'bg-amber-100', icon: <UserCheck size={12} />, label: 'In Progress' },
  completed: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle size={12} />, label: 'Completed' },
  cancelled: { color: 'text-slate-500', bg: 'bg-slate-100', icon: <X size={12} />, label: 'Cancelled' },
  failed: { color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle size={12} />, label: 'Failed' },
  provider_error: { color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle size={12} />, label: 'Provider Error' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotarizeClosingSection({ dealId, deal }: NotarizeClosingSectionProps) {
  const [session, setSession] = useState<NotarizeSession | null>(null);
  const [signers, setSigners] = useState<NotarizeSigner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInitiate, setShowInitiate] = useState(false);
  const [files, setFiles] = useState<DealFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [newSigners, setNewSigners] = useState<NotarizeSigner[]>([{ name: '', email: '', role: 'signer' }]);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dId = dealId || deal?.id;

  const fetchStatus = useCallback(async () => {
    if (!dId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/v1/deals/${dId}/notarize/status`) as any;
      const data = res?.data || res;
      setSession(data?.session || null);
      setSigners(data?.signers || []);
    } catch {
      setSession(null);
      setSigners([]);
    } finally {
      setLoading(false);
    }
  }, [dId]);

  const fetchFiles = useCallback(async () => {
    if (!dId) return;
    try {
      const res = await apiClient.get(`/api/v1/deals/${dId}/files`) as any;
      const data = res?.data?.files || res?.data || [];
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      setFiles([]);
    }
  }, [dId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const handleInitiateOpen = async () => {
    await fetchFiles();
    setShowInitiate(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (selectedFileIds.length === 0) {
      setError('Select at least one document');
      return;
    }
    const validSigners = newSigners.filter(s => s.name && s.email);
    if (validSigners.length === 0) {
      setError('Add at least one signer');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/deals/${dId}/notarize`, {
        document_ids: selectedFileIds,
        signers: validSigners.map(s => ({
          name: s.name,
          email: s.email,
          phone: s.phone || undefined,
          role: s.role || 'signer',
        })),
      });
      setShowInitiate(false);
      setSelectedFileIds([]);
      setNewSigners([{ name: '', email: '', role: 'signer' }]);
      await fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to initiate notarization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel the active notarization session?')) return;
    try {
      await apiClient.post(`/api/v1/deals/${dId}/notarize/cancel`, { reason: 'Cancelled by user' });
      await fetchStatus();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel session');
    }
  };

  const handleDownloadCertificate = async () => {
    try {
      const res = await apiClient.get(`/api/v1/deals/${dId}/notarize/certificate`) as any;
      const data = res?.data || res;
      if (data?.certificateUrl) {
        window.open(data.certificateUrl, '_blank');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to get certificate');
    }
  };

  const addSigner = () => setNewSigners(prev => [...prev, { name: '', email: '', role: 'signer' }]);
  const removeSigner = (idx: number) => setNewSigners(prev => prev.filter((_, i) => i !== idx));
  const updateSigner = (idx: number, field: string, value: string) => {
    setNewSigners(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const toggleFile = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  if (!dId) return null;

  const statusCfg = STATUS_CONFIG[session?.status || ''] || STATUS_CONFIG.draft;
  const hasActiveSession = session && !['completed', 'cancelled', 'failed'].includes(session.status);

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature size={16} className="text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700">Remote Online Notarization</span>
          {session && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <button onClick={handleRefresh} disabled={refreshing} className="p-1 text-slate-400 hover:text-slate-600">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
          {!hasActiveSession && (
            <button
              onClick={handleInitiateOpen}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
            >
              <Send size={12} /> Send to Notarize
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : session ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Documents</div>
              <div className="text-lg font-bold text-slate-900">{session.document_names?.length || 0}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {session.document_names?.slice(0, 2).join(', ')}
                {(session.document_names?.length || 0) > 2 && ` +${session.document_names.length - 2}`}
              </div>
            </div>
            <div className="bg-slate-50 rounded p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Signers</div>
              <div className="text-lg font-bold text-slate-900">
                {session.signers_verified || 0}<span className="text-sm text-slate-400">/{session.signer_count}</span>
              </div>
              <div className="text-[10px] text-slate-400">verified</div>
            </div>
            <div className="bg-slate-50 rounded p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Status</div>
              <div className={`text-sm font-bold ${statusCfg.color}`}>{statusCfg.label}</div>
              <div className="text-[10px] text-slate-400">{timeAgo(session.initiated_at)}</div>
            </div>
          </div>

          {signers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Signers</div>
              <div className="space-y-1.5">
                {signers.map((s, i) => (
                  <div key={s.id || i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                        s.status === 'completed' ? 'bg-green-500' : s.kba_verified ? 'bg-amber-500' : 'bg-slate-300'
                      }`}>
                        {s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-700">{s.name}</div>
                        <div className="text-slate-400">{s.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.kba_verified && (
                        <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Shield size={8} /> KBA
                        </span>
                      )}
                      {s.id_verified && (
                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <UserCheck size={8} /> ID
                        </span>
                      )}
                      {s.status === 'completed' ? (
                        <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <CheckCircle size={8} /> Signed
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                          {s.status || 'pending'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.notary_name && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-indigo-50 px-3 py-2 rounded">
              <Shield size={12} className="text-indigo-600" />
              <span>Notary: <strong>{session.notary_name}</strong></span>
              {session.notary_state && <span className="text-slate-400">({session.notary_state})</span>}
            </div>
          )}

          {session.error_message && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{session.error_message}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {session.status === 'completed' && (
              <button
                onClick={handleDownloadCertificate}
                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <Download size={12} /> Download Certificate
              </button>
            )}
            {hasActiveSession && (
              <button
                onClick={handleCancel}
                className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-1"
              >
                <X size={12} /> Cancel Session
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <FileSignature size={24} className="text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500 mb-1">No notarization sessions</p>
          <p className="text-[10px] text-slate-400">Select documents from Files and send to Notarize for remote online notarization.</p>
        </div>
      )}

      {showInitiate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Initiate Notarization</h2>
              </div>
              <button onClick={() => setShowInitiate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Select Documents</label>
                {files.length === 0 ? (
                  <p className="text-xs text-slate-400">No documents uploaded yet. Upload documents in the Files section first.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {files.map(f => (
                      <label key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-xs ${
                        selectedFileIds.includes(f.id) ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                      }`}>
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(f.id)}
                          onChange={() => toggleFile(f.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="truncate text-slate-700">{f.original_filename || f.filename}</span>
                        {f.category && <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{f.category}</span>}
                      </label>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-1">{selectedFileIds.length} selected</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Signers</label>
                <div className="space-y-2">
                  {newSigners.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Full name"
                        value={s.name}
                        onChange={e => updateSigner(i, 'name', e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={s.email}
                        onChange={e => updateSigner(i, 'email', e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <select
                        value={s.role || 'signer'}
                        onChange={e => updateSigner(i, 'role', e.target.value)}
                        className="text-xs px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="signer">Signer</option>
                        <option value="witness">Witness</option>
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                      </select>
                      {newSigners.length > 1 && (
                        <button onClick={() => removeSigner(i)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addSigner}
                  className="mt-2 text-[10px] text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                >
                  <Plus size={10} /> Add signer
                </button>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[10px] text-slate-400">
                Powered by Notarize.com &middot; FL HB 409 RON compliant
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInitiate(false)}
                  className="text-xs px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || selectedFileIds.length === 0}
                  className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                  {submitting ? 'Sending...' : 'Initiate RON Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotarizeClosingSection;
