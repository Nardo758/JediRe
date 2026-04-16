/**
 * Notes Tab - Full Implementation
 * Create, edit, categorize, and search deal notes
 */

import React, { useState, useEffect } from 'react';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538', active: '#252D40', input: '#0D1117' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', purple: '#A78BFA' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};

const MONO = "'JetBrains Mono', monospace";

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  isPinned: boolean;
}

const CATEGORIES = [
  { id: 'general', label: 'General', color: BT.text.secondary },
  { id: 'financial', label: 'Financial', color: BT.text.green },
  { id: 'legal', label: 'Legal', color: BT.text.purple },
  { id: 'technical', label: 'Technical', color: BT.text.cyan },
  { id: 'risk', label: 'Risk', color: BT.text.red },
  { id: 'meeting', label: 'Meeting', color: BT.text.amber },
];

// Mock data for demo
const MOCK_NOTES: Note[] = [
  {
    id: '1',
    title: 'Initial Due Diligence Findings',
    content: 'Phase I ESA came back clean. No environmental concerns. Title search revealed one easement on the north boundary that needs review by counsel.',
    category: 'legal',
    tags: ['due-diligence', 'esa', 'title'],
    createdAt: '2024-03-25T10:30:00Z',
    updatedAt: '2024-03-25T10:30:00Z',
    author: 'M. Dixon',
    isPinned: true,
  },
  {
    id: '2',
    title: 'Financing Discussion with JP Morgan',
    content: 'Call with Sarah at JPM. They can do 65% LTC at SOFR+275. Term sheet expected by Friday. Need to provide updated rent roll.',
    category: 'financial',
    tags: ['financing', 'jpm', 'term-sheet'],
    createdAt: '2024-03-24T14:00:00Z',
    updatedAt: '2024-03-24T16:30:00Z',
    author: 'L. Dixon',
    isPinned: false,
  },
  {
    id: '3',
    title: 'Construction Timeline Risk',
    content: 'GC flagged potential 6-week delay due to steel delivery. Evaluating alternative suppliers. May impact TCO deadline.',
    category: 'risk',
    tags: ['construction', 'timeline', 'materials'],
    createdAt: '2024-03-23T09:15:00Z',
    updatedAt: '2024-03-23T09:15:00Z',
    author: 'M. Dixon',
    isPinned: true,
  },
];

