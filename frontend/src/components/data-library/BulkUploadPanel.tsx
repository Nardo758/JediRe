/**
 * Bulk Upload Panel
 * 
 * Drag & drop upload for files and ZIP archives
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Archive, X, CheckCircle, 
  AlertCircle, Loader2, FolderOpen
} from 'lucide-react';
import { cloudStorageService, type BulkUploadJob } from '../../services/cloudStorage.service';

interface BulkUploadPanelProps {
  onUploadComplete?: () => void;
}

export const BulkUploadPanel: React.FC<BulkUploadPanelProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadJob, setUploadJob] = useState<BulkUploadJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  
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
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
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
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
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
    
    // Check if any file is a ZIP
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile && files.length === 1) {
      uploadZip(zipFile);
      return;
    }
    
    setError(null);
    setUploadProgress(0);
    
    try {
      const job = await cloudStorageService.uploadFiles(files, setUploadProgress);
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
      const job = await cloudStorageService.uploadZip(file, setUploadProgress);
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
    if (ext === 'zip') return <Archive size={16} className="text-purple-400" />;
    if (ext === 'pdf') return <FileText size={16} className="text-red-400" />;
    return <FileText size={16} className="text-green-400" />;
  };
  
  const getStatusColor = (status: BulkUploadJob['status']) => {
    switch (status) {
      case 'complete': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };
  
  const getStatusText = (status: BulkUploadJob['status']) => {
    switch (status) {
      case 'uploading': return 'Uploading files...';
      case 'extracting': return 'Extracting archive...';
      case 'parsing': return 'Parsing documents...';
      case 'complete': return 'Complete!';
      case 'error': return 'Error';
    }
  };
  
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}
      
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <Upload size={40} className="mx-auto mb-4 text-gray-500" />
        <p className="text-lg font-medium mb-2">
          Drag & drop files here
        </p>
        <p className="text-sm text-gray-400 mb-4">
          Supported: PDF, XLSX, XLS, CSV, ZIP
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors"
          >
            Select Files
          </button>
          <span className="text-gray-500">or</span>
          <button
            onClick={() => zipInputRef.current?.click()}
            className="px-4 py-2 bg-purple-500 text-white rounded font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
          >
            <Archive size={16} />
            Upload ZIP
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          onChange={handleZipSelect}
          className="hidden"
        />
      </div>
      
      {/* File List */}
      {files.length > 0 && (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-800/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">{files.length} files selected</span>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear all
            </button>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-2 border-t border-gray-800 hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(file.name)}
                  <div>
                    <div className="text-sm truncate max-w-xs">{file.name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="bg-gray-800/50 px-4 py-3">
            <button
              onClick={uploadFiles}
              className="w-full px-4 py-2 bg-green-500 text-white rounded font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Upload {files.length} {files.length === 1 ? 'file' : 'files'}
            </button>
          </div>
        </div>
      )}
      
      {/* Upload Progress */}
      {uploadProgress > 0 && uploadProgress < 100 && !uploadJob && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Uploading...</span>
            <span className="text-sm text-gray-400">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Processing Status */}
      {uploadJob && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {uploadJob.status === 'complete' ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : uploadJob.status === 'error' ? (
                <AlertCircle size={16} className="text-red-400" />
              ) : (
                <Loader2 size={16} className="animate-spin" />
              )}
              <span className="text-sm font-medium">Processing</span>
            </div>
            <span className={`text-sm ${getStatusColor(uploadJob.status)}`}>
              {getStatusText(uploadJob.status)}
            </span>
          </div>
          
          {uploadJob.status === 'complete' && (
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-green-400 mb-1">
                {uploadJob.dealsCreated}
              </div>
              <div className="text-sm text-gray-400">deals created</div>
            </div>
          )}
          
          {uploadJob.errors.length > 0 && (
            <div className="mt-3 text-xs text-red-400">
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
              className="mt-4 w-full px-4 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
            >
              Upload more files
            </button>
          )}
        </div>
      )}
      
      {/* Help Text */}
      <div className="bg-gray-800/30 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <FolderOpen size={16} className="text-yellow-500" />
          Tips for bulk upload
        </h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <strong>ZIP archives:</strong> Organize by deal folder (e.g., Deal Name/T12.xlsx, Rent Roll.xlsx, OM.pdf)</li>
          <li>• <strong>File naming:</strong> Include document type in filename (T12, RR, Rent Roll, OM, Tax Bill)</li>
          <li>• <strong>Supported formats:</strong> Excel (XLSX/XLS), PDF, CSV</li>
          <li>• <strong>Large uploads:</strong> For 50+ deals, use ZIP or connect cloud storage</li>
        </ul>
      </div>
    </div>
  );
};
