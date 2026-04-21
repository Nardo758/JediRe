import React, { useState, useEffect, useCallback } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { apiClient } from '@/services/api.client';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  sections: unknown[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['All', 'ProForma', 'LOI', 'PSA', 'Investment Memo', 'Due Diligence', 'Email'];

const inputStyle: React.CSSProperties = {
  background: BT.bg.input,
  border: `1px solid ${BT.border.medium}`,
  borderRadius: 0,
  color: BT.text.primary,
  outline: 'none',
  fontSize: 12,
  padding: '6px 10px',
  width: '100%',
  fontFamily: 'inherit',
};

const API = '/api/v1/org/templates';

export function TemplatesSettings() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Create form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('ProForma');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit form
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(API) as { data?: { templates?: Template[] } };
      setTemplates(res.data?.templates ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load templates';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const filtered = templates.filter(t => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiClient.post(API, {
        name: newName.trim(),
        category: newCategory,
        description: newDesc.trim() || null,
      }) as { data?: { template?: Template } };
      if (res.data?.template) {
        setTemplates(prev => [...prev, res.data!.template!]);
      } else {
        await loadTemplates();
      }
      setNewName('');
      setNewCategory('ProForma');
      setNewDesc('');
      setShowNewForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create template';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t: Template) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditCategory(t.category);
    setEditDesc(t.description ?? '');
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditError(null);
  };

  const handleSave = async () => {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await apiClient.put(`${API}/${editId}`, {
        name: editName.trim(),
        category: editCategory,
        description: editDesc.trim() || null,
      }) as { data?: { template?: Template } };
      if (res.data?.template) {
        setTemplates(prev => prev.map(t => t.id === editId ? res.data!.template! : t));
      } else {
        await loadTemplates();
      }
      setEditId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save template';
      setEditError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`${API}/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete template';
      setError(msg);
    }
  };

  const fmtDate = (s: string) => {
    try { return new Date(s).toISOString().slice(0, 10); } catch { return s.slice(0, 10); }
  };

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 24 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary, letterSpacing: 0.8, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
            DOCUMENT TEMPLATES
          </h2>
          <p style={{ fontSize: 11, color: BT.text.secondary }}>Manage ProForma, LOI, PSA, and email templates used across your deals.</p>
        </div>
        <button
          onClick={() => { setShowNewForm(!showNewForm); setCreateError(null); }}
          style={{ fontSize: 10, fontWeight: 600, padding: '6px 14px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: 'pointer', borderRadius: 0 }}
        >
          + NEW TEMPLATE
        </button>
      </div>

      {/* Global error */}
      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#2a1212', border: `1px solid #EF444444`, fontSize: 11, color: '#EF4444' }}>
          {error}
          <button onClick={loadTemplates} style={{ marginLeft: 10, color: BT.text.cyan, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* Create form */}
      {showNewForm && (
        <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.primary, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>NEW TEMPLATE</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 4 }}>Template Name</label>
              <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Custom Template" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 4 }}>Category</label>
              <select style={{ ...inputStyle }} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 4 }}>Description</label>
            <input style={inputStyle} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of this template..." />
          </div>
          {createError && <div style={{ marginBottom: 8, fontSize: 10, color: '#EF4444' }}>{createError}</div>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{ fontSize: 10, fontWeight: 600, padding: '6px 14px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: creating ? 'wait' : 'pointer', opacity: creating || !newName.trim() ? 0.6 : 1 }}
            >
              {creating ? 'CREATING...' : 'CREATE'}
            </button>
            <button onClick={() => setShowNewForm(false)} style={{ fontSize: 10, padding: '6px 14px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.medium}`, cursor: 'pointer' }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex items-center gap-3 mb-4">
        <input
          style={{ ...inputStyle, width: 200 }}
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                fontSize: 9, fontWeight: 600, padding: '4px 8px',
                background: activeCategory === cat ? BT.bg.active : 'transparent',
                color: activeCategory === cat ? BT.text.cyan : BT.text.muted,
                border: `1px solid ${activeCategory === cat ? BT.text.cyan + '44' : BT.border.subtle}`,
                cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
              }}
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* Template list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: BT.text.muted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
          Loading templates...
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: BT.text.muted, fontSize: 11 }}>No templates found</div>
          )}
          {filtered.map(t => (
            <div key={t.id} style={{ background: BT.bg.panelAlt, border: `1px solid ${editId === t.id ? BT.text.cyan + '44' : BT.border.subtle}`, padding: '12px 16px' }}>
              {editId === t.id ? (
                /* ── Inline edit form ── */
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 4 }}>Name</label>
                      <input style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 4 }}>Category</label>
                      <select style={{ ...inputStyle }} value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                        {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 4 }}>Description</label>
                    <input style={inputStyle} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                  </div>
                  {editError && <div style={{ marginBottom: 8, fontSize: 10, color: '#EF4444' }}>{editError}</div>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || !editName.trim()}
                      style={{ fontSize: 9, padding: '4px 10px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? 'SAVING...' : 'SAVE'}
                    </button>
                    <button onClick={cancelEdit} style={{ fontSize: 9, padding: '4px 10px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.medium}`, cursor: 'pointer' }}>
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read-only row ── */
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>{t.name}</span>
                      {t.is_default && (
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', background: BT.text.cyan + '22', color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>DEFAULT</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.secondary }}>{t.description}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                      {t.category.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 9, color: BT.text.muted }}>
                      Modified {fmtDate(t.updated_at)}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => startEdit(t)}
                      style={{ fontSize: 9, padding: '4px 8px', background: 'transparent', color: BT.text.cyan, border: `1px solid ${BT.text.cyan}44`, cursor: 'pointer' }}
                    >
                      EDIT
                    </button>
                    {!t.is_default && (
                      <button
                        onClick={() => handleDelete(t.id)}
                        style={{ fontSize: 9, padding: '4px 8px', background: 'transparent', color: BT.text.red, border: `1px solid ${BT.text.red}44`, cursor: 'pointer' }}
                      >
                        DEL
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, padding: '10px 14px', background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, fontSize: 10, color: BT.text.muted }}>
        {filtered.length} template{filtered.length !== 1 ? 's' : ''} · Default templates cannot be deleted · Templates are shared with your organization
      </div>
    </div>
  );
}
