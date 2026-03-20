import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, ExternalLink, Shield, Clock, Layers, FileWarning, Scale, ChevronDown, ChevronUp, BookOpen, MapPin, Search } from 'lucide-react';

export type VerificationStatus = 'confirmed' | 'stale' | 'split' | 'conflict' | 'pending';

export interface VerificationData {
  id: string;
  parcelId?: string;
  gisDesignation: string;
  verifiedDesignation?: string;
  status: VerificationStatus;
  discrepancyDetail?: string;
  overlaysDetected?: string[];
  recentAmendments?: { title: string; date: string; description?: string }[];
  conditionalApprovals?: { type: string; status: string; detail?: string }[];
  sourceCitations?: { section: string; url?: string; sourceType: string }[];
  confidence: number;
  sourceUrl?: string;
  sourceName?: string;
  municodeUrl?: string;
  webSearchUrl?: string;
  verifiedAt?: string;
  userAction?: 'confirmed' | 'flagged' | 'corrected';
}

interface VerificationCardProps {
  data: VerificationData;
  onViewSource?: (url: string) => void;
}

const STATUS_CONFIG: Record<VerificationStatus, {
  icon: React.ElementType;
  emoji: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
}> = {
  confirmed: {
    icon: CheckCircle,
    emoji: '✅',
    label: 'Confirmed',
    bg: 'bg-[#022c22]',
    text: 'text-green-400',
    border: 'border-green-800/50',
    badgeBg: 'bg-[#022c22]',
  },
  stale: {
    icon: AlertTriangle,
    emoji: '⚠️',
    label: 'Stale',
    bg: 'bg-[#1a1200]',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    badgeBg: 'bg-yellow-100',
  },
  split: {
    icon: AlertTriangle,
    emoji: '⚠️',
    label: 'Split Zoning',
    bg: 'bg-[#1a0d00]',
    text: 'text-orange-700',
    border: 'border-orange-200',
    badgeBg: 'bg-[#1a0d00]',
  },
  conflict: {
    icon: XCircle,
    emoji: '❌',
    label: 'Conflict',
    bg: 'bg-[#1c0a0a]',
    text: 'text-red-400',
    border: 'border-red-800/50',
    badgeBg: 'bg-[#1c0a0a]',
  },
  pending: {
    icon: AlertTriangle,
    emoji: '🔍',
    label: 'Pending Verification',
    bg: 'bg-[#0d1e3d]',
    text: 'text-blue-400',
    border: 'border-blue-900/50',
    badgeBg: 'bg-[#0d1e3d]',
  },
};

