/**
 * Bulk Upload Panel
 * 
 * Drag & drop upload for files and ZIP archives, with deal linking
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Archive, X, CheckCircle, 
  AlertCircle, Loader2, FolderOpen, Link
} from 'lucide-react';
import { cloudStorageService, type BulkUploadJob } from '../../services/cloudStorage.service';
import { apiClient } from '../../services/api.client';

interface BulkUploadPanelProps {
  onUploadComplete?: () => void;
}

interface Deal {
  id: string;
  name: string;
  address?: string;
}

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const C = {
  bg: '#0F1117',
  panel: '#161B27',
  input: '#1A2236',
  border: '#1E2D45',
  borderHover: '#2A3F5F',
  amber: '#F5A623',
  cyan: '#00BCD4',
  green: '#00D26A',
  red: '#FF4757',
  muted: '#475569',
  secondary: '#94A3B8',
  primary: '#E2E8F0',
};

export const BulkUploadPanel: React.FC<BulkUploadPanelProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadJob, setUploadJob] = useState<BulkUploadJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deal linking
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [dealsLoading, setDealsLoading] = useState(true);
  const [linkMode, setLinkMode] = useState<'none' | 'pipeline' | 'custom'>('none');
  const [customLabel, setCustomLabel] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Load deals for the selector
  useEffect(() => {
    apiClient.get('/api/v1/deals?limit=100')
      .then(res => {
        const list = res.data?.deals || res.data?.data || [];
        setDeals(list);
      })
      .catch(() => setDeals([]))
      .finally(() => setDealsLoading(false));
  }, []);
  
  // Poll upload job status
  useEffect(() => {
    if (!uploadJob || ['complete', 'error'].includes(uploadJob.status)) return;
    
    const interval = setInterval(async () => {
      try {
        const updated = await cloudStorageService.getUploadJob(uploadJob.id);
        setUploadJob(updated);
        
        if (updated.status === 'complete') {
          onUploadComplete?.();
        }
      } catch (err) {
        console.error('Failed to poll upload status:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [uploadJob, onUploadComplete]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);
  
  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['pdf', 'xlsx', 'xls', 'csv', 'zip'].includes(ext || '');
    });
    if (validFiles.length < newFiles.length) {
      setError(`${newFiles.length - validFiles.length} files skipped (unsupported type)`);
    }
    setFiles(prev => [...prev, ...validFiles]);
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };
  
  const handleZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('Please select a ZIP file');
        return;
      }
      uploadZip(file);
    }
  };
  
  const uploadFiles = async () => {
    if (files.length === 0) return;
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile && files.length === 1) {
      uploadZip(zipFile);
      return;
    }
    setError(null);
    setUploadProgress(0);
    try {
      const job = await cloudStorageService.uploadFiles(
        files, setUploadProgress,
        linkMode === 'pipeline' ? selectedDealId || undefined : undefined,
        linkMode === 'custom' ? customLabel || undefined : undefined,
      );
      setUploadJob(job);
      setFiles([]);
    } catch (err) {
      setError('Upload failed. Please try again.');
    }
  };
  
  const uploadZip = async (file: File) => {
    setError(null);
    setUploadProgress(0);
    try {
      const job = await cloudStorageService.uploadZip(
        file, setUploadProgress,
        linkMode === 'pipeline' ? selectedDealId || undefined : undefined,
        linkMode === 'custom' ? customLabel || undefined : undefined,
      );
      setUploadJob(job);
      setFiles([]);
    } catch (err) {
      setError('ZIP upload failed. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'zip') return <Archive size={16} style={{ color: '#A78BFA' }} />;
    if (ext === 'pdf') return <FileText size={16} style={{ color: '#F87171' }} />;
    return <FileText size={16} style={{ color: '#4ADE80' }} />;
  };

  const selectedDeal = deals.find(d => d.id === selectedDealId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: MONO }}>

      {/* Deal Linking */}
      <div style={{ padding: '12px 14px', background: C.panel, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Link size={14} style={{ color: C.cyan }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: 0.5 }}>LINK TO DEAL</span>
          <span style={{ fontSize: 10, color: C.muted }}>— tag these files to a deal for the data library</span>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {([
            { mode: 'none', label: 'No Link' },
            { mode: 'pipeline', label: 'Pipeline Deal' },
            { mode: 'custom', label: 'Custom Label' },
          ] as const).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setLinkMode(mode)}
              style={{
                padding: '5px 12px', fontFamily: MONO, fontSize: 10, fontWeight: 600,
                cursor: 'pointer', letterSpacing: 0.3, border: 'none',
                background: linkMode === mode ? C.cyan : C.input,
                color: linkMode === mode ? '#000' : C.muted,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pipeline deal dropdown */}
        {linkMode === 'pipeline' && (
          dealsLoading ? (
            <div style={{ fontSize: 10, color: C.muted }}>Loading deals...</div>
          ) : (
            <select
              value={selectedDealId}
              onChange={e => setSelectedDealId(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', background: C.input,
                border: `1px solid ${selectedDealId ? C.cyan : C.border}`,
                color: selectedDealId ? C.primary : C.muted,
                fontFamily: MONO, fontSize: 11, outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">— Select a pipeline deal —</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.address ? ` · ${d.address.split(',').slice(0, 2).join(',').trim()}` : ''}
                </option>
              ))}
            </select>
          )
        )}

        {/* Custom label input */}
        {linkMode === 'custom' && (
          <div>
            <input
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              placeholder="e.g. 123 Main St Tampa — T12 & Rent Roll"
              style={{
                width: '100%', padding: '7px 10px', background: C.input,
                border: `1px solid ${customLabel ? C.amber : C.border}`,
                color: C.primary, fontFamily: MONO, fontSize: 11,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 5, fontSize: 9, color: C.muted }}>
              This creates a named entry in your data library — useful for deals you haven't added to the platform yet.
            </div>
          </div>
        )}

        {/* Confirmation badge */}
        {linkMode === 'pipeline' && selectedDeal && (
          <div style={{ marginTop: 8, padding: '5px 8px', background: `${C.cyan}11`, border: `1px solid ${C.cyan}33`, fontSize: 10, color: C.cyan }}>
            → <strong>{selectedDeal.name}</strong>
            {selectedDeal.address && <span style={{ color: C.muted }}> · {selectedDeal.address.split(',').slice(0, 2).join(',')}</span>}
          </div>
        )}
        {linkMode === 'custom' && customLabel && (
          <div style={{ marginTop: 8, padding: '5px 8px', background: `${C.amber}11`, border: `1px solid ${C.amber}33`, fontSize: 10, color: C.amber }}>
            → <strong>{customLabel}</strong>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}44`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#FCA5A5' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>×</button>
        </div>
      )}
      
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? C.cyan : C.border}`,
          background: isDragging ? `${C.cyan}08` : C.panel,
          padding: '32px 24px',
          textAlign: 'center',
          transition: 'all 0.15s',
          cursor: 'default',
        }}
      >
        <Upload size={36} style={{ color: C.muted, marginBottom: 12 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: C.primary, marginBottom: 6 }}>
          Drag & drop files here
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>
          PDF · XLSX · XLS · CSV · ZIP
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '7px 18px', background: C.cyan, color: '#000',
              border: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.3,
            }}
          >
            SELECT FILES
          </button>
          <span style={{ color: C.muted, fontSize: 10 }}>or</span>
          <button
            onClick={() => zipInputRef.current?.click()}
            style={{
              padding: '7px 18px', background: 'transparent', color: '#A78BFA',
              border: '1px solid #A78BFA55', fontFamily: MONO, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Archive size={13} />
            UPLOAD ZIP
          </button>
        </div>
        
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
        <input ref={zipInputRef} type="file" accept=".zip" onChange={handleZipSelect} style={{ display: 'none' }} />
      </div>
      
      {/* File List */}
      {files.length > 0 && (
        <div style={{ border: `1px solid ${C.border}` }}>
          <div style={{ background: C.panel, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
            <button onClick={() => setFiles([])} style={{ fontSize: 10, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all
            </button>
          </div>
          
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {files.map((file, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderTop: index > 0 ? `1px solid ${C.border}` : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {getFileIcon(file.name)}
                  <div>
                    <div style={{ fontSize: 11, color: C.primary, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: 9, color: C.muted }}>{formatFileSize(file.size)}</div>
                  </div>
                </div>
                <button onClick={() => removeFile(index)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: C.panel }}>
            <button
              onClick={uploadFiles}
              style={{
                width: '100%', padding: '8px', background: C.green, color: '#000',
                border: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Upload size={13} />
              UPLOAD {files.length} {files.length === 1 ? 'FILE' : 'FILES'}
              {selectedDeal && <span style={{ fontWeight: 400 }}>→ {selectedDeal.name}</span>}
            </button>
          </div>
        </div>
      )}
      
      {/* Upload Progress */}
      {uploadProgress > 0 && uploadProgress < 100 && !uploadJob && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
            <span style={{ color: C.primary }}>Uploading...</span>
            <span style={{ color: C.muted }}>{uploadProgress}%</span>
          </div>
          <div style={{ height: 4, background: C.input }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, background: C.cyan, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      
      {/* Processing Status */}
      {uploadJob && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {uploadJob.status === 'complete' ? (
                <CheckCircle size={16} style={{ color: C.green }} />
              ) : uploadJob.status === 'error' ? (
                <AlertCircle size={16} style={{ color: C.red }} />
              ) : (
                <Loader2 size={16} style={{ color: C.cyan, animation: 'spin 1s linear infinite' }} />
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>Processing</span>
            </div>
            <span style={{ fontSize: 11, color: uploadJob.status === 'complete' ? C.green : uploadJob.status === 'error' ? C.red : C.amber }}>
              {uploadJob.status === 'uploading' ? 'Uploading files...' :
               uploadJob.status === 'extracting' ? 'Extracting archive...' :
               uploadJob.status === 'parsing' ? 'Parsing documents...' :
               uploadJob.status === 'complete' ? 'Complete!' : 'Error'}
            </span>
          </div>
          
          {uploadJob.status === 'complete' && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>{uploadJob.dealsCreated}</div>
              <div style={{ fontSize: 10, color: C.muted }}>assets added to library</div>
            </div>
          )}
          
          {(uploadJob.errors?.length ?? 0) > 0 && (
            <div style={{ marginTop: 10, fontSize: 10, color: '#FCA5A5' }}>
              {uploadJob.errors.slice(0, 3).map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
              {uploadJob.errors.length > 3 && (
                <div>...and {uploadJob.errors.length - 3} more errors</div>
              )}
            </div>
          )}
          
          {uploadJob.status === 'complete' && (
            <button
              onClick={() => setUploadJob(null)}
              style={{
                marginTop: 12, width: '100%', padding: '7px',
                background: `${C.cyan}18`, color: C.cyan, border: `1px solid ${C.cyan}44`,
                fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
            >
              Upload more files
            </button>
          )}
        </div>
      )}
      
      {/* Help Text */}
      <div style={{ padding: '12px 14px', background: C.panel, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.amber, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={13} />
          Tips for bulk upload
        </div>
        <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
          <div>• <strong style={{ color: C.secondary }}>Link to Deal:</strong> Select a deal above to tag all uploaded files to that deal — they'll appear in the data library linked to it</div>
          <div>• <strong style={{ color: C.secondary }}>ZIP archives:</strong> Organize by deal folder (e.g., Deal Name/T12.xlsx, Rent Roll.xlsx, OM.pdf) for auto-parsing</div>
          <div>• <strong style={{ color: C.secondary }}>File naming:</strong> Include document type in filename (T12, RR, Rent Roll, OM, Tax Bill)</div>
          <div>• <strong style={{ color: C.secondary }}>Large uploads:</strong> For 50+ deals, use ZIP or connect cloud storage</div>
        </div>
      </div>
    </div>
  );
};
