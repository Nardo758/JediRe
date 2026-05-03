/**
 * Email Viewer & Reply Modal
 * View full email and reply
 */

import { useState, useEffect } from 'react';
import { X, Reply, ReplyAll, Forward, Trash2, Loader, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

interface Email {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  receivedDateTime: string;
  bodyPreview: string;
  body?: {
    contentType: string;
    content: string;
  };
  hasAttachments: boolean;
  isRead: boolean;
}

interface EmailViewerProps {
  isOpen: boolean;
  emailId: string | null;
  onClose: () => void;
  apiUrl?: string;
  onLinkToProperty?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
}

export default function EmailViewer({
  isOpen,
  emailId,
  onClose,
  apiUrl = '/api/v1',
  onLinkToProperty,
  onDelete,
}: EmailViewerProps) {
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || '';
  };

  // Load email details
  const loadEmail = async () => {
    if (!emailId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${apiUrl}/microsoft/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      setEmail(response.data);
    } catch (err: any) {
      console.error('Error loading email:', err);
      setError(err.response?.data?.message || 'Failed to load email');
    } finally {
      setLoading(false);
    }
  };

  // Send reply
  const handleReply = async (replyAll: boolean = false) => {
    if (!emailId || !replyBody.trim()) return;

    try {
      setSending(true);
      setError(null);

      await axios.post(
        `${apiUrl}/microsoft/emails/${emailId}/reply`,
        {
          body: replyBody,
          replyAll,
        },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      // Success
      setShowReply(false);
      setReplyBody('');
      onClose();
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setError(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  // Delete email
  const handleDelete = async () => {
    if (!emailId || !confirm('Delete this email?')) return;

    try {
      await axios.delete(`${apiUrl}/microsoft/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      onDelete?.(emailId);
      onClose();
    } catch (err: any) {
      console.error('Error deleting email:', err);
      alert('Failed to delete email');
    }
  };

  useEffect(() => {
    if (isOpen && emailId) {
      loadEmail();
      setShowReply(false);
      setReplyBody('');
    }
  }, [isOpen, emailId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Email</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          ) : email ? (
            <>
              {/* Email Header */}
              <div className="p-6 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                  {email.subject || '(No subject)'}
                </h1>

                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-medium text-gray-600">
                        {email.from.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">{email.from.name}</p>
                      <p className="text-sm text-gray-600">{email.from.address}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(email.receivedDateTime).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {onLinkToProperty && (
                      <button
                        onClick={() => onLinkToProperty(email.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Link to property"
                      >
                        <LinkIcon className="w-5 h-5 text-gray-600" />
                      </button>
                    )}
                    <button
                      onClick={handleDelete}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="p-6">
                {email.body?.contentType === 'html' ? (
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: email.body.content }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-gray-700">
                    {email.body?.content || email.bodyPreview}
                  </div>
                )}
              </div>

              {/* Reply Section */}
              {showReply && (
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                  <textarea
                    id="email-reply-body"
                    name="replyBody"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your reply..."
                    rows={6}
                    aria-label="Reply message body"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-3"
                  />

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowReply(false)}
                      disabled={sending}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReply(false)}
                      disabled={sending || !replyBody.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {sending ? 'Sending...' : 'Reply'}
                    </button>
                    <button
                      onClick={() => handleReply(true)}
                      disabled={sending || !replyBody.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {sending ? 'Sending...' : 'Reply All'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {email && !showReply && (
          <div className="flex items-center gap-3 p-4 border-t border-gray-200">
            <button
              onClick={() => setShowReply(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
            <button
              onClick={() => setShowReply(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              <ReplyAll className="w-4 h-4" />
              Reply All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
