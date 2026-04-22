import React, { useState, useEffect, useRef } from 'react';
import api from '@/services/api';

interface DealFile {
  id: string;
  original_filename: string;
  category: string;
  file_size: number;
  mime_type: string;
  status: string;
  uploaded_by?: string;
  created_at: string;
  description?: string;
}

interface DocumentsSectionProps {
  dealId: string;
}

const T = {
  bg: { terminal: '#0A0E14', panel: '#0F1923', header: '#0D1720', row: '#111C27', rowHover: '#15222F' },
  text: { primary: '#E8F4FD', secondary: '#8BA8BF', muted: '#4A6070', cyan: '#00B4D8', green: '#00D26A', red: '#FF4D4D', amber: '#F6A623' },
  border: { subtle: '#1A2C3D', medium: '#1E3448' },
  font: { mono: '"JetBrains Mono", "Consolas", monospace' },
};

const CATEGORIES = ['All', 'Financial', 'Legal', 'Inspections', 'Appraisals', 'Environmental', 'Insurance', 'Permits', 'Other'];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function extIcon(mime: string, name: string): string {
  if (mime?.includes('pdf') || name?.endsWith('.pdf')) return 'PDF';
  if (mime?.includes('spreadsheet') || mime?.includes('excel') || name?.match(/\.(xlsx?|csv)$/i)) return 'XLS';
  if (mime?.includes('word') || name?.match(/\.(docx?)$/i)) return 'DOC';
  if (mime?.includes('image')) return 'IMG';
  if (mime?.includes('zip')) return 'ZIP';
  return 'FILE';
}

function extColor(mime: string, name: string): string {
  if (mime?.includes('pdf') || name?.endsWith('.pdf')) return T.text.red;
  if (mime?.includes('spreadsheet') || mime?.includes('excel') || name?.match(/\.(xlsx?|csv)$/i)) return T.text.green;
  if (mime?.includes('word') || name?.match(/\.(docx?)$/i)) return T.text.cyan;
  if (mime?.includes('image')) return T.text.amber;
  return T.text.muted;
}

