import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';
import {
  MessageSquare, Clock, Users, FolderOpen, DollarSign,
  Calendar, FileText, AlertTriangle, Plus, Trash2, Pin,
  CheckCircle, XCircle, Edit2, Save, X, ChevronDown, ChevronUp
} from 'lucide-react';

interface ContextTrackerSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

const TABS = [
  { id: 'notes', name: 'Notes', icon: MessageSquare, color: 'blue' },
  { id: 'activity', name: 'Activity Timeline', icon: Clock, color: 'green' },
  { id: 'contacts', name: 'Contact Map', icon: Users, color: 'purple' },
  { id: 'documents', name: 'Document Vault', icon: FolderOpen, color: 'amber' },
  { id: 'financial', name: 'Financial Snapshot', icon: DollarSign, color: 'emerald' },
  { id: 'dates', name: 'Key Dates', icon: Calendar, color: 'rose' },
  { id: 'decisions', name: 'Decision Log', icon: FileText, color: 'indigo' },
  { id: 'risks', name: 'Risk Flags', icon: AlertTriangle, color: 'red' },
];

export const ContextTrackerSection: React.FC<ContextTrackerSectionProps> = ({ deal, dealId: propDealId }) => {
  const [activeTab, setActiveTab] = useState('notes');
  const resolvedDealId = propDealId || deal?.id;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-1">Deal Context Tracker</h3>
        <p className="text-sm text-blue-600">
          Unified view of all deal context — notes, activity, contacts, documents, dates, decisions, and risks.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {tab.name}
            </button>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'notes' && <NotesTab dealId={resolvedDealId} />}
        {activeTab === 'activity' && <ActivityTab dealId={resolvedDealId} />}
        {activeTab === 'contacts' && <ContactsTab dealId={resolvedDealId} />}
        {activeTab === 'documents' && <DocumentsTab dealId={resolvedDealId} />}
        {activeTab === 'financial' && <FinancialTab dealId={resolvedDealId} />}
        {activeTab === 'dates' && <DatesTab dealId={resolvedDealId} />}
        {activeTab === 'decisions' && <DecisionsTab dealId={resolvedDealId} />}
        {activeTab === 'risks' && <RisksTab dealId={resolvedDealId} />}
      </div>
    </div>
  );
};

