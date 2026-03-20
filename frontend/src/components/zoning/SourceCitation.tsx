import React from 'react';
import { FileText, Map, BarChart3, FolderOpen, ExternalLink, BookOpen } from 'lucide-react';

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

function isMunicodeUrl(url?: string): boolean {
  return !!url && url.includes('library.municode.com');
}

const SOURCE_CONFIG: Record<SourceType, { icon: React.ElementType; emoji: string; label: string; bg: string; text: string; border: string }> = {
  code: { icon: FileText, emoji: '', label: 'Code', bg: 'bg-[#0d1020]', text: 'text-indigo-400', border: 'border-indigo-800/50' },
  gis: { icon: Map, emoji: '', label: 'GIS', bg: 'bg-[#022c22]', text: 'text-emerald-400', border: 'border-emerald-800/50' },
  calculated: { icon: BarChart3, emoji: '', label: 'Calculated', bg: 'bg-[#1a1200]', text: 'text-amber-400', border: 'border-amber-800/50' },
  record: { icon: FolderOpen, emoji: '', label: 'Record', bg: 'bg-[#0d1e3d]', text: 'text-blue-400', border: 'border-blue-900/50' },
};

export default function SourceCitation({ section, url, sourceType, lastVerified, fullText, crossReferences, onOpenPanel }: SourceCitationProps) {
  const isMunicode = isMunicodeUrl(url);
  const config = SOURCE_CONFIG[sourceType];
  const Icon = isMunicode ? BookOpen : config.icon;
  const bgClass = isMunicode ? 'bg-[#1a0d3d]' : config.bg;
  const textClass = isMunicode ? 'text-violet-400' : config.text;
  const borderClass = isMunicode ? 'border-violet-800/50' : config.border;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenPanel) {
      onOpenPanel({ section, url, sourceType, lastVerified, fullText, crossReferences });
    } else if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium ${bgClass} ${textClass} border ${borderClass} rounded hover:opacity-80 transition-opacity cursor-pointer`}
      title={`${isMunicode ? 'Municode' : config.label}: ${section}${lastVerified ? ` | Verified ${lastVerified}` : ''}`}
    >
      <Icon className="w-3 h-3" />
      <span>{section}</span>
      {url && url !== '#' && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
    </button>
  );
}

export function ViewSourceBadge({ section, url, sourceType, lastVerified, fullText, crossReferences, onOpenPanel }: SourceCitationProps) {
  const isMunicode = isMunicodeUrl(url);
  const config = SOURCE_CONFIG[sourceType];
  const textClass = isMunicode ? 'text-violet-400' : config.text;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenPanel) {
      onOpenPanel({ section, url, sourceType, lastVerified, fullText, crossReferences });
    } else if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium ${textClass} hover:underline cursor-pointer`}
      title={`View source: ${section}`}
    >
      {isMunicode && <BookOpen className="w-2.5 h-2.5" />}
      <span>{isMunicode ? '[View on Municode]' : '[View Source]'}</span>
    </button>
  );
}

export function MunicodeLink({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-violet-400 bg-[#1a0d3d] border border-violet-800/50 rounded-md hover:bg-[#241355] transition-colors"
    >
      <BookOpen className="w-3 h-3" />
      <span>{label || 'View on Municode'}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </a>
  );
}
