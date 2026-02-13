/**
 * Saved Drawings Panel
 * Manage user's saved map annotations and team shared drawings
 */

import { useState } from 'react';
import {
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ShareIcon,
  PencilIcon,
  UserGroupIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

export interface MapAnnotation {
  id: string;
  user_id: string;
  user_name?: string;
  title: string;
  description?: string;
  geojson: any; // GeoJSON feature collection
  color: string;
  is_shared: boolean;
  shared_with_team: boolean;
  created_at: string;
  updated_at: string;
}

interface SavedDrawingsPanelProps {
  drawings: MapAnnotation[];
  onToggleVisibility: (id: string, visible: boolean) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onLoadDrawing: (id: string) => void;
  onClose: () => void;
  currentUserId?: string;
}

export default function SavedDrawingsPanel({
  drawings,
  onToggleVisibility,
  onDelete,
  onShare,
  onRename,
  onLoadDrawing,
  onClose,
  currentUserId,
}: SavedDrawingsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredDrawings = drawings.filter((drawing) => {
    if (filter === 'mine') return drawing.user_id === currentUserId;
    if (filter === 'shared') return drawing.shared_with_team && drawing.user_id !== currentUserId;
    return true;
  });

  const myDrawings = drawings.filter(d => d.user_id === currentUserId);
  const sharedDrawings = drawings.filter(d => d.shared_with_team && d.user_id !== currentUserId);

  const handleRename = (id: string) => {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
      setEditingId(null);
      setEditTitle('');
    }
  };

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const getFeatureCount = (geojson: any): number => {
    return geojson?.features?.length || 0;
  };

  const getFeatureTypes = (geojson: any): string[] => {
    const types = new Set<string>();
    geojson?.features?.forEach((f: any) => {
      if (f.geometry?.type) {
        types.add(f.geometry.type);
      }
    });
    return Array.from(types);
  };

  return (
    <div className="absolute top-4 right-80 bg-white rounded-xl shadow-2xl w-80 max-h-[calc(100vh-8rem)] overflow-hidden z-20 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Saved Drawings</h3>
          <p className="text-xs text-purple-100 mt-0.5">
            {myDrawings.length} yours • {sharedDrawings.length} shared
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          All ({drawings.length})
        </button>
        <button
          onClick={() => setFilter('mine')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            filter === 'mine'
              ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <div className="flex items-center justify-center gap-1">
            <UserIcon className="w-4 h-4" />
            <span>Mine ({myDrawings.length})</span>
          </div>
        </button>
        <button
          onClick={() => setFilter('shared')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            filter === 'shared'
              ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <div className="flex items-center justify-center gap-1">
            <UserGroupIcon className="w-4 h-4" />
            <span>Shared ({sharedDrawings.length})</span>
          </div>
        </button>
      </div>

      {/* Drawings List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredDrawings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <PencilIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm">
              {filter === 'mine' && 'No drawings yet'}
              {filter === 'shared' && 'No shared drawings'}
              {filter === 'all' && 'No drawings available'}
            </p>
            <p className="text-xs mt-1">
              Use drawing tools to create annotations
            </p>
          </div>
        ) : (
          filteredDrawings.map((drawing) => {
            const isOwner = drawing.user_id === currentUserId;
            const featureCount = getFeatureCount(drawing.geojson);
            const featureTypes = getFeatureTypes(drawing.geojson);
            const isEditing = editingId === drawing.id;

            return (
              <div
                key={drawing.id}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors"
              >
                {/* Title */}
                <div className="flex items-start justify-between mb-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleRename(drawing.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(drawing.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: drawing.color }}
                        />
                        <h4 className="font-medium text-gray-900 text-sm">
                          {drawing.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {drawing.user_name || 'User'}
                        </span>
                        {drawing.shared_with_team && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <UserGroupIcon className="w-3 h-3" />
                            Shared
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggleVisibility(drawing.id, true)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Toggle visibility"
                      >
                        <EyeIcon className="w-4 h-4 text-gray-600" />
                      </button>
                      {isOwner && (
                        <>
                          <button
                            onClick={() => startEdit(drawing.id, drawing.title)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Rename"
                          >
                            <PencilIcon className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => onShare(drawing.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Share with team"
                          >
                            <ShareIcon className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this drawing?')) {
                                onDelete(drawing.id);
                              }
                            }}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4 text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                {drawing.description && (
                  <p className="text-xs text-gray-600 mb-2">
                    {drawing.description}
                  </p>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span>{featureCount} shapes</span>
                    <span>•</span>
                    <span>{featureTypes.join(', ')}</span>
                  </div>
                  <button
                    onClick={() => onLoadDrawing(drawing.id)}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Load
                  </button>
                </div>

                {/* Date */}
                <div className="text-xs text-gray-400 mt-1">
                  Updated {new Date(drawing.updated_at).toLocaleDateString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