// ============== NOTES TAB ==============
function NotesTab({ dealId }: { dealId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', pinned: false });

  const fetchNotes = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/notes`);
      setNotes(res.data);
    } catch { setNotes([]); }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const addNote = async () => {
    if (!form.content.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/notes`, form);
      setForm({ title: '', content: '', category: 'general', pinned: false });
      setShowForm(false);
      fetchNotes();
    } catch (e) { console.error('Failed to add note', e); }
  };

  const deleteNote = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/context/notes/${id}`);
      fetchNotes();
    } catch (e) { console.error('Failed to delete note', e); }
  };

  const categories = ['general', 'due-diligence', 'financial', 'legal', 'construction', 'market'];

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-900">Notes ({notes.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus size={14} /> Add Note
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <input type="text" placeholder="Note title (optional)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <textarea placeholder="Write your note..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none" />
          <div className="flex gap-3 items-center">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              {categories.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} /> Pin
            </label>
            <div className="flex-1" />
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            <button onClick={addNote} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState message="No notes yet. Add your first note to start tracking deal context." icon={MessageSquare} />
      ) : (
        <div className="space-y-3">
          {notes.map((note: any) => (
            <div key={note.id} className={`bg-white border rounded-lg p-4 ${note.pinned ? 'border-yellow-300 bg-yellow-50/30' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {note.pinned && <span className="inline-flex items-center gap-1 text-xs text-yellow-600 mb-1"><Pin size={12} /> Pinned</span>}
                  {note.title && <h5 className="font-medium text-gray-900">{note.title}</h5>}
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {note.category && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{note.category}</span>}
                    <span className="text-xs text-gray-400">{new Date(note.created_at).toLocaleDateString()}</span>
                    {note.author_name && <span className="text-xs text-gray-400">by {note.author_name}</span>}
                  </div>
                </div>
                <button onClick={() => deleteNote(note.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== ACTIVITY TAB ==============
function ActivityTab({ dealId }: { dealId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/context/deals/${dealId}/activity`)
      .then(res => setActivities(res.data))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Activity Timeline ({activities.length})</h4>
      {activities.length === 0 ? (
        <EmptyState message="No activity recorded yet. Activities are automatically logged as you work on this deal." icon={Clock} />
      ) : (
        <div className="space-y-0">
          {activities.map((a: any, i: number) => (
            <div key={a.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Clock size={14} /></div>
                {i < activities.length - 1 && <div className="w-px h-full bg-gray-200 my-1" />}
              </div>
              <div className="pb-4 flex-1">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  {a.module_name && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{a.module_name}</span>}
                  <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                  {a.user_name && <span className="text-xs text-gray-400">by {a.user_name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== CONTACTS TAB ==============
function ContactsTab({ dealId }: { dealId: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'broker', company: '', email: '', phone: '', notes: '', is_primary: false });

  const fetchContacts = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/contacts`);
      setContacts(res.data);
    } catch { setContacts([]); }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const addContact = async () => {
    if (!form.name.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/contacts`, form);
      setForm({ name: '', role: 'broker', company: '', email: '', phone: '', notes: '', is_primary: false });
      setShowForm(false);
      fetchContacts();
    } catch (e) { console.error('Failed to add contact', e); }
  };

  const deleteContact = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/context/contacts/${id}`);
      fetchContacts();
    } catch (e) { console.error('Failed to delete contact', e); }
  };

  const roles = ['seller', 'broker', 'lender', 'attorney', 'engineer', 'architect', 'contractor', 'appraiser', 'inspector', 'other'];

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-900">Contacts ({contacts.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <input type="text" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="tel" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={form.is_primary} onChange={e => setForm({ ...form, is_primary: e.target.checked })} /> Primary Contact
            </label>
          </div>
          <textarea placeholder="Notes about this contact..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            <button onClick={addContact} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Save Contact</button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState message="No contacts added yet. Add key stakeholders, brokers, and team members for this deal." icon={Users} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c: any) => (
            <div key={c.id} className={`bg-white border rounded-lg p-4 ${c.is_primary ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-gray-900">{c.name}</h5>
                    {c.is_primary && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Primary</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.role}{c.company ? ` at ${c.company}` : ''}</p>
                </div>
                <button onClick={() => deleteContact(c.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
              <div className="mt-2 space-y-1">
                {c.email && <p className="text-xs text-gray-600">✉ {c.email}</p>}
                {c.phone && <p className="text-xs text-gray-600">☎ {c.phone}</p>}
                {c.notes && <p className="text-xs text-gray-500 mt-1 italic">{c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== DOCUMENTS TAB ==============
function DocumentsTab({ dealId }: { dealId: string }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ original_filename: '', category: 'due-diligence', description: '', file_url: '' });

  const fetchDocs = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/documents`);
      setDocuments(res.data);
    } catch { setDocuments([]); }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const addDoc = async () => {
    if (!form.original_filename.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/documents`, {
        ...form, filename: form.original_filename.replace(/\s+/g, '_'), file_size: 0, mime_type: 'application/octet-stream',
        file_url: form.file_url || '#'
      });
      setForm({ original_filename: '', category: 'due-diligence', description: '', file_url: '' });
      setShowForm(false);
      fetchDocs();
    } catch (e) { console.error('Failed to add document', e); }
  };

  const deleteDoc = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/context/documents/${id}`);
      fetchDocs();
    } catch (e) { console.error('Failed to delete document', e); }
  };

  const docCategories = ['due-diligence', 'financial', 'legal', 'plans', 'photos', 'environmental', 'appraisal', 'other'];
  const categoryColors: Record<string, string> = {
    'due-diligence': 'bg-blue-100 text-blue-700', financial: 'bg-green-100 text-green-700',
    legal: 'bg-purple-100 text-purple-700', plans: 'bg-amber-100 text-amber-700',
    photos: 'bg-pink-100 text-pink-700', environmental: 'bg-emerald-100 text-emerald-700',
    appraisal: 'bg-indigo-100 text-indigo-700', other: 'bg-gray-100 text-gray-700',
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-900">Documents ({documents.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
          <Plus size={14} /> Add Document
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Document name *" value={form.original_filename} onChange={e => setForm({ ...form, original_filename: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {docCategories.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
            </select>
          </div>
          <input type="url" placeholder="Document URL (optional)" value={form.file_url} onChange={e => setForm({ ...form, file_url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <textarea placeholder="Description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            <button onClick={addDoc} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">Save Document</button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState message="No documents yet. Add contracts, reports, and plans to keep everything organized." icon={FolderOpen} />
      ) : (
        <div className="space-y-2">
          {documents.map((d: any) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><FolderOpen size={18} className="text-gray-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{d.original_filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {d.category && <span className={`text-xs px-1.5 py-0.5 rounded ${categoryColors[d.category] || 'bg-gray-100 text-gray-600'}`}>{d.category}</span>}
                  <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => deleteDoc(d.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== FINANCIAL SNAPSHOT TAB ==============
function FinancialTab({ dealId }: { dealId: string }) {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Financial Snapshot</h4>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-sm text-gray-500 mb-4">Quick financial overview pulled from deal data and modules.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Purchase Price', value: '$0', sub: 'Not set' },
            { label: 'Total Budget', value: '$0', sub: 'Not set' },
            { label: 'Projected NOI', value: '$0', sub: 'Not set' },
            { label: 'Target Return', value: '0%', sub: 'Not set' },
          ].map(m => (
            <div key={m.label} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{m.value}</p>
              <p className="text-xs text-gray-400">{m.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">Financial data auto-populates as you complete financial analysis modules.</p>
      </div>
    </div>
  );
}

// ============== KEY DATES TAB ==============
function DatesTab({ dealId }: { dealId: string }) {
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', date_type: 'deadline', description: '' });

  const fetchDates = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/key-dates`);
      setDates(res.data);
    } catch { setDates([]); }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchDates(); }, [fetchDates]);

  const addDate = async () => {
    if (!form.title.trim() || !form.date) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/key-dates`, form);
      setForm({ title: '', date: '', date_type: 'deadline', description: '' });
      setShowForm(false);
      fetchDates();
    } catch (e) { console.error('Failed to add date', e); }
  };

  const toggleStatus = async (d: any) => {
    const newStatus = d.status === 'completed' ? 'upcoming' : 'completed';
    try {
      await apiClient.put(`/api/v1/context/key-dates/${d.id}`, {
        ...d, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      });
      fetchDates();
    } catch (e) { console.error('Failed to update date', e); }
  };

  const deleteDate = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/context/key-dates/${id}`);
      fetchDates();
    } catch (e) { console.error('Failed to delete date', e); }
  };

  const dateTypes = ['deadline', 'milestone', 'scheduled', 'hearing', 'inspection', 'closing'];
  const statusColors: Record<string, string> = {
    upcoming: 'text-blue-600 bg-blue-50', completed: 'text-green-600 bg-green-50',
    missed: 'text-red-600 bg-red-50', cancelled: 'text-gray-400 bg-gray-50',
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-900">Key Dates ({dates.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700">
          <Plus size={14} /> Add Date
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.date_type} onChange={e => setForm({ ...form, date_type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {dateTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <textarea placeholder="Description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            <button onClick={addDate} className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700">Save Date</button>
          </div>
        </div>
      )}

      {dates.length === 0 ? (
        <EmptyState message="No key dates set. Add deadlines, milestones, and important dates for this deal." icon={Calendar} />
      ) : (
        <div className="space-y-2">
          {dates.map((d: any) => {
            const isPast = new Date(d.date) < new Date() && d.status !== 'completed';
            return (
              <div key={d.id} className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${isPast ? 'border-red-200' : 'border-gray-200'}`}>
                <button onClick={() => toggleStatus(d)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  d.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                }`}>
                  {d.status === 'completed' && <CheckCircle size={14} />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${d.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{d.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[d.status] || 'bg-gray-100 text-gray-600'}`}>{d.date_type}</span>
                    <span className={`text-xs ${isPast ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{new Date(d.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => deleteDate(d.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============== DECISIONS TAB ==============
function DecisionsTab({ dealId }: { dealId: string }) {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', decision_type: 'go-no-go', status: 'pending', rationale: '', impact_description: '' });

  const fetchDecisions = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/decisions`);
      setDecisions(res.data);
    } catch { setDecisions([]); }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  const addDecision = async () => {
    if (!form.title.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/decisions`, { ...form, decision_date: new Date().toISOString().split('T')[0] });
      setForm({ title: '', decision_type: 'go-no-go', status: 'pending', rationale: '', impact_description: '' });
      setShowForm(false);
      fetchDecisions();
    } catch (e) { console.error('Failed to add decision', e); }
  };

  const deleteDecision = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/context/decisions/${id}`);
      fetchDecisions();
    } catch (e) { console.error('Failed to delete decision', e); }
  };

  const decisionTypes = ['go-no-go', 'budget', 'design', 'strategy', 'vendor', 'legal', 'other'];
  const statusColors: Record<string, string> = {
    approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700', tabled: 'bg-gray-100 text-gray-600',
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-900">Decision Log ({decisions.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus size={14} /> Log Decision
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="Decision title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.decision_type} onChange={e => setForm({ ...form, decision_type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {decisionTypes.map(t => <option key={t} value={t}>{t.replace('-', '/')}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="tabled">Tabled</option>
            </select>
          </div>
          <textarea placeholder="Rationale / reasoning..." value={form.rationale} onChange={e => setForm({ ...form, rationale: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <textarea placeholder="Impact description..." value={form.impact_description} onChange={e => setForm({ ...form, impact_description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            <button onClick={addDecision} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Save Decision</button>
          </div>
        </div>
      )}

      {decisions.length === 0 ? (
        <EmptyState message="No decisions logged yet. Record go/no-go calls, budget approvals, and strategy decisions." icon={FileText} />
      ) : (
        <div className="space-y-3">
          {decisions.map((d: any) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-gray-900">{d.title}</h5>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[d.status] || 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{d.decision_type}</span>
                    {d.decision_date && <span className="text-xs text-gray-400">{new Date(d.decision_date).toLocaleDateString()}</span>}
                  </div>
                  {d.rationale && <p className="text-sm text-gray-600 mt-2">{d.rationale}</p>}
                  {d.impact_description && <p className="text-sm text-gray-500 mt-1 italic">{d.impact_description}</p>}
                </div>
                <button onClick={() => deleteDecision(d.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== RISKS TAB ==============
function RisksTab({ dealId }: { dealId: string }) {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'financial', impact: 'medium', likelihood: 'medium', mitigation_strategy: '' });

  const fetchRisks = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/api/v1/context/deals/${dealId}/risks`);
      setRisks(res.data);
    } catch { setRisks([]); }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchRisks(); }, [fetchRisks]);

  const addRisk = async () => {
    if (!form.title.trim()) return;
    try {
      await apiClient.post(`/api/v1/context/deals/${dealId}/risks`, form);
      setForm({ title: '', description: '', category: 'financial', impact: 'medium', likelihood: 'medium', mitigation_strategy: '' });
      setShowForm(false);
      fetchRisks();
    } catch (e) { console.error('Failed to add risk', e); }
  };

  const deleteRisk = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/context/risks/${id}`);
      fetchRisks();
    } catch (e) { console.error('Failed to delete risk', e); }
  };

  const riskCategories = ['financial', 'legal', 'environmental', 'construction', 'market', 'regulatory', 'operational'];
  const severityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200', medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  const computeSeverity = (impact: string, likelihood: string): string => {
    const levels: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const score = (levels[impact] || 2) * (levels[likelihood] || 2);
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-900">Risk Register ({risks.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
          <Plus size={14} /> Add Risk
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <input type="text" placeholder="Risk title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {riskCategories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="low">Low Impact</option>
              <option value="medium">Medium Impact</option>
              <option value="high">High Impact</option>
            </select>
            <select value={form.likelihood} onChange={e => setForm({ ...form, likelihood: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="low">Low Likelihood</option>
              <option value="medium">Medium Likelihood</option>
              <option value="high">High Likelihood</option>
            </select>
          </div>
          <textarea placeholder="Description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <textarea placeholder="Mitigation strategy..." value={form.mitigation_strategy} onChange={e => setForm({ ...form, mitigation_strategy: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            <button onClick={addRisk} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Save Risk</button>
          </div>
        </div>
      )}

      {risks.length === 0 ? (
        <EmptyState message="No risks identified yet. Add potential risks to proactively manage deal threats." icon={AlertTriangle} />
      ) : (
        <div className="space-y-3">
          {risks.map((r: any) => {
            const severity = computeSeverity(r.impact, r.likelihood);
            return (
            <div key={r.id} className={`bg-white border rounded-lg p-4 ${severityColors[severity] || 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className={severity === 'high' ? 'text-red-500' : severity === 'medium' ? 'text-yellow-500' : 'text-green-500'} />
                    <h5 className="font-medium text-gray-900">{r.title}</h5>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityColors[severity] || 'bg-gray-100 text-gray-600'}`}>
                      {severity} severity
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{r.category}</span>
                    <span>Impact: {r.impact}</span>
                    <span>Likelihood: {r.likelihood}</span>
                    <span className={`px-1.5 py-0.5 rounded ${r.status === 'active' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{r.status}</span>
                  </div>
                  {r.description && <p className="text-sm text-gray-600 mt-2">{r.description}</p>}
                  {r.mitigation_strategy && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                      <strong>Mitigation:</strong> {r.mitigation_strategy}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteRisk(r.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============== SHARED COMPONENTS ==============
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon: React.FC<any> }) {
  return (
    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
      <Icon size={40} className="mx-auto text-gray-300 mb-3" />
      <p className="text-sm text-gray-500 max-w-md mx-auto">{message}</p>
    </div>
  );
}

export default ContextTrackerSection;
