import { useState, useEffect } from 'react';
import { XMarkIcon, MapPinIcon, PaperClipIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { AssetNote, NoteCategory } from '@/types/asset';

interface AddNoteModalProps {
  location: { lat: number; lng: number };
  onClose: () => void;
  onSave: (note: Partial<AssetNote>) => void;
}

// Mock categories - will be replaced with API call
const mockCategories: NoteCategory[] = [
  { id: 'cat-1', name: 'Observation', color: '#3B82F6', icon: '👁️', isSystemDefault: true },
  { id: 'cat-2', name: 'Issue', color: '#EF4444', icon: '⚠️', isSystemDefault: true },
  { id: 'cat-3', name: 'Opportunity', color: '#10B981', icon: '💡', isSystemDefault: true },
  { id: 'cat-4', name: 'Maintenance', color: '#F59E0B', icon: '🔧', isSystemDefault: false },
];

export default function AddNoteModal({ location, onClose, onSave }: AddNoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<NoteCategory[]>([]);

  useEffect(() => {
    // TODO: Replace with API call
    setCategories(mockCategories);
    setSelectedCategory(mockCategories[0]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const totalSize =
      files.reduce((acc, file) => acc + file.size, 0) +
      attachments.reduce((acc, file) => acc + file.size, 0);

    if (totalSize > 50 * 1024 * 1024) {
      alert('Total attachment size cannot exceed 50 MB');
      return;
    }

    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('Please enter note content');
      return;
    }

    setIsSubmitting(true);

    // TODO: Upload attachments and get URLs
    const attachmentData = attachments.map((file) => ({
      type: file.type.startsWith('image/') ? ('photo' as const) : ('file' as const),
      url: URL.createObjectURL(file), // Placeholder - replace with actual upload
      name: file.name,
      size: file.size,
    }));

    const noteData: Partial<AssetNote> = {
      title: title.trim() || undefined,
      content: content.trim(),
      category: selectedCategory || undefined,
      location,
      isPrivate,
      attachments: attachmentData,
    };

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    onSave(noteData);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Add Note at This Location</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Location Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-blue-700">
              <MapPinIcon className="w-4 h-4" />
              <span className="font-medium">
                Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="note-title" className="block text-sm font-semibold text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Site Visit - Main Entrance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={255}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="note-category" className="block text-sm font-semibold text-gray-700 mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedCategory?.id === category.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{
                    backgroundColor:
                      selectedCategory?.id === category.id
                        ? `${category.color}10`
                        : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="font-medium text-gray-900">{category.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label htmlFor="note-content" className="block text-sm font-semibold text-gray-700 mb-1">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your observation, issue, or note..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              maxLength={5000}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">{content.length}/5,000 characters</span>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <PaperClipIcon className="w-4 h-4 inline mr-1" />
              Attachments
            </label>
            <div className="space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">
                      {file.type.startsWith('image/') ? '🖼️' : '📄'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Remove attachment"
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}

              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                <PaperClipIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">Upload Photo or File</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500">
                Max 50 MB total. Supported: JPG, PNG, PDF, DOC, XLS
              </p>
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">🔒 Private Note</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  Only you can see this note. Uncheck to share with team members.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <MapPinIcon className="w-4 h-4" />
                <span>Save to Map</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
