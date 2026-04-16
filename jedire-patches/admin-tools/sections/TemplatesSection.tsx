/**
 * Templates Section
 * Pro forma, report, email, and checklist templates
 */

import React, { useState } from 'react';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538', input: '#0D1117' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', cyan: '#00BCD4', purple: '#A78BFA', orange: '#FF8C42' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};
const MONO = "'JetBrains Mono', monospace";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  lastModified: string;
  usageCount: number;
  isDefault: boolean;
}

const TEMPLATE_CATEGORIES = [
  { id: 'proforma', name: 'Pro Forma', icon: '📊', color: BT.text.green },
  { id: 'reports', name: 'Reports', icon: '📄', color: BT.text.cyan },
  { id: 'email', name: 'Email', icon: '📧', color: BT.text.purple },
  { id: 'checklist', name: 'Checklists', icon: '✅', color: BT.text.orange },
];

const MOCK_TEMPLATES: Template[] = [
  // Pro Forma
  { id: '1', name: 'Multifamily Acquisition', description: 'Standard MF acquisition pro forma with 10-year hold', category: 'proforma', lastModified: '2024-03-20', usageCount: 24, isDefault: true },
  { id: '2', name: 'Build-to-Rent', description: 'BTR development pro forma with construction draws', category: 'proforma', lastModified: '2024-03-15', usageCount: 12, isDefault: false },
  { id: '3', name: 'Value-Add Reposition', description: 'Heavy renovation with unit-by-unit underwriting', category: 'proforma', lastModified: '2024-03-10', usageCount: 8, isDefault: false },
  
  // Reports
  { id: '4', name: 'Monthly Investor Update', description: 'LP update with KPIs, narrative, and financials', category: 'reports', lastModified: '2024-03-25', usageCount: 36, isDefault: true },
  { id: '5', name: 'Acquisition Summary', description: 'One-pager deal summary for investment committee', category: 'reports', lastModified: '2024-03-18', usageCount: 18, isDefault: false },
  { id: '6', name: 'Market Analysis', description: 'MSA overview with supply/demand metrics', category: 'reports', lastModified: '2024-03-12', usageCount: 15, isDefault: false },
  
  // Email
  { id: '7', name: 'LOI Submission', description: 'Initial LOI cover letter to seller/broker', category: 'email', lastModified: '2024-03-22', usageCount: 42, isDefault: true },
  { id: '8', name: 'Investor Introduction', description: 'New deal introduction to LP network', category: 'email', lastModified: '2024-03-20', usageCount: 28, isDefault: false },
  { id: '9', name: 'Due Diligence Request', description: 'Standard DD document request list', category: 'email', lastModified: '2024-03-15', usageCount: 21, isDefault: false },
  
  // Checklists
  { id: '10', name: 'Acquisition DD Checklist', description: 'Comprehensive due diligence items for acquisitions', category: 'checklist', lastModified: '2024-03-24', usageCount: 31, isDefault: true },
  { id: '11', name: 'Closing Checklist', description: 'Pre-closing and closing day items', category: 'checklist', lastModified: '2024-03-19', usageCount: 19, isDefault: false },
  { id: '12', name: 'Post-Acquisition Checklist', description: 'Day 1-90 transition items', category: 'checklist', lastModified: '2024-03-14', usageCount: 14, isDefault: false },
];

export default function TemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>(MOCK_TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (catId: string) => TEMPLATE_CATEGORIES.find(c => c.id === catId);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: BT.text.amber, fontFamily: MONO, marginBottom: 8 }}>
            TEMPLATES
          </h1>
          <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO }}>
            Manage pro forma, report, email, and checklist templates
          </p>
        </div>
        
        <button style={{
          padding: '10px 20px',
          background: BT.text.cyan,
          color: BT.bg.terminal,
          border: 'none',
          borderRadius: 4,
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          textTransform: 'uppercase',
        }}>
          + NEW TEMPLATE
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: BT.bg.input,
            border: `1px solid ${BT.border.medium}`,
            borderRadius: 4,
            color: BT.text.primary,
            fontFamily: MONO,
            fontSize: 12,
          }}
        />
        
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '8px 14px',
              background: !selectedCategory ? BT.text.cyan : BT.bg.panel,
              color: !selectedCategory ? BT.bg.terminal : BT.text.secondary,
              border: `1px solid ${!selectedCategory ? BT.text.cyan : BT.border.medium}`,
              borderRadius: 4,
              fontFamily: MONO,
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            All
          </button>
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '8px 14px',
                background: selectedCategory === cat.id ? cat.color : BT.bg.panel,
                color: selectedCategory === cat.id ? BT.bg.terminal : BT.text.secondary,
                border: `1px solid ${selectedCategory === cat.id ? cat.color : BT.border.medium}`,
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 10,
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Category Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {TEMPLATE_CATEGORIES.map(cat => {
          const count = templates.filter(t => t.category === cat.id).length;
          return (
            <div
              key={cat.id}
              style={{
                padding: 16,
                background: BT.bg.panel,
                border: `1px solid ${BT.border.subtle}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <span style={{ fontSize: 11, color: cat.color, fontFamily: MONO, fontWeight: 600 }}>
                  {cat.name}
                </span>
              </div>
              <div style={{ fontSize: 24, color: BT.text.primary, fontFamily: MONO, fontWeight: 600 }}>
                {count}
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>
                templates
              </div>
            </div>
          );
        })}
      </div>

      {/* Templates List */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 120px 100px 80px 100px',
          padding: '12px 16px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Template</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Category</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Modified</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase', textAlign: 'center' }}>Uses</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Actions</span>
        </div>

        {/* Rows */}
        {filteredTemplates.map((template) => {
          const catInfo = getCategoryInfo(template.category);
          return (
            <div
              key={template.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 120px 100px 80px 100px',
                padding: '14px 16px',
                borderBottom: `1px solid ${BT.border.subtle}`,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO, fontWeight: 500 }}>
                    {template.name}
                  </span>
                  {template.isDefault && (
                    <span style={{
                      padding: '2px 6px',
                      background: BT.text.amber + '22',
                      color: BT.text.amber,
                      fontSize: 8,
                      fontFamily: MONO,
                      borderRadius: 2,
                      textTransform: 'uppercase',
                    }}>
                      Default
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>
                  {template.description}
                </div>
              </div>
              
              <div>
                <span style={{
                  padding: '4px 8px',
                  background: (catInfo?.color || BT.text.secondary) + '22',
                  color: catInfo?.color || BT.text.secondary,
                  fontSize: 9,
                  fontFamily: MONO,
                  borderRadius: 3,
                }}>
                  {catInfo?.icon} {catInfo?.name}
                </span>
              </div>
              
              <div style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>
                {template.lastModified}
              </div>
              
              <div style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO, textAlign: 'center' }}>
                {template.usageCount}
              </div>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{
                  background: 'transparent',
                  border: 'none',
                  color: BT.text.cyan,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: MONO,
                }}>
                  Edit
                </button>
                <button style={{
                  background: 'transparent',
                  border: 'none',
                  color: BT.text.secondary,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: MONO,
                }}>
                  Duplicate
                </button>
              </div>
            </div>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: BT.text.muted, fontFamily: MONO, fontSize: 12 }}>
            No templates match your filters
          </div>
        )}
      </div>
    </div>
  );
}
