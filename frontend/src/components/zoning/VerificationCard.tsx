import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, ExternalLink, Shield, Clock, Layers, FileWarning, Scale, ChevronDown, ChevronUp } from 'lucide-react';

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
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    badgeBg: 'bg-green-100',
  },
  stale: {
    icon: AlertTriangle,
    emoji: '⚠️',
    label: 'Stale',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    badgeBg: 'bg-yellow-100',
  },
  split: {
    icon: AlertTriangle,
    emoji: '⚠️',
    label: 'Split Zoning',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    badgeBg: 'bg-orange-100',
  },
  conflict: {
    icon: XCircle,
    emoji: '❌',
    label: 'Conflict',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badgeBg: 'bg-red-100',
  },
  pending: {
    icon: AlertTriangle,
    emoji: '🔍',
    label: 'Pending Verification',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100',
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
            <span className="text-xs text-gray-600">Confidence:</span>
            <span className={`text-xs font-semibold ${data.confidence >= 80 ? 'text-green-600' : data.confidence >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.confidence}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data.verifiedAt && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Clock className="w-3 h-3" />
              Verified {data.verifiedAt}
            </span>
          )}
          {data.sourceUrl && (
            <button
              onClick={() => onViewSource ? onViewSource(data.sourceUrl!) : window.open(data.sourceUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {data.sourceName || 'View Source'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-500">GIS Designation: </span>
            <span className="font-semibold text-gray-900">{data.gisDesignation}</span>
          </div>
          {data.verifiedDesignation && (
            <div>
              <span className="text-gray-500">Verified: </span>
              <span className={`font-semibold ${hasDiscrepancy ? 'text-red-700' : 'text-gray-900'}`}>
                {data.verifiedDesignation}
              </span>
            </div>
          )}
        </div>
      </div>

      {hasDiscrepancy && (
        <div className="mx-4 mb-3 bg-red-100 border border-red-300 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-800">Zoning Discrepancy Detected</p>
              <p className="text-xs text-red-700 mt-1">
                GIS shows <span className="font-semibold">{data.gisDesignation}</span> but authoritative source shows <span className="font-semibold">{data.verifiedDesignation}</span>
              </p>
              {data.discrepancyDetail && (
                <p className="text-xs text-red-600 mt-1">{data.discrepancyDetail}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {hasAlerts && (
        <div className="border-t border-gray-200/50">
          <button
            onClick={() => setExpandedAlerts(!expandedAlerts)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-600 hover:bg-white/30 transition-colors"
          >
            <span className="font-medium">
              Sub-alerts ({(data.overlaysDetected?.length || 0) + (data.recentAmendments?.length || 0) + (data.conditionalApprovals?.length || 0)})
            </span>
            {expandedAlerts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expandedAlerts && (
            <div className="px-4 pb-3 space-y-2">
              {data.overlaysDetected && data.overlaysDetected.length > 0 && (
                <div className="bg-white/60 border border-gray-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Overlay Districts</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.overlaysDetected.map((overlay, i) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-medium">
                        {overlay}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.recentAmendments && data.recentAmendments.length > 0 && (
                <div className="bg-white/60 border border-gray-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileWarning className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Recent Amendments</span>
                  </div>
                  <div className="space-y-1">
                    {data.recentAmendments.map((amendment, i) => (
                      <div key={i} className="text-xs text-gray-700">
                        <span className="font-medium">{amendment.title}</span>
                        <span className="text-gray-400 ml-1">({amendment.date})</span>
                        {amendment.description && <p className="text-gray-500 mt-0.5">{amendment.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.conditionalApprovals && data.conditionalApprovals.length > 0 && (
                <div className="bg-white/60 border border-gray-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Scale className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Conditional Approvals</span>
                  </div>
                  <div className="space-y-1">
                    {data.conditionalApprovals.map((approval, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${approval.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {approval.status}
                        </span>
                        <span className="text-gray-700">{approval.type}</span>
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
