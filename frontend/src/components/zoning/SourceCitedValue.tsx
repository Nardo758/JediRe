import React from 'react';
import { ExternalLink, BookOpen } from 'lucide-react';
import type { SourceType } from './SourceCitation';

export interface SourceCitedValueProps {
  label: string;
  value: string | number | null;
  unit?: string;
  sectionNumber?: string;
  sectionTitle?: string;
  sourceUrl?: string;
  sourceType?: SourceType;
  calculation?: string;
  insight?: string;
}

function isMunicodeUrl(url?: string): boolean {
  return !!url && url.includes('library.municode.com');
}

export default function SourceCitedValue({
  label,
  value,
  unit,
  sectionNumber,
  sectionTitle,
  sourceUrl,
  sourceType,
  calculation,
  insight,
}: SourceCitedValueProps) {
  const hasSource = !!sectionNumber;
  const isMunicode = isMunicodeUrl(sourceUrl);
  const displayValue = value !== null && value !== undefined ? value : '—';

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceUrl && sourceUrl !== '#') {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-xs text-gray-500">{label}</span>
        {hasSource && (
          <button
            onClick={handleSourceClick}
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
              isMunicode ? 'text-violet-600 hover:text-violet-800' : 'text-indigo-600 hover:text-indigo-800'
            } hover:underline cursor-pointer transition-colors`}
            title={sectionTitle ? `${sectionNumber} — ${sectionTitle}` : sectionNumber}
          >
            {isMunicode && <BookOpen className="w-2.5 h-2.5" />}
            <span>§{sectionNumber}</span>
            {sourceUrl && sourceUrl !== '#' && <ExternalLink className="w-2 h-2 opacity-60" />}
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold text-gray-900">
          {displayValue}
        </span>
        {unit && (
          <span className="text-xs text-gray-400">{unit}</span>
        )}
      </div>

      {calculation && (
        <span className="text-[10px] text-gray-400 italic leading-tight">
          {calculation}
        </span>
      )}

      {insight && (
        <span className="text-[10px] text-blue-600 leading-tight">
          {insight}
        </span>
      )}
    </div>
  );
}
