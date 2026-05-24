import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../../services/api.client';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

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

const DOC_TYPES = ['ALL', 'OM', 'T12', 'RENT_ROLL', 'TAX_BILL', 'LEASING_STATS', 'OTHER'];
const PARSER_STATUSES = ['ALL', 'success', 'partial', 'failed', 'unparsed'];
const DOC_LABEL: Record<string, string> = {
  OM: 'OM', T12: 'T-12', RENT_ROLL: 'Rent Roll',
  TAX_BILL: 'Tax Bill', LEASING_STATS: 'Leasing', OTHER: 'Other',
};
const STATUS_COLOR: Record<string, string> = {
  success: '#4ade80', partial: '#f59e0b',
  failed: '#e06c75', unparsed: '#8892b0',
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return '\u2014';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FilesTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterParcelId = searchParams.get('parcel_id') ?? '';
  const docType = searchParams.get('document_type') ?? 'ALL';
  const parserStat = searchParams.get('parser_status') ?? 'ALL';
  const search = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback((key: string, val: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('dlTab', 'files');
      if (val === '' || val === 'ALL' || val === '1') next.delete(key);
      else next.set(key, val);
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const setPage = useCallback((p: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('dlTab', 'files');
      if (p === 1) next.delete('page');
      else next.set('page', String(p));
      return next;
    });
  }, [setSearchParams]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (docType !== 'ALL') params.set('document_type', docType);
      if (parserStat !== 'ALL') params.set('parser_status', parserStat);
      if (filterParcelId) params.set('parcel_id', filterParcelId);
      params.set('page', String(page));
      params.set('limit', '50');
      const res = await apiClient.get(`/api/v1/data-library-files?${params}`);
      setFiles(res.data.files || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      setError(String(err));
    } finally { setLoading(false); }
  }, [search, docType, parserStat, page, filterParcelId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== search) setParam('search', searchInput);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const handleDownload = useCallback(async (file: LibraryFile) => {
    if (file.cdn_url) { window.open(file.cdn_url, '_blank'); return; }
    try {
      const res = await apiClient.get(`/api/v1/data-library-files/${file.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = file.original_filename; a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      if (file.storage_key) window.open(`/api/v1/data-library-files/${file.id}/download`, '_blank');
    }
  }, []);

  const clearParcelFilter = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('dlTab', 'files');
      next.delete('parcel_id');
      next.delete('page');
      return next;
    });
  };

  const totalFiles = pagination?.total ?? 0;
  const uniqueProps = new Set(files.map(f => f.parcel_id).filter(Boolean)).size;
  const activeParcelName = (files.length > 0 && filterParcelId ? (files[0].property_display_name || filterParcelId) : filterParcelId);

  return (
    <div style={{ padding: '16px 20px' }}>
      {filterParcelId && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#1f3a5c', border: '1px solid #388bfd', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#4fc3f7', fontSize: 12, fontFamily: MONO }}>
            Showing files for <strong>{activeParcelName}</strong>
          </span>
          <button onClick={clearParcelFilter}
            style={{ background: 'none', border: '1px solid #30363d', color: '#8892b0', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: MONO, fontSize: 11 }}
          >Show all files</button>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#f0f6fc', marginBottom: '4px' }}>Data Library</div>
        <div style={{ color: '#8892b0', fontSize: '12px' }}>
          {loading ? 'Loading\u2026' : `${totalFiles.toLocaleString()} files \u00b7 ${uniqueProps} properties`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <input
          style={{
            width: '100%', padding: '8px 12px', background: '#0d1117', color: '#cdd9e5',
            border: '1px solid #30363d', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px',
            outline: 'none', boxSizing: 'border-box',
          }}
          placeholder="Search filename or property\u2026"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: '#8892b0', fontSize: '11px', marginRight: '4px' }}>Type</span>
          {DOC_TYPES.map(dt => (
            <button key={dt}
              style={{
                background: docType === dt ? '#1f3a5c' : 'transparent',
                border: `1px solid ${docType === dt ? '#388bfd' : '#30363d'}`,
                color: docType === dt ? '#4fc3f7' : '#8892b0',
                borderRadius: '12px', padding: '2px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '11px',
              }}
              onClick={() => setParam('document_type', dt)}
            >{dt === 'ALL' ? 'All' : (DOC_LABEL[dt] ?? dt)}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: '#8892b0', fontSize: '11px', marginRight: '4px' }}>Status</span>
          {PARSER_STATUSES.map(s => (
            <button key={s}
              style={{
                background: parserStat === s ? '#1f3a5c' : 'transparent',
                border: `1px solid ${parserStat === s ? '#388bfd' : '#30363d'}`,
                color: parserStat === s ? '#4fc3f7' : '#8892b0',
                borderRadius: '12px', padding: '2px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '11px',
              }}
              onClick={() => setParam('parser_status', s)}
            >{s === 'ALL' ? 'All' : s}</button>
          ))}
        </div>
      </div>

      {error ? (
        <div style={{ color: '#e06c75', padding: '20px 0' }}>{error}</div>
      ) : loading ? (
        <div style={{ color: '#8892b0', padding: '40px 0', textAlign: 'center' }}>Loading\u2026</div>
      ) : files.length === 0 ? (
        <div style={{ color: '#8892b0', padding: '40px 0', textAlign: 'center' }}>No files match the current filters.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '20px', padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}></th>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Filename</th>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Property</th>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Type</th>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Size</th>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: '#8892b0', borderBottom: '2px solid #21262d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Uploaded</th>
              <th style={{ padding: '8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => {
              const statusColor = STATUS_COLOR[file.parser_status ?? ''] ?? '#8892b0';
              const propName = file.property_display_name ?? file.parcel_id ?? '\u2014';
              return (
                <tr key={file.id}
                  style={{ borderBottom: '1px solid #21262d' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#161b22'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '8px', fontSize: '12px', verticalAlign: 'middle' }}>
                    <span title={file.parser_status ?? 'unknown'} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
                  </td>
                  <td style={{ padding: '8px', fontSize: '12px', verticalAlign: 'middle', maxWidth: '320px' }}>
                    <span style={{ color: '#cdd9e5', wordBreak: 'break-all' }}>{file.original_filename}</span>
                  </td>
                  <td style={{ padding: '8px', fontSize: '12px', verticalAlign: 'middle', maxWidth: '200px', cursor: 'pointer' }} onClick={() => setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('dlTab'); n.delete('parcel_id'); return n; })}>
                    <span style={{ color: '#388bfd', fontSize: '12px' }}>{propName}</span>
                  </td>
                  <td style={{ padding: '8px', fontSize: '12px', verticalAlign: 'middle' }}>
                    <span style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', color: '#93c5fd', letterSpacing: '0.06em' }}>
                      {DOC_LABEL[file.document_type] ?? file.document_type}
                    </span>
                  </td>
                  <td style={{ padding: '8px', fontSize: '11px', verticalAlign: 'middle', color: statusColor, whiteSpace: 'nowrap' }}>
                    {file.parser_status ?? '\u2014'}
                  </td>
                  <td style={{ padding: '8px', fontSize: '11px', verticalAlign: 'middle', color: '#8892b0', whiteSpace: 'nowrap' }}>
                    {fmtSize(file.size_bytes)}
                  </td>
                  <td style={{ padding: '8px', fontSize: '11px', verticalAlign: 'middle', color: '#8892b0', whiteSpace: 'nowrap' }}>
                    {fmtDate(file.uploaded_at)}
                  </td>
                  <td style={{ padding: '8px', fontSize: '12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <button onClick={e => { e.stopPropagation(); void handleDownload(file); }}
                      style={{
                        background: 'none', border: '1px solid #30363d', color: '#8892b0',
                        borderRadius: '3px', padding: '2px 8px', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '10px',
                      }}
                    >\u2193</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', marginTop: '16px' }}>
          <span style={{ color: '#8892b0', fontSize: '11px' }}>
            Page {pagination.page} of {pagination.pages} \u00b7 {pagination.total.toLocaleString()} files
          </span>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            style={{
              background: 'none', border: '1px solid #30363d', color: page <= 1 ? '#30363d' : '#8892b0',
              borderRadius: '4px', padding: '4px 12px', cursor: page <= 1 ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: '11px',
            }}
          >\u2190 Prev</button>
          <button disabled={page >= (pagination?.pages || 1)} onClick={() => setPage(page + 1)}
            style={{
              background: 'none', border: '1px solid #30363d', color: page >= (pagination?.pages || 1) ? '#30363d' : '#8892b0',
              borderRadius: '4px', padding: '4px 12px', cursor: page >= (pagination?.pages || 1) ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: '11px',
            }}
          >Next \u2192</button>
        </div>
      )}
    </div>
  );
}
