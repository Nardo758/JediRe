/**
 * Email Inbox Component
 * Display and manage Outlook emails within JediRe
 */

import { useState, useEffect } from 'react';
import { 
  Mail, Search, RefreshCw, Inbox, Send, Archive, Trash2, 
  Star, Paperclip, ChevronRight, Loader, Link as LinkIcon,
  Building2, MapPin, CheckCircle, XCircle, Eye
} from 'lucide-react';
import axios from 'axios';
import ExtractionBadges from './ExtractionBadges';

interface Email {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  receivedDateTime: string;
  bodyPreview: string;
  hasAttachments: boolean;
  isRead: boolean;
  // Extraction data
  hasPropertyExtraction?: boolean;
  hasNewsExtraction?: boolean;
  propertyStatus?: 'auto-created' | 'requires-review' | 'rejected' | 'pending';
  extractionId?: string;
  pinId?: string;
}

interface EmailInboxProps {
  apiUrl?: string;
  onEmailSelect?: (email: Email) => void;
  onLinkToProperty?: (emailId: string) => void;
}

export default function EmailInbox({ 
  apiUrl = '/api/v1',
  onEmailSelect,
  onLinkToProperty
}: EmailInboxProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || '';
  };

  // Load inbox
  const loadInbox = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await axios.get(`${apiUrl}/microsoft/emails/inbox`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        params: {
          top: 50,
          skip: 0,
        },
      });

      setEmails(response.data.emails || []);
    } catch (err: any) {
      console.error('Error loading inbox:', err);
      setError(err.response?.data?.message || 'Failed to load emails');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Search emails
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadInbox();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${apiUrl}/microsoft/emails/search`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        params: {
          q: searchQuery,
          top: 50,
        },
      });

      setEmails(response.data.emails || []);
    } catch (err: any) {
      console.error('Error searching emails:', err);
      setError(err.response?.data?.message || 'Failed to search emails');
    } finally {
      setLoading(false);
    }
  };

  // Mark as read
  const markAsRead = async (emailId: string, isRead: boolean) => {
    try {
      await axios.patch(
        `${apiUrl}/microsoft/emails/${emailId}`,
        { isRead },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      // Update local state
      setEmails(prev =>
        prev.map(email =>
          email.id === emailId ? { ...email, isRead } : email
        )
      );
    } catch (err: any) {
      console.error('Error updating email:', err);
    }
  };

  // Delete email
  const deleteEmail = async (emailId: string) => {
    if (!confirm('Delete this email?')) return;

    try {
      await axios.delete(`${apiUrl}/microsoft/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      // Remove from local state
      setEmails(prev => prev.filter(email => email.id !== emailId));
    } catch (err: any) {
      console.error('Error deleting email:', err);
      alert('Failed to delete email');
    }
  };

  // Select email
  const handleEmailClick = (email: Email) => {
    setSelectedEmailId(email.id);
    if (!email.isRead) {
      markAsRead(email.id, true);
    }
    onEmailSelect?.(email);
  };

  // Load extraction data for emails
  const loadExtractionData = async (emailIds: string[]) => {
    try {
      // Batch fetch extractions for all emails
      const extractionPromises = emailIds.map(emailId =>
        axios.get(`${apiUrl}/email-extractions/${emailId}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        }).catch(() => null) // Ignore errors for individual emails
      );

      const extractionResults = await Promise.all(extractionPromises);

      // Update emails with extraction data
      setEmails(prev => prev.map((email, idx) => {
        const extraction = extractionResults[idx]?.data?.data;
        if (!extraction) return email;

        return {
          ...email,
          hasPropertyExtraction: extraction.propertyExtractions?.length > 0,
          hasNewsExtraction: !!extraction.newsExtraction,
          propertyStatus: extraction.propertyExtractions?.[0]?.status || 'pending',
          extractionId: extraction.propertyExtractions?.[0]?.id,
          pinId: extraction.propertyExtractions?.[0]?.pin_id,
        };
      }));
    } catch (err) {
      console.error('Error loading extraction data:', err);
    }
  };

  // Approve property extraction
  const approveExtraction = async (extractionId: string, emailId: string) => {
    try {
      const response = await axios.post(
        `${apiUrl}/email-extractions/properties/${extractionId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        }
      );

      // Update email status
      setEmails(prev => prev.map(email =>
        email.id === emailId
          ? { ...email, propertyStatus: 'auto-created', pinId: response.data.data.pinId }
          : email
      ));

      alert('Property pin created successfully!');
    } catch (err: any) {
      console.error('Error approving extraction:', err);
      alert(err.response?.data?.message || 'Failed to approve extraction');
    }
  };

  // Reject property extraction
  const rejectExtraction = async (extractionId: string, emailId: string) => {
    try {
      await axios.post(
        `${apiUrl}/email-extractions/properties/${extractionId}/reject`,
        { reason: 'User rejected from inbox' },
        {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        }
      );

      // Update email status
      setEmails(prev => prev.map(email =>
        email.id === emailId
          ? { ...email, propertyStatus: 'rejected' }
          : email
      ));
    } catch (err: any) {
      console.error('Error rejecting extraction:', err);
      alert(err.response?.data?.message || 'Failed to reject extraction');
    }
  };

  // View extraction details
  const viewExtractionDetails = (emailId: string) => {
    // Open modal or navigate to details page
    window.open(`/extractions/${emailId}`, '_blank');
  };

  // Load inbox on mount
  useEffect(() => {
    loadInbox();
  }, []);

  // Load extraction data when emails change
  useEffect(() => {
    if (emails.length > 0) {
      const emailIds = emails.map(e => e.id);
      loadExtractionData(emailIds);
    }
  }, [emails.length]);

  if (loading && emails.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Inbox</h2>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {emails.filter(e => !e.isRead).length} unread
            </span>
          </div>

          <button
            onClick={() => loadInbox(true)}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            id="inbox-search-emails"
            name="searchEmails"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search emails..."
            aria-label="Search emails"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Email List */}
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {emails.length === 0 ? (
          <div className="py-12 text-center">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? 'No emails found' : 'Your inbox is empty'}
            </p>
          </div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedEmailId === email.id ? 'bg-blue-50' : ''
              } ${!email.isRead ? 'bg-blue-50/30' : ''}`}
              onClick={() => handleEmailClick(email)}
            >
              <div className="flex items-start gap-3">
                {/* Avatar/Icon */}
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-gray-600">
                    {email.from.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`font-medium truncate ${!email.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                      {email.from.name}
                    </p>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {new Date(email.receivedDateTime).toLocaleDateString()}
                    </span>
                  </div>

                  <p className={`text-sm mb-1 truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {email.subject || '(No subject)'}
                  </p>

                  <p className="text-sm text-gray-500 line-clamp-2">
                    {email.bodyPreview}
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {email.hasAttachments && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Paperclip className="w-3 h-3" />
                        Attachment
                      </span>
                    )}
                    
                    {/* Extraction Badges */}
                    <ExtractionBadges
                      hasPropertyExtraction={email.hasPropertyExtraction || false}
                      hasNewsExtraction={email.hasNewsExtraction || false}
                      propertyStatus={email.propertyStatus}
                      compact
                    />
                  </div>

                  {/* Extraction Actions */}
                  {(email.hasPropertyExtraction || email.hasNewsExtraction) && (
                    <div className="flex items-center gap-2 mt-2">
                      {email.propertyStatus === 'requires-review' && email.extractionId && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              approveExtraction(email.extractionId!, email.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors"
                            title="Approve and create pin"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectExtraction(email.extractionId!, email.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                            title="Reject extraction"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}
                      {email.pinId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/map?pin=${email.pinId}`, '_blank');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
                          title="View on map"
                        >
                          <MapPin className="w-3 h-3" />
                          View
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewExtractionDetails(email.id);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded transition-colors"
                        title="View extraction details"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onLinkToProperty && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLinkToProperty(email.id);
                      }}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                      title="Link to property"
                    >
                      <LinkIcon className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEmail(email.id);
                    }}
                    className="p-1.5 hover:bg-red-100 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
