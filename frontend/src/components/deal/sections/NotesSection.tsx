/**
 * Notes Section - Dual-Mode (Acquisition & Performance)
 * 
 * Acquisition Mode: Deal notes, observations, follow-ups
 * Performance Mode: Property updates, maintenance notes, tenant issues
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionNotes,
  acquisitionCategories,
  acquisitionStats,
  performanceNotes,
  performanceCategories,
  performanceStats,
  Note,
  NoteCategory,
  NoteStats
} from '../../../data/notesMockData';

interface NotesSectionProps {
  deal: Deal;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);

  // Select data based on mode
  const notes = isPipeline ? acquisitionNotes : performanceNotes;
  const categories = isPipeline ? acquisitionCategories : performanceCategories;
  const stats = isPipeline ? acquisitionStats : performanceStats;

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);

  // Filter notes
  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchQuery === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
      note.category.toLowerCase().replace(/\s+/g, '-') === selectedCategory;
    
    const matchesPinned = !showPinnedOnly || note.isPinned;
    
    return matchesSearch && matchesCategory && matchesPinned;
  });

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {isPipeline ? '📝 Acquisition Notes' : '🏢 Property Activity Log'}
        </div>
        <div className="text-xs text-gray-500">
          {isPipeline ? 'Deal notes, observations, and follow-ups' : 'Property updates, maintenance, and tenant issues'}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Search, Filter & Actions Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search notes, tags, content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.label} ({cat.count})
              </option>
            ))}
          </select>

          {/* Pinned Filter */}
          <button
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showPinnedOnly
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            📌 Pinned {showPinnedOnly && '✓'}
          </button>

          {/* Add Note Button */}
          <button
            onClick={() => setShowAddNoteForm(!showAddNoteForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Note</span>
          </button>
        </div>

        {/* Category Quick Filters */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({notes.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? `bg-${cat.color}-600 text-white`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.icon} {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Add Note Form */}
      {showAddNoteForm && (
        <AddNoteForm 
          mode={mode} 
          categories={categories}
          onClose={() => setShowAddNoteForm(false)}
        />
      )}

      {/* Notes Feed */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-600 font-medium mb-2">No notes found</p>
            <p className="text-sm text-gray-500">
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Click "Add Note" to create your first note'
              }
            </p>
          </div>
        ) : (
          filteredNotes.map(note => (
            <NoteCard key={note.id} note={note} mode={mode} />
          ))
        )}
      </div>

      {/* Results Summary */}
      {filteredNotes.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {filteredNotes.length} of {notes.length} notes
        </div>
      )}

      {/* Cross-Tab Navigation */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Related Sections</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const element = document.getElementById('section-map-view');
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
          >
            🗺️ View on Map
          </button>
          <button
            onClick={() => {
              const element = document.getElementById('section-ai-agent');
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-4 py-2 text-sm font-medium text-purple-600 bg-white hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
          >
            🤖 Ask AI Agent
          </button>
          <button
            onClick={() => {
              const element = document.getElementById('section-context-tracker');
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
          >
            🧭 View Context
          </button>
          <button
            onClick={() => {
              const element = document.getElementById('section-documents');
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-4 py-2 text-sm font-medium text-green-600 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
          >
            📄 View Documents
          </button>
        </div>
      </div>

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: NoteStats[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            {stat.trend && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                stat.trend.direction === 'up' 
                  ? 'text-green-600' 
                  : stat.trend.direction === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}>
                <span>{stat.trend.direction === 'up' ? '↗' : stat.trend.direction === 'down' ? '↘' : '→'}</span>
                <span>{stat.trend.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface NoteCardProps {
  note: Note;
  mode: 'acquisition' | 'performance';
}

const NoteCard: React.FC<NoteCardProps> = ({ note, mode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(note.isPinned);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Deal Notes': 'blue',
      'Observations': 'purple',
      'Follow-Ups': 'orange',
      'Property Updates': 'green',
      'Maintenance Notes': 'blue',
      'Tenant Issues': 'orange'
    };
    return colors[category] || 'gray';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'note': '📝',
      'observation': '👁️',
      'follow-up': '⏰',
      'update': '🔄',
      'maintenance': '🔧',
      'tenant-issue': '👥'
    };
    return icons[type] || '📋';
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    
    const badges: Record<string, { color: string; label: string }> = {
      'high': { color: 'red', label: '🔴 High' },
      'medium': { color: 'yellow', label: '🟡 Medium' },
      'low': { color: 'gray', label: '⚪ Low' }
    };

    const badge = badges[priority];
    if (!badge) return null;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold bg-${badge.color}-100 text-${badge.color}-700`}>
        {badge.label}
      </span>
    );
  };

  const categoryColor = getCategoryColor(note.category);
  const shouldTruncate = note.content.length > 280;
  const displayContent = isExpanded || !shouldTruncate 
    ? note.content 
    : note.content.substring(0, 280) + '...';

  return (
    <div className={`bg-white border rounded-lg p-5 hover:shadow-md transition-all ${
      isPinned ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
    }`}>
      
      {/* Header */}
      <div className="flex items-start gap-4 mb-3">
        
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {note.authorAvatar}
          </div>
        </div>

        {/* Content Header */}
        <div className="flex-1 min-w-0">
          
          {/* Title Row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-base font-semibold text-gray-900 flex-1">
              {getTypeIcon(note.type)} {note.title}
            </h3>
            
            {/* Pin Button */}
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`flex-shrink-0 text-xl transition-all ${
                isPinned 
                  ? 'text-yellow-500 hover:text-yellow-600' 
                  : 'text-gray-300 hover:text-yellow-500'
              }`}
              title={isPinned ? 'Unpin note' : 'Pin note'}
            >
              📌
            </button>
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
            <span className="font-medium text-gray-700">{note.author}</span>
            <span>•</span>
            <span>{note.createdAt}</span>
            {note.updatedAt && (
              <>
                <span>•</span>
                <span>Edited {note.updatedAt}</span>
              </>
            )}
            {note.attachments && (
              <>
                <span>•</span>
                <span>📎 {note.attachments} attachment{note.attachments > 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold bg-${categoryColor}-100 text-${categoryColor}-700`}>
              {note.category}
            </span>
            {getPriorityBadge(note.priority)}
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
          {displayContent}
        </p>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
          >
            {isExpanded ? '← Show less' : 'Read more →'}
          </button>
        )}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {note.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Mentions */}
      {note.mentions && note.mentions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-200">
          <span className="text-xs text-gray-500">Mentioned:</span>
          {note.mentions.map((mention, index) => (
            <span
              key={index}
              className="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700"
            >
              @{mention}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1">
          <span>✏️</span>
          <span>Edit</span>
        </button>
        <button className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1">
          <span>💬</span>
          <span>Reply</span>
        </button>
        <button className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1">
          <span>🔗</span>
          <span>Share</span>
        </button>
        <button className="text-sm text-gray-600 hover:text-red-600 font-medium flex items-center gap-1">
          <span>🗑️</span>
          <span>Delete</span>
        </button>
      </div>

    </div>
  );
};

interface AddNoteFormProps {
  mode: 'acquisition' | 'performance';
  categories: NoteCategory[];
  onClose: () => void;
}

const AddNoteForm: React.FC<AddNoteFormProps> = ({ mode, categories, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: categories[0]?.id || '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    tags: '',
    isPinned: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission (would integrate with backend/state management)
    console.log('Note submitted:', formData);
    onClose();
  };

  return (
    <div className="bg-white border-2 border-blue-400 rounded-lg p-6 shadow-lg">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          ✍️ Add New Note
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter note title..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Content - Rich Text Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content *
          </label>
          
          {/* Rich Text Toolbar */}
          <div className="flex items-center gap-1 mb-2 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
            <button type="button" className="px-2 py-1 text-sm font-bold hover:bg-gray-200 rounded" title="Bold">
              B
            </button>
            <button type="button" className="px-2 py-1 text-sm italic hover:bg-gray-200 rounded" title="Italic">
              I
            </button>
            <button type="button" className="px-2 py-1 text-sm underline hover:bg-gray-200 rounded" title="Underline">
              U
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <button type="button" className="px-2 py-1 text-sm hover:bg-gray-200 rounded" title="Bullet List">
              • List
            </button>
            <button type="button" className="px-2 py-1 text-sm hover:bg-gray-200 rounded" title="Numbered List">
              1. List
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <button type="button" className="px-2 py-1 text-sm hover:bg-gray-200 rounded" title="Add Link">
              🔗
            </button>
            <button type="button" className="px-2 py-1 text-sm hover:bg-gray-200 rounded" title="Add Attachment">
              📎
            </button>
          </div>

          <textarea
            required
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Enter note content... (Markdown supported)"
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 rounded-b-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports markdown formatting, @mentions, and #tags
          </p>
        </div>

        {/* Category & Priority Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="high">🔴 High Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="low">⚪ Low Priority</option>
            </select>
          </div>

        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="Enter tags separated by commas (e.g., financing, urgent, follow-up)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Pin Checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pin-note"
            checked={formData.isPinned}
            onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="pin-note" className="text-sm text-gray-700">
            📌 Pin this note to the top
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Note
          </button>
        </div>

      </form>

    </div>
  );
};

export default NotesSection;
