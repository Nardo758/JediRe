import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  dataLibraryService,
  type DataLibraryFile,
  type DealFolderManifest,
  type DealFolderManifestEntry,
  type DealStatus,
} from '@/services/dataLibrary.service';
import { cloudStorageService } from '@/services/cloudStorage.service';

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// ── Status badge ──────────────────────────────────────────────────────────────

const BADGE_MAP: Record<DealStatus, { label: string; bg: string; color: string }> = {
  portfolio:    { label: 'Portfolio', bg: '#166534', color: '#4ade80' },
  owned:        { label: 'Owned',     bg: '#166534', color: '#4ade80' },
  closed:       { label: 'Closed',    bg: '#166534', color: '#4ade80' },
  lead:         { label: 'Pipeline',  bg: '#1e3a5f', color: '#60a5fa' },
  evaluating:   { label: 'Pipeline',  bg: '#1e3a5f', color: '#60a5fa' },
  underwriting: { label: 'Pipeline',  bg: '#1e3a5f', color: '#60a5fa' },
  negotiating:  { label: 'Pipeline',  bg: '#1e3a5f', color: '#60a5fa' },
  in_diligence: { label: 'Diligence', bg: '#1e3a5f', color: '#60a5fa' },
  closing:      { label: 'Closing',   bg: '#1e3a5f', color: '#60a5fa' },
  archived:     { label: 'Archived',  bg: '#1a1a2e', color: '#4a5568' },
};

const StatusBadge: React.FC<{ status: DealStatus }> = ({ status }) => {
  const cfg = BADGE_MAP[status] ?? { label: status, bg: '#1a1a2e', color: '#8892b0' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: cfg.bg, color: cfg.color, letterSpacing: 0.5,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  );
};

// ── File detail inline panel ──────────────────────────────────────────────────

