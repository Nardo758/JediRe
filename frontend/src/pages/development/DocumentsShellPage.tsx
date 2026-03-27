import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BT, BT_CSS } from '../../components/deal/bloomberg-ui';
import { DueDiligencePage } from './DueDiligencePage';
import { apiClient } from '../../services/api.client';

const mono = { fontFamily: BT.font.mono } as React.CSSProperties;
const sans = { fontFamily: BT.font.label } as React.CSSProperties;

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

interface FileStats {
  total: number;
  totalSizeMb: number;
  requiredFilled: number;
  requiredTotal: number;
  expired: number;
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
  { id: '8', original_filename: 'Leases/', file_size: 0, file_extension: 'folder', mime_type: 'folder', status: 'final', category: 'leases', is_required: false, expiration_date: null, folder_path: '/leases', created_at: '2026-03-01T10:00:00Z' },
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
  { id: '19', original_filename: 'Loan_Quote_BankB.pdf', file_size: 819200, file_extension: 'pdf', mime_type: 'application/pdf', status: 'draft', category: 'loan_docs', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-19T10:00:00Z' },
  { id: '20', original_filename: 'Inspection_Report.pdf', file_size: 6291456, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'inspection', is_required: true, expiration_date: null, folder_path: '/', created_at: '2026-02-25T10:00:00Z' },
  { id: '21', original_filename: 'Capex_Budget.xlsx', file_size: 163840, file_extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'final', category: 'financial', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-11T10:00:00Z' },
  { id: '22', original_filename: 'Market_Comp.pdf', file_size: 2097152, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'comps', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-06T10:00:00Z' },
  { id: '23', original_filename: 'Utility_Bills.pdf', file_size: 1572864, file_extension: 'pdf', mime_type: 'application/pdf', status: 'final', category: 'financial', is_required: false, expiration_date: null, folder_path: '/', created_at: '2026-03-04T10:00:00Z' },
  { id: '24', original_filename: 'Lease_Abstract.docx', file_size: 409600, file_extension: 'docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'final', category: 'leases', is_required: false, expiration_date: null, folder_path: '/leases', created_at: '2026-03-03T10:00:00Z' },
];

const MISSING_REQUIRED = ['PSA (Executed)', 'Title Report (Final)', 'Survey (ALTA)'];

function fmtSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return Math.round(bytes / 1048576) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

function getIcon(ext: string): string {
  const e = ext?.toLowerCase().replace('.', '');
  if (e === 'folder') return '📁';
  if (['pdf'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📊';
  if (['doc', 'docx', 'txt'].includes(e)) return '📋';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(e)) return '🖼️';
  if (['zip', 'rar', '7z'].includes(e)) return '🗜️';
  return '📎';
}

function statusColor(s: string): string {
  if (s === 'final') return BT.text.green;
  if (s === 'draft') return BT.text.amber;
  if (s === 'pending-review') return BT.text.orange;
  if (s === 'expired') return BT.text.red;
  if (s === 'archived') return BT.text.muted;
  return BT.text.secondary;
}

function statusLabel(s: string): string {
  if (s === 'final') return 'FINAL';
  if (s === 'draft') return 'DRAFT';
  if (s === 'pending-review') return 'REVIEW';
  if (s === 'expired') return 'EXPIRED';
  if (s === 'archived') return 'ARCHIVED';
  return s.toUpperCase();
}

const TABS = ['FILES', 'DEAL LIFECYCLE'] as const;
const CATEGORIES = ['all', 'legal', 'financial', 'offering_memo', 'rent_roll', 'survey', 'title', 'inspection', 'appraisal', 'insurance', 'environmental', 'media', 'leases', 'loan_docs', 'comps', 'architectural', 'zoning'] as const;
const STATUSES = ['all', 'final', 'draft', 'pending-review', 'expired', 'archived'] as const;

export function DocumentsShellPage({ dealId: propDealId, deal }: DocumentsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [files, setFiles] = useState<FileItem[]>(DEMO_FILES);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'folder'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/deals/${resolvedDealId}/files`)
      .then((res: { data?: { data?: { files?: FileItem[] } }; files?: FileItem[] }) => {
        const fetched = res.data?.data?.files ?? (res as { files?: FileItem[] }).files ?? [];
        if (fetched.length > 0) setFiles(fetched);
      })
      .catch(() => {});
  }, [resolvedDealId]);

  const stats: FileStats = {
    total: files.length,
    totalSizeMb: files.reduce((s, f) => s + f.file_size, 0),
    requiredFilled: files.filter(f => f.is_required && f.status === 'final').length,
    requiredTotal: files.filter(f => f.is_required).length,
    expired: files.filter(f => f.expiration_date && new Date(f.expiration_date) < new Date()).length,
  };

  const filtered = files.filter(f => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && f.status !== selectedStatus) return false;
    if (searchQuery && !f.original_filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const folderGroups = filtered.reduce<Record<string, FileItem[]>>((acc, f) => {
    const cat = f.category || 'uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, color: BT.text.primary }}>
      <style>{BT_CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BT.border.medium}`, background: BT.bg.header, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: BT.text.primary, ...mono }}>📋 DOCUMENTS & FILES</div>
          <div style={{ fontSize: 9, color: BT.text.muted, letterSpacing: 0.5, marginTop: 2, ...mono }}>Acquisition & Due Diligence</div>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: BT.bg.terminal, background: BT.text.cyan, border: 'none', padding: '6px 16px', cursor: 'pointer' }}
        >
          ⬆ Upload Files
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '8px 18px', cursor: 'pointer',
              background: 'transparent', border: 'none', borderBottom: activeTab === i ? `2px solid ${BT.text.amber}` : '2px solid transparent',
              color: activeTab === i ? BT.text.amber : BT.text.muted,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
              {[
                { label: 'TOTAL FILES', value: String(stats.total), color: BT.text.secondary },
                { label: 'TOTAL SIZE', value: fmtSize(stats.totalSizeMb), color: BT.text.cyan },
                { label: 'REQUIRED', value: `${stats.requiredFilled}/${stats.requiredTotal}`, color: stats.requiredFilled === stats.requiredTotal ? BT.text.green : BT.text.amber },
                { label: 'EXPIRED', value: String(stats.expired), color: stats.expired > 0 ? BT.text.red : BT.text.green },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: BT.bg.panel, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: BT.text.muted, marginBottom: 4, ...mono }}>{kpi.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, ...mono }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {MISSING_REQUIRED.length > 0 && (
              <div style={{ margin: '1px 0 0', background: BT.text.amber + '12', border: `1px solid ${BT.text.amber}33`, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12 }}>⚠️</span>
                  <span style={{ fontSize: 10, color: BT.text.amber, fontWeight: 600, ...sans }}>
                    Missing Files: {MISSING_REQUIRED.join(', ')}
                  </span>
                </div>
                <button
                  onClick={() => setShowUpload(true)}
                  style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: BT.bg.terminal, background: BT.text.amber, border: 'none', padding: '4px 12px', cursor: 'pointer' }}
                >
                  Upload Now
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panelAlt }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, padding: '4px 8px', height: 26 }}>
                <span style={{ fontSize: 10, color: BT.text.muted }}>🔍</span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', ...mono, fontSize: 10, color: BT.text.primary }}
                />
              </div>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ ...mono, fontSize: 9, background: BT.bg.input, color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, padding: '4px 8px', height: 26, cursor: 'pointer', outline: 'none' }}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'Category ▾' : c.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                style={{ ...mono, fontSize: 9, background: BT.bg.input, color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, padding: '4px 8px', height: 26, cursor: 'pointer', outline: 'none' }}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s === 'all' ? 'Status ▾' : s.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 0, padding: '0 12px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel }}>
              {([['grid', '▦ Grid'], ['list', '☰ List'], ['folder', '📁 Folders']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    ...mono, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, padding: '6px 14px', cursor: 'pointer',
                    background: 'transparent', border: 'none', borderBottom: viewMode === mode ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
                    color: viewMode === mode ? BT.text.primary : BT.text.muted, marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {showUpload && (
              <div style={{ margin: 12, padding: 20, border: `2px dashed ${BT.text.cyan}44`, background: BT.bg.panelAlt, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📤</div>
                <div style={{ fontSize: 10, color: BT.text.secondary, ...sans }}>Drag & drop files here, or click to browse</div>
                <button onClick={() => setShowUpload(false)} style={{ ...mono, fontSize: 9, color: BT.text.muted, background: 'transparent', border: `1px solid ${BT.border.subtle}`, padding: '3px 10px', cursor: 'pointer', marginTop: 10 }}>Cancel</button>
              </div>
            )}

            <div style={{ padding: 12 }}>
              {viewMode === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {filtered.map(f => (
                    <FileCard key={f.id} file={f} />
                  ))}
                  {filtered.length === 0 && <EmptyState onUpload={() => setShowUpload(true)} />}
                </div>
              )}

              {viewMode === 'list' && (
                <div>
                  <div style={{ display: 'flex', padding: '4px 8px', borderBottom: `1px solid ${BT.border.medium}`, background: BT.bg.header }}>
                    {[{ l: 'Name', w: '40%' }, { l: 'Category', w: '15%' }, { l: 'Size', w: '12%' }, { l: 'Status', w: '12%' }, { l: 'Date', w: '21%' }].map(h => (
                      <div key={h.l} style={{ width: h.w, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: BT.text.muted, padding: '2px 4px', ...mono }}>{h.l}</div>
                    ))}
                  </div>
                  {filtered.map((f, i) => (
                    <div key={f.id} style={{ display: 'flex', padding: '6px 8px', borderBottom: `1px solid ${BT.border.subtle}`, background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt)}>
                      <div style={{ width: '40%', display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
                        <span style={{ fontSize: 14 }}>{getIcon(f.file_extension)}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...sans }}>{f.original_filename}</span>
                      </div>
                      <div style={{ width: '15%', padding: '0 4px' }}>
                        <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>{f.category.replace(/_/g, ' ').toUpperCase()}</span>
                      </div>
                      <div style={{ width: '12%', padding: '0 4px' }}>
                        <span style={{ fontSize: 9, color: BT.text.secondary, ...mono }}>{fmtSize(f.file_size)}</span>
                      </div>
                      <div style={{ width: '12%', padding: '0 4px' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: statusColor(f.status), background: statusColor(f.status) + '18', padding: '1px 6px', letterSpacing: 0.5, ...mono }}>{statusLabel(f.status)}</span>
                      </div>
                      <div style={{ width: '21%', padding: '0 4px' }}>
                        <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <EmptyState onUpload={() => setShowUpload(true)} />}
                </div>
              )}

              {viewMode === 'folder' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(folderGroups).map(([cat, catFiles]) => (
                    <div key={cat} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <span style={{ fontSize: 12 }}>📁</span>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: BT.text.amber, ...mono }}>{cat.replace(/_/g, ' ').toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>{catFiles.length} files</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, padding: 8 }}>
                        {catFiles.map(f => (
                          <FileCard key={f.id} file={f} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(folderGroups).length === 0 && <EmptyState onUpload={() => setShowUpload(true)} />}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div style={{ padding: 1 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DueDiligencePage dealId={resolvedDealId} deal={deal as any} />
          </div>
        )}
      </div>
    </div>
  );
}

function FileCard({ file }: { file: FileItem }) {
  const isFolder = file.file_extension === 'folder';
  return (
    <div style={{
      background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer',
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = BT.text.cyan + '66')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = BT.border.subtle)}>
      <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 2 }}>
        {getIcon(file.file_extension)}
      </div>
      <div style={{ fontSize: 9, fontWeight: 600, color: BT.text.primary, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontFamily: BT.font.label }}>
        {file.original_filename}
      </div>
      <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: BT.font.mono }}>
        {isFolder ? `${8} files` : fmtSize(file.file_size)}
      </div>
      {!isFolder && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
          color: statusColor(file.status), background: statusColor(file.status) + '18',
          padding: '1px 6px', fontFamily: BT.font.mono,
        }}>
          {statusLabel(file.status)}
        </span>
      )}
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>📄</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.secondary, marginBottom: 4, fontFamily: BT.font.mono }}>No files match</div>
      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 12, fontFamily: BT.font.label }}>Upload documents or adjust your filters</div>
      <button onClick={onUpload} style={{ fontFamily: BT.font.mono, fontSize: 9, fontWeight: 700, color: BT.text.cyan, background: 'transparent', border: `1px solid ${BT.text.cyan}44`, padding: '4px 12px', cursor: 'pointer' }}>Upload File</button>
    </div>
  );
}

export default DocumentsShellPage;
