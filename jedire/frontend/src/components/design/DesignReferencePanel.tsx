import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/services/api.client';

interface DesignReference {
  id: string;
  deal_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string;
  tags: string[];
  notes: string | null;
  ai_analysis: any;
  created_at: string;
}

interface DesignReferencePanelProps {
  dealId: string;
  isOpen: boolean;
  onToggle: () => void;
  onPinToViewport?: (ref: DesignReference) => void;
}

const CATEGORIES = ['general', 'facade', 'floorplan', 'elevation', 'massing', 'site-plan', 'interior', 'landscape'];

export const DesignReferencePanel: React.FC<DesignReferencePanelProps> = ({
  dealId,
  isOpen,
  onToggle,
  onPinToViewport,
}) => {
  const [references, setReferences] = useState<DesignReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRef, setSelectedRef] = useState<DesignReference | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReferences = useCallback(async () => {
    if (!dealId) return;
    try {
      setIsLoading(true);
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const res = await apiClient.get(`/api/v1/design-references/${dealId}${params}`);
      setReferences(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load design references:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dealId, selectedCategory]);

  useEffect(() => {
    if (isOpen) loadReferences();
  }, [isOpen, loadReferences]);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', selectedCategory !== 'all' ? selectedCategory : 'general');

    try {
      await apiClient.post(`/api/v1/design-references/${dealId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      loadReferences();
    } catch (err) {
      console.error('Failed to upload reference:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleUpload);
  };

  const handleDelete = async (refId: string) => {
    try {
      await apiClient.delete(`/api/v1/design-references/${dealId}/${refId}`);
      setReferences((prev) => prev.filter((r) => r.id !== refId));
      if (selectedRef?.id === refId) setSelectedRef(null);
    } catch (err) {
      console.error('Failed to delete reference:', err);
    }
  };

  const handleAnalyze = async (refId: string) => {
    try {
      const res = await apiClient.post(`/api/v1/design-references/${dealId}/${refId}/analyze`);
      setReferences((prev) =>
        prev.map((r) => (r.id === refId ? { ...r, ai_analysis: res.data?.data?.analysis } : r))
      );
    } catch (err) {
      console.error('Failed to analyze reference:', err);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-20 right-4 z-10 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition text-sm"
      >
        References
      </button>
    );
  }

  return (
    <div className="absolute top-20 right-4 z-10 w-80 bg-gray-800 rounded-lg shadow-xl overflow-hidden max-h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-white text-sm font-medium">Design References</h3>
        <button onClick={onToggle} className="text-gray-400 hover:text-white text-lg">
          &times;
        </button>
      </div>

      <div
        className={`mx-3 mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${
          isDragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(handleUpload);
          }}
        />
        <p className="text-gray-400 text-xs">Drop images here or click to upload</p>
      </div>

      <div className="flex gap-1 px-3 mt-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
            selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap capitalize ${
              selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="p-3 overflow-y-auto max-h-96">
        {isLoading ? (
          <p className="text-gray-500 text-xs text-center py-4">Loading...</p>
        ) : references.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">No references yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {references.map((ref) => (
              <div
                key={ref.id}
                className={`relative group rounded-lg overflow-hidden border cursor-pointer transition ${
                  selectedRef?.id === ref.id ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'
                }`}
                onClick={() => setSelectedRef(selectedRef?.id === ref.id ? null : ref)}
              >
                {ref.mime_type.startsWith('image/') ? (
                  <img
                    src={`/api/v1/design-references/file/${ref.file_path}`}
                    alt={ref.file_name}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-400 text-2xl">PDF</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                  {onPinToViewport && ref.mime_type.startsWith('image/') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPinToViewport(ref); }}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                    >
                      Pin
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAnalyze(ref.id); }}
                    className="px-2 py-1 bg-purple-600 text-white text-xs rounded"
                  >
                    AI
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(ref.id); }}
                    className="px-2 py-1 bg-red-600 text-white text-xs rounded"
                  >
                    Del
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                  <p className="text-white text-[10px] truncate">{ref.file_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRef?.ai_analysis && (
        <div className="px-3 py-2 border-t border-gray-700">
          <h4 className="text-white text-xs font-medium mb-1">AI Analysis</h4>
          <p className="text-gray-400 text-xs">{selectedRef.ai_analysis.style_notes}</p>
        </div>
      )}
    </div>
  );
};

export default DesignReferencePanel;
