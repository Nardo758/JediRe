/**
 * FileUploader Usage Example
 * Demonstrates how to integrate FileUploader into Asset Map Intelligence notes
 */

import React, { useState } from 'react';
import { FileUploader, FileWithPreview } from './FileUploader';

interface Attachment {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
}

export const FileUploaderExample: React.FC = () => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [currentTotalSize, setCurrentTotalSize] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Example asset and note IDs (replace with actual values)
  const assetId = '123e4567-e89b-12d3-a456-426614174000';
  const noteId = '987fcdeb-51a2-43d1-b789-123456789abc';

  const handleUploadSuccess = (files: Attachment[]) => {
    console.log('Upload successful:', files);
    setAttachments(prev => [...prev, ...files]);
    
    // Calculate new total size
    const newSize = files.reduce((sum, file) => sum + file.size, 0);
    setCurrentTotalSize(prev => prev + newSize);
    
    setUploadSuccess(`Successfully uploaded ${files.length} file(s)`);
    setUploadError(null);
    
    // Clear success message after 3 seconds
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    setUploadError(error);
    setUploadSuccess(null);
  };

  const handleFilesChange = (files: FileWithPreview[]) => {
    setSelectedFiles(files);
  };

  const handleDeleteAttachment = async (filename: string, size: number) => {
    try {
      const response = await fetch(
        `/api/v1/files/notes/${assetId}/${noteId}/${filename}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      // Remove from attachments list
      setAttachments(prev => prev.filter(a => a.filename !== filename));
      
      // Update total size
      setCurrentTotalSize(prev => prev - size);
      
      setUploadSuccess('File deleted successfully');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (error) {
      console.error('Delete error:', error);
      setUploadError('Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
    if (mimeType.includes('text')) return '📄';
    return '📎';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          File Upload Example
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload files for Asset Map Intelligence note attachments
        </p>

        {/* Success Message */}
        {uploadSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <p className="text-sm text-green-700">{uploadSuccess}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {uploadError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-600">✕</span>
              <p className="text-sm text-red-700 whitespace-pre-line">{uploadError}</p>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* File Uploader */}
        <FileUploader
          assetId={assetId}
          noteId={noteId}
          currentTotalSize={currentTotalSize}
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          onFilesChange={handleFilesChange}
        />
      </div>

      {/* Existing Attachments */}
      {attachments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Uploaded Attachments ({attachments.length})
          </h3>
          
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.filename}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {/* Icon */}
                <div className="w-10 h-10 flex-shrink-0 bg-white rounded flex items-center justify-center">
                  <span className="text-2xl">{getFileIcon(attachment.mimeType)}</span>
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={attachment.url}
                    download={attachment.originalName}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Download"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                  <button
                    onClick={() => handleDeleteAttachment(attachment.filename, attachment.size)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Debug Info</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <p>Asset ID: <code className="bg-white px-1 py-0.5 rounded">{assetId}</code></p>
          <p>Note ID: <code className="bg-white px-1 py-0.5 rounded">{noteId}</code></p>
          <p>Current Total Size: <code className="bg-white px-1 py-0.5 rounded">{formatFileSize(currentTotalSize)}</code></p>
          <p>Selected Files: <code className="bg-white px-1 py-0.5 rounded">{selectedFiles.length}</code></p>
          <p>Uploaded Attachments: <code className="bg-white px-1 py-0.5 rounded">{attachments.length}</code></p>
        </div>
      </div>
    </div>
  );
};

export default FileUploaderExample;