const FileDetailPanel: React.FC<{ file: DataLibraryFile }> = ({ file }) => {
  const pd = file.parsed_data;
  return (
    <div style={{ marginTop: 6, padding: 10, background: '#0d1117', borderRadius: 6, fontSize: 11 }}>
      {pd?.type === 'csv' && pd.headers ? (
        <div>
          <div style={{ color: '#8892b0', marginBottom: 6 }}>
            {pd.totalRows} rows · {pd.headers.length} columns
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 10, width: '100%' }}>
              <thead>
                <tr>
                  {(pd.headers as string[]).slice(0, 8).map((h: string) => (
                    <th key={h} style={{ padding: '3px 6px', color: '#00d4ff', textAlign: 'left', borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                  {pd.headers.length > 8 && (
                    <th style={{ padding: '3px 6px', color: '#8892b0' }}>+{pd.headers.length - 8}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(pd.preview as any[])?.slice(0, 4).map((row: any, i: number) => (
                  <tr key={i}>
                    {(pd.headers as string[]).slice(0, 8).map((h: string) => (
                      <td key={h} style={{ padding: '3px 6px', color: '#ccd6f6', borderBottom: '1px solid #1e1e38', whiteSpace: 'nowrap' }}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : pd ? (
        <pre style={{ color: '#8892b0', whiteSpace: 'pre-wrap', margin: 0, maxHeight: 120, overflow: 'auto' }}>
          {JSON.stringify(pd, null, 2)}
        </pre>
      ) : (
        <span style={{ color: '#4a5568' }}>No parsed data</span>
      )}
    </div>
  );
};

// ── File row ──────────────────────────────────────────────────────────────────

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'text/csv': '📊',
  'application/csv': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-excel': '📊',
};

const FileRow: React.FC<{ file: DataLibraryFile; dimmed?: boolean }> = ({ file, dimmed }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ opacity: dimmed ? 0.65 : 1 }}>
      <div
        onClick={() => setExpanded(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e2740')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ fontSize: 13 }}>{MIME_ICON[file.mime_type] ?? '📁'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#ccd6f6', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.file_name}
          </div>
          <div style={{ color: '#8892b0', fontSize: 10, marginTop: 1, display: 'flex', gap: 6 }}>
            <span>{fmtSize(file.file_size)}</span>
            <span>·</span>
            <span>{fmtDate(file.uploaded_at)}</span>
            {file.source_type && <><span>·</span><span style={{ textTransform: 'capitalize' }}>{file.source_type}</span></>}
          </div>
        </div>
        <span style={{ color: '#4a5568', fontSize: 9 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 6 }}>
          <FileDetailPanel file={file} />
        </div>
      )}
    </div>
  );
};

// ── Per-file classification types ─────────────────────────────────────────────

type DocType = 'T12' | 'RENT_ROLL' | 'OM' | 'TAX_BILL' | 'OTHER';

interface FileEntry {
  file: File;
  docType: DocType;
  obsDate: string; // YYYY-MM
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  T12: 'T-12 (Trailing 12)',
  RENT_ROLL: 'Rent Roll',
  OM: 'Offering Memo',
  TAX_BILL: 'Tax Bill',
  OTHER: 'Other',
};

function inferDocType(filename: string): DocType {
  const lower = filename.toLowerCase();
  if (/t[-_]?12|trailing[\s_-]?12|actuals/.test(lower)) return 'T12';
  if (/rent[\s_-]?roll|\brr\b/.test(lower)) return 'RENT_ROLL';
  if (/\bom\b|offering[\s_-]?memo/.test(lower)) return 'OM';
  if (/\btax\b|bill|assess/.test(lower)) return 'TAX_BILL';
  return 'OTHER';
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Bulk upload modal with per-file classification ────────────────────────────

const UploadModal: React.FC<{
  dealId: string;
  dealName: string;
  onClose: () => void;
  onUploaded: () => void;
}> = ({ dealId, dealName, onClose, onUploaded }) => {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f => {
      const ext = f.name.toLowerCase().split('.').pop() ?? '';
      return ['pdf', 'xlsx', 'xls', 'csv'].includes(ext);
    });
    setEntries(prev => [
      ...prev,
      ...valid.map(file => ({
        file,
        docType: inferDocType(file.name),
        obsDate: currentYearMonth(),
      })),
    ]);
    if (valid.length < newFiles.length) {
      setError(`${newFiles.length - valid.length} file(s) skipped — only PDF, XLSX, XLS, CSV accepted`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const updateEntry = (idx: number, patch: Partial<FileEntry>) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };

  const removeEntry = (idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmUpload = async () => {
    if (entries.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await cloudStorageService.uploadFiles(
        entries.map(e => e.file),
        p => setProgress(p),
        dealId,
      );
      setDone(true);
      onUploaded();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const MONO = "'JetBrains Mono', 'Fira Code', monospace";
  const C = { bg: '#0F1117', panel: '#161B27', border: '#1E2D45', cyan: '#00BCD4', muted: '#475569', secondary: '#94A3B8', primary: '#E2E8F0', red: '#FF4757', green: '#00D26A' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', flexDirection: 'column', fontFamily: MONO }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: 0.5 }}>BULK UPLOAD HISTORICAL</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{dealName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? C.cyan : C.border}`, background: isDragging ? `${C.cyan}08` : C.panel, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', borderRadius: 4, transition: 'all 0.15s' }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 4 }}>Drop files here or click to select</div>
            <div style={{ fontSize: 10, color: C.muted }}>PDF · XLSX · XLS · CSV</div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }} style={{ display: 'none' }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}44`, padding: '8px 12px', fontSize: 11, color: '#FCA5A5', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', marginLeft: 8 }}>×</button>
            </div>
          )}

          {/* Per-file classification table */}
          {entries.length > 0 && !done && (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px 24px', gap: 8, padding: '7px 10px', background: C.panel, borderBottom: `1px solid ${C.border}`, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 0.5 }}>
                <div>FILE</div>
                <div>DOC TYPE</div>
                <div>OBS DATE</div>
                <div></div>
              </div>
              {entries.map((entry, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px 24px', gap: 8, padding: '7px 10px', borderTop: idx > 0 ? `1px solid ${C.border}` : undefined, alignItems: 'center' }}>
                  {/* Filename */}
                  <div style={{ fontSize: 11, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.file.name}>
                    {entry.file.name}
                  </div>
                  {/* Doc type dropdown */}
                  <select
                    value={entry.docType}
                    onChange={e => updateEntry(idx, { docType: e.target.value as DocType })}
                    style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.primary, fontFamily: MONO, fontSize: 10, padding: '4px 6px', outline: 'none', cursor: 'pointer' }}
                  >
                    {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(dt => (
                      <option key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</option>
                    ))}
                  </select>
                  {/* Observation date */}
                  <input
                    type="month"
                    value={entry.obsDate}
                    onChange={e => updateEntry(idx, { obsDate: e.target.value })}
                    style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.primary, fontFamily: MONO, fontSize: 10, padding: '4px 6px', outline: 'none' }}
                  />
                  {/* Remove */}
                  <button onClick={() => removeEntry(idx)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: '12px 14px', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: C.primary }}>
                <span>Uploading {entries.length} file{entries.length !== 1 ? 's' : ''}…</span>
                <span style={{ color: C.muted }}>{progress}%</span>
              </div>
              <div style={{ height: 3, background: '#1E2D45' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: C.cyan, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {/* Done */}
          {done && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>✓</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Upload complete</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{entries.length} file{entries.length !== 1 ? 's' : ''} added to the data library</div>
              <button onClick={onClose} style={{ marginTop: 14, padding: '7px 20px', background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, color: C.cyan, fontFamily: MONO, fontSize: 11, cursor: 'pointer', borderRadius: 4 }}>Close</button>
            </div>
          )}

          {/* Footer actions */}
          {!done && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={uploading}
                style={{ padding: '7px 16px', background: 'none', border: `1px solid ${C.border}`, color: C.secondary, fontFamily: MONO, fontSize: 11, cursor: 'pointer', borderRadius: 4 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={entries.length === 0 || uploading}
                style={{ padding: '7px 20px', background: entries.length > 0 && !uploading ? C.cyan : `${C.cyan}40`, border: 'none', color: entries.length > 0 && !uploading ? '#000' : C.muted, fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: entries.length > 0 && !uploading ? 'pointer' : 'default', borderRadius: 4, letterSpacing: 0.3 }}
              >
                {uploading ? 'Uploading…' : `Confirm & Upload${entries.length > 0 ? ` (${entries.length})` : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Deal accordion ────────────────────────────────────────────────────────────

const DealFolder: React.FC<{
  entry: DealFolderManifestEntry;
  dimmed?: boolean;
  onUploadClick: (dealId: string, dealName: string) => void;
}> = ({ entry, dimmed, onUploadClick }) => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<DataLibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const toggle = useCallback(async () => {
    if (!open && !loaded) {
      setLoading(true);
      try {
        const rows = await dataLibraryService.getFilesByDeal(entry.deal_id);
        setFiles(rows);
        setLoaded(true);
      } catch {
        setFiles([]);
        setLoaded(true);
      }
      setLoading(false);
    }
    setOpen(o => !o);
  }, [open, loaded, entry.deal_id]);

  return (
    <div style={{ borderBottom: '1px solid #1e2740' }}>
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', cursor: 'pointer',
          opacity: dimmed ? 0.7 : 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#151b2e')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: '#8892b0', fontSize: 10, width: 10, textAlign: 'center', flexShrink: 0 }}>
          {open ? '▼' : '▶'}
        </span>
        <span style={{ flex: 1, color: '#ccd6f6', fontSize: 13, fontWeight: 500 }}>
          {entry.deal_name}
        </span>
        <StatusBadge status={entry.deal_status} />
        <span style={{ color: '#8892b0', fontSize: 11, marginLeft: 8 }}>
          {entry.file_count} {entry.file_count === 1 ? 'file' : 'files'}
        </span>
        {entry.last_upload_at && (
          <span style={{ color: '#4a5568', fontSize: 10, marginLeft: 8 }}>
            last {fmtDate(entry.last_upload_at as any)}
          </span>
        )}
        {/* Bulk upload affordance */}
        <button
          onClick={e => { e.stopPropagation(); onUploadClick(entry.deal_id, entry.deal_name); }}
          title="Bulk upload historical documents for this deal"
          style={{
            marginLeft: 8, padding: '3px 8px',
            background: 'transparent', border: '1px solid #1e3a5f',
            color: '#60a5fa', fontSize: 10, fontWeight: 600,
            cursor: 'pointer', borderRadius: 3, letterSpacing: 0.3,
            fontFamily: 'inherit', flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#1e3a5f';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#60a5fa';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e3a5f';
          }}
        >
          ↑ Upload
        </button>
      </div>

      {open && (
        <div style={{ paddingLeft: 20, paddingBottom: 4 }}>
          {loading && (
            <div style={{ color: '#8892b0', fontSize: 12, padding: '8px 12px' }}>Loading…</div>
          )}
          {!loading && files.length === 0 && (
            <div style={{ color: '#4a5568', fontSize: 12, padding: '8px 12px', fontStyle: 'italic' }}>
              No files in this folder
            </div>
          )}
          {files.map(f => (
            <FileRow key={f.id} file={f} dimmed={dimmed} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Unaffiliated pseudo-folder ────────────────────────────────────────────────

const UnaffiliatedFolder: React.FC<{ count: number }> = ({ count }) => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<DataLibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const toggle = useCallback(async () => {
    if (!open && !loaded) {
      setLoading(true);
      try {
        const rows = await dataLibraryService.getUnaffiliatedFiles();
        setFiles(rows);
        setLoaded(true);
      } catch {
        setFiles([]);
        setLoaded(true);
      }
      setLoading(false);
    }
    setOpen(o => !o);
  }, [open, loaded]);

  return (
    <div style={{ borderBottom: '1px solid #1e2740' }}>
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#151b2e')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: '#8892b0', fontSize: 10, width: 10, textAlign: 'center', flexShrink: 0 }}>
          {open ? '▼' : '▶'}
        </span>
        <span style={{ flex: 1, color: '#8892b0', fontSize: 13, fontWeight: 500, fontStyle: 'italic' }}>
          Unaffiliated
        </span>
        <span style={{ color: '#4a5568', fontSize: 11, marginLeft: 8 }}>
          {count} {count === 1 ? 'file' : 'files'}
        </span>
      </div>

      {open && (
        <div style={{ paddingLeft: 20, paddingBottom: 4 }}>
          {loading && (
            <div style={{ color: '#8892b0', fontSize: 12, padding: '8px 12px' }}>Loading…</div>
          )}
          {!loading && files.length === 0 && (
            <div style={{ color: '#4a5568', fontSize: 12, padding: '8px 12px', fontStyle: 'italic' }}>
              No unaffiliated files
            </div>
          )}
          {files.map(f => (
            <FileRow key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Section header ────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ label: string; count: number; dimmed?: boolean }> = ({ label, count, dimmed }) => (
  <div style={{
    padding: '10px 14px 6px',
    fontSize: 11, fontWeight: 700, letterSpacing: 1,
    textTransform: 'uppercase',
    color: dimmed ? '#4a5568' : '#8892b0',
    borderBottom: '1px solid #1e2740',
  }}>
    {label} <span style={{ fontWeight: 400 }}>({count})</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const DealFolderView: React.FC = () => {
  const [manifest, setManifest] = useState<DealFolderManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState<{ dealId: string; dealName: string } | null>(null);

  const loadManifest = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    dataLibraryService
      .getDealFolderManifest()
      .then(m => { if (!cancelled) { setManifest(m); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return loadManifest();
  }, [loadManifest]);

  const handleUploadClick = useCallback((dealId: string, dealName: string) => {
    setUploadModal({ dealId, dealName });
  }, []);

  const handleUploaded = useCallback(() => {
    setUploadModal(null);
    loadManifest();
  }, [loadManifest]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#8892b0' }}>Loading deal folders…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '10px 14px', background: '#3b1a1a', borderRadius: 8, color: '#e06c75', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!manifest) return null;

  const hasActive       = manifest.active.length > 0;
  const hasArchived     = manifest.archived.length > 0;
  const hasUnaffiliated = manifest.unaffiliated_file_count > 0;

  if (!hasActive && !hasArchived && !hasUnaffiliated) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8892b0' }}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>No deals or files yet</p>
        <p style={{ fontSize: 13 }}>
          Files you upload for a specific deal will appear here, organized by deal.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{
        background: '#0d1117', border: '1px solid #1e2740', borderRadius: 8,
        overflow: 'hidden', fontSize: 13,
      }}>
        {hasActive && (
          <>
            <SectionHeader label="Active Portfolio" count={manifest.active.length} />
            {manifest.active.map(entry => (
              <DealFolder key={entry.deal_id} entry={entry} onUploadClick={handleUploadClick} />
            ))}
          </>
        )}

        {hasArchived && (
          <>
            <SectionHeader label="Archived" count={manifest.archived.length} dimmed />
            {manifest.archived.map(entry => (
              <DealFolder key={entry.deal_id} entry={entry} dimmed onUploadClick={handleUploadClick} />
            ))}
          </>
        )}

        {hasUnaffiliated && (
          <>
            {(hasActive || hasArchived) && (
              <SectionHeader label="Unaffiliated" count={manifest.unaffiliated_file_count} dimmed />
            )}
            <UnaffiliatedFolder count={manifest.unaffiliated_file_count} />
          </>
        )}
      </div>

      {uploadModal && (
        <UploadModal
          dealId={uploadModal.dealId}
          dealName={uploadModal.dealName}
          onClose={() => setUploadModal(null)}
          onUploaded={handleUploaded}
        />
      )}
    </>
  );
};
