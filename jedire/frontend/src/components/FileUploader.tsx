/**
 * FileUploader Component
 * Drag & drop file uploader for Asset Map Intelligence note attachments
 * 
 * Features:
 * - Drag & drop interface
 * - Multiple file support (max 10 files per upload)
 * - Progress tracking
 * - File preview with thumbnails
 * - Size validation (50 MB total per note)
 * - File type whitelist
 * - Error handling with user-friendly messages
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button } from './shared/Button';

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.txt', '.csv'
];

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_SINGLE_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 10;

export interface FileWithPreview {
  file: File;
  preview?: string;
  id: string;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
  progress?: number;
}

export interface FileUploaderProps {
  assetId: string;
  noteId: string;
  currentTotalSize?: number;
  onUploadSuccess?: (files: any[]) => void;
  onUploadError?: (error: string) => void;
  onFilesChange?: (files: FileWithPreview[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  assetId,
  noteId,
  currentTotalSize = 0,
  onUploadSuccess,
  onUploadError,
  onFilesChange,
  maxFiles = MAX_FILES,
  disabled = false,
  className = '',
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate remaining space
  const getTotalSize = useCallback(() => {
    return files.reduce((sum, f) => sum + f.file.size, 0);
  }, [files]);

  const getRemainingSpace = useCallback(() => {
    return MAX_TOTAL_SIZE - currentTotalSize - getTotalSize();
  }, [currentTotalSize, getTotalSize]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Get file icon based on type
  const getFileIcon = (file: File): string => {
    const type = file.type;
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📊';
    if (type.includes('text')) return '📄';
    return '📎';
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type not allowed: ${file.name}. Allowed types: images, PDFs, Office docs.`;
    }

    // Check individual file size
    if (file.size > MAX_SINGLE_FILE_SIZE) {
      return `File too large: ${file.name}. Maximum size per file: ${formatFileSize(MAX_SINGLE_FILE_SIZE)}.`;
    }

    // Check total size
    if (currentTotalSize + getTotalSize() + file.size > MAX_TOTAL_SIZE) {
      return `Adding ${file.name} would exceed the ${formatFileSize(MAX_TOTAL_SIZE)} limit per note.`;
    }

    return null;
  };

  // Handle file selection
  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    // Check file count
    if (files.length + fileList.length > maxFiles) {
      onUploadError?.(`Maximum ${maxFiles} files allowed per upload.`);
      return;
    }

    Array.from(fileList).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        return;
      }

      const fileWithPreview: FileWithPreview = {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        uploading: false,
        uploaded: false,
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          fileWithPreview.preview = reader.result as string;
          setFiles(prev => [...prev]);
        };
        reader.readAsDataURL(file);
      }

      newFiles.push(fileWithPreview);
    });

    if (errors.length > 0) {
      onUploadError?.(errors.join('\n'));
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    }
  }, [files, maxFiles, currentTotalSize, getTotalSize, onUploadError, onFilesChange]);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
  }, [files, onFilesChange]);

  // Upload files
  const uploadFiles = async () => {
    if (files.length === 0) return;
    if (!assetId || !noteId) {
      onUploadError?.('Asset ID and Note ID are required');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('assetId', assetId);
    formData.append('noteId', noteId);

    files.forEach((fileWithPreview) => {
      formData.append('files', fileWithPreview.file);
    });

    try {
      const response = await fetch('/api/v1/upload/note-attachment', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      // Update files as uploaded
      setFiles(prev => prev.map(f => ({ ...f, uploaded: true, uploading: false, progress: 100 })));
      setUploadProgress(100);

      onUploadSuccess?.(data.files);

      // Clear files after successful upload
      setTimeout(() => {
        setFiles([]);
        onFilesChange?.([]);
        setIsUploading(false);
        setUploadProgress(0);
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError?.(errorMessage);
      
      // Mark files with error
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        error: errorMessage, 
        uploading: false 
      })));
      
      setIsUploading(false);
    }
  };

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    onFilesChange?.([]);
  }, [onFilesChange]);

  const totalSize = getTotalSize();
  const remainingSpace = getRemainingSpace();
  const canUpload = files.length > 0 && !isUploading && remainingSpace >= 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 cursor-pointer'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="text-center">
          <div className="text-5xl mb-3">📤</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isDragOver ? 'Drop files here' : 'Drag & drop files'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            or click to browse files
          </p>
          <Button
            variant="default"
            size="md"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Select Files
          </Button>
          <p className="text-xs text-gray-500 mt-3">
            Allowed: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX
          </p>
          <p className="text-xs text-gray-500">
            Max {maxFiles} files • {formatFileSize(MAX_SINGLE_FILE_SIZE)} per file • {formatFileSize(MAX_TOTAL_SIZE)} total per note
          </p>
        </div>
      </div>

      {/* Storage Info */}
      {(currentTotalSize > 0 || totalSize > 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Storage Usage</span>
            <span className="text-sm text-gray-600">
              {formatFileSize(currentTotalSize + totalSize)} / {formatFileSize(MAX_TOTAL_SIZE)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                (currentTotalSize + totalSize) / MAX_TOTAL_SIZE < 0.5
                  ? 'bg-green-500'
                  : (currentTotalSize + totalSize) / MAX_TOTAL_SIZE < 0.8
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(((currentTotalSize + totalSize) / MAX_TOTAL_SIZE) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {remainingSpace > 0
              ? `${formatFileSize(remainingSpace)} remaining`
              : 'Storage limit reached'}
          </p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">
              Selected Files ({files.length})
            </h4>
            <button
              onClick={clearFiles}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            {files.map((fileWithPreview) => (
              <div
                key={fileWithPreview.id}
                className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3"
              >
                {/* Preview/Icon */}
                <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                  {fileWithPreview.preview ? (
                    <img
                      src={fileWithPreview.preview}
                      alt={fileWithPreview.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{getFileIcon(fileWithPreview.file)}</span>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileWithPreview.file.name}
                    </p>
                    {fileWithPreview.uploaded && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Uploaded
                      </span>
                    )}
                    {fileWithPreview.error && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        Error
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileWithPreview.file.size)}
                  </p>
                  {fileWithPreview.error && (
                    <p className="text-xs text-red-600 mt-1">{fileWithPreview.error}</p>
                  )}
                  
                  {/* Progress Bar */}
                  {fileWithPreview.uploading && fileWithPreview.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${fileWithPreview.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                {!fileWithPreview.uploaded && !fileWithPreview.uploading && (
                  <button
                    onClick={() => removeFile(fileWithPreview.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload Button */}
          {canUpload && (
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="md"
                onClick={uploadFiles}
                disabled={!canUpload}
                loading={isUploading}
                className="flex-1"
              >
                {isUploading ? `Uploading... ${uploadProgress}%` : `Upload ${files.length} File${files.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