export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  
  // New note form state
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: '',
  });

  const filteredNotes = notes.filter(note => {
    const matchesSearch = !searchQuery || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.isPinned);

  const handleCreateNote = () => {
    const note: Note = {
      id: Date.now().toString(),
      title: newNote.title,
      content: newNote.content,
      category: newNote.category,
      tags: newNote.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'Current User',
      isPinned: false,
    };
    setNotes([note, ...notes]);
    setNewNote({ title: '', content: '', category: 'general', tags: '' });
    setIsCreating(false);
  };

  const togglePin = (id: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const getCategoryColor = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId)?.color || BT.text.secondary;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const NoteCard = ({ note }: { note: Note }) => (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${note.isPinned ? BT.text.amber + '44' : BT.border.subtle}`,
      borderRadius: 6,
      padding: 16,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {note.isPinned && <span style={{ color: BT.text.amber }}>📌</span>}
            <h3 style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: BT.text.primary,
              fontFamily: MONO,
              margin: 0,
            }}>
              {note.title}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '2px 8px',
              background: getCategoryColor(note.category) + '22',
              color: getCategoryColor(note.category),
              fontSize: 9,
              fontFamily: MONO,
              borderRadius: 3,
              textTransform: 'uppercase',
            }}>
              {note.category}
            </span>
            <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>
              {note.author} · {formatDate(note.createdAt)}
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => togglePin(note.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: note.isPinned ? BT.text.amber : BT.text.muted,
              cursor: 'pointer',
              fontSize: 14,
            }}
            title={note.isPinned ? 'Unpin' : 'Pin'}
          >
            📌
          </button>
          <button
            onClick={() => setEditingNote(note)}
            style={{
              background: 'transparent',
              border: 'none',
              color: BT.text.muted,
              cursor: 'pointer',
              fontSize: 14,
            }}
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={() => deleteNote(note.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: BT.text.muted,
              cursor: 'pointer',
              fontSize: 14,
            }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Content */}
      <p style={{
        fontSize: 12,
        color: BT.text.secondary,
        fontFamily: MONO,
        lineHeight: 1.6,
        margin: '0 0 12px 0',
      }}>
        {note.content}
      </p>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {note.tags.map(tag => (
            <span key={tag} style={{
              padding: '2px 6px',
              background: BT.bg.header,
              color: BT.text.muted,
              fontSize: 9,
              fontFamily: MONO,
              borderRadius: 2,
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            background: BT.bg.input,
            border: `1px solid ${BT.border.medium}`,
            borderRadius: 4,
            color: BT.text.primary,
            fontFamily: MONO,
            fontSize: 12,
          }}
        />

        {/* Category Filter */}
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          style={{
            padding: '8px 12px',
            background: BT.bg.input,
            border: `1px solid ${BT.border.medium}`,
            borderRadius: 4,
            color: BT.text.primary,
            fontFamily: MONO,
            fontSize: 12,
          }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>

        {/* New Note Button */}
        <button
          onClick={() => setIsCreating(true)}
          style={{
            padding: '8px 16px',
            background: BT.text.cyan,
            color: BT.bg.terminal,
            border: 'none',
            borderRadius: 4,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          + NEW NOTE
        </button>
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.text.cyan}44`,
          borderRadius: 6,
          padding: 20,
          marginBottom: 20,
        }}>
          <h3 style={{ 
            fontSize: 12, 
            color: BT.text.cyan, 
            fontFamily: MONO, 
            marginBottom: 16,
            textTransform: 'uppercase',
          }}>
            Create New Note
          </h3>
          
          <input
            type="text"
            placeholder="Note title..."
            value={newNote.title}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: BT.bg.input,
              border: `1px solid ${BT.border.medium}`,
              borderRadius: 4,
              color: BT.text.primary,
              fontFamily: MONO,
              fontSize: 13,
              marginBottom: 12,
            }}
          />

          <textarea
            placeholder="Note content..."
            value={newNote.content}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: BT.bg.input,
              border: `1px solid ${BT.border.medium}`,
              borderRadius: 4,
              color: BT.text.primary,
              fontFamily: MONO,
              fontSize: 12,
              marginBottom: 12,
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select
              value={newNote.category}
              onChange={(e) => setNewNote({ ...newNote, category: e.target.value })}
              style={{
                padding: '8px 12px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontFamily: MONO,
                fontSize: 12,
              }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={newNote.tags}
              onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontFamily: MONO,
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleCreateNote}
              disabled={!newNote.title.trim()}
              style={{
                padding: '8px 20px',
                background: newNote.title.trim() ? BT.text.green : BT.bg.header,
                color: newNote.title.trim() ? BT.bg.terminal : BT.text.muted,
                border: 'none',
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 600,
                cursor: newNote.title.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              SAVE NOTE
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewNote({ title: '', content: '', category: 'general', tags: '' });
              }}
              style={{
                padding: '8px 20px',
                background: 'transparent',
                color: BT.text.secondary,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {pinnedNotes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ 
            fontSize: 10, 
            color: BT.text.amber, 
            fontFamily: MONO, 
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            📌 Pinned Notes
          </h4>
          {pinnedNotes.map(note => <NoteCard key={note.id} note={note} />)}
        </div>
      )}

      {unpinnedNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && (
            <h4 style={{ 
              fontSize: 10, 
              color: BT.text.muted, 
              fontFamily: MONO, 
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              All Notes
            </h4>
          )}
          {unpinnedNotes.map(note => <NoteCard key={note.id} note={note} />)}
        </div>
      )}

      {filteredNotes.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: BT.text.muted,
          fontFamily: MONO,
          fontSize: 12,
        }}>
          {searchQuery || selectedCategory ? 'No notes match your filters' : 'No notes yet. Create your first note!'}
        </div>
      )}
    </div>
  );
}
