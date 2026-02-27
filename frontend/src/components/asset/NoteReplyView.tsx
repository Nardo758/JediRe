import { useState, useEffect } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { NoteReply, NotePermission } from '@/types/asset';

interface NoteReplyViewProps {
  noteId: string;
  permission: NotePermission;
}

// Mock replies - will be replaced with API calls
const mockReplies: NoteReply[] = [
  {
    id: 'reply-1',
    noteId: 'note-1',
    content: 'I checked this yesterday, contractor quoted $12K',
    author: {
      id: 'user-2',
      name: 'Jeremy Myers',
    },
    authorId: 'user-2',
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    isEdited: false,
  },
  {
    id: 'reply-2',
    noteId: 'note-1',
    content: "Good catch! Let's schedule this for Q2.",
    author: {
      id: 'user-3',
      name: 'Sarah Chen',
    },
    authorId: 'user-3',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    isEdited: false,
  },
];

export default function NoteReplyView({ noteId, permission }: NoteReplyViewProps) {
  const [replies, setReplies] = useState<NoteReply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    // TODO: Replace with API call
    const timer = setTimeout(() => {
      setReplies(mockReplies.filter((r) => r.noteId === noteId));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [noteId]);

  const handleSubmitReply = async () => {
    if (!newReply.trim() || permission === 'view') return;

    setIsSubmitting(true);
    // TODO: Replace with API call
    const reply: NoteReply = {
      id: `reply-${Date.now()}`,
      noteId,
      content: newReply.trim(),
      author: {
        id: 'current-user',
        name: 'You',
      },
      authorId: 'current-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
    };

    await new Promise((resolve) => setTimeout(resolve, 500));
    setReplies([...replies, reply]);
    setNewReply('');
    setIsSubmitting(false);
  };

  const handleEditReply = async (replyId: string) => {
    if (!editContent.trim()) return;

    // TODO: Replace with API call
    await new Promise((resolve) => setTimeout(resolve, 300));
    setReplies(
      replies.map((r) =>
        r.id === replyId
          ? { ...r, content: editContent.trim(), isEdited: true, updatedAt: new Date().toISOString() }
          : r
      )
    );
    setEditingId(null);
    setEditContent('');
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete this reply?')) return;

    // TODO: Replace with API call
    await new Promise((resolve) => setTimeout(resolve, 300));
    setReplies(replies.filter((r) => r.id !== replyId));
  };

  const startEdit = (reply: NoteReply) => {
    setEditingId(reply.id);
    setEditContent(reply.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Existing Replies */}
      {replies.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {replies.map((reply) => (
            <div key={reply.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-700">
                      {reply.author.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{reply.author.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(reply.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {reply.isEdited && <span className="ml-2 italic">(edited)</span>}
                    </p>
                  </div>
                </div>

                {/* Edit/Delete Actions */}
                {(permission === 'admin' || reply.authorId === 'current-user') && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(reply)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      aria-label="Edit reply"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteReply(reply.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      aria-label="Delete reply"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Reply Content */}
              {editingId === reply.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    rows={3}
                    maxLength={5000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{editContent.length}/5,000</span>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEditReply(reply.id)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-10">
                  {reply.content}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500 text-sm">
          No replies yet. Be the first to comment!
        </div>
      )}

      {/* Add Reply Form */}
      {permission !== 'view' && (
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-gray-600">You</span>
            </div>
            <div className="flex-1">
              <textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitReply();
                  }
                }}
                placeholder="Add a reply... (Ctrl+Enter to submit)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                rows={2}
                maxLength={5000}
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{newReply.length}/5,000 characters</span>
                <button
                  onClick={handleSubmitReply}
                  disabled={!newReply.trim() || isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-4 h-4" />
                      <span>Reply</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
