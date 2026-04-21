import React, { useState } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  lastModified: string;
  isDefault: boolean;
}

const CATEGORIES = ['All', 'ProForma', 'LOI', 'PSA', 'Investment Memo', 'Due Diligence', 'Email'];

const DEFAULT_TEMPLATES: Template[] = [
  { id: '1', name: 'Multifamily ProForma — Base', category: 'ProForma', description: 'Standard 10-year DCF for multifamily acquisitions', lastModified: '2026-04-01', isDefault: true },
  { id: '2', name: 'Industrial ProForma — NNN', category: 'ProForma', description: 'Triple-net lease cash flow model', lastModified: '2026-03-18', isDefault: true },
  { id: '3', name: 'Letter of Intent — Standard', category: 'LOI', description: 'Non-binding offer template with standard CRE terms', lastModified: '2026-02-14', isDefault: true },
  { id: '4', name: 'PSA — Simple Purchase', category: 'PSA', description: 'Simplified purchase and sale agreement for direct deals', lastModified: '2026-01-30', isDefault: true },
  { id: '5', name: 'Investment Committee Memo', category: 'Investment Memo', description: 'IC memo template with executive summary, underwriting, risks', lastModified: '2026-04-10', isDefault: true },
  { id: '6', name: 'Due Diligence Checklist', category: 'Due Diligence', description: 'Comprehensive DD checklist covering physical, legal, financial', lastModified: '2026-03-22', isDefault: true },
  { id: '7', name: 'Seller Outreach Email', category: 'Email', description: 'Initial off-market outreach email to property owners', lastModified: '2026-04-15', isDefault: false },
];

export function TemplatesSettings() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('ProForma');
  const [newDesc, setNewDesc] = useState('');
  const [search, setSearch] = useState('');

  const filtered = templates.filter(t => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    const t: Template = {
      id: Date.now().toString(),
      name: newName.trim(),
      category: newCategory,
      description: newDesc.trim(),
      lastModified: new Date().toISOString().slice(0, 10),
      isDefault: false,
    };
    setTemplates(prev => [...prev, t]);
    setNewName('');
    setNewCategory('ProForma');
    setNewDesc('');
    setShowNewForm(false);
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id || t.isDefault));
  };

  const inputStyle: React.CSSProperties = {
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 0,
    color: BT.text.primary,
    outline: 'none',
    fontSize: 12,
    padding: '6px 10px',
    width: '100%',
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
          onClick={() => setShowNewForm(!showNewForm)}
          style={{ fontSize: 10, fontWeight: 600, padding: '6px 14px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: 'pointer', borderRadius: 0 }}
        >
          + NEW TEMPLATE
        </button>
      </div>

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
          <div className="flex gap-2">
            <button onClick={handleCreate} style={{ fontSize: 10, fontWeight: 600, padding: '6px 14px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: 'pointer' }}>
              CREATE
            </button>
            <button onClick={() => setShowNewForm(false)} style={{ fontSize: 10, padding: '6px 14px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.medium}`, cursor: 'pointer' }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <input
          style={{ ...inputStyle, width: 200 }}
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '4px 8px',
                background: activeCategory === cat ? BT.bg.active : 'transparent',
                color: activeCategory === cat ? BT.text.cyan : BT.text.muted,
                border: `1px solid ${activeCategory === cat ? BT.text.cyan + '44' : BT.border.subtle}`,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: BT.text.muted, fontSize: 11 }}>No templates found</div>
        )}
        {filtered.map(t => (
          <div key={t.id} style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>{t.name}</span>
                {t.isDefault && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', background: BT.text.cyan + '22', color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>DEFAULT</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: BT.text.secondary }}>{t.description}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{t.category.toUpperCase()}</div>
              <div style={{ fontSize: 9, color: BT.text.muted }}>Modified {t.lastModified}</div>
            </div>
            <div className="flex gap-2 ml-2">
              <button style={{ fontSize: 9, padding: '4px 8px', background: 'transparent', color: BT.text.cyan, border: `1px solid ${BT.text.cyan}44`, cursor: 'pointer' }}>
                EDIT
              </button>
              {!t.isDefault && (
                <button onClick={() => handleDelete(t.id)} style={{ fontSize: 9, padding: '4px 8px', background: 'transparent', color: BT.text.red, border: `1px solid ${BT.text.red}44`, cursor: 'pointer' }}>
                  DEL
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: '10px 14px', background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, fontSize: 10, color: BT.text.muted }}>
        {filtered.length} template{filtered.length !== 1 ? 's' : ''} · Default templates cannot be deleted · Custom templates are shared with your organization
      </div>
    </div>
  );
}
