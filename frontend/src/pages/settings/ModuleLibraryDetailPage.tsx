import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { DollarSign, BarChart3, ClipboardCheck, Activity, ArrowLeft, Download, Trash2, Upload, FolderOpen } from 'lucide-react';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface ModuleFile {
  id: number;
  fileName: string;
  category: string;
  fileSize: number;
  uploadedAt: string;
  parsingStatus: 'pending' | 'parsing' | 'complete' | 'error';
  parsedAt?: string;
  parsingErrors?: string;
  propertyType?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  submarket?: string;
}

interface LearningStatus {
  filesAnalyzed: number;
  totalFiles: number;
  patterns: Array<{ id: number; patternType: string; patternValue: any; confidenceScore: number; sampleSize: number }>;
  templates: Array<{ id: number; templateName: string; propertyType: string; usageCount: number }>;
}

const MODULE_INFO: Record<string, { title: string; icon: React.ReactNode; categories: string[] }> = {
  financial: {
    title: 'Financial Module',
    icon: <DollarSign style={{ width: 24, height: 24, color: BT.text.green }} />,
    categories: ['Historical Operating Expenses', 'Previous Pro Formas', 'Construction Cost Data', 'Debt Terms & Structures', 'Cap Rate History'],
  },
  market: {
    title: 'Market Module',
    icon: <BarChart3 style={{ width: 24, height: 24, color: BT.text.cyan }} />,
    categories: ['Market Reports', 'Proprietary Research', 'Comp Data', 'Market Trends'],
  },
  due_diligence: {
    title: 'Due Diligence Module',
    icon: <ClipboardCheck style={{ width: 24, height: 24, color: BT.text.amber }} />,
    categories: ['Checklists', 'Template Documents', 'Previous DD Files'],
  },
  traffic: {
    title: 'Traffic Module',
    icon: <Activity style={{ width: 24, height: 24, color: BT.text.violet }} />,
    categories: ['Weekly Traffic Reports', 'Leasing Velocity Data', 'Historical Conversion Data', 'Submarket Benchmarks'],
  },
};

