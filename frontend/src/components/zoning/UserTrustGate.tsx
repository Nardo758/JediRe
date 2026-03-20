import React, { useState } from 'react';
import { CheckCircle, Flag, Edit3, Loader2, X, Send } from 'lucide-react';

export type TrustGateAction = 'confirmed' | 'flagged' | 'corrected';

interface UserTrustGateProps {
  verificationId: string;
  isConfirmed: boolean;
  onConfirm: (verificationId: string) => Promise<void>;
  onFlag: (verificationId: string) => Promise<void>;
  onCorrect: (verificationId: string, correctionDetail: string, newDesignation?: string) => Promise<void>;
}

export default function UserTrustGate({ verificationId, isConfirmed, onConfirm, onFlag, onCorrect }: UserTrustGateProps) {
  const [loading, setLoading] = useState<TrustGateAction | null>(null);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [showFlagConfirm, setShowFlagConfirm] = useState(false);
  const [correctionDetail, setCorrectionDetail] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [actionComplete, setActionComplete] = useState<TrustGateAction | null>(null);

  if (isConfirmed || actionComplete === 'confirmed') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-[#022c22] border border-green-800/50 rounded-lg">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-green-400">Verification confirmed — analysis sections unlocked</span>
      </div>
    );
  }

  if (actionComplete === 'flagged') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1200] border border-yellow-200 rounded-lg">
        <Flag className="w-4 h-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-700">Flagged for review — an analyst will investigate</span>
      </div>
    );
  }

  if (actionComplete === 'corrected') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1e3d] border border-blue-900/50 rounded-lg">
        <Edit3 className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-400">Correction submitted — verification updated</span>
      </div>
    );
  }

  const handleConfirm = async () => {
    setLoading('confirmed');
    try {
      await onConfirm(verificationId);
      setActionComplete('confirmed');
    } catch {
      setLoading(null);
    }
  };

  const handleFlag = async () => {
    setLoading('flagged');
    try {
      await onFlag(verificationId);
      setActionComplete('flagged');
    } catch {
      setLoading(null);
    }
  };

  const handleCorrect = async () => {
    if (!correctionDetail.trim()) return;
    setLoading('corrected');
    try {
      await onCorrect(verificationId, correctionDetail, newDesignation || undefined);
      setActionComplete('corrected');
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-[#0F1319] border-b border-[#1e2a3d]">
        <p className="text-xs font-semibold text-[#9EA8B4] uppercase tracking-wider">Trust Gate — Confirm Before Proceeding</p>
        <p className="text-xs text-[#6B7585] mt-0.5">Review the verification above, then choose an action to unlock the full analysis.</p>
      </div>

      <div className="p-4">
        {!showCorrectionForm && !showFlagConfirm && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading !== null}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading === 'confirmed' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Confirm & Continue
            </button>

            <button
              onClick={() => setShowFlagConfirm(true)}
              disabled={loading !== null}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1200] hover:bg-yellow-100 disabled:bg-[#131920] text-yellow-700 border border-yellow-300 rounded-lg text-sm font-medium transition-colors"
            >
              <Flag className="w-4 h-4" />
              Flag for Review
            </button>

            <button
              onClick={() => setShowCorrectionForm(true)}
              disabled={loading !== null}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0d1e3d] hover:bg-[#1a2a4d] disabled:bg-[#131920] text-blue-400 border border-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              I Know More
            </button>
          </div>
        )}

        {showFlagConfirm && (
          <div className="space-y-3">
            <div className="bg-[#1a1200] border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800 font-medium">Flag this verification for investigation?</p>
              <p className="text-xs text-yellow-600 mt-1">An analyst will review the zoning data and source discrepancies.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFlag}
                disabled={loading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading === 'flagged' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                Yes, Flag It
              </button>
              <button
                onClick={() => setShowFlagConfirm(false)}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[#9EA8B4] hover:text-[#E8E6E1] text-sm transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {showCorrectionForm && (
          <div className="space-y-3">
            <div className="bg-[#0d1e3d] border border-blue-900/50 rounded-lg p-3">
              <p className="text-sm text-blue-300 font-medium">Submit a Correction</p>
              <p className="text-xs text-blue-600 mt-1">Provide the correct zoning information and we'll update the verification.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9EA8B4] mb-1">Correct Designation (optional)</label>
              <input
                type="text"
                value={newDesignation}
                onChange={(e) => setNewDesignation(e.target.value)}
                placeholder="e.g., MR-4A"
                className="w-full px-3 py-2 border border-[#253347] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9EA8B4] mb-1">Correction Details <span className="text-red-500">*</span></label>
              <textarea
                value={correctionDetail}
                onChange={(e) => setCorrectionDetail(e.target.value)}
                placeholder="Explain what is incorrect and provide the correct information..."
                rows={3}
                className="w-full px-3 py-2 border border-[#253347] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCorrect}
                disabled={loading !== null || !correctionDetail.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading === 'corrected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Correction
              </button>
              <button
                onClick={() => { setShowCorrectionForm(false); setCorrectionDetail(''); setNewDesignation(''); }}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[#9EA8B4] hover:text-[#E8E6E1] text-sm transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
