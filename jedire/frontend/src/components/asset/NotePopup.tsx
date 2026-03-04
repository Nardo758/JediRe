import { useState, useEffect } from 'react';
import { XMarkIcon, ChatBubbleLeftIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import type { AssetNote, NotePermission } from '@/types/asset';
import NoteReplyView from './NoteReplyView';
import { cn } from '@/utils/cn';

interface NotePopupProps {
  note: AssetNote;
  onClose: () => void;
  permission: NotePermission;
}

export default function NotePopup({ note, onClose, permission }: NotePopupProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content);

  const canEdit = permission === 'admin' || (permission === 'edit' && note.authorId === 'current-user');

  useEffect(() => {
    // Auto-expand replies if note has them
    if (note.replyCount > 0) {
      setShowReplies(true);
    }
  }, [note.replyCount]);

  const handleSaveEdit = () => {
    // TODO: Replace with API call
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-start justify-between"
          style={{ backgroundColor: note.category?.color || '#F59E0B' }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white/90 text-sm mb-1">
              <span>{note.category?.icon || '📝'}</span>
              <span>{note.category?.name || 'Note'}</span>
              <span>•</span>
              <span>{note.author.name}</span>
              <span>•</span>
              <span>
                {new Date(note.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {note.title && (
              <h2 className="text-xl font-bold text-white pr-8">{note.title}</h2>
            )}
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
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Main Note Content */}
          <div className="p-6 border-b border-gray-200">
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={5}
                  maxLength={5000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {editedContent.length}/5,000 characters
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditedContent(note.content);
                        setIsEditing(false);
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                )}
              </>
            )}

            {/* Attachments */}
            {note.attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                  <PaperClipIcon className="w-4 h-4" />
                  Attachments ({note.attachments.length})
                </h3>
                <div className="space-y-2">
                  {note.attachments.map((attachment, idx) => (
                    <a
                      key={idx}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(attachment.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <span className="text-blue-600 group-hover:text-blue-700 text-sm">
                        View →
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Location Info */}
            {note.location && (
              <div className="mt-4 text-sm text-gray-600">
                📍 {note.location.lat.toFixed(6)}, {note.location.lng.toFixed(6)}
              </div>
            )}

            {/* Privacy Badge */}
            {note.isPrivate && (
              <div className="mt-4">
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  🔒 Private
                </span>
              </div>
            )}
          </div>

          {/* Replies Section */}
          <div className="bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChatBubbleLeftIcon className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-900">
                  {note.replyCount} {note.replyCount === 1 ? 'Reply' : 'Replies'}
                </span>
              </div>
              <span className={cn('text-gray-500 transition-transform', showReplies && 'rotate-180')}>
                ▼
              </span>
            </button>

            {showReplies && (
              <div className="border-t border-gray-200">
                <NoteReplyView noteId={note.id} permission={permission} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Close
          </button>
          {permission !== 'view' && (
            <button
              onClick={() => setShowReplies(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
