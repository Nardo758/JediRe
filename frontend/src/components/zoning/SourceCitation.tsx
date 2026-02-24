import React from 'react';
import { FileText, Map, BarChart3, FolderOpen, ExternalLink } from 'lucide-react';

export type SourceType = 'code' | 'gis' | 'calculated' | 'record';

export interface SourceCitationData {
  section: string;
  url?: string;
  sourceType: SourceType;
  lastVerified?: string;
  fullText?: string;
  crossReferences?: { section: string; title: string; url?: string }[];
}

interface SourceCitationProps extends SourceCitationData {
  onOpenPanel?: (data: SourceCitationData) => void;
}

const SOURCE_CONFIG: Record<SourceType, { icon: React.ElementType; emoji: string; label: string; bg: string; text: string; border: string }> = {
  code: { icon: FileText, emoji: '📋', label: 'Code', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  gis: { icon: Map, emoji: '🗺️', label: 'GIS', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  calculated: { icon: BarChart3, emoji: '📊', label: 'Calculated', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  record: { icon: FolderOpen, emoji: '📁', label: 'Record', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

export default function SourceCitation({ section, url, sourceType, lastVerified, fullText, crossReferences, onOpenPanel }: SourceCitationProps) {
  const config = SOURCE_CONFIG[sourceType];
  const Icon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenPanel) {
      onOpenPanel({ section, url, sourceType, lastVerified, fullText, crossReferences });
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium ${config.bg} ${config.text} border ${config.border} rounded hover:opacity-80 transition-opacity cursor-pointer`}
      title={`${config.label}: ${section}${lastVerified ? ` • Verified ${lastVerified}` : ''}`}
    >
      <Icon className="w-3 h-3" />
      <span>{section}</span>
      {url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
    </button>
  );
}

export function ViewSourceBadge({ section, url, sourceType, lastVerified, fullText, crossReferences, onOpenPanel }: SourceCitationProps) {
  const config = SOURCE_CONFIG[sourceType];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenPanel) {
      onOpenPanel({ section, url, sourceType, lastVerified, fullText, crossReferences });
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium ${config.text} hover:underline cursor-pointer`}
      title={`View source: ${section}`}
    >
      <span>[View Source]</span>
    </button>
  );
}
