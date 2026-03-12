import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dataLibraryService, type DataLibraryFile, type DataLibrarySearchParams } from '@/services/dataLibrary.service';
import { pstUploadService, type PstJobStatus, type PstEntity } from '@/services/pstUpload.service';

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusColors: Record<string, string> = {
  complete: '#4ade80',
  completed: '#4ade80',
  parsing: '#f59e0b',
  extracting: '#f59e0b',
  storing: '#f59e0b',
  processing: '#f59e0b',
  pending: '#8892b0',
  error: '#e06c75',
  failed: '#e06c75',
};

export const DataLibraryPage: React.FC = () => {
  const [files, setFiles] = useState<DataLibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DataLibraryFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DataLibrarySearchParams>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pstInputRef = useRef<HTMLInputElement>(null);

  const [uploadMeta, setUploadMeta] = useState({
    city: '', zipCode: '', propertyType: 'Multifamily', propertyHeight: '',
    yearBuilt: '', unitCount: '', sourceType: 'owned',
  });

  const [pstJob, setPstJob] = useState<PstJobStatus | null>(null);
  const [pstEntities, setPstEntities] = useState<PstEntity[]>([]);
  const [showPstResults, setShowPstResults] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadFiles(); }, [filters]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await dataLibraryService.getFiles(filters);
      setFiles(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = fileInputRef.current;
    if (!fileInput?.files?.[0]) return;

    setUploading(true);
    setError(null);
    try {
      await dataLibraryService.uploadFile(fileInput.files[0], {
        ...uploadMeta,
        unitCount: uploadMeta.unitCount ? parseInt(uploadMeta.unitCount) : undefined,
      });
      setShowUpload(false);
      setUploadMeta({ city: '', zipCode: '', propertyType: 'Multifamily', propertyHeight: '', yearBuilt: '', unitCount: '', sourceType: 'owned' });
      if (fileInput) fileInput.value = '';
      loadFiles();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handlePstUpload = async () => {
    const fileInput = pstInputRef.current;
    if (!fileInput?.files?.[0]) return;

    const file = fileInput.files[0];
    if (!file.name.endsWith('.pst')) {
      setError('Please select a .pst file');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { jobId } = await pstUploadService.uploadPst(file);
      setPstJob({
        jobId,
        status: 'parsing',
        uploadId: jobId,
        totalEmails: 0,
        processedEmails: 0,
        entitiesFound: 0,
        errors: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
      setShowPstResults(true);
      setShowUpload(false);
      if (fileInput) fileInput.value = '';
      startPolling(jobId);
    } catch (e: any) {
      setError(e.message || 'PST upload failed');
    }
    setUploading(false);
  };

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await pstUploadService.getJobStatus(jobId);
        setPstJob(status);
        if (status.status === 'completed' || status.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (status.status === 'completed') {
            try {
              const { entities } = await pstUploadService.getEntities(jobId, { limit: 50 });
              setPstEntities(entities);
            } catch {}
          }
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this file?')) return;
    try {
      await dataLibraryService.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      if (selectedFile?.id === id) setSelectedFile(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: 24, maxWidth: 1200, margin: '0 auto', color: '#ccd6f6', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#ccd6f6', fontSize: 22 }}>Data Library</h2>
          <p style={{ margin: '4px 0 0', color: '#8892b0', fontSize: 13 }}>
            Upload historical data for Opus to learn from. Files are matched to deals by property characteristics.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          style={{
            padding: '8px 20px', background: '#00d4ff', border: 'none', borderRadius: 8,
            color: '#0d1117', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Upload File
        </button>
      </div>

      {showUpload && (
        <form onSubmit={handleUpload} style={{
          background: '#1a1a2e', borderRadius: 8, padding: 20, marginBottom: 20, border: '1px solid #2a2a4a',
        }}>
          <h4 style={{ color: '#ccd6f6', margin: '0 0 16px', fontSize: 14 }}>Upload Property Data</h4>

          <div style={{ marginBottom: 16 }}>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ color: '#8892b0', fontSize: 13 }} required />
            <p style={{ color: '#8892b0', fontSize: 11, margin: '4px 0 0' }}>CSV, Excel, or PDF files up to 50MB</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <InputField label="City" value={uploadMeta.city} onChange={v => setUploadMeta(p => ({ ...p, city: v }))} placeholder="Atlanta" />
            <InputField label="Zip Code" value={uploadMeta.zipCode} onChange={v => setUploadMeta(p => ({ ...p, zipCode: v }))} placeholder="30301" />
            <SelectField label="Property Type" value={uploadMeta.propertyType} onChange={v => setUploadMeta(p => ({ ...p, propertyType: v }))}
              options={['Multifamily', 'Office', 'Retail', 'Industrial', 'Mixed-Use', 'Student Housing', 'Senior Living']} />
            <SelectField label="Height" value={uploadMeta.propertyHeight} onChange={v => setUploadMeta(p => ({ ...p, propertyHeight: v }))}
              options={['', 'Garden (1-3)', 'Mid-Rise (4-7)', 'High-Rise (8+)']} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <InputField label="Year Built" value={uploadMeta.yearBuilt} onChange={v => setUploadMeta(p => ({ ...p, yearBuilt: v }))} placeholder="2020" />
            <InputField label="Unit Count" value={uploadMeta.unitCount} onChange={v => setUploadMeta(p => ({ ...p, unitCount: v }))} placeholder="200" />
            <SelectField label="Source" value={uploadMeta.sourceType} onChange={v => setUploadMeta(p => ({ ...p, sourceType: v }))}
              options={['owned', 'third-party', 'broker', 'public']} />
            <div />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={uploading} style={{
              padding: '8px 20px', background: '#00d4ff', border: 'none', borderRadius: 6,
              color: '#0d1117', fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
            }}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button type="button" onClick={() => setShowUpload(false)} style={{
              padding: '8px 20px', background: 'none', border: '1px solid #2a2a4a', borderRadius: 6,
              color: '#8892b0', fontSize: 13, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #2a2a4a' }}>
            <h4 style={{ color: '#ccd6f6', margin: '0 0 12px', fontSize: 14 }}>Email Archive Import</h4>
            <p style={{ color: '#8892b0', fontSize: 12, margin: '0 0 12px' }}>
              Upload a Microsoft Outlook .pst file to extract real estate signals from email history.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input ref={pstInputRef} type="file" accept=".pst" style={{ color: '#8892b0', fontSize: 13 }} />
              <button
                type="button"
                onClick={handlePstUpload}
                disabled={uploading}
                style={{
                  padding: '8px 20px', background: '#7c3aed', border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {uploading ? 'Uploading...' : 'Import PST'}
              </button>
            </div>
            <p style={{ color: '#8892b0', fontSize: 11, margin: '4px 0 0' }}>
              PST files up to 200MB. AI will extract property addresses, deal names, contacts, and financial details.
            </p>
          </div>
        </form>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: '#3b1a1a', borderRadius: 8, color: '#e06c75', fontSize: 13, marginBottom: 16 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#e06c75', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {showPstResults && pstJob && <PstProgressPanel job={pstJob} entities={pstEntities} onClose={() => setShowPstResults(false)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        <FilterInput placeholder="Filter by city..." value={filters.city || ''} onChange={v => setFilters(p => ({ ...p, city: v || undefined }))} />
        <FilterInput placeholder="Zip code..." value={filters.zipCode || ''} onChange={v => setFilters(p => ({ ...p, zipCode: v || undefined }))} />
        <FilterSelect value={filters.propertyType || ''} onChange={v => setFilters(p => ({ ...p, propertyType: v || undefined }))}
          options={[{ value: '', label: 'All Types' }, { value: 'Multifamily', label: 'Multifamily' }, { value: 'Office', label: 'Office' }, { value: 'Industrial', label: 'Industrial' }]} />
        <FilterSelect value={filters.sourceType || ''} onChange={v => setFilters(p => ({ ...p, sourceType: v || undefined }))}
          options={[{ value: '', label: 'All Sources' }, { value: 'owned', label: 'Owned' }, { value: 'third-party', label: 'Third Party' }, { value: 'broker', label: 'Broker' }]} />
        <button onClick={() => setFilters({})} style={{
          padding: '6px 12px', background: 'none', border: '1px solid #2a2a4a', borderRadius: 6,
          color: '#8892b0', fontSize: 12, cursor: 'pointer',
        }}>
          Clear Filters
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8892b0' }}>Loading...</div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8892b0' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No files in the Data Library yet</p>
          <p style={{ fontSize: 13 }}>Upload rent rolls, operating statements, or comp surveys for Opus to learn from.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map(file => (
            <div key={file.id} onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)} style={{
              background: selectedFile?.id === file.id ? '#1e3a5f' : '#1a1a2e',
              border: selectedFile?.id === file.id ? '1px solid #00d4ff' : '1px solid #2a2a4a',
              borderRadius: 8, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileIcon type={file.mime_type} />
                  <div>
                    <div style={{ color: '#ccd6f6', fontSize: 13, fontWeight: 500 }}>{file.file_name}</div>
                    <div style={{ color: '#8892b0', fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>{fmtSize(file.file_size)}</span>
                      <span>&#183;</span>
                      <span>{fmtDate(file.uploaded_at)}</span>
                      {file.city && <><span>&#183;</span><span>{file.city}</span></>}
                      {file.property_type && <><span>&#183;</span><span>{file.property_type}</span></>}
                      {file.unit_count && <><span>&#183;</span><span>{file.unit_count} units</span></>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: statusColors[file.parsing_status] || '#8892b0', fontSize: 11, textTransform: 'capitalize' }}>
                    {file.parsing_status}
                  </span>
                  <span style={{ color: '#8892b0', fontSize: 11, background: '#0d1117', padding: '2px 8px', borderRadius: 4 }}>
                    {file.source_type}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} style={{
                    background: 'none', border: 'none', color: '#e06c75', cursor: 'pointer', fontSize: 14, padding: '2px 6px',
                  }}>
                    &#10005;
                  </button>
                </div>
              </div>

              {selectedFile?.id === file.id && file.parsed_data && (
                <div style={{ marginTop: 12, padding: 12, background: '#0d1117', borderRadius: 6, fontSize: 12 }}>
                  {file.parsed_data?.type === 'csv' && file.parsed_data.headers ? (
                    <div>
                      <div style={{ color: '#8892b0', marginBottom: 8 }}>
                        {file.parsed_data.totalRows} rows | {file.parsed_data.headers.length} columns
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                          <thead>
                            <tr>
                              {file.parsed_data.headers.slice(0, 8).map((h: string) => (
                                <th key={h} style={{ padding: '4px 8px', color: '#00d4ff', textAlign: 'left', borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                              {file.parsed_data.headers.length > 8 && <th style={{ padding: '4px 8px', color: '#8892b0' }}>+{file.parsed_data.headers.length - 8} more</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {file.parsed_data.preview?.slice(0, 5).map((row: any, i: number) => (
                              <tr key={i}>
                                {file.parsed_data.headers.slice(0, 8).map((h: string) => (
                                  <td key={h} style={{ padding: '4px 8px', color: '#ccd6f6', borderBottom: '1px solid #1e1e38', whiteSpace: 'nowrap' }}>{row[h] || '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <pre style={{ color: '#8892b0', whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(file.parsed_data, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PstProgressPanel: React.FC<{
  job: PstJobStatus;
  entities: PstEntity[];
  onClose: () => void;
}> = ({ job, entities, onClose }) => {
  const isActive = job.status !== 'completed' && job.status !== 'failed';
  const progress = job.totalEmails > 0
    ? Math.round((job.processedEmails / job.totalEmails) * 100)
    : 0;

  const statusLabel: Record<string, string> = {
    parsing: 'Parsing PST archive...',
    extracting: 'AI extracting real estate signals...',
    storing: 'Storing results...',
    completed: 'Import complete',
    failed: 'Import failed',
  };

  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 8, padding: 20, marginBottom: 20,
      border: `1px solid ${job.status === 'failed' ? '#e06c75' : job.status === 'completed' ? '#4ade80' : '#7c3aed'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ color: '#ccd6f6', margin: 0, fontSize: 14 }}>
          PST Email Import
        </h4>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 16,
        }}>&#10005;</button>
      </div>

      <div style={{ color: statusColors[job.status] || '#8892b0', fontSize: 13, marginBottom: 8 }}>
        {statusLabel[job.status] || job.status}
      </div>

      {isActive && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            height: 6, background: '#0d1117', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`, background: '#7c3aed',
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ color: '#8892b0', fontSize: 11, marginTop: 4 }}>
            {job.processedEmails} / {job.totalEmails || '?'} emails processed
          </div>
        </div>
      )}

      {job.status === 'completed' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatBox label="Emails Processed" value={String(job.totalEmails)} color="#ccd6f6" />
          <StatBox label="Entities Extracted" value={String(job.entitiesFound)} color="#4ade80" />
          <StatBox label="Emails with Signal" value={String(job.emailsWithSignal || 0)} color="#7c3aed" />
        </div>
      )}

      {job.status === 'failed' && job.errors.length > 0 && (
        <div style={{ padding: 10, background: '#3b1a1a', borderRadius: 6, color: '#e06c75', fontSize: 12, marginBottom: 12 }}>
          {job.errors.slice(0, 3).map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {entities.length > 0 && (
        <div>
          <h5 style={{ color: '#ccd6f6', fontSize: 12, margin: '12px 0 8px' }}>
            Extracted Entities ({entities.length})
          </h5>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Details</th>
                  <th style={thStyle}>Source Email</th>
                  <th style={thStyle}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr key={e.id}>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: entityTypeColor(e.entity_type) + '22',
                        color: entityTypeColor(e.entity_type),
                      }}>
                        {e.entity_type}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {e.property_address && <div style={{ color: '#ccd6f6' }}>{e.property_address}</div>}
                      {e.deal_name && <div style={{ color: '#8892b0' }}>{e.deal_name}</div>}
                      {e.contact_name && <div style={{ color: '#8892b0' }}>{e.contact_name}{e.organization ? ` (${e.organization})` : ''}</div>}
                      {e.asking_price && <div style={{ color: '#4ade80' }}>${Number(e.asking_price).toLocaleString()}</div>}
                      {e.unit_count && <div style={{ color: '#8892b0' }}>{e.unit_count} units</div>}
                      {e.cap_rate && <div style={{ color: '#8892b0' }}>{Number(e.cap_rate).toFixed(1)}% cap</div>}
                      {e.rent_figures && <div style={{ color: '#8892b0' }}>{e.rent_figures}</div>}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ color: '#ccd6f6' }}>{e.email_subject || '(no subject)'}</div>
                      <div style={{ color: '#8892b0', fontSize: 10 }}>{e.email_sender}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: Number(e.confidence) >= 0.7 ? '#4ade80' : '#f59e0b' }}>
                        {Math.round(Number(e.confidence) * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '6px 8px', color: '#00d4ff', textAlign: 'left',
  borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap', fontSize: 11,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px', borderBottom: '1px solid #1e1e38', verticalAlign: 'top',
};

function entityTypeColor(type: string): string {
  const map: Record<string, string> = {
    property: '#00d4ff',
    deal: '#4ade80',
    contact: '#f59e0b',
    financial: '#e06c75',
  };
  return map[type] || '#8892b0';
}

const StatBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ padding: 10, background: '#0d1117', borderRadius: 6, textAlign: 'center' }}>
    <div style={{ color, fontSize: 20, fontWeight: 700 }}>{value}</div>
    <div style={{ color: '#8892b0', fontSize: 11, marginTop: 2 }}>{label}</div>
  </div>
);

const InputField: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label style={{ color: '#8892b0', fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
      width: '100%', padding: '6px 10px', background: '#0d1117', border: '1px solid #2a2a4a',
      borderRadius: 6, color: '#ccd6f6', fontSize: 12, outline: 'none', boxSizing: 'border-box',
    }} />
  </div>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
  <div>
    <label style={{ color: '#8892b0', fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: '100%', padding: '6px 10px', background: '#0d1117', border: '1px solid #2a2a4a',
      borderRadius: 6, color: '#ccd6f6', fontSize: 12, outline: 'none',
    }}>
      {options.map(o => <option key={o} value={o}>{o || '\u2014'}</option>)}
    </select>
  </div>
);

const FilterInput: React.FC<{ placeholder: string; value: string; onChange: (v: string) => void }> = ({ placeholder, value, onChange }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
    padding: '6px 10px', background: '#1a1a2e', border: '1px solid #2a2a4a',
    borderRadius: 6, color: '#ccd6f6', fontSize: 12, outline: 'none',
  }} />
);

const FilterSelect: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    padding: '6px 10px', background: '#1a1a2e', border: '1px solid #2a2a4a',
    borderRadius: 6, color: '#ccd6f6', fontSize: 12, outline: 'none',
  }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  const isPst = type === 'application/vnd.ms-outlook' || type === 'pst';
  const colors: Record<string, string> = {
    'text/csv': '#4ade80',
    'application/csv': '#4ade80',
    'application/pdf': '#e06c75',
  };
  const labels: Record<string, string> = {
    'text/csv': 'CSV',
    'application/csv': 'CSV',
    'application/pdf': 'PDF',
  };
  const color = isPst ? '#7c3aed' : (colors[type] || '#00d4ff');
  const label = isPst ? 'PST' : (labels[type] || 'XLS');

  return (
    <div style={{
      width: 36, height: 36, borderRadius: 6, background: `${color}22`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 10, fontWeight: 700,
    }}>
      {label}
    </div>
  );
};

export default DataLibraryPage;
