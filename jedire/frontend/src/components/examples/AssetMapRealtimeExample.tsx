/**
 * Example: Asset Map with Real-Time Updates
 * Demonstrates how to use useAssetUpdates hook
 */

import React, { useState, useEffect } from 'react';
import { useAssetUpdates } from '../../hooks/useAssetUpdates';

interface Note {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar?: string;
  };
  createdAt: string;
  replyCount: number;
}

interface AssetMapRealtimeExampleProps {
  assetId: string;
}

export function AssetMapRealtimeExample({ assetId }: AssetMapRealtimeExampleProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time updates
  const { isConnected, isSubscribed, activeConnections, refreshActiveConnections } = useAssetUpdates({
    assetId,
    enabled: true,

    // Handle note created
    onNoteCreated: (data) => {
      console.log('Note created:', data);
      setNotes((prev) => [data.note, ...prev]);
    },

    // Handle note updated
    onNoteUpdated: (data) => {
      console.log('Note updated:', data);
      setNotes((prev) =>
        prev.map((note) =>
          note.id === data.noteId
            ? { ...note, ...data.changes }
            : note
        )
      );
    },

    // Handle note deleted
    onNoteDeleted: (data) => {
      console.log('Note deleted:', data);
      setNotes((prev) => prev.filter((note) => note.id !== data.noteId));
    },

    // Handle reply created
    onReplyCreated: (data) => {
      console.log('Reply created:', data);
      setNotes((prev) =>
        prev.map((note) =>
          note.id === data.noteId
            ? { ...note, replyCount: (note.replyCount || 0) + 1 }
            : note
        )
      );
    },

    // Handle news linked
    onNewsLinked: (data) => {
      console.log('News linked:', data);
      // Could update a separate news list here
    },

    // Show toast notifications
    showToasts: true,
  });

  // Fetch initial notes
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/v1/assets/${assetId}/notes`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await response.json();
        setNotes(data.notes);
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [assetId]);

  // Refresh active connections every 30 seconds
  useEffect(() => {
    if (!isSubscribed) return;

    const interval = setInterval(() => {
      refreshActiveConnections();
    }, 30000);

    return () => clearInterval(interval);
  }, [isSubscribed, refreshActiveConnections]);

  if (loading) {
    return <div className="p-4">Loading notes...</div>;
  }

  return (
    <div className="p-4">
      {/* Connection Status */}
      <div className="mb-4 flex items-center justify-between bg-gray-100 p-3 rounded-lg">
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {isSubscribed && (
          <div className="text-sm text-gray-600">
            {activeConnections} viewer{activeConnections !== 1 ? 's' : ''} online
          </div>
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Asset Notes ({notes.length})</h2>

        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No notes yet. Add one to get started!
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Note Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {note.author.avatar ? (
                    <img
                      src={note.author.avatar}
                      alt={note.author.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                      {note.author.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{note.author.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {note.replyCount > 0 && (
                  <div className="text-sm text-gray-600">
                    💬 {note.replyCount} {note.replyCount === 1 ? 'reply' : 'replies'}
                  </div>
                )}
              </div>

              {/* Note Content */}
              {note.title && (
                <h3 className="font-semibold mb-1">{note.title}</h3>
              )}
              <p className="text-gray-700">{note.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add Note Button */}
      <button
        className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        onClick={() => {
          // Open add note modal
          console.log('Add note clicked');
        }}
      >
        + Add Note
      </button>
    </div>
  );
}

export default AssetMapRealtimeExample;
