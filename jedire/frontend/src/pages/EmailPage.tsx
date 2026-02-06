/**
 * Email Management Page
 * Full-featured email interface using Outlook integration
 */

import { useState } from 'react';
import { Mail, Plus } from 'lucide-react';
import { 
  OutlookConnect, 
  EmailInbox, 
  ComposeEmail, 
  EmailViewer 
} from '../components/outlook';

export default function EmailPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const handleEmailSelect = (email: any) => {
    setSelectedEmailId(email.id);
    setViewerOpen(true);
  };

  const handleLinkToProperty = (emailId: string) => {
    // TODO: Implement property linking modal
    alert(`Link email ${emailId} to property (feature coming soon)`);
  };

  const handleEmailDeleted = (emailId: string) => {
    setViewerOpen(false);
    setSelectedEmailId(null);
    // Inbox will automatically refresh
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Email</h1>
                <p className="text-sm text-gray-600">
                  Manage property communications from Outlook
                </p>
              </div>
            </div>

            {isConnected && (
              <button
                onClick={() => setComposeOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Email
              </button>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <OutlookConnect onStatusChange={setIsConnected} />
        </div>

        {/* Email Inbox (only show if connected) */}
        {isConnected && (
          <EmailInbox 
            onEmailSelect={handleEmailSelect}
            onLinkToProperty={handleLinkToProperty}
          />
        )}

        {/* Modals */}
        <ComposeEmail
          isOpen={composeOpen}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            // Could trigger inbox refresh here
          }}
        />

        <EmailViewer
          isOpen={viewerOpen}
          emailId={selectedEmailId}
          onClose={() => {
            setViewerOpen(false);
            setSelectedEmailId(null);
          }}
          onLinkToProperty={handleLinkToProperty}
          onDelete={handleEmailDeleted}
        />
      </div>
    </div>
  );
}
