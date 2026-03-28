import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BT, BT_CSS } from '../../components/deal/bloomberg-ui';
import { DueDiligencePage } from './DueDiligencePage';
import { apiClient } from '../../services/api.client';

const mono: React.CSSProperties = { fontFamily: BT.font.mono };

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

interface FileItem {
  id: string;
  original_filename: string;
  file_size: number;
  file_extension: string;
  mime_type: string;
  status: string;
  category: string;
  is_required: boolean;
  expiration_date: string | null;
  folder_path: string;
  created_at: string;
}

const DEMO_FILES: FileItem[] = [
  { id: '1', original_filename: 'PSA.pdf', file_size: 2516582, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'legal', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-20T10:00:00Z' },
  { id: '2', original_filename: 'OM.pdf', file_size: 8493465, file_extension: 'pdf', mime_type: 'application/pdf', status: 'draft', category: 'offering_memo', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-18T10:00:00Z' },
  { id: '3', original_filename: 'T12.xlsx', file_size: 159744, file_extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'final', category: 'financial', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-15T10:00:00Z' },
  { id: '4', original_filename: 'LOI.pdf', file_size: 1258291, file_extension: 'pdf', mime_type: 'application/pdf', status: 'pending-review', category: 'legal', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-22T10:00:00Z' },
  { id: '5', original_filename: 'Photo1.jpg', file_size: 4404019, file_extension: 'jpg', mime_type: 'image/jpeg', status: 'final', category: 'media', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-10T10:00:00Z' },
  { id: '6', original_filename: 'Survey.pdf', file_size: 12582912, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'survey', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-08T10:00:00Z' },
  { id: '7', original_filename: 'Title.pdf', file_size: 3984588, file_extension: 'pdf', mime_type: 'application/pdf', status: 'pending-review', category: 'title', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-05T10:00:00Z' },
  { id: '9', original_filename: 'Rent_Roll_Q1.xlsx', file_size: 245760, file_extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'final', category: 'rent_roll', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-03-12T10:00:00Z' },
  { id: '10', original_filename: 'Appraisal.pdf', file_size: 5242880, file_extension: 'pdf', mime_type: 'application/pdf', status: 'draft', category: 'appraisal', is_required: true, expiration_date: '2026-02-15T00:00:00Z', folder_path: '/', created_at: '2026-02-01T10:00:00Z' },
  { id: '11', original_filename: 'Insurance_COI.pdf', file_size: 1048576, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'insurance', is_required: true, expiration_date: '2026-01-31T00:00:00Z', folder_path: '/', created_at: '2026-01-15T10:00:00Z' },
  { id: '12', original_filename: 'Phase1_ESA.pdf', file_size: 8388608, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'environmental', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-02-20T10:00:00Z' },
  { id: '13', original_filename: 'Operating_Statement.xlsx', file_size: 327680, file_extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'final', category: 'financial', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-14T10:00:00Z' },
  { id: '14', original_filename: 'Zoning_Letter.pdf', file_size: 524288, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'zoning', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-02T10:00:00Z' },
  { id: '15', original_filename: 'Exterior_Photo2.jpg', file_size: 3670016, file_extension: 'jpg', mime_type: 'image/jpeg', status: 'final', category: 'media', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-10T10:00:00Z' },
  { id: '16', original_filename: 'Floor_Plans.pdf', file_size: 15728640, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'architectural', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-02-28T10:00:00Z' },
  { id: '17', original_filename: 'Stacking_Plan.xlsx', file_size: 204800, file_extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'draft', category: 'rent_roll', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-16T10:00:00Z' },
  { id: '18', original_filename: 'Loan_Quote_BankA.pdf', file_size: 786432, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'loan_docs', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-19T10:00:00Z' },
  { id: '20', original_filename: 'Inspection_Report.pdf', file_size: 6291456, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'inspection', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-02-25T10:00:00Z' },
  { id: '21', original_filename: 'Capex_Budget.xlsx', file_size: 163840, file_extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'final', category: 'financial', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-11T10:00:00Z' },
  { id: '22', original_filename: 'Market_Comp.pdf', file_size: 2097152, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'comps', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-06T10:00:00Z' },
];

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'all', label: 'All Files', icon: '📁', color: BT.text.primary },
  { id: 'legal', label: 'Legal', icon: '⚖️', color: BT.text.purple },
  { id: 'financial', label: 'Financial', icon: '💰', color: BT.text.green },
  { id: 'offering_memo', label: 'Offering Memo', icon: '📑', color: BT.text.cyan },
  { id: 'rent_roll', label: 'Rent Roll', icon: '📊', color: BT.text.amber },
  { id: 'survey', label: 'Survey', icon: '📐', color: BT.text.orange },
  { id: 'title', label: 'Title', icon: '📜', color: BT.text.teal },
  { id: 'inspection', label: 'Inspection', icon: '🔍', color: BT.text.red },
  { id: 'appraisal', label: 'Appraisal', icon: '🏠', color: BT.text.violet },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', color: BT.text.cyan },
  { id: 'environmental', label: 'Environmental', icon: '🌿', color: BT.text.green },
  { id: 'media', label: 'Photos & Media', icon: '📷', color: BT.text.amber },
  { id: 'loan_docs', label: 'Loan Docs', icon: '🏦', color: BT.text.purple },
  { id: 'architectural', label: 'Architectural', icon: '📏', color: BT.text.cyan },
  { id: 'zoning', label: 'Zoning', icon: '🗺️', color: BT.text.orange },
  { id: 'comps', label: 'Comps', icon: '📈', color: BT.text.green },
];

function fmtSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

function getIcon(ext: string): string {
  const e = ext?.toLowerCase().replace('.', '');
  if (['pdf'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📊';
  if (['doc', 'docx', 'txt'].includes(e)) return '📝';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(e)) return '🖼️';
  if (['zip', 'rar', '7z'].includes(e)) return '🗜️';
  return '📎';
}

function statusColor(s: string): string {
  if (s === 'final') return BT.text.green;
  if (s === 'draft') return BT.text.amber;
  if (s === 'pending-review') return BT.text.orange;
  if (s === 'expired') return BT.text.red;
  return BT.text.muted;
}

function statusLabel(s: string): string {
  if (s === 'final') return 'FINAL';
  if (s === 'draft') return 'DRAFT';
  if (s === 'pending-review') return 'REVIEW';
  if (s === 'expired') return 'EXPIRED';
  return s.toUpperCase();
}

export function DocumentsShellPage({ dealId: propDealId, deal }: DocumentsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [files, setFiles] = useState<FileItem[]>(DEMO_FILES);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeView, setActiveView] = useState<'files' | 'lifecycle'>('files');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/deals/${resolvedDealId}/files`)
      .then((res: any) => {
        const fetched = res.data?.data?.files ?? res.files ?? [];
        if (fetched.length > 0) setFiles(fetched);
      })
      .catch(() => {});
  }, [resolvedDealId]);

  const filtered = files.filter(f => {
    if (activeCategory !== 'all' && f.category !== activeCategory) return false;
    if (searchQuery && !f.original_filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: files.length,
    totalSize: files.reduce((s, f) => s + f.file_size, 0),
    required: files.filter(f => f.is_required).length,
    requiredComplete: files.filter(f => f.is_required && f.status === 'final').length,
    drafts: files.filter(f => f.status === 'draft').length,
    pendingReview: files.filter(f => f.status === 'pending-review').length,
  };

  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return files.length;
    return files.filter(f => f.category === catId).length;
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: BT.bg.terminal, color: BT.text.primary }}>
      <style>{BT_CSS}</style>

      {/* Sidebar */}
      <div style={{ width: 220, borderRight: `1px solid ${BT.border.subtle}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: BT.bg.panel }}>
        {/* Sidebar Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: BT.text.primary, ...mono }}>DOCUMENTS</div>
          <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 4, ...mono }}>{stats.total} files · {fmtSize(stats.totalSize)}</div>
        </div>

        {/* Quick Stats */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: BT.bg.panelAlt, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: stats.requiredComplete === stats.required ? BT.text.green : BT.text.amber, ...mono }}>{stats.requiredComplete}/{stats.required}</div>
            <div style={{ fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>REQUIRED</div>
          </div>
          <div style={{ background: BT.bg.panelAlt, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: stats.pendingReview > 0 ? BT.text.orange : BT.text.muted, ...mono }}>{stats.pendingReview}</div>
            <div style={{ fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>REVIEW</div>
          </div>
        </div>

        {/* Main Views */}
        <div style={{ padding: '8px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
          {[
            { id: 'files', label: 'Files', icon: '📁' },
            { id: 'lifecycle', label: 'Deal Lifecycle', icon: '📋' },
          ].map(view => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as 'files' | 'lifecycle')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                background: activeView === view.id ? BT.bg.active : 'transparent',
                border: 'none', borderLeft: activeView === view.id ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                color: activeView === view.id ? BT.text.amber : BT.text.secondary,
                cursor: 'pointer', textAlign: 'left', ...mono, fontSize: 10, fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 12 }}>{view.icon}</span>
              <span>{view.label}</span>
            </button>
          ))}
        </div>

        {/* Categories */}
        {activeView === 'files' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            <div style={{ padding: '4px 16px 8px', fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: 1, ...mono }}>CATEGORIES</div>
            {CATEGORIES.map(cat => {
              const count = getCategoryCount(cat.id);
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px',
                    background: isActive ? BT.bg.active : 'transparent',
                    border: 'none', borderLeft: isActive ? `2px solid ${cat.color}` : '2px solid transparent',
                    color: isActive ? BT.text.primary : BT.text.secondary,
                    cursor: 'pointer', textAlign: 'left', ...mono, fontSize: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11 }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  {count > 0 && (
                    <span style={{ fontSize: 9, color: BT.text.muted, background: BT.bg.panelAlt, padding: '1px 6px', fontWeight: 600 }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Upload Button */}
        <div style={{ padding: 12, borderTop: `1px solid ${BT.border.subtle}` }}>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              width: '100%', padding: '10px 16px', background: BT.text.cyan, color: BT.bg.terminal,
              border: 'none', cursor: 'pointer', ...mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            }}
          >
            ⬆ UPLOAD FILES
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeView === 'files' ? (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...mono, fontSize: 10 }}>
                  <span style={{ color: BT.text.muted }}>Documents</span>
                  <span style={{ color: BT.text.muted }}>/</span>
                  <span style={{ color: BT.text.primary, fontWeight: 600 }}>
                    {CATEGORIES.find(c => c.id === activeCategory)?.label || 'All Files'}
                  </span>
                </div>
                <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>{filtered.length} files</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, padding: '4px 10px', width: 200 }}>
                  <span style={{ fontSize: 10, color: BT.text.muted }}>🔍</span>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search files..."
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', ...mono, fontSize: 10, color: BT.text.primary }}
                  />
                </div>
                {/* View Toggle */}
                <div style={{ display: 'flex', border: `1px solid ${BT.border.subtle}` }}>
                  {(['list', 'grid'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      style={{
                        padding: '4px 10px', background: viewMode === mode ? BT.bg.active : 'transparent',
                        border: 'none', color: viewMode === mode ? BT.text.primary : BT.text.muted,
                        cursor: 'pointer', ...mono, fontSize: 10,
                      }}
                    >
                      {mode === 'list' ? '☰' : '▦'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Upload Zone */}
            {showUpload && (
              <div style={{ margin: 16, padding: 32, border: `2px dashed ${BT.text.cyan}44`, background: BT.bg.panelAlt, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📤</div>
                <div style={{ fontSize: 11, color: BT.text.secondary, marginBottom: 4, ...mono }}>Drag & drop files here</div>
                <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 16 }}>or click to browse</div>
                <button onClick={() => setShowUpload(false)} style={{ ...mono, fontSize: 9, color: BT.text.muted, background: 'transparent', border: `1px solid ${BT.border.subtle}`, padding: '4px 12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}

            {/* File Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {viewMode === 'list' ? (
                <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
                  {/* Table Header */}
                  <div style={{ display: 'flex', padding: '8px 12px', borderBottom: `1px solid ${BT.border.medium}`, background: BT.bg.header }}>
                    <div style={{ width: '40%', fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>NAME</div>
                    <div style={{ width: '15%', fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>CATEGORY</div>
                    <div style={{ width: '12%', fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>SIZE</div>
                    <div style={{ width: '12%', fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>STATUS</div>
                    <div style={{ width: '21%', fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>MODIFIED</div>
                  </div>
                  {/* Table Rows */}
                  {filtered.map((f, i) => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFile(f)}
                      style={{
                        display: 'flex', padding: '10px 12px', borderBottom: `1px solid ${BT.border.subtle}`,
                        background: selectedFile?.id === f.id ? BT.bg.active : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                        cursor: 'pointer', alignItems: 'center',
                      }}
                    >
                      <div style={{ width: '40%', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{getIcon(f.file_extension)}</span>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: BT.text.primary }}>{f.original_filename}</div>
                          {f.is_required && <span style={{ fontSize: 8, color: BT.text.amber, fontWeight: 700, ...mono }}>REQUIRED</span>}
                        </div>
                      </div>
                      <div style={{ width: '15%', fontSize: 9, color: BT.text.secondary, ...mono }}>{f.category.replace(/_/g, ' ').toUpperCase()}</div>
                      <div style={{ width: '12%', fontSize: 9, color: BT.text.muted, ...mono }}>{fmtSize(f.file_size)}</div>
                      <div style={{ width: '12%' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: statusColor(f.status), background: statusColor(f.status) + '18', padding: '2px 6px', ...mono }}>{statusLabel(f.status)}</span>
                      </div>
                      <div style={{ width: '21%', fontSize: 9, color: BT.text.muted, ...mono }}>{new Date(f.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📄</div>
                      <div style={{ fontSize: 10, color: BT.text.muted, ...mono }}>No files found</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {filtered.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFile(f)}
                      style={{
                        background: selectedFile?.id === f.id ? BT.bg.active : BT.bg.panel,
                        border: `1px solid ${selectedFile?.id === f.id ? BT.text.cyan : BT.border.subtle}`,
                        padding: 16, textAlign: 'center', cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 36, marginBottom: 8 }}>{getIcon(f.file_extension)}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: BT.text.primary, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_filename}</div>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 6, ...mono }}>{fmtSize(f.file_size)}</div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: statusColor(f.status), background: statusColor(f.status) + '18', padding: '2px 8px', ...mono }}>{statusLabel(f.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <DueDiligencePage dealId={resolvedDealId} deal={deal as any} />
          </div>
        )}
      </div>

      {/* File Detail Panel */}
      {selectedFile && activeView === 'files' && (
        <div style={{ width: 280, borderLeft: `1px solid ${BT.border.subtle}`, background: BT.bg.panel, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>FILE DETAILS</span>
            <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: BT.text.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
          <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{getIcon(selectedFile.file_extension)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, wordBreak: 'break-word' }}>{selectedFile.original_filename}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Status', value: statusLabel(selectedFile.status), color: statusColor(selectedFile.status) },
                { label: 'Category', value: selectedFile.category.replace(/_/g, ' ').toUpperCase() },
                { label: 'Size', value: fmtSize(selectedFile.file_size) },
                { label: 'Type', value: selectedFile.file_extension.toUpperCase() },
                { label: 'Required', value: selectedFile.is_required ? 'Yes' : 'No', color: selectedFile.is_required ? BT.text.amber : BT.text.muted },
                { label: 'Created', value: new Date(selectedFile.created_at).toLocaleDateString() },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>{row.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: row.color || BT.text.primary, ...mono }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ width: '100%', padding: '8px 16px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: 'pointer', ...mono, fontSize: 10, fontWeight: 700 }}>
                ⬇ DOWNLOAD
              </button>
              <button style={{ width: '100%', padding: '8px 16px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, cursor: 'pointer', ...mono, fontSize: 10 }}>
                📋 COPY LINK
              </button>
              <button style={{ width: '100%', padding: '8px 16px', background: 'transparent', color: BT.text.red, border: `1px solid ${BT.text.red}44`, cursor: 'pointer', ...mono, fontSize: 10 }}>
                🗑 DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsShellPage;
