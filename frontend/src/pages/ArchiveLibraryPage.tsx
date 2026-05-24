import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// ─── Upload helpers ───────────────────────────────────────────────────────────

interface UploadToast {
  id: number;
  type: 'progress' | 'success' | 'error';
  message: string;
  filename?: string;
}

let toastSeq = 0;

// ─── types ────────────────────────────────────────────────────────────────────

interface LibraryFile {
  id: string;
  parcel_id: string | null;
  deal_id: string | null;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_provider: string | null;
  storage_key: string | null;
  cdn_url: string | null;
  document_type: string;
  parser_used: string | null;
  parser_status: string | null;
  parser_error: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  source_signal: string | null;
  license_restricted: boolean;
  property_display_name: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = ['ALL', 'OM', 'T12', 'RENT_ROLL', 'TAX_BILL', 'LEASING_STATS', 'OTHER'];
const PARSER_STATUSES = ['ALL', 'success', 'partial', 'failed', 'unparsed'];
const PAGE_SIZE = 50;

const DOC_LABEL: Record<string, string> = {
  OM: 'OM', T12: 'T-12', RENT_ROLL: 'Rent Roll',
  TAX_BILL: 'Tax Bill', LEASING_STATS: 'Leasing', OTHER: 'Other',
};

const STATUS_COLOR: Record<string, string> = {
  success: '#4ade80', partial: '#f59e0b',
  failed: '#e06c75', unparsed: '#8892b0',
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ArchiveLibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [toasts, setToasts] = useState<UploadToast[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);

  // filters (derived from URL search params for shareability)
  const docType     = searchParams.get('document_type') ?? 'ALL';
  const parserStat  = searchParams.get('parser_status') ?? 'ALL';
  const search      = searchParams.get('search') ?? '';
  const page        = parseInt(searchParams.get('page') ?? '1', 10);

  // debounced search input
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback((key: string, val: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === '' || val === 'ALL' || val === '1') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      next.delete('page'); // reset to page 1 on filter change
      return next;
    });
  }, [setSearchParams]);

  const setPage = useCallback((p: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (p === 1) next.delete('page');
      else next.set('page', String(p));
      return next;
    });
  }, [setSearchParams]);

  // sync searchInput → URL with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (searchInput) next.set('search', searchInput);
        else next.delete('search');
        next.delete('page');
        return next;
      });
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (docType   !== 'ALL') params.document_type = docType;
      if (parserStat !== 'ALL') params.parser_status = parserStat;
      if (search) params.search = search;

      const { data } = await apiClient.get('/api/v1/archive/files', { params });
      setFiles(data.files ?? []);
      setPagination(data.pagination ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [docType, parserStat, search, page]);

  useEffect(() => { void load(); }, [load]);

  // ── Upload helpers ──────────────────────────────────────────────────────────

  const addToast = useCallback((toast: Omit<UploadToast, 'id'>) => {
    const id = ++toastSeq;
    setToasts(prev => [...prev, { ...toast, id }]);
    if (toast.type !== 'progress') {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const uploadFiles = useCallback(async (fileList: File[]) => {
    for (const f of fileList) {
      const toastId = addToast({ type: 'progress', message: `Uploading ${f.name}…`, filename: f.name });
      try {
        const formData = new FormData();
        formData.append('file', f);
        const { data } = await apiClient.post('/api/v1/archive/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        removeToast(toastId);
        addToast({ type: 'success', message: `Uploaded ${f.name} — queued for enrichment`, filename: f.name });
        // Prepend the new file to the list optimistically
        const newFile: LibraryFile = {
          id: data.file_id,
          parcel_id: data.parcel_id ?? null,
          deal_id: null,
          original_filename: f.name,
          mime_type: f.type || null,
          size_bytes: f.size,
          storage_provider: 'local',
          storage_key: null,
          cdn_url: null,
          document_type: data.document_type ?? 'OTHER',
          parser_used: null,
          parser_status: 'unparsed',
          parser_error: null,
          uploaded_at: new Date().toISOString(),
          uploaded_by: null,
          source_signal: null,
          license_restricted: false,
          property_display_name: null,
        };
        setFiles(prev => [newFile, ...prev]);
        setPagination(prev => prev ? { ...prev, total: prev.total + 1 } : prev);
      } catch (err: unknown) {
        removeToast(toastId);
        const msg = err instanceof Error ? err.message : 'Upload failed';
        addToast({ type: 'error', message: `Failed: ${f.name} — ${msg}`, filename: f.name });
      }
    }
  }, [addToast, removeToast]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) void uploadFiles(droppedFiles);
  }, [uploadFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) void uploadFiles(picked);
    e.target.value = '';
  }, [uploadFiles]);

  const handleDownload = async (file: LibraryFile) => {
    try {
      const { data } = await apiClient.get(`/api/v1/archive/files/${file.id}/url`);
      if (!data.url) {
        alert('Download URL unavailable for this file.');
        return;
      }
      if (data.local) {
        // Locally-stored file: fetch as authenticated blob so the Authorization
        // header is included (window.open would not send it).
        const blobRes = await apiClient.get(data.url, { responseType: 'blob' });
        const objectUrl = URL.createObjectURL(blobRes.data as Blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = data.filename ?? file.original_filename ?? 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      } else {
        window.open(data.url, '_blank', 'noopener');
      }
    } catch {
      alert('Download URL unavailable for this file.');
    }
  };

  // ── styles ──────────────────────────────────────────────────────────────────
  const page_style: React.CSSProperties = {
    minHeight: '100vh', background: '#0d1117', color: '#cdd9e5',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '13px',
  };
  const topBar: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 20px', borderBottom: '1px solid #21262d', background: '#161b22',
  };
  const backBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #30363d', color: '#8892b0',
    borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
  };
  const main: React.CSSProperties = { padding: '24px 28px' };
  const filterRow: React.CSSProperties = {
    display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
    marginBottom: '16px',
  };
  const filterGroup: React.CSSProperties = { display: 'flex', gap: '4px', alignItems: 'center' };
  const filterLabel: React.CSSProperties = {
    fontSize: '10px', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.08em',
    marginRight: '6px',
  };
  const chipBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#1f3a5c' : 'none',
    border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
    color: active ? '#4fc3f7' : '#8892b0',
    borderRadius: '4px', padding: '3px 10px', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
    transition: 'all 0.1s',
  });
  const searchBox: React.CSSProperties = {
    background: '#161b22', border: '1px solid #30363d', color: '#cdd9e5',
    borderRadius: '4px', padding: '5px 10px', fontFamily: 'inherit',
    fontSize: '12px', outline: 'none', width: '240px',
  };
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
  const thStyle: React.CSSProperties = {
    padding: '8px 10px', color: '#8892b0', fontSize: '10px',
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
    textAlign: 'left', borderBottom: '1px solid #30363d', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px 10px', verticalAlign: 'middle', borderBottom: '1px solid #21262d',
  };

  const paginationRow: React.CSSProperties = {
    display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: '16px',
  };
  const pgBtn = (disabled: boolean): React.CSSProperties => ({
    background: 'none', border: '1px solid #30363d',
    color: disabled ? '#30363d' : '#8892b0',
    borderRadius: '4px', padding: '4px 12px', cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', fontSize: '11px',
  });

  const totalFiles = pagination?.total ?? 0;
  const uniqueProps = new Set(files.map(f => f.parcel_id).filter(Boolean)).size;

  const navLink = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.08em',
    color: active ? '#f0f6fc' : '#8892b0',
    borderBottom: active ? '2px solid #388bfd' : '2px solid transparent',
    padding: '2px 8px', textTransform: 'uppercase',
  });

  return (
    <div
      style={{ ...page_style, position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Drag-drop overlay ── */}
      {isDragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(13,17,23,0.85)',
          border: '3px dashed #388bfd',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '12px',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '48px' }}>📂</div>
          <div style={{ fontSize: '18px', color: '#4fc3f7', fontFamily: "'JetBrains Mono', monospace" }}>
            Drop files to upload
          </div>
          <div style={{ fontSize: '12px', color: '#8892b0', fontFamily: "'JetBrains Mono', monospace" }}>
            PDF, XLSX, CSV, DOCX — max 100 MB each
          </div>
        </div>
      )}

      {/* ── Toast stack ── */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 900,
        display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '380px',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? '#0d2118' : t.type === 'error' ? '#1c0a0a' : '#161b22',
            border: `1px solid ${t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#e06c75' : '#388bfd'}`,
            borderRadius: '6px', padding: '10px 14px',
            color: t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#e06c75' : '#4fc3f7',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '12px',
            display: 'flex', gap: '10px', alignItems: 'center',
          }}>
            <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
            {t.type !== 'progress' && (
              <button
                onClick={() => removeToast(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              >×</button>
            )}
          </div>
        ))}
      </div>

      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* ── Top bar ── */}
      <div style={topBar}>
        <button style={backBtn} onClick={() => navigate('/terminal/dashboard')}>← Terminal</button>
        <span style={{ color: '#8892b0', fontSize: '11px', letterSpacing: '0.08em' }}>Archive</span>
        <span style={{ color: '#30363d' }}>/</span>
        <button style={navLink(true)}>Library</button>
        <button style={navLink(false)} onClick={() => navigate('/archive/inbox')}>Inbox</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#1f3a5c', border: '1px solid #388bfd', color: '#4fc3f7',
            borderRadius: '4px', padding: '5px 14px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = '#264d7c'); }}
          onMouseLeave={e => { (e.currentTarget.style.background = '#1f3a5c'); }}
        >
          + Upload
        </button>
      </div>

      <div style={main}>
        {/* ── Page title ── */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#f0f6fc', marginBottom: '4px' }}>
            Data Library
          </div>
          <div style={{ color: '#8892b0', fontSize: '12px' }}>
            {loading ? 'Loading…' : `${totalFiles.toLocaleString()} files · ${uniqueProps} properties`}
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={filterRow}>
          {/* Search */}
          <input
            style={searchBox}
            placeholder="Search filename or property…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />

          {/* Doc type */}
          <div style={filterGroup}>
            <span style={filterLabel}>Type</span>
            {DOC_TYPES.map(dt => (
              <button
                key={dt}
                style={chipBtn(docType === dt)}
                onClick={() => setParam('document_type', dt)}
              >
                {dt === 'ALL' ? 'All' : (DOC_LABEL[dt] ?? dt)}
              </button>
            ))}
          </div>

          {/* Parser status */}
          <div style={filterGroup}>
            <span style={filterLabel}>Status</span>
            {PARSER_STATUSES.map(s => (
              <button
                key={s}
                style={chipBtn(parserStat === s)}
                onClick={() => setParam('parser_status', s)}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        {error ? (
          <div style={{ color: '#e06c75', padding: '20px 0' }}>{error}</div>
        ) : loading ? (
          <div style={{ color: '#8892b0', padding: '40px 0', textAlign: 'center' }}>Loading…</div>
        ) : files.length === 0 ? (
          <div style={{ color: '#8892b0', padding: '40px 0', textAlign: 'center' }}>
            No files match the current filters.
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '20px' }}></th>
                <th style={thStyle}>Filename</th>
                <th style={thStyle}>Property</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>Uploaded</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => {
                const statusColor = STATUS_COLOR[file.parser_status ?? ''] ?? '#8892b0';
                const propName = file.property_display_name ?? file.parcel_id ?? '—';
                return (
                  <tr
                    key={file.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#161b22'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    {/* status dot */}
                    <td style={tdStyle}>
                      <span
                        title={file.parser_status ?? 'unknown'}
                        style={{
                          display: 'inline-block', width: '8px', height: '8px',
                          borderRadius: '50%', background: statusColor,
                        }}
                      />
                    </td>

                    {/* filename — click goes to property page */}
                    <td
                      style={{ ...tdStyle, maxWidth: '320px', cursor: 'pointer' }}
                      onClick={() => file.parcel_id && navigate(`/archive/properties/${encodeURIComponent(file.parcel_id)}`)}
                    >
                      <span style={{ color: '#cdd9e5', wordBreak: 'break-all' }}>
                        {file.original_filename}
                      </span>
                    </td>

                    {/* property name */}
                    <td
                      style={{ ...tdStyle, maxWidth: '200px', cursor: file.parcel_id ? 'pointer' : 'default' }}
                      onClick={() => file.parcel_id && navigate(`/archive/properties/${encodeURIComponent(file.parcel_id)}`)}
                    >
                      <span style={{ color: '#388bfd', fontSize: '12px' }}>{propName}</span>
                    </td>

                    {/* doc type badge */}
                    <td style={tdStyle}>
                      <span style={{
                        background: '#1f2937', border: '1px solid #374151',
                        borderRadius: '3px', padding: '2px 6px',
                        fontSize: '10px', color: '#93c5fd', letterSpacing: '0.06em',
                      }}>
                        {DOC_LABEL[file.document_type] ?? file.document_type}
                      </span>
                    </td>

                    {/* parser status */}
                    <td style={{ ...tdStyle, fontSize: '11px', color: statusColor, whiteSpace: 'nowrap' }}>
                      {file.parser_status ?? '—'}
                    </td>

                    {/* size */}
                    <td style={{ ...tdStyle, color: '#8892b0', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {fmtSize(file.size_bytes)}
                    </td>

                    {/* uploaded */}
                    <td style={{ ...tdStyle, color: '#8892b0', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {fmtDate(file.uploaded_at)}
                    </td>

                    {/* download */}
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={e => { e.stopPropagation(); void handleDownload(file); }}
                        style={{
                          background: 'none', border: '1px solid #30363d', color: '#8892b0',
                          borderRadius: '3px', padding: '2px 8px', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: '10px',
                        }}
                        onMouseEnter={e => { (e.currentTarget.style.borderColor = '#388bfd'); (e.currentTarget.style.color = '#4fc3f7'); }}
                        onMouseLeave={e => { (e.currentTarget.style.borderColor = '#30363d'); (e.currentTarget.style.color = '#8892b0'); }}
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Pagination ── */}
        {pagination && pagination.pages > 1 && (
          <div style={paginationRow}>
            <span style={{ color: '#8892b0', fontSize: '11px' }}>
              Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} files
            </span>
            <button
              style={pgBtn(page <= 1)}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ← Prev
            </button>
            <button
              style={pgBtn(page >= pagination.pages)}
              disabled={page >= pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
