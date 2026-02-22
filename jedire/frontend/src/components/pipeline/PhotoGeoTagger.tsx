import React, { useState, useRef } from 'react';
import { BuildingSection, PhotoTag, Vector3 } from '../../types/construction';

interface PhotoGeoTaggerProps {
  sections: BuildingSection[];
  onPhotoTag: (photo: PhotoTag) => void;
  onClose: () => void;
}

export const PhotoGeoTagger: React.FC<PhotoGeoTaggerProps> = ({
  sections,
  onPhotoTag,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select a valid image file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedSection) {
      alert('Please select a photo and a building section');
      return;
    }

    setUploading(true);

    try {
      // In production, this would upload to a server
      // For now, we'll simulate with a timeout and create a local object URL
      await new Promise(resolve => setTimeout(resolve, 1000));

      const section = sections.find(s => s.id === selectedSection);
      if (!section) {
        throw new Error('Section not found');
      }

      // Create photo tag
      const photoTag: PhotoTag = {
        id: `photo-${Date.now()}`,
        filename: selectedFile.name,
        url: URL.createObjectURL(selectedFile),
        thumbnailUrl: URL.createObjectURL(selectedFile),
        sectionId: selectedSection,
        location: {
          x: section.x || 0,
          y: (section.floor - 1) * 4,
          z: section.z || 0,
        },
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Current User', // Would come from auth context
        caption: caption || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
      };

      onPhotoTag(photoTag);

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedSection('');
      setCaption('');
      setTags('');
      
      alert('Photo tagged successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreviewUrl(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📸 Tag Construction Photo</h2>
            <p className="text-sm text-gray-600 mt-1">Upload and link photos to building sections</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Photo Upload */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Upload Photo</h3>
              
              {/* File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition hover:border-blue-400 hover:bg-blue-50
                  ${previewUrl ? 'border-green-400 bg-green-50' : 'border-gray-300'}
                `}
              >
                {previewUrl ? (
                  <div className="space-y-4">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg shadow-md"
                    />
                    <p className="text-sm text-gray-600">
                      {selectedFile?.name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-gray-600">
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm">PNG, JPG, HEIC up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Caption */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption (optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe what's in this photo..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Tags */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="framing, inspection, progress, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Right: Location Selection */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Select Location</h3>
              
              <div className="space-y-2 max-h-[500px] overflow-y-auto border border-gray-200 rounded-lg">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className={`
                      w-full text-left px-4 py-3 transition border-b border-gray-100
                      hover:bg-blue-50
                      ${selectedSection === section.id 
                        ? 'bg-blue-100 border-l-4 border-l-blue-500' 
                        : 'hover:border-l-4 hover:border-l-blue-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{section.name}</div>
                        <div className="text-sm text-gray-600 capitalize">{section.phase} Phase</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-700">
                          {section.percentComplete}%
                        </div>
                        <div className={`
                          w-3 h-3 rounded-full
                          ${section.status === 'complete' ? 'bg-green-500' :
                            section.status === 'inProgress' ? 'bg-yellow-400' :
                            'bg-gray-300'
                          }
                        `} />
                      </div>
                    </div>
                    {section.photos && section.photos.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        📸 {section.photos.length} existing photo{section.photos.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* AI Auto-Tag Placeholder */}
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-purple-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-purple-900">🚀 AI Auto-Tag (Coming Soon)</h4>
                    <p className="text-xs text-purple-700 mt-1">
                      Upload multiple photos and our AI will automatically identify and tag the building section,
                      estimate progress, and flag quality issues.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedFile && selectedSection && (
              <span className="text-green-600 font-medium">
                ✓ Ready to upload to {sections.find(s => s.id === selectedSection)?.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedSection || uploading}
              className={`
                px-6 py-2 rounded-lg font-medium transition
                ${selectedFile && selectedSection && !uploading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {uploading ? 'Uploading...' : 'Upload & Tag Photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
