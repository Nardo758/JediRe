import { useState } from 'react';
import { XMarkIcon, LinkIcon } from '@heroicons/react/24/outline';
import type { AssetNewsLink } from '@/types/asset';
import { cn } from '@/utils/cn';

interface NewsEventPopupProps {
  newsLink: AssetNewsLink;
  onClose: () => void;
  onDismiss: () => void;
  canDismiss?: boolean;
}

const NEWS_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  employment: { label: 'Employment', emoji: '💼' },
  development: { label: 'Development', emoji: '🏗️' },
  infrastructure: { label: 'Infrastructure', emoji: '🚇' },
  transaction: { label: 'Transaction', emoji: '💰' },
  regulatory: { label: 'Regulatory', emoji: '📋' },
  demographic: { label: 'Demographic', emoji: '👥' },
};

export default function NewsEventPopup({
  newsLink,
  onClose,
  onDismiss,
  canDismiss = false,
}: NewsEventPopupProps) {
  const [userNote, setUserNote] = useState(newsLink.userNotes || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const newsEvent = newsLink.newsEvent;
  if (!newsEvent) return null;

  const impactScore = newsLink.impactScore || newsEvent.impactScore || 0;
  const impactLevel = impactScore >= 7 ? 'high' : impactScore >= 4 ? 'medium' : 'low';
  const impactColor =
    impactLevel === 'high' ? 'text-red-600' : impactLevel === 'medium' ? 'text-yellow-600' : 'text-gray-600';

  const typeInfo = NEWS_TYPE_LABELS[newsEvent.type] || { label: newsEvent.type, emoji: '📰' };

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    // TODO: Replace with API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSavingNote(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <span>{typeInfo.emoji}</span>
              <span>{typeInfo.label}</span>
            </div>
            <h2 className="text-xl font-bold text-white pr-8">{newsEvent.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">📍 Distance</span>
              <p className="font-semibold text-gray-900">
                {newsLink.distanceMiles?.toFixed(1)} miles{' '}
                {newsLink.distanceMiles && newsLink.distanceMiles < 2 ? 'away' : ''}
              </p>
            </div>
            <div>
              <span className="text-gray-500">📅 Date</span>
              <p className="font-semibold text-gray-900">
                {new Date(newsEvent.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Impact Score */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Expected Impact</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-1 rounded-full uppercase',
                    impactLevel === 'high' && 'bg-red-100 text-red-700',
                    impactLevel === 'medium' && 'bg-yellow-100 text-yellow-700',
                    impactLevel === 'low' && 'bg-gray-100 text-gray-700'
                  )}
                >
                  {impactLevel}
                </span>
                <span className={cn('text-2xl font-bold', impactColor)}>{impactScore}/10</span>
              </div>
            </div>
            {newsEvent.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{newsEvent.description}</p>
            )}
          </div>

          {/* Link Type Badge */}
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              Linked:{' '}
              <span className="font-semibold">
                {newsLink.linkType === 'auto' ? 'Automatically' : 'Manually'}
              </span>
            </span>
            {newsLink.linkedAt && (
              <span className="text-gray-400">
                on{' '}
                {new Date(newsLink.linkedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* User Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💬 Your Notes
            </label>
            <textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="Add your thoughts on how this impacts your asset..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
            {userNote !== (newsLink.userNotes || '') && (
              <button
                onClick={handleSaveNote}
                disabled={isSavingNote}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {isSavingNote ? 'Saving...' : 'Save Note'}
              </button>
            )}
          </div>

          {/* External Link */}
          {newsEvent.url && (
            <a
              href={newsEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Full Article →
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Close
          </button>
          {canDismiss && newsLink.linkType === 'auto' && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              ✕ Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
