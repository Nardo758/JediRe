import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// ─── types ────────────────────────────────────────────────────────────────────

type FileStatus =
  | 'queued'
  | 'hashing'
  | 'signing'
  | 'uploading'
  | 'registering'
  | 'processing'
  | 'complete'
  | 'blocked'
  | 'error';

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  progress: number;
  error?: string;
  sha256?: string;
  fileId?: string;
  jobId?: string;
  parcelId?: string | null;
  documentType?: string;
}

interface RecentJob {
  id: string;
  file_id: string | null;
  parcel_id: string | null;
  state: string;
  source_type: string;
  created_at: string;
  updated_at: string;
  original_filename: string | null;
  document_type: string | null;
  size_bytes: number | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function computeSha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function detectDocType(filename: string): string {
  const lower = filename.toLowerCase();
  if (/\bt[-_]?12\b/.test(lower) || /trailing.*(12|twelve)/i.test(lower)) return 'T12';
  if (/rent[-_]?roll|rentroll/i.test(lower)) return 'RENT_ROLL';
  if (/tax[-_]?bill|property[-_]?tax/i.test(lower)) return 'TAX_BILL';
  if (/leasing[-_]?stat|leasing[-_]?report|traffic/i.test(lower)) return 'LEASING_STATS';
  if (/\bom\b|offering[\s_-]?memo|investment[\s_-]?memo/i.test(lower)) return 'OM';
  return 'OTHER';
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLOR: Record<FileStatus, string> = {
  queued:      '#8892b0',
  hashing:     '#f59e0b',
  signing:     '#f59e0b',
  uploading:   '#4fc3f7',
  registering: '#4fc3f7',
  processing:  '#a78bfa',
  complete:    '#4ade80',
  blocked:     '#f59e0b',
  error:       '#e06c75',
};

const STATUS_LABEL: Record<FileStatus, string> = {
  queued:      'QUEUED',
  hashing:     'HASHING',
  signing:     'SIGNING',
  uploading:   'UPLOADING',
  registering: 'REGISTERING',
  processing:  'PROCESSING',
  complete:    'COMPLETE',
  blocked:     'NEEDS ID',
  error:       'ERROR',
};

const JOB_STATE_COLOR: Record<string, string> = {
  pending:              '#f59e0b',
  processing:           '#4fc3f7',
  complete:             '#4ade80',
  blocked_needs_user:   '#f59e0b',
  failed:               '#e06c75',
};

// ─── file collection from drag ────────────────────────────────────────────────

async function collectFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = Array.from(dt.items ?? []);

  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      await collectFromEntry(entry, files);
    } else {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}

async function collectFromEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    await new Promise<void>((res, rej) => {
      (entry as FileSystemFileEntry).file(
        f => { out.push(f); res(); },
        rej,
      );
    });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    await new Promise<void>((res, rej) => {
      reader.readEntries(async entries => {
        for (const e of entries) await collectFromEntry(e, out);
        res();
      }, rej);
    });
  }
}

const ALLOWED_EXTS = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.docx', '.doc']);

