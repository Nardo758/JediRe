import React, { useState, useEffect, useCallback } from 'react';
import {
  dataLibraryService,
  type DataLibraryFile,
  type DealFolderManifest,
  type DealFolderManifestEntry,
  type DealStatus,
} from '@/services/dataLibrary.service';
import { BulkUploadPanel } from './BulkUploadPanel';

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

// ── Upload modal overlay ─────────────────────────────────────────────────────

const UploadModal: React.FC<{
  dealId: string;
  dealName: string;
  onClose: () => void;
  onUploaded: () => void;
}> = ({ dealId, dealName, onClose, onUploaded }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        background: '#0F1117', border: '1px solid #1E2D45',
        borderRadius: 8, overflow: 'auto',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Modal header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #1E2D45',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00BCD4', letterSpacing: 0.5 }}>
            BULK UPLOAD HISTORICAL
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{dealName}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Panel */}
      <div style={{ padding: 16 }}>
        <BulkUploadPanel
          preselectedDealId={dealId}
          preselectedDealName={dealName}
          onUploadComplete={() => {
            onUploaded();
          }}
        />
      </div>
    </div>
  </div>
);

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
