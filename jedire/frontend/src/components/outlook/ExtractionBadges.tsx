/**
 * Extraction Badges Component
 * Show visual indicators for emails with extracted property/news data
 */

import { Building2, Newspaper, CheckCircle, AlertCircle } from 'lucide-react';

interface ExtractionBadgesProps {
  hasPropertyExtraction: boolean;
  hasNewsExtraction: boolean;
  propertyStatus?: 'auto-created' | 'requires-review' | 'rejected' | 'pending';
  newsStatus?: 'created' | 'pending';
  compact?: boolean;
}

export default function ExtractionBadges({
  hasPropertyExtraction,
  hasNewsExtraction,
  propertyStatus,
  newsStatus,
  compact = false,
}: ExtractionBadgesProps) {
  if (!hasPropertyExtraction && !hasNewsExtraction) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
      {/* Property Badge */}
      {hasPropertyExtraction && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            propertyStatus === 'auto-created'
              ? 'bg-green-100 text-green-700'
              : propertyStatus === 'requires-review'
              ? 'bg-yellow-100 text-yellow-700'
              : propertyStatus === 'rejected'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-blue-100 text-blue-700'
          }`}
          title={
            propertyStatus === 'auto-created'
              ? 'Property auto-created on map'
              : propertyStatus === 'requires-review'
              ? 'Property needs review'
              : 'Property extracted'
          }
        >
          {propertyStatus === 'auto-created' ? (
            <CheckCircle className="w-3 h-3" />
          ) : propertyStatus === 'requires-review' ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <Building2 className="w-3 h-3" />
          )}
          {compact ? '🏢' : 'Property'}
        </span>
      )}

      {/* News Badge */}
      {hasNewsExtraction && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
          title="Market intelligence extracted"
        >
          <Newspaper className="w-3 h-3" />
          {compact ? '📰' : 'News'}
        </span>
      )}
    </div>
  );
}
