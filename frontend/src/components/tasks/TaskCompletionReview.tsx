/**
 * Task Completion Review Component
 * Shows AI-detected task completions from emails for user review
 */

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface CompletionSignal {
  taskId: string;
  taskName: string;
  emailId: string;
  emailSubject: string;
  completionDate: string;
  confidence: number;
  matchedKeywords: string[];
  matchedBy: string;
  sender: string;
  reasoning: string;
}

interface TaskCompletionReviewProps {
  onComplete: (taskId: string, emailId: string, completionDate: string) => void;
  onReject: (taskId: string, emailId: string) => void;
  onRefresh: () => void;
}

export const TaskCompletionReview: React.FC<TaskCompletionReviewProps> = ({
  onComplete,
  onReject,
  onRefresh,
}) => {
  const [signals, setSignals] = useState<CompletionSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadSignals();
  }, []);

  const loadSignals = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/tasks/scan-completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 7, minConfidence: 40 }),
      });
      const result = await response.json();
      if (result.success) {
        setSignals(result.data.signals || []);
      }
    } catch (error) {
      console.error('Error loading completion signals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (signal: CompletionSignal) => {
    try {
      const response = await fetch(`/api/v1/tasks/${signal.taskId}/complete-from-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: signal.emailId,
          completionDate: signal.completionDate,
        }),
      });

      if (response.ok) {
        onComplete(signal.taskId, signal.emailId, signal.completionDate);
        // Remove from list
        setSignals(prev => prev.filter(s => s.taskId !== signal.taskId));
      }
    } catch (error) {
      console.error('Error approving completion:', error);
    }
  };

  const handleReject = async (signal: CompletionSignal) => {
    try {
      await fetch(`/api/v1/tasks/${signal.taskId}/reject-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: signal.emailId }),
      });

      onReject(signal.taskId, signal.emailId);
      // Remove from list
      setSignals(prev => prev.filter(s => s.taskId !== signal.taskId));
    } catch (error) {
      console.error('Error rejecting completion:', error);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    await loadSignals();
    setScanning(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return '🟢';
    if (confidence >= 60) return '🟡';
    return '🟠';
  };

  if (signals.length === 0 && !loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-blue-900 mb-1">
              Email Intelligence: No completion signals detected
            </div>
            <div className="text-sm text-blue-700 mb-3">
              AI scans your emails automatically for task completions. When detected, they'll appear here for review.
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {scanning ? 'Scanning...' : '🔍 Scan Recent Emails'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-300 rounded-lg mb-6">
      {/* Header */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-semibold text-blue-900">
                🤖 AI-Detected Task Completions
              </div>
              <div className="text-sm text-blue-700">
                {signals.length} completion{signals.length !== 1 ? 's' : ''} detected from recent emails
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {scanning ? '⏳ Scanning...' : '🔄 Rescan'}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 text-sm text-blue-700 hover:text-blue-900"
            >
              {expanded ? '▼' : '▶'}
            </button>
          </div>
        </div>
      </div>

      {/* Signals List */}
      {expanded && (
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              <div>Scanning emails...</div>
            </div>
          ) : (
            signals.map((signal) => (
              <div key={`${signal.taskId}-${signal.emailId}`} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  {/* Confidence Badge */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${getConfidenceColor(
                        signal.confidence
                      )}`}
                    >
                      {getConfidenceIcon(signal.confidence)} {signal.confidence}%
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Task Name */}
                    <div className="font-semibold text-gray-900 mb-1">
                      {signal.taskName}
                    </div>

                    {/* Email Info */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Mail className="w-4 h-4" />
                      <span className="font-medium">{signal.sender}</span>
                      <span>•</span>
                      <span className="truncate">{signal.emailSubject}</span>
                      <span>•</span>
                      <span>{new Date(signal.completionDate).toLocaleDateString()}</span>
                    </div>

                    {/* Reasoning */}
                    <div className="text-sm text-gray-600 mb-2">
                      {signal.reasoning}
                    </div>

                    {/* Keywords */}
                    <div className="flex flex-wrap gap-1.5">
                      {signal.matchedKeywords.slice(0, 5).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {keyword}
                        </span>
                      ))}
                      {signal.matchedKeywords.length > 5 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                          +{signal.matchedKeywords.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => handleApprove(signal)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
                      title="Mark task as complete"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(signal)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
                      title="Reject this suggestion"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
