import React, { useState } from 'react';
import { X, Share2, CheckCircle, Copy, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface ShareCapsuleModalProps {
  capsuleId: string;
  propertyAddress: string;
  onClose: () => void;
  onShareCreated?: () => void;
}

interface ShareResult {
  capsule_url: string;
  access_token: string;
  recipient_email: string;
  share_type: string;
  share_id: string;
}

const ShareCapsuleModal: React.FC<ShareCapsuleModalProps> = ({
  capsuleId,
  propertyAddress,
  onClose,
  onShareCreated,
}) => {
  const [shareForm, setShareForm] = useState({
    recipient_email: '',
    recipient_name: '',
    share_type: 'external_agent_enabled' as 'external_view' | 'external_agent_enabled',
    preview_text: '',
    expires_at: '',
  });
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareLoading(true);
    setShareError(null);
    try {
      const payload: Record<string, unknown> = {
        recipient_email: shareForm.recipient_email,
        share_type: shareForm.share_type,
      };
      if (shareForm.recipient_name.trim()) payload.recipient_name = shareForm.recipient_name.trim();
      if (shareForm.preview_text.trim()) payload.preview_text = shareForm.preview_text.trim();
      if (shareForm.expires_at) payload.expires_at = shareForm.expires_at;
      const res = await apiClient.post(`/api/v1/deals/${capsuleId}/share/external`, payload);
      setShareResult(res.data);
      onShareCreated?.();
    } catch (err: any) {
      setShareError(err.response?.data?.error ?? err.message ?? 'Failed to create share');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.capsule_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Share Capsule</h2>
            <p className="text-sm text-gray-500 mt-0.5">{propertyAddress}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {shareResult ? (
          <div className="px-6 py-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Share created — send this link to {shareResult.recipient_email}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Capsule Link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareResult.capsule_url}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 font-mono"
                />
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Share Type</div>
                <div className="font-medium text-gray-700">
                  {shareResult.share_type === 'external_agent_enabled' ? 'Agent Enabled' : 'View Only'}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Share ID</div>
                <div className="font-mono text-xs text-gray-600 truncate">{shareResult.share_id}</div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => setShareResult(null)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share Again
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={shareForm.recipient_email}
                onChange={e => setShareForm(f => ({ ...f, recipient_email: e.target.value }))}
                placeholder="investor@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
              <input
                type="text"
                value={shareForm.recipient_name}
                onChange={e => setShareForm(f => ({ ...f, recipient_name: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Share Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'external_agent_enabled', label: 'Agent Enabled', desc: 'Recipient can query AI with their own API key' },
                  { value: 'external_view', label: 'View Only', desc: 'Read-only access, no agent interaction' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${shareForm.share_type === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="radio"
                      name="share_type"
                      value={opt.value}
                      checked={shareForm.share_type === opt.value}
                      onChange={() => setShareForm(f => ({ ...f, share_type: opt.value as typeof f.share_type }))}
                      className="sr-only"
                    />
                    <span className={`text-sm font-medium ${shareForm.share_type === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                    <span className={`text-xs leading-snug ${shareForm.share_type === opt.value ? 'text-blue-600' : 'text-gray-400'}`}>{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preview Pitch <span className="text-gray-400 font-normal">(optional, max 500 chars)</span>
              </label>
              <textarea
                value={shareForm.preview_text}
                onChange={e => setShareForm(f => ({ ...f, preview_text: e.target.value.slice(0, 500) }))}
                placeholder="Short note to the recipient about this deal…"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="text-xs text-gray-400 text-right mt-0.5">{shareForm.preview_text.length}/500</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires On <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={shareForm.expires_at}
                onChange={e => setShareForm(f => ({ ...f, expires_at: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {shareError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {shareError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={shareLoading || !shareForm.recipient_email}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {shareLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                ) : (
                  <><ExternalLink className="w-4 h-4" /> Create Share Link</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export { ShareCapsuleModal };
export default ShareCapsuleModal;
