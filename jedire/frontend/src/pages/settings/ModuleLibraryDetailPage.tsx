import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api.client';

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
  patterns: Array<{
    id: number;
    patternType: string;
    patternValue: any;
    confidenceScore: number;
    sampleSize: number;
  }>;
  templates: Array<{
    id: number;
    templateName: string;
    propertyType: string;
    usageCount: number;
  }>;
}

const MODULE_INFO: Record<string, { title: string; icon: string; categories: string[] }> = {
  financial: {
    title: 'Financial Module',
    icon: '\u{1F4B0}',
    categories: [
      'Historical Operating Expenses',
      'Previous Pro Formas',
      'Construction Cost Data',
      'Debt Terms & Structures',
      'Cap Rate History',
    ],
  },
  market: {
    title: 'Market Module',
    icon: '\u{1F4CA}',
    categories: [
      'Market Reports',
      'Proprietary Research',
      'Comp Data',
      'Market Trends',
    ],
  },
  due_diligence: {
    title: 'Due Diligence Module',
    icon: '\u2705',
    categories: [
      'Checklists',
      'Template Documents',
      'Previous DD Files',
    ],
  },
  traffic: {
    title: 'Traffic Module',
    icon: '\u{1F6A6}',
    categories: [
      'Weekly Traffic Reports',
      'Leasing Velocity Data',
      'Historical Conversion Data',
      'Submarket Benchmarks',
    ],
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
      const interval = setInterval(() => {
        loadFiles();
        loadLearningStatus();
      }, 3000);
      return () => clearInterval(interval);
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
    if (!selectedCategory) {
      alert('Please select a category first');
      return;
    }

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

      await apiClient.post(`/api/v1/module-libraries/${module}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await loadFiles();
      setSelectedCategory('');
      setUploadPropertyType('');
      setUploadAddress('');
      setUploadCity('');
      setUploadState('');
      setUploadZip('');
      setUploadSubmarket('');
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDelete = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/module-libraries/${module}/files/${fileId}`);
      await loadFiles();
      await loadLearningStatus();
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      const response = await apiClient.get(
        `/api/v1/module-libraries/${module}/files/${fileId}/download`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      parsing: 'bg-yellow-100 text-yellow-700',
      complete: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
    };
    return badges[status] || badges.pending;
  };

  if (!module || !moduleInfo) {
    return (
      <div className="p-6">
        <div className="text-red-600">Invalid module</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const filesByCategory: Record<string, ModuleFile[]> = {};
  files.forEach(file => {
    if (!filesByCategory[file.category]) {
      filesByCategory[file.category] = [];
    }
    filesByCategory[file.category].push(file);
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/settings/module-libraries')}
          className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-2"
        >
          &larr; Back to Module Libraries
        </button>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">{moduleInfo.icon}</span>
          <h1 className="text-3xl font-bold text-gray-900">{moduleInfo.title}</h1>
        </div>
        <p className="text-gray-600">
          Upload historical data for Opus to learn your patterns and assumptions
        </p>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Files</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">-- Select a category --</option>
              {moduleInfo.categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
            <select
              value={uploadPropertyType}
              onChange={(e) => setUploadPropertyType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">-- Select property type --</option>
              <option value="multifamily">Multifamily</option>
              <option value="office">Office</option>
              <option value="retail">Retail</option>
              <option value="industrial">Industrial</option>
              <option value="mixed-use">Mixed-Use</option>
              <option value="hospitality">Hospitality</option>
              <option value="self_storage">Self Storage</option>
              <option value="student_housing">Student Housing</option>
              <option value="senior_living">Senior Living</option>
              <option value="build_to_rent">Build-to-Rent</option>
              <option value="data_centers">Data Centers</option>
              <option value="manufactured_mobile">Manufactured / Mobile</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={uploadAddress}
              onChange={(e) => setUploadAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={uploadCity}
              onChange={(e) => setUploadCity(e.target.value)}
              placeholder="Atlanta"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                value={uploadState}
                onChange={(e) => setUploadState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">--</option>
                {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input
                type="text"
                value={uploadZip}
                onChange={(e) => setUploadZip(e.target.value)}
                placeholder="30301"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Submarket (optional)</label>
          <input
            type="text"
            value={uploadSubmarket}
            onChange={(e) => setUploadSubmarket(e.target.value)}
            placeholder="e.g., Midtown Atlanta, Downtown Dallas"
            className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
          } ${!selectedCategory ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            type="file"
            id="file-upload"
            onChange={handleFileSelect}
            accept=".xlsx,.xls,.pdf,.csv"
            disabled={!selectedCategory || uploading}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className={!selectedCategory ? 'cursor-not-allowed' : 'cursor-pointer'}
          >
            <div className="text-4xl mb-2">&#x1F4C1;</div>
            <p className="text-gray-700 font-medium mb-1">
              {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
            </p>
            <p className="text-gray-500 text-sm">
              Supports: Excel (.xlsx, .xls), PDF, CSV (max 50 MB)
            </p>
          </label>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Uploaded Files ({files.length})</h2>
          
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Categories</option>
            {moduleInfo.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">&#x1F4C2;</div>
            <p>No files uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(filesByCategory).map(([category, categoryFiles]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  &#x1F4C1; {category} <span className="text-gray-500">({categoryFiles.length})</span>
                </h3>
                <div className="space-y-2">
                  {categoryFiles.map((file) => (
                    <div
                      key={file.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-2xl">
                              {file.fileName.endsWith('.xlsx') || file.fileName.endsWith('.xls') ? '\u{1F4CA}' : 
                               file.fileName.endsWith('.pdf') ? '\u{1F4C4}' : '\u{1F4C3}'}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{file.fileName}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                                <span>{formatFileSize(file.fileSize)}</span>
                                <span>&bull;</span>
                                <span>Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                {file.propertyType && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs capitalize">{file.propertyType.replace(/_/g, ' ')}</span>
                                  </>
                                )}
                                {(file.city || file.state) && (
                                  <>
                                    <span>&bull;</span>
                                    <span>{[file.city, file.state].filter(Boolean).join(', ')}</span>
                                  </>
                                )}
                                {file.submarket && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="text-gray-400">{file.submarket}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(file.parsingStatus)}`}>
                            {file.parsingStatus}
                          </span>
                          <button
                            onClick={() => handleDownload(file.id, file.fileName)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                            title="Download"
                          >
                            &#x2B07;&#xFE0F;
                          </button>
                          <button
                            onClick={() => handleDelete(file.id)}
                            className="text-red-600 hover:text-red-800 p-2"
                            title="Delete"
                          >
                            &#x1F5D1;&#xFE0F;
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
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            &#x1F916; Opus Learning Status
          </h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Files Analyzed</div>
              <div className="text-2xl font-bold text-gray-900">
                {learningStatus.filesAnalyzed} of {learningStatus.totalFiles}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${learningStatus.totalFiles > 0 ? (learningStatus.filesAnalyzed / learningStatus.totalFiles * 100) : 0}%` }}
                />
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Patterns Detected</div>
              <div className="text-2xl font-bold text-gray-900">{learningStatus.patterns.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                OpEx/unit, rent growth, cap rates, etc.
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Template Structures</div>
              <div className="text-2xl font-bold text-gray-900">{learningStatus.templates.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                Learned model structures
              </div>
            </div>
          </div>
          
          {learningStatus.patterns.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Recent Patterns</h3>
              <div className="space-y-2">
                {learningStatus.patterns.slice(0, 5).map((pattern) => (
                  <div key={pattern.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{pattern.patternType.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500">
                      Confidence: {(pattern.confidenceScore * 100).toFixed(0)}%
                    </span>
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
