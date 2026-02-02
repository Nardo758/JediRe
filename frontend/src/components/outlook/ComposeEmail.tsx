/**
 * Compose Email Modal
 * Send new emails from within JediRe
 */

import { useState } from 'react';
import { X, Send, Paperclip, Loader } from 'lucide-react';
import axios from 'axios';

interface ComposeEmailProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl?: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSent?: () => void;
}

export default function ComposeEmail({
  isOpen,
  onClose,
  apiUrl = '/api/v1',
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  onSent,
}: ComposeEmailProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCc, setShowCc] = useState(false);

  const getAuthToken = () => {
    return localStorage.getItem('jwt_token') || '';
  };

  const handleSend = async () => {
    // Validation
    if (!to.trim()) {
      setError('Recipient email is required');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const payload: any = {
        to: to.split(',').map(email => email.trim()),
        subject: subject.trim(),
        body,
        bodyType: 'html',
      };

      if (cc.trim()) {
        payload.cc = cc.split(',').map(email => email.trim());
      }

      await axios.post(
        `${apiUrl}/microsoft/emails/send`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Success
      onSent?.();
      handleClose();
    } catch (err: any) {
      console.error('Error sending email:', err);
      setError(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setTo(defaultTo);
    setCc('');
    setSubject(defaultSubject);
    setBody(defaultBody);
    setError(null);
    setShowCc(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              multiple
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple emails with commas
            </p>
          </div>

          {/* CC (conditional) */}
          {showCc ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CC
              </label>
              <input
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowCc(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add CC
            </button>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Attach file (Coming soon)"
              disabled
            >
              <Paperclip className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={sending}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              {sending ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
