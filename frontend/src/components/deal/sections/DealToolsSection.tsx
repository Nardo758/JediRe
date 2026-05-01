/**
 * DealToolsSection - Unified Deal Tools Tab
 * Combines: Notes, Contacts, Key Dates, Decision Log, Files, Documents
 * Simplified from ContextTrackerSection - removes duplicates covered by other modules
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';
import {
  MessageSquare, Users, Calendar, FileText, FolderOpen, Files,
  Plus, Trash2, Pin, Edit2, Save, X, ChevronDown, ChevronUp,
  Phone, Mail, Building2, User, Clock, Bot, UserCheck,
} from 'lucide-react';
import { BT } from '../bloomberg-ui';
import OpusAISection from './OpusAISection';
import { DealTeamPanel } from '../DealTeamPanel';
import { CommentThread } from '../CommentThread';
import { ActivityFeed } from '../ActivityFeed';

interface DealToolsSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
}

const TABS = [
  { id: 'notes', name: 'Notes', icon: MessageSquare },
  { id: 'contacts', name: 'Contacts', icon: Users },
  { id: 'dates', name: 'Key Dates', icon: Calendar },
  { id: 'decisions', name: 'Decisions', icon: FileText },
  { id: 'documents', name: 'Docs', icon: FolderOpen },
  { id: 'team', name: 'Team', icon: UserCheck },
  { id: 'ai', name: 'AI Agent', icon: Bot },
];

export const DealToolsSection: React.FC<DealToolsSectionProps> = ({ deal, dealId: propDealId }) => {
  const [activeTab, setActiveTab] = useState('notes');
  const resolvedDealId = propDealId || deal?.id;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: BT.bg.terminal,
      animation: 'bt-fade 0.15s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        borderTop: `2px solid ${BT.text.cyan}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ 
            fontSize: 11, 
            fontWeight: 700, 
            color: BT.text.primary,
            fontFamily: BT.font.mono,
            letterSpacing: 1,
          }}>
            DEAL TOOLS
          </span>
          <span style={{ fontSize: 9, color: BT.text.muted }}>|</span>
          <span style={{ fontSize: 9, color: BT.text.secondary }}>
            M21 · NOTES + CONTACTS + DATES + FILES
          </span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`,
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                color: isActive ? BT.text.amber : BT.text.secondary,
                fontFamily: BT.font.mono,
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={14} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'ai' ? 0 : 16 }}>
        {activeTab === 'notes' && <NotesTab dealId={resolvedDealId} />}
        {activeTab === 'contacts' && <ContactsTab dealId={resolvedDealId} />}
        {activeTab === 'dates' && <DatesTab dealId={resolvedDealId} />}
        {activeTab === 'decisions' && <DecisionsTab dealId={resolvedDealId} />}
        {activeTab === 'documents' && <DocumentsFilesTab dealId={resolvedDealId} />}
        {activeTab === 'team' && (
          resolvedDealId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DealTeamPanel dealId={resolvedDealId} />
              <CommentThread dealId={resolvedDealId} />
              <ActivityFeed dealId={resolvedDealId} />
            </div>
          ) : (
            <div style={{ padding: 16, fontSize: 11, color: BT.text.secondary, fontFamily: BT.font.mono }}>No deal selected</div>
          )
        )}
        {activeTab === 'ai' && <OpusAISection dealId={resolvedDealId} deal={deal} />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════
function NotesTab({ dealId }: { dealId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', pinned: false });

  const fetchNotes = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/notes`);
      setNotes(res.data?.notes || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/notes`, form);
      setForm({ title: '', content: '', category: 'general', pinned: false });
      setShowForm(false);
      fetchNotes();
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await apiClient.delete(`/api/v1/context/deals/${dealId}/notes/${noteId}`);
      fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const togglePin = async (noteId: string, pinned: boolean) => {
    try {
      await apiClient.patch(`/api/v1/context/deals/${dealId}/notes/${noteId}`, { pinned: !pinned });
      fetchNotes();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: BT.text.muted }}>{notes.length} notes</span>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', background: BT.text.amber,
            color: BT.bg.terminal, border: 'none', cursor: 'pointer',
            fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700,
          }}
        >
          <Plus size={12} /> ADD NOTE
        </button>
      </div>

      {showForm && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, padding: 12 }}>
          <input
            placeholder="Note title..."
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            style={{
              width: '100%', padding: 8, marginBottom: 8,
              background: BT.bg.input, border: `1px solid ${BT.border.subtle}`,
              color: BT.text.primary, fontFamily: BT.font.mono, fontSize: 11,
            }}
          />
          <textarea
            placeholder="Note content..."
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            rows={4}
            style={{
              width: '100%', padding: 8, marginBottom: 8,
              background: BT.bg.input, border: `1px solid ${BT.border.subtle}`,
              color: BT.text.primary, fontFamily: BT.font.mono, fontSize: 11,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              style={{
                padding: '6px 10px', background: BT.bg.input,
                border: `1px solid ${BT.border.subtle}`, color: BT.text.primary,
                fontFamily: BT.font.mono, fontSize: 10,
              }}
            >
              <option value="general">General</option>
              <option value="meeting">Meeting</option>
              <option value="call">Call</option>
              <option value="research">Research</option>
              <option value="action">Action Item</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: BT.text.secondary }}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => setForm({ ...form, pinned: e.target.checked })}
              />
              Pin
            </label>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{ padding: '6px 12px', background: BT.text.green, border: 'none', color: BT.bg.terminal, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700 }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState message="No notes yet. Add your first note to track important information." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(note => (
            <div
              key={note.id}
              style={{
                background: BT.bg.panel,
                border: `1px solid ${note.pinned ? BT.text.amber + '44' : BT.border.subtle}`,
                borderLeft: note.pinned ? `3px solid ${BT.text.amber}` : `3px solid ${BT.border.subtle}`,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 2 }}>{note.title}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 9, color: BT.text.muted }}>
                    <span style={{ padding: '1px 6px', background: BT.bg.active, color: BT.text.cyan }}>{note.category}</span>
                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => togglePin(note.id, note.pinned)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: note.pinned ? BT.text.amber : BT.text.muted }}>
                    <Pin size={14} />
                  </button>
                  <button onClick={() => deleteNote(note.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.red }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTACTS TAB
// ═══════════════════════════════════════════════════════════════
function ContactsTab({ dealId }: { dealId: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', company: '', email: '', phone: '' });

  const fetchContacts = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/contacts`);
      setContacts(res.data?.contacts || []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/contacts`, form);
      setForm({ name: '', role: '', company: '', email: '', phone: '' });
      setShowForm(false);
      fetchContacts();
    } catch (err) {
      console.error('Failed to create contact:', err);
    }
  };

  const deleteContact = async (contactId: string) => {
    try {
      await apiClient.delete(`/api/v1/context/deals/${dealId}/contacts/${contactId}`);
      fetchContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: BT.text.muted }}>{contacts.length} contacts</span>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', background: BT.text.amber,
            color: BT.bg.terminal, border: 'none', cursor: 'pointer',
            fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700,
          }}
        >
          <Plus size={12} /> ADD CONTACT
        </button>
      </div>

      {showForm && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle} />
            <input placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={inputStyle} />
            <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10 }}>Cancel</button>
            <button onClick={handleSubmit} style={{ padding: '6px 12px', background: BT.text.green, border: 'none', color: BT.bg.terminal, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700 }}>Save</button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState message="No contacts yet. Add key people involved in this deal." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {contacts.map(contact => (
            <div key={contact.id} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: BT.bg.active, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} style={{ color: BT.text.amber }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>{contact.name}</div>
                    <div style={{ fontSize: 10, color: BT.text.cyan }}>{contact.role}</div>
                  </div>
                </div>
                <button onClick={() => deleteContact(contact.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.muted }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {contact.company && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: BT.text.secondary, marginBottom: 4 }}>
                  <Building2 size={12} /> {contact.company}
                </div>
              )}
              {contact.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: BT.text.secondary, marginBottom: 4 }}>
                  <Mail size={12} /> {contact.email}
                </div>
              )}
              {contact.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: BT.text.secondary }}>
                  <Phone size={12} /> {contact.phone}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KEY DATES TAB
// ═══════════════════════════════════════════════════════════════
function DatesTab({ dealId }: { dealId: string }) {
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', category: 'deadline', notes: '' });

  const fetchDates = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/dates`);
      setDates(res.data?.dates || []);
    } catch {
      setDates([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchDates(); }, [fetchDates]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/dates`, form);
      setForm({ title: '', date: '', category: 'deadline', notes: '' });
      setShowForm(false);
      fetchDates();
    } catch (err) {
      console.error('Failed to create date:', err);
    }
  };

  const deleteDate = async (dateId: string) => {
    try {
      await apiClient.delete(`/api/v1/context/deals/${dealId}/dates/${dateId}`);
      fetchDates();
    } catch (err) {
      console.error('Failed to delete date:', err);
    }
  };

  const getDaysUntil = (date: string) => {
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: BT.text.red };
    if (diff === 0) return { text: 'Today', color: BT.text.amber };
    if (diff <= 7) return { text: `${diff}d`, color: BT.text.orange };
    return { text: `${diff}d`, color: BT.text.green };
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: BT.text.muted }}>{dates.length} dates</span>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', background: BT.text.amber,
            color: BT.bg.terminal, border: 'none', cursor: 'pointer',
            fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700,
          }}
        >
          <Plus size={12} /> ADD DATE
        </button>
      </div>

      {showForm && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              <option value="deadline">Deadline</option>
              <option value="milestone">Milestone</option>
              <option value="meeting">Meeting</option>
              <option value="closing">Closing</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
            <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10 }}>Cancel</button>
            <button onClick={handleSubmit} style={{ padding: '6px 12px', background: BT.text.green, border: 'none', color: BT.bg.terminal, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700 }}>Save</button>
          </div>
        </div>
      )}

      {dates.length === 0 ? (
        <EmptyState message="No key dates yet. Track important deadlines and milestones." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(d => {
            const status = getDaysUntil(d.date);
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 12 }}>
                <div style={{ width: 50, textAlign: 'center', padding: '4px 8px', background: status.color + '22', border: `1px solid ${status.color}44`, color: status.color, fontSize: 10, fontWeight: 700, fontFamily: BT.font.mono }}>
                  {status.text}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>{d.title}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 9, color: BT.text.muted, marginTop: 2 }}>
                    <span>{new Date(d.date).toLocaleDateString()}</span>
                    <span style={{ padding: '1px 6px', background: BT.bg.active, color: BT.text.cyan }}>{d.category}</span>
                  </div>
                </div>
                <button onClick={() => deleteDate(d.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.muted }}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DECISIONS TAB
// ═══════════════════════════════════════════════════════════════
function DecisionsTab({ dealId }: { dealId: string }) {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', decision: '', rationale: '', made_by: '' });

  const fetchDecisions = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/decisions`);
      setDecisions(res.data?.decisions || []);
    } catch {
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.decision.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/decisions`, form);
      setForm({ title: '', decision: '', rationale: '', made_by: '' });
      setShowForm(false);
      fetchDecisions();
    } catch (err) {
      console.error('Failed to create decision:', err);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: BT.text.muted }}>{decisions.length} decisions</span>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', background: BT.text.amber,
            color: BT.bg.terminal, border: 'none', cursor: 'pointer',
            fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700,
          }}
        >
          <Plus size={12} /> LOG DECISION
        </button>
      </div>

      {showForm && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, padding: 12 }}>
          <input placeholder="Decision title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
          <textarea placeholder="What was decided? *" value={form.decision} onChange={e => setForm({ ...form, decision: e.target.value })} rows={2} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
          <textarea placeholder="Rationale / reasoning" value={form.rationale} onChange={e => setForm({ ...form, rationale: e.target.value })} rows={2} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
          <input placeholder="Decision made by" value={form.made_by} onChange={e => setForm({ ...form, made_by: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10 }}>Cancel</button>
            <button onClick={handleSubmit} style={{ padding: '6px 12px', background: BT.text.green, border: 'none', color: BT.bg.terminal, cursor: 'pointer', fontFamily: BT.font.mono, fontSize: 10, fontWeight: 700 }}>Save</button>
          </div>
        </div>
      )}

      {decisions.length === 0 ? (
        <EmptyState message="No decisions logged yet. Document important decisions and their rationale." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {decisions.map(d => (
            <div key={d.id} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderLeft: `3px solid ${BT.text.purple}`, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 4 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: BT.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>{d.decision}</div>
              {d.rationale && (
                <div style={{ fontSize: 10, color: BT.text.muted, padding: 8, background: BT.bg.active, marginBottom: 8 }}>
                  <strong>Rationale:</strong> {d.rationale}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, fontSize: 9, color: BT.text.muted }}>
                {d.made_by && <span>By: {d.made_by}</span>}
                <span>{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// DOCUMENTS & FILES TAB (unified)
// Left: scrollable directory by category · Right: upload panel
// ═══════════════════════════════════════════════════════════════

const DOC_CATEGORIES = [
  { id: 'om',           name: 'Offering Memorandum',  icon: '📋' },
  { id: 'financial',    name: 'Financial Statements', icon: '💰' },
  { id: 'legal',        name: 'Legal Documents',      icon: '⚖️' },
  { id: 'environmental',name: 'Environmental Reports',icon: '🌿' },
  { id: 'inspection',   name: 'Inspection Reports',   icon: '🔍' },
  { id: 'title',        name: 'Title & Survey',       icon: '📐' },
  { id: 'lease',        name: 'Lease Agreements',     icon: '📝' },
  { id: 'permits',      name: 'Permits & Approvals',  icon: '✅' },
];

function DocumentsFilesTab({ dealId }: { dealId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['om', 'financial', 'legal']));
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; category: string }>>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const fetchFiles = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/files`);
      const fetched = res.data?.files || [];
      setFiles(fetched);
      setRecentActivity(fetched.slice(-5).reverse());
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  // Handle drag-and-drop or file picker
  const addFilesToQueue = (fileList: FileList | File[], preSelectedCategory?: string) => {
    const newEntries = Array.from(fileList).map(f => ({
      file: f,
      category: preSelectedCategory || 'financial',
    }));
    setUploadQueue(prev => [...prev, ...newEntries]);
  };

  const updateQueueCategory = (idx: number, category: string) => {
    setUploadQueue(prev => prev.map((entry, i) => i === idx ? { ...entry, category } : entry));
  };

  const removeFromQueue = (idx: number) => {
    setUploadQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const executeUpload = async () => {
    if (uploadQueue.length === 0 || uploading) return;
    setUploading(true);
    for (const entry of uploadQueue) {
      try {
        const formData = new FormData();
        formData.append('files', entry.file);
        formData.append('category', entry.category);
        await apiClient.post(`/api/v1/deals/${dealId}/files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    setUploadQueue([]);
    setUploading(false);
    await fetchFiles();
  };

  const deleteFile = async (fileId: string) => {
    try {
      await apiClient.delete(`/api/v1/deals/${dealId}/files/${fileId}`);
      fetchFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (file: any) => {
    const status = file.extraction_status || file.status;
    if (status === 'completed' || status === 'final' || status === 'parsed') {
      return <span style={{ fontSize: 8, padding: '1px 4px', background: BT.text.green + '22', color: BT.text.green, fontFamily: BT.font.mono }}>✅ parsed</span>;
    }
    if (status === 'processing') {
      return <span style={{ fontSize: 8, padding: '1px 4px', background: BT.text.orange + '22', color: BT.text.orange, fontFamily: BT.font.mono }}>🔄 processing</span>;
    }
    return <span style={{ fontSize: 8, padding: '1px 4px', background: BT.text.muted + '22', color: BT.text.muted, fontFamily: BT.font.mono }}>⏳ pending</span>;
  };

  if (loading) return <LoadingState />;

  const filesByCategory = (catId: string) =>
    files.filter(f => (f.category || 'financial') === catId);

  const totalFiles = files.length;

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* ─── LEFT: SCROLLABLE DIRECTORY ─── */}
      <div style={{
        flex: 3, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 4,
        paddingRight: 8,
      }}>
        <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 8, fontFamily: BT.font.mono }}>
          {totalFiles} documents · organized by type
        </div>

        {DOC_CATEGORIES.map(cat => {
          const catFiles = filesByCategory(cat.id);
          const isExpanded = expandedCategories.has(cat.id);
          const isEmpty = catFiles.length === 0;

          return (
            <div key={cat.id} style={{
              border: `1px solid ${BT.border.subtle}`,
              background: BT.bg.panel,
            }}>
              {/* Category header */}
              <div
                onClick={() => toggleCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', cursor: 'pointer',
                  borderBottom: isExpanded && !isEmpty ? `1px solid ${BT.border.subtle}` : 'none',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 16 }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>{cat.name}</div>
                  <div style={{ fontSize: 9, color: BT.text.muted }}>{catFiles.length} file{catFiles.length !== 1 ? 's' : ''}</div>
                </div>
                {isEmpty && (
                  <div
                    onClick={(e) => { e.stopPropagation(); addFilesToQueue([], cat.id); }}
                    style={{
                      fontSize: 9, color: BT.text.cyan, cursor: 'pointer',
                      fontFamily: BT.font.mono,
                      border: `1px dashed ${BT.text.cyan}44`, padding: '4px 8px',
                    }}
                  >
                    drop here
                  </div>
                )}
                <span style={{ fontSize: 10, color: BT.text.muted }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>

              {/* Category files (collapsible) */}
              {isExpanded && catFiles.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px 6px 44px',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  background: BT.bg.panelAlt,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 500, color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name || f.original_filename}
                  </span>
                  <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>{formatSize(f.size || f.file_size)}</span>
                  <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>{new Date(f.created_at).toLocaleDateString()}</span>
                  {getStatusBadge(f)}
                  <button onClick={() => deleteFile(f.id)} style={{
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: BT.text.muted,
                    padding: 2, display: 'flex',
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ─── RIGHT: UPLOAD PANEL ─── */}
      <div style={{
        flex: 2,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Drop zone */}
        <div
          onDrop={(e) => { e.preventDefault(); addFilesToQueue(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg';
            input.onchange = (e) => {
              const fl = (e.target as HTMLInputElement).files;
              if (fl) addFilesToQueue(fl);
            };
            input.click();
          }}
          style={{
            border: `2px dashed ${BT.border.medium}`,
            borderRadius: 6,
            padding: '24px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: BT.bg.panelAlt,
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📤</div>
          <div style={{ fontSize: 11, color: BT.text.secondary, fontFamily: BT.font.mono }}>Drop files here or click to browse</div>
          <div style={{ fontSize: 8, color: BT.text.muted, marginTop: 4, fontFamily: BT.font.mono }}>.pdf .xlsx .docx .png .jpg</div>
        </div>

        {/* Upload queue */}
        {uploadQueue.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            padding: 12,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, fontFamily: BT.font.mono, letterSpacing: 0.5 }}>
              UPLOAD QUEUE ({uploadQueue.length})
            </div>
            {uploadQueue.map((entry, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: BT.bg.panelAlt,
                border: `1px solid ${BT.border.subtle}`,
                padding: '6px 8px',
              }}>
                <span style={{ fontSize: 9, color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: BT.font.mono }}>
                  {entry.file.name}
                </span>
                <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono, flexShrink: 0 }}>
                  {formatSize(entry.file.size)}
                </span>
                <select
                  value={entry.category}
                  onChange={e => updateQueueCategory(idx, e.target.value)}
                  style={{
                    background: BT.bg.input, border: `1px solid ${BT.border.subtle}`,
                    color: BT.text.primary, fontSize: 8, padding: '2px 4px',
                    fontFamily: BT.font.mono, cursor: 'pointer',
                    maxWidth: 130,
                  }}
                >
                  {DOC_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button onClick={() => removeFromQueue(idx)} style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: BT.text.muted, padding: 2, display: 'flex',
                }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={executeUpload}
              disabled={uploading}
              style={{
                padding: '8px 16px', background: BT.text.amber,
                color: BT.bg.terminal, border: 'none',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontFamily: BT.font.mono, fontSize: 9, fontWeight: 700,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? 'UPLOADING...' : `📤 UPLOAD ${uploadQueue.length} FILE${uploadQueue.length > 1 ? 'S' : ''}`}
            </button>
          </div>
        )}

        {/* Recent activity */}
        {recentActivity.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            padding: 12,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, fontFamily: BT.font.mono, letterSpacing: 0.5, marginBottom: 4 }}>
              RECENT ACTIVITY
            </div>
            {recentActivity.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: BT.text.secondary, fontFamily: BT.font.mono }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{f.name || f.original_filename}</span>
                <span style={{ color: BT.text.muted }}>→</span>
                {getStatusBadge(f)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  background: BT.bg.input,
  border: `1px solid ${BT.border.subtle}`,
  color: BT.text.primary,
  fontFamily: BT.font.mono,
  fontSize: 11,
};

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: BT.text.muted }}>
      <Clock size={16} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
      Loading...
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 40, 
      background: BT.bg.panel,
      border: `1px dashed ${BT.border.medium}`,
    }}>
      <div style={{ fontSize: 11, color: BT.text.muted, textAlign: 'center' }}>{message}</div>
    </div>
  );
}

export default DealToolsSection;