export function ModuleLibraryDetailPage() {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();

  const [files, setFiles] = useState<ModuleFile[]>([]);
  const [learningStatus, setLearningStatus] = useState<LearningStatus | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadPropertyType, setUploadPropertyType] = useState('');
  const [uploadAddress, setUploadAddress] = useState('');
  const [uploadCity, setUploadCity] = useState('');
  const [uploadState, setUploadState] = useState('');
  const [uploadZip, setUploadZip] = useState('');
  const [uploadSubmarket, setUploadSubmarket] = useState('');

  const moduleInfo = module ? MODULE_INFO[module] : null;

  useEffect(() => {
    if (module && moduleInfo) {
      loadFiles();
      loadLearningStatus();

      const poll = () => {
        if (document.visibilityState === 'hidden') return;
        loadFiles();
        loadLearningStatus();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') { loadFiles(); loadLearningStatus(); }
      };

      const interval = setInterval(poll, 3000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [module]);

  const loadFiles = async () => {
    try {
      const response = await apiClient.get(`/api/v1/module-libraries/${module}/files`, {
        params: selectedCategoryFilter ? { category: selectedCategoryFilter } : {},
      });
      setFiles(response.data.files || []);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLearningStatus = async () => {
    try {
      const response = await apiClient.get(`/api/v1/module-libraries/${module}/learning-status`);
      setLearningStatus(response.data);
    } catch (error) {
      console.error('Failed to load learning status:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedCategory) { alert('Please select a category first'); return; }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', selectedCategory);
      if (uploadPropertyType) formData.append('propertyType', uploadPropertyType);
      if (uploadAddress) formData.append('address', uploadAddress);
      if (uploadCity) formData.append('city', uploadCity);
      if (uploadState) formData.append('state', uploadState);
      if (uploadZip) formData.append('zip', uploadZip);
      if (uploadSubmarket) formData.append('submarket', uploadSubmarket);
      await apiClient.post(`/api/v1/module-libraries/${module}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadFiles();
      setSelectedCategory(''); setUploadPropertyType(''); setUploadAddress('');
      setUploadCity(''); setUploadState(''); setUploadZip(''); setUploadSubmarket('');
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDelete = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await apiClient.delete(`/api/v1/module-libraries/${module}/files/${fileId}`);
      await loadFiles(); await loadLearningStatus();
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      const response = await apiClient.get(`/api/v1/module-libraries/${module}/files/${fileId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', fileName);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) {
      console.error('Failed to download file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (status: string): string => {
    const m: Record<string, string> = { pending: BT.text.muted, parsing: BT.text.amber, complete: BT.text.green, error: BT.text.red };
    return m[status] || BT.text.muted;
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 11,
    background: BT.bg.input, color: BT.text.primary,
    border: `1px solid ${BT.border.medium}`, outline: 'none',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 11,
    background: BT.bg.input, color: BT.text.primary,
    border: `1px solid ${BT.border.medium}`, outline: 'none',
  };

  if (!module || !moduleInfo) {
    return <div style={{ padding: 24, color: BT.text.red }}>Invalid module</div>;
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ height: 32, width: 32, border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const filesByCategory: Record<string, ModuleFile[]> = {};
  files.forEach(file => {
    if (!filesByCategory[file.category]) filesByCategory[file.category] = [];
    filesByCategory[file.category].push(file);
  });

  return (
    <div style={{ maxWidth: 1200, padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate('/settings/module-libraries')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: BT.text.cyan, cursor: 'pointer', fontSize: 11, marginBottom: 8, ...mono }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Module Libraries
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ padding: 8, background: BT.bg.panelAlt }}>{moduleInfo.icon}</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary }}>{moduleInfo.title}</h1>
        </div>
        <p style={{ fontSize: 12, color: BT.text.secondary }}>Upload historical data for Opus to learn your patterns and assumptions</p>
      </div>

      <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, marginBottom: 12 }}>Upload Files</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>CATEGORY *</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={selectStyle}>
              <option value="">-- Select a category --</option>
              {moduleInfo.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>PROPERTY TYPE</label>
            <select value={uploadPropertyType} onChange={(e) => setUploadPropertyType(e.target.value)} style={selectStyle}>
              <option value="">-- Select property type --</option>
              {['multifamily','office','retail','industrial','mixed-use','hospitality','self_storage','student_housing','senior_living','build_to_rent','data_centers','manufactured_mobile'].map(s =>
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              )}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr 0.5fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>ADDRESS</label>
            <input type="text" value={uploadAddress} onChange={(e) => setUploadAddress(e.target.value)} placeholder="123 Main St" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>CITY</label>
            <input type="text" value={uploadCity} onChange={(e) => setUploadCity(e.target.value)} placeholder="Atlanta" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>STATE</label>
            <select value={uploadState} onChange={(e) => setUploadState(e.target.value)} style={selectStyle}>
              <option value="">--</option>
              {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>ZIP</label>
            <input type="text" value={uploadZip} onChange={(e) => setUploadZip(e.target.value)} placeholder="30301" maxLength={10} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>SUBMARKET (OPTIONAL)</label>
          <input type="text" value={uploadSubmarket} onChange={(e) => setUploadSubmarket(e.target.value)} placeholder="e.g., Midtown Atlanta, Downtown Dallas" style={{ ...inputStyle, maxWidth: '50%' }} />
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? BT.text.cyan : BT.border.subtle}`,
            background: dragActive ? BT.bg.active : BT.bg.panelAlt,
            padding: 32,
            textAlign: 'center',
            opacity: !selectedCategory ? 0.4 : 1,
            cursor: !selectedCategory ? 'not-allowed' : 'pointer',
          }}
        >
          <input type="file" id="file-upload" onChange={handleFileSelect} accept=".xlsx,.xls,.pdf,.csv" disabled={!selectedCategory || uploading} style={{ display: 'none' }} />
          <label htmlFor="file-upload" style={{ cursor: !selectedCategory ? 'not-allowed' : 'pointer' }}>
            <Upload style={{ width: 28, height: 28, color: BT.text.muted, margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: BT.text.secondary, marginBottom: 4 }}>
              {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
            </p>
            <p style={{ fontSize: 10, color: BT.text.muted }}>Supports: Excel (.xlsx, .xls), PDF, CSV (max 50 MB)</p>
          </label>
        </div>
      </div>

      <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary }}>Uploaded Files ({files.length})</h2>
          <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: 160 }}>
            <option value="">All Categories</option>
            {moduleInfo.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <FolderOpen style={{ width: 32, height: 32, color: BT.text.muted, margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12, color: BT.text.muted }}>No files uploaded yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(filesByCategory).map(([category, categoryFiles]) => (
              <div key={category}>
                <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.06em', marginBottom: 6, ...mono }}>
                  {category.toUpperCase()} ({categoryFiles.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {categoryFiles.map((file) => (
                    <div key={file.id} style={{ padding: 12, border: `1px solid ${BT.border.subtle}`, background: BT.bg.panelAlt }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: BT.text.primary, marginBottom: 4 }}>{file.fileName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: BT.text.muted, flexWrap: 'wrap', ...mono }}>
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span style={{ color: BT.border.subtle }}>|</span>
                            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                            {file.propertyType && (
                              <>
                                <span style={{ color: BT.border.subtle }}>|</span>
                                <span style={{ color: BT.text.cyan, textTransform: 'capitalize' }}>{file.propertyType.replace(/_/g, ' ')}</span>
                              </>
                            )}
                            {(file.city || file.state) && (
                              <>
                                <span style={{ color: BT.border.subtle }}>|</span>
                                <span>{[file.city, file.state].filter(Boolean).join(', ')}</span>
                              </>
                            )}
                            {file.submarket && (
                              <>
                                <span style={{ color: BT.border.subtle }}>|</span>
                                <span>{file.submarket}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                          <span style={{ fontSize: 9, padding: '2px 8px', fontWeight: 600, color: getStatusColor(file.parsingStatus), background: BT.bg.active, textTransform: 'uppercase', ...mono }}>{file.parsingStatus}</span>
                          <button onClick={() => handleDownload(file.id, file.fileName)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Download">
                            <Download style={{ width: 14, height: 14, color: BT.text.cyan }} />
                          </button>
                          <button onClick={() => handleDelete(file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Delete">
                            <Trash2 style={{ width: 14, height: 14, color: BT.text.red }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {learningStatus && (
        <div style={{ padding: 20, background: BT.bg.panelAlt, border: `1px solid ${BT.text.cyan}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 style={{ width: 16, height: 16, color: BT.text.cyan }} /> Opus Learning Status
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ padding: 14, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Files Analyzed</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.primary, ...mono }}>
                {learningStatus.filesAnalyzed} <span style={{ fontSize: 12, color: BT.text.muted }}>of {learningStatus.totalFiles}</span>
              </div>
              <div style={{ marginTop: 8, height: 4, background: BT.bg.input }}>
                <div style={{ height: '100%', background: BT.text.cyan, width: `${learningStatus.totalFiles > 0 ? (learningStatus.filesAnalyzed / learningStatus.totalFiles * 100) : 0}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
            <div style={{ padding: 14, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Patterns Detected</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.primary, ...mono }}>{learningStatus.patterns.length}</div>
              <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>OpEx/unit, rent growth, cap rates, etc.</div>
            </div>
            <div style={{ padding: 14, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Template Structures</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.primary, ...mono }}>{learningStatus.templates.length}</div>
              <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>Learned model structures</div>
            </div>
          </div>

          {learningStatus.patterns.length > 0 && (
            <div style={{ padding: 14, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.secondary, marginBottom: 8 }}>Recent Patterns</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {learningStatus.patterns.slice(0, 5).map((pattern) => (
                  <div key={pattern.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: BT.text.secondary, textTransform: 'capitalize' }}>{pattern.patternType.replace(/_/g, ' ')}</span>
                    <span style={{ color: BT.text.muted, ...mono }}>Confidence: {(pattern.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