export default function VerificationCard({ data, onViewSource }: VerificationCardProps) {
  const [expandedAlerts, setExpandedAlerts] = React.useState(false);
  const config = STATUS_CONFIG[data.status];
  const StatusIcon = config.icon;

  const hasAlerts = (data.overlaysDetected && data.overlaysDetected.length > 0) ||
    (data.recentAmendments && data.recentAmendments.length > 0) ||
    (data.conditionalApprovals && data.conditionalApprovals.length > 0);

  const hasDiscrepancy = data.status === 'conflict' && data.gisDesignation !== data.verifiedDesignation;

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 ${config.badgeBg} ${config.text} rounded-full text-xs font-semibold`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {config.emoji} {config.label}
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-[#9EA8B4]">Confidence:</span>
            <span className={`text-xs font-semibold ${data.confidence >= 80 ? 'text-green-600' : data.confidence >= 50 ? 'text-yellow-600' : 'text-red-400'}`}>
              {data.confidence}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data.verifiedAt && (
            <span className="flex items-center gap-1 text-[10px] text-[#6B7585]">
              <Clock className="w-3 h-3" />
              Verified {data.verifiedAt}
            </span>
          )}
          {data.sourceUrl && !data.sourceUrl.includes('/rest/services/') && !data.sourceUrl.includes('/MapServer/') && (
            <button
              onClick={() => onViewSource ? onViewSource(data.sourceUrl!) : window.open(data.sourceUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-400 bg-[#0F1319] border border-emerald-800/50 rounded hover:bg-[#022c22] transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {data.sourceName || 'Planning & Zoning'}
            </button>
          )}
          {data.municodeUrl && (
            <button
              onClick={() => window.open(data.municodeUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-400 bg-[#0F1319] border border-violet-800/50 rounded hover:bg-[#1a0d3d] transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              View on Municode
            </button>
          )}
          {!data.municodeUrl && data.webSearchUrl && (
            <button
              onClick={() => window.open(data.webSearchUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#9EA8B4] bg-[#0F1319] border border-[#1e2a3d] rounded hover:bg-[#0F1319] transition-colors"
            >
              <Search className="w-3 h-3" />
              Search Zoning Code
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[#6B7585]">GIS Designation: </span>
            <span className="font-semibold text-[#E8E6E1]">{data.gisDesignation}</span>
          </div>
          {data.verifiedDesignation && (
            <div>
              <span className="text-[#6B7585]">Verified: </span>
              <span className={`font-semibold ${hasDiscrepancy ? 'text-red-400' : 'text-[#E8E6E1]'}`}>
                {data.verifiedDesignation}
              </span>
            </div>
          )}
        </div>
      </div>

      {hasDiscrepancy && (
        <div className="mx-4 mb-3 bg-[#1c0a0a] border border-red-700 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-300">Zoning Discrepancy Detected</p>
              <p className="text-xs text-red-400 mt-1">
                GIS shows <span className="font-semibold">{data.gisDesignation}</span> but authoritative source shows <span className="font-semibold">{data.verifiedDesignation}</span>
              </p>
              {data.discrepancyDetail && (
                <p className="text-xs text-red-400 mt-1">{data.discrepancyDetail}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {hasAlerts && (
        <div className="border-t border-[#1e2a3d]/50">
          <button
            onClick={() => setExpandedAlerts(!expandedAlerts)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-[#9EA8B4] hover:bg-[#0F1319]/30 transition-colors"
          >
            <span className="font-medium">
              Sub-alerts ({(data.overlaysDetected?.length || 0) + (data.recentAmendments?.length || 0) + (data.conditionalApprovals?.length || 0)})
            </span>
            {expandedAlerts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expandedAlerts && (
            <div className="px-4 pb-3 space-y-2">
              {data.overlaysDetected && data.overlaysDetected.length > 0 && (
                <div className="bg-[#0F1319]/60 border border-[#1e2a3d] rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[10px] font-semibold text-[#9EA8B4] uppercase tracking-wider">Overlay Districts</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.overlaysDetected.map((overlay, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#1a0d3d] text-purple-400 border border-purple-800/50 rounded text-[10px] font-medium">
                        {overlay}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.recentAmendments && data.recentAmendments.length > 0 && (
                <div className="bg-[#0F1319]/60 border border-[#1e2a3d] rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileWarning className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-semibold text-[#9EA8B4] uppercase tracking-wider">Recent Amendments</span>
                  </div>
                  <div className="space-y-1">
                    {data.recentAmendments.map((amendment, i) => (
                      <div key={i} className="text-xs text-[#9EA8B4]">
                        <span className="font-medium">{amendment.title}</span>
                        <span className="text-gray-400 ml-1">({amendment.date})</span>
                        {amendment.description && <p className="text-[#6B7585] mt-0.5">{amendment.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.conditionalApprovals && data.conditionalApprovals.length > 0 && (
                <div className="bg-[#0F1319]/60 border border-[#1e2a3d] rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Scale className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-semibold text-[#9EA8B4] uppercase tracking-wider">Conditional Approvals</span>
                  </div>
                  <div className="space-y-1">
                    {data.conditionalApprovals.map((approval, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${approval.status === 'active' ? 'bg-[#022c22] text-green-400' : 'bg-[#131920] text-[#9EA8B4]'}`}>
                          {approval.status}
                        </span>
                        <span className="text-[#9EA8B4]">{approval.type}</span>
                        {approval.detail && <span className="text-gray-400">— {approval.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