function filterAllowed(files: File[]): File[] {
  return files.filter(f => {
    const ext = '.' + f.name.split('.').pop()!.toLowerCase();
    return ALLOWED_EXTS.has(ext);
  });
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ArchiveUploadPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [sessionJobIds, setSessionJobIds] = useState<Set<string>>(new Set());
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const processingRef = useRef<Set<string>>(new Set());

  // ── Poll intake_jobs for session files every 5 s ────────────────────────────
  useEffect(() => {
    const poll = async () => {
      if (sessionJobIds.size === 0) return;
      try {
        const { data } = await apiClient.get('/api/v1/archive/inbox', {
          params: { limit: '50', page: '1' },
        });
        const jobs: RecentJob[] = (data.jobs ?? []).filter((j: RecentJob) =>
          sessionJobIds.has(j.id),
        );
        setRecentJobs(jobs);

        // Sync queue status from job state
        setQueue(prev => prev.map(f => {
          const job = jobs.find(j => j.id === f.jobId);
          if (!job) return f;
          if (f.status !== 'processing' && f.status !== 'complete' && f.status !== 'blocked') return f;
          const st = job.state;
          if (st === 'complete') return { ...f, status: 'complete', parcelId: job.parcel_id };
          if (st === 'blocked_needs_user') return { ...f, status: 'blocked' };
          if (st === 'failed') return { ...f, status: 'error', error: 'Enrichment failed' };
          return f;
        }));
      } catch (_) {}
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [sessionJobIds]);

  // ── Upload pipeline for one file ─────────────────────────────────────────────
  const processFile = useCallback(async (uf: UploadFile) => {
    if (processingRef.current.has(uf.id)) return;
    processingRef.current.add(uf.id);

    const update = (patch: Partial<UploadFile>) =>
      setQueue(prev => prev.map(f => (f.id === uf.id ? { ...f, ...patch } : f)));

    try {
      // Step 1: compute sha256
      update({ status: 'hashing' });
      const sha256 = await computeSha256(uf.file);
      update({ sha256 });

      // Step 2: get presigned PUT URL
      update({ status: 'signing' });
      const ext = '.' + uf.name.split('.').pop()!.toLowerCase();
      const { data: urlData } = await apiClient.post('/api/v1/archive/files/signed-upload-url', {
        original_filename: uf.name,
        mime_type: uf.file.type || 'application/octet-stream',
        size_bytes: uf.size,
        file_ext: ext,
      });

      if (!urlData.signed_url) throw new Error('No signed URL returned');

      const { signed_url, storage_key } = urlData as { signed_url: string; storage_key: string };

      // Step 3: PUT directly to R2
      update({ status: 'uploading', progress: 0 });
      const putRes = await fetch(signed_url, {
        method: 'PUT',
        body: uf.file,
        headers: { 'Content-Type': uf.file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error(`R2 PUT failed: ${putRes.status} ${putRes.statusText}`);
      update({ progress: 100 });

      // Step 4: register file + create intake job
      update({ status: 'registering' });
      const { data: regData } = await apiClient.post('/api/v1/archive/files/register', {
        sha256,
        original_filename: uf.name,
        mime_type: uf.file.type || 'application/octet-stream',
        size_bytes: uf.size,
        storage_key,
        document_type: uf.documentType,
        parcel_id: null,
      });

      const { file_id, intake_job_id } = regData as { file_id: string; status: string; intake_job_id: string };
      update({ status: 'processing', fileId: file_id, jobId: intake_job_id });
      setSessionJobIds(prev => new Set([...prev, intake_job_id]));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      update({ status: 'error', error: msg });
    } finally {
      processingRef.current.delete(uf.id);
    }
  }, []);

  // ── Enqueue files ─────────────────────────────────────────────────────────────
  const enqueue = useCallback((files: File[]) => {
    const allowed = filterAllowed(files);
    if (allowed.length === 0) return;
    const newItems: UploadFile[] = allowed.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: 'queued',
      progress: 0,
      documentType: detectDocType(f.name),
    }));
    setQueue(prev => [...newItems, ...prev]);
    for (const item of newItems) {
      processFile(item);
    }
  }, [processFile]);

  // ── Drag handlers ─────────────────────────────────────────────────────────────
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = await collectFilesFromDataTransfer(e.dataTransfer);
    enqueue(files);
  }, [enqueue]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    enqueue(files);
    e.target.value = '';
  }, [enqueue]);

  // ── stats ─────────────────────────────────────────────────────────────────────
  const total = queue.length;
  const done  = queue.filter(f => f.status === 'complete').length;
  const errs  = queue.filter(f => f.status === 'error').length;
  const inflight = queue.filter(f => !['queued','complete','blocked','error'].includes(f.status)).length;

  // ── styles ────────────────────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh', background: '#0d1117', color: '#cdd9e5',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '13px',
      position: 'relative' as const,
    },
    topBar: {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 20px', borderBottom: '1px solid #21262d', background: '#161b22',
    },
    backBtn: {
      background: 'none', border: '1px solid #30363d', color: '#8892b0',
      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
    },
    navLink: (active: boolean): React.CSSProperties => ({
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.08em',
      color: active ? '#f0f6fc' : '#8892b0',
      borderBottom: active ? '2px solid #388bfd' : '2px solid transparent',
      padding: '2px 8px', textTransform: 'uppercase' as const,
    }),
    main: { padding: '28px 28px', maxWidth: '1100px' },
    dropZone: (active: boolean): React.CSSProperties => ({
      border: `2px dashed ${active ? '#388bfd' : '#30363d'}`,
      borderRadius: '10px',
      background: active ? 'rgba(56,139,253,0.06)' : '#161b22',
      display: 'flex', flexDirection: 'column' as const,
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: '12px',
      cursor: 'pointer', transition: 'all 0.15s',
      marginBottom: '28px', minHeight: '180px',
    }),
    dropTitle: {
      fontSize: '15px', color: '#cdd9e5', fontWeight: 500,
    },
    dropSub: { fontSize: '12px', color: '#8892b0', textAlign: 'center' as const },
    btnRow: { display: 'flex', gap: '10px', marginTop: '8px' },
    btn: (variant: 'primary' | 'ghost'): React.CSSProperties => ({
      background: variant === 'primary' ? '#1f3a5c' : 'none',
      border: `1px solid ${variant === 'primary' ? '#388bfd' : '#30363d'}`,
      color: variant === 'primary' ? '#4fc3f7' : '#8892b0',
      borderRadius: '4px', padding: '6px 16px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
    }),
    statsRow: {
      display: 'flex', gap: '20px', marginBottom: '20px',
      fontSize: '12px', color: '#8892b0',
    },
    statItem: (color?: string): React.CSSProperties => ({
      color: color ?? '#cdd9e5',
    }),
    sectionTitle: {
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em',
      color: '#8892b0', textTransform: 'uppercase' as const,
      marginBottom: '10px', borderBottom: '1px solid #21262d',
      paddingBottom: '6px',
    },
    fileRow: (status: FileStatus): React.CSSProperties => ({
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '9px 12px', borderRadius: '6px',
      background: '#161b22', border: '1px solid #21262d',
      marginBottom: '6px',
      borderLeft: `3px solid ${STATUS_COLOR[status]}`,
    }),
    fileName: { flex: 1, color: '#cdd9e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    fileSize: { color: '#8892b0', fontSize: '11px', whiteSpace: 'nowrap' as const },
    statusChip: (status: FileStatus): React.CSSProperties => ({
      background: 'none',
      border: `1px solid ${STATUS_COLOR[status]}`,
      color: STATUS_COLOR[status],
      borderRadius: '4px', padding: '2px 8px',
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
      whiteSpace: 'nowrap' as const, minWidth: '84px', textAlign: 'center' as const,
    }),
    docTypeChip: {
      background: '#1f2937', border: '1px solid #374151',
      color: '#93c5fd', borderRadius: '4px', padding: '2px 8px',
      fontSize: '10px', letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
    },
    actionBtn: {
      background: 'none', border: '1px solid #30363d', color: '#8892b0',
      borderRadius: '4px', padding: '2px 10px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '10px',
    },
    recentTable: { width: '100%', borderCollapse: 'collapse' as const },
    th: {
      padding: '7px 10px', color: '#8892b0', fontSize: '10px',
      letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 600,
      textAlign: 'left' as const, borderBottom: '1px solid #30363d',
    },
    td: { padding: '7px 10px', verticalAlign: 'middle' as const, borderBottom: '1px solid #21262d', fontSize: '12px' },
  };

  // ── overlay for global drag-over ──────────────────────────────────────────────
  return (
    <div
      style={S.page}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isDragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(13,17,23,0.88)',
          border: '3px dashed #388bfd',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '14px', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '44px' }}>📂</div>
          <div style={{ fontSize: '18px', color: '#4fc3f7', fontFamily: "'JetBrains Mono', monospace" }}>
            Drop folder or files
          </div>
          <div style={{ fontSize: '12px', color: '#8892b0' }}>
            PDF · XLSX · CSV · DOCX — max 100 MB each
          </div>
        </div>
      )}

      {/* hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
        style={{ display: 'none' }}
        onChange={onFileInput}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        multiple
        style={{ display: 'none' }}
        onChange={onFileInput}
      />

      {/* top bar */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate('/terminal/dashboard')}>← Terminal</button>
        <span style={{ color: '#8892b0', fontSize: '11px', letterSpacing: '0.08em' }}>Archive</span>
        <span style={{ color: '#30363d' }}>/</span>
        <button style={S.navLink(false)} onClick={() => navigate('/archive/library')}>Library</button>
        <button style={S.navLink(false)} onClick={() => navigate('/archive/inbox')}>Inbox</button>
        <button style={S.navLink(true)}>Upload</button>
      </div>

      <div style={S.main}>
        {/* page heading */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#f0f6fc', marginBottom: '4px' }}>
            Upload Files
          </div>
          <div style={{ color: '#8892b0', fontSize: '12px' }}>
            Drop a property folder — files are uploaded directly to storage and flow through enrichment automatically.
          </div>
        </div>

        {/* drop zone */}
        <div
          style={S.dropZone(isDragging)}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '36px' }}>📁</div>
          <div style={S.dropTitle}>Drag &amp; drop a folder or files here</div>
          <div style={S.dropSub}>
            Accepts PDF, XLSX, CSV, DOCX — up to 100 MB per file
          </div>
          <div style={S.btnRow} onClick={e => e.stopPropagation()}>
            <button style={S.btn('primary')} onClick={() => fileInputRef.current?.click()}>
              Choose Files
            </button>
            <button style={S.btn('ghost')} onClick={() => folderInputRef.current?.click()}>
              Choose Folder
            </button>
          </div>
        </div>

        {/* stats strip */}
        {total > 0 && (
          <div style={S.statsRow}>
            <span style={S.statItem()}>
              {total} file{total !== 1 ? 's' : ''}
            </span>
            {inflight > 0 && (
              <span style={S.statItem('#4fc3f7')}>{inflight} in progress</span>
            )}
            {done > 0 && (
              <span style={S.statItem('#4ade80')}>{done} complete</span>
            )}
            {errs > 0 && (
              <span style={S.statItem('#e06c75')}>{errs} failed</span>
            )}
          </div>
        )}

        {/* current session queue */}
        {queue.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={S.sectionTitle}>This Session</div>
            {queue.map(f => (
              <div key={f.id} style={S.fileRow(f.status)}>
                <span style={S.fileName} title={f.name}>{f.name}</span>
                <span style={S.docTypeChip}>{f.documentType}</span>
                <span style={S.fileSize}>{fmtSize(f.size)}</span>

                {/* progress bar only while uploading */}
                {f.status === 'uploading' && (
                  <div style={{ width: '80px', height: '4px', background: '#21262d', borderRadius: '2px' }}>
                    <div style={{ width: `${f.progress}%`, height: '100%', background: '#4fc3f7', borderRadius: '2px', transition: 'width 0.2s' }} />
                  </div>
                )}

                <span style={S.statusChip(f.status)}>
                  {STATUS_LABEL[f.status]}
                  {f.status === 'error' && f.error ? ` — ${f.error.slice(0, 30)}` : ''}
                </span>

                {f.status === 'complete' && f.parcelId && (
                  <button
                    style={S.actionBtn}
                    onClick={() => navigate(`/archive/properties/${f.parcelId}`)}
                  >
                    View →
                  </button>
                )}
                {f.status === 'blocked' && (
                  <button
                    style={S.actionBtn}
                    onClick={() => navigate('/archive/inbox')}
                  >
                    Identify →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* recent uploads table — polls every 5 s */}
        {recentJobs.length > 0 && (
          <div>
            <div style={S.sectionTitle}>Recent Jobs (session)</div>
            <table style={S.recentTable}>
              <thead>
                <tr>
                  <th style={S.th}>File</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Size</th>
                  <th style={S.th}>State</th>
                  <th style={S.th}>Updated</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map(j => {
                  const color = JOB_STATE_COLOR[j.state] ?? '#8892b0';
                  return (
                    <tr key={j.id}>
                      <td style={S.td}>{j.original_filename ?? '—'}</td>
                      <td style={{ ...S.td }}>
                        {j.document_type && (
                          <span style={{ ...S.docTypeChip as React.CSSProperties }}>{j.document_type}</span>
                        )}
                      </td>
                      <td style={{ ...S.td, color: '#8892b0' }}>{fmtSize(j.size_bytes)}</td>
                      <td style={S.td}>
                        <span style={{
                          color, border: `1px solid ${color}`,
                          borderRadius: '4px', padding: '1px 8px',
                          fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                        }}>
                          {j.state.toUpperCase().replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: '#8892b0' }}>{fmtDate(j.updated_at)}</td>
                      <td style={S.td}>
                        {j.state === 'complete' && j.parcel_id && (
                          <button style={S.actionBtn} onClick={() => navigate(`/archive/properties/${j.parcel_id}`)}>
                            View →
                          </button>
                        )}
                        {j.state === 'blocked_needs_user' && (
                          <button style={S.actionBtn} onClick={() => navigate('/archive/inbox')}>
                            Identify →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