export function DocumentsSection({ dealId }: DocumentsSectionProps) {
  const [files, setFiles] = useState<DealFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      setError(null);
      const res = await api.get(`/deals/${dealId}/files`);
      setFiles(res.data?.files || []);
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dealId) loadFiles();
  }, [dealId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    Array.from(selectedFiles).forEach(f => fd.append('files', f));
    fd.append('category', selectedCategory !== 'All' ? selectedCategory : 'Other');
    try {
      await api.post(`/deals/${dealId}/files`, fd, {
        headers: { 'Content-Type': undefined as any },
      });
      await loadFiles();
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await api.delete(`/deals/${dealId}/files/${fileId}`);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch {
      setError('Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (file: DealFile) => {
    try {
      const res = await api.get(`/deals/${dealId}/files/${file.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    }
  };

  const filtered = files.filter(f => {
    const matchSearch = f.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'All' || f.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const btnBase: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: T.font.mono, fontSize: 9, letterSpacing: 0.5, padding: '4px 10px',
  };

  return (
    <div style={{ fontFamily: T.font.mono, color: T.text.primary }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.text.cyan, letterSpacing: 1 }}>DOCUMENTS</span>
          <span style={{ fontSize: 9, color: T.text.muted, background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: '1px 6px', borderRadius: 2 }}>
            {files.length}
          </span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            ...btnBase,
            background: uploading ? T.bg.panel : T.text.cyan + '18',
            border: `1px solid ${T.text.cyan}55`,
            color: uploading ? T.text.muted : T.text.cyan,
            borderRadius: 2,
            fontSize: 9,
          }}
        >
          {uploading ? '↑ UPLOADING...' : '↑ UPLOAD'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip,.txt"
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="SEARCH DOCUMENTS..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, background: T.bg.panel, border: `1px solid ${T.border.subtle}`,
            color: T.text.primary, fontFamily: T.font.mono, fontSize: 9,
            padding: '5px 8px', outline: 'none', letterSpacing: 0.5,
          }}
        />
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{
            background: T.bg.panel, border: `1px solid ${T.border.subtle}`,
            color: T.text.secondary, fontFamily: T.font.mono, fontSize: 9,
            padding: '5px 8px', outline: 'none', cursor: 'pointer',
          }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
      </div>

      {/* Error banners */}
      {error && (
        <div style={{ background: T.text.red + '18', border: `1px solid ${T.text.red}44`, color: T.text.red, padding: '6px 10px', fontSize: 9, marginBottom: 8 }}>
          ⚠ {error}
          <button onClick={() => setError(null)} style={{ ...btnBase, color: T.text.red, float: 'right', padding: 0 }}>✕</button>
        </div>
      )}
      {uploadError && (
        <div style={{ background: T.text.red + '18', border: `1px solid ${T.text.red}44`, color: T.text.red, padding: '6px 10px', fontSize: 9, marginBottom: 8 }}>
          ⚠ UPLOAD FAILED: {uploadError}
          <button onClick={() => setUploadError(null)} style={{ ...btnBase, color: T.text.red, float: 'right', padding: 0 }}>✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.text.muted, fontSize: 9 }}>LOADING...</div>
      ) : filtered.length === 0 ? (
        <div style={{ border: `1px dashed ${T.border.medium}`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>📁</div>
          <div style={{ fontSize: 10, color: T.text.muted, marginBottom: 4 }}>NO DOCUMENTS YET</div>
          <div style={{ fontSize: 9, color: T.text.muted, marginBottom: 16 }}>Upload deal documents — PDFs, spreadsheets, images</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              ...btnBase,
              background: T.text.cyan + '18',
              border: `1px solid ${T.text.cyan}55`,
              color: T.text.cyan,
              borderRadius: 2,
              padding: '6px 16px',
              fontSize: 9,
            }}
          >
            + ADD FIRST DOCUMENT
          </button>
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border.subtle}` }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 70px 70px 80px', background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, padding: '5px 10px', gap: 8 }}>
            {['', 'NAME', 'CATEGORY', 'SIZE', 'DATE', 'ACTIONS'].map((h, i) => (
              <span key={i} style={{ fontSize: 8, color: T.text.muted, fontWeight: 700, letterSpacing: 0.8 }}>{h}</span>
            ))}
          </div>
          {filtered.map((file, idx) => (
            <div
              key={file.id}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 90px 70px 70px 80px',
                padding: '7px 10px', gap: 8, alignItems: 'center',
                borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
                background: T.bg.panel,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.bg.rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bg.panel)}
            >
              {/* Type badge */}
              <span style={{ fontSize: 7, fontWeight: 700, color: extColor(file.mime_type, file.original_filename), letterSpacing: 0.3 }}>
                {extIcon(file.mime_type, file.original_filename)}
              </span>
              {/* Filename */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.original_filename}
                </div>
                {file.description && (
                  <div style={{ fontSize: 8, color: T.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.description}
                  </div>
                )}
              </div>
              {/* Category */}
              <span style={{ fontSize: 8, color: T.text.secondary, letterSpacing: 0.3 }}>
                {(file.category || 'OTHER').toUpperCase()}
              </span>
              {/* Size */}
              <span style={{ fontSize: 9, color: T.text.muted }}>{fmtSize(file.file_size)}</span>
              {/* Date */}
              <span style={{ fontSize: 9, color: T.text.muted }}>{fmtDate(file.created_at)}</span>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleDownload(file)}
                  title="Download"
                  style={{ ...btnBase, color: T.text.cyan, padding: '2px 4px', fontSize: 10 }}
                >
                  ↓
                </button>
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                  title="Delete"
                  style={{ ...btnBase, color: deletingId === file.id ? T.text.muted : T.text.red, padding: '2px 4px', fontSize: 10 }}
                >
                  {deletingId === file.id ? '…' : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentsSection;
