import React, { useEffect, useCallback } from 'react';
import { X, ExternalLink, Clock, FileText, Map, BarChart3, FolderOpen, Link2 } from 'lucide-react';
import type { SourceCitationData, SourceType } from './SourceCitation';

interface SourceSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: SourceCitationData | null;
}

const SOURCE_LABELS: Record<SourceType, { icon: React.ElementType; label: string; color: string }> = {
  code: { icon: FileText, label: 'Municipal Code', color: 'text-indigo-600' },
  gis: { icon: Map, label: 'GIS Data', color: 'text-emerald-600' },
  calculated: { icon: BarChart3, label: 'Calculated Value', color: 'text-amber-600' },
  record: { icon: FolderOpen, label: 'Public Record', color: 'text-blue-600' },
};

export default function SourceSidePanel({ isOpen, onClose, data }: SourceSidePanelProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !data) return null;

  const sourceConfig = SOURCE_LABELS[data.sourceType];
  const Icon = sourceConfig.icon;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right border-l border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${sourceConfig.color}`} />
            <h2 className="text-sm font-semibold text-gray-900">{sourceConfig.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Section</div>
            <div className="text-base font-semibold text-gray-900">{data.section}</div>
          </div>

          {data.lastVerified && (
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Last verified:</span>
              <span className="text-xs font-medium text-gray-700">{data.lastVerified}</span>
            </div>
          )}

          {data.fullText && (
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Code Text</div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 leading-relaxed font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {data.fullText}
              </div>
            </div>
          )}

          {!data.fullText && (
            <div className="px-5 py-8 border-b border-gray-100 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Full code text not yet loaded</p>
              <p className="text-xs text-gray-400 mt-1">Click "Open in Municode" to view the full section</p>
            </div>
          )}

          {data.crossReferences && data.crossReferences.length > 0 && (
            <div className="px-5 py-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Cross-References</div>
              <div className="space-y-2">
                {data.crossReferences.map((ref, i) => (
                  <button
                    key={i}
                    onClick={() => ref.url && window.open(ref.url, '_blank', 'noopener,noreferrer')}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <Link2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{ref.section}</div>
                      <div className="text-[10px] text-gray-500 truncate">{ref.title}</div>
                    </div>
                    {ref.url && <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {data.url && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Municode →
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
