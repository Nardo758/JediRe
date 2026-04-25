/**
 * Context Indicator
 * 
 * Shows at the top of data views to indicate:
 * - How many data gaps exist
 * - What questions the system couldn't answer
 * - Suggestions for deeper analysis
 * - Agent tasks running in background
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle,
  Lightbulb,
  Bot,
  RefreshCw
} from 'lucide-react';
import type { ContextAnalysis, DataGap, Suggestion } from '../../hooks/useContextAwareness';

interface ContextIndicatorProps {
  analysis: ContextAnalysis | null;
  loading?: boolean;
  onTriggerResearch?: (gaps: DataGap[]) => void;
  onSuggestionClick?: (suggestion: Suggestion) => void;
  onRefresh?: () => void;
  compact?: boolean;
}

export const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  analysis,
  loading,
  onTriggerResearch,
  onSuggestionClick,
  onRefresh,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Analyzing context...</span>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const { summary, gaps, immediateQuestions, suggestions, agentTasks } = analysis;
  const criticalGaps = gaps.filter(g => g.relevance === 'critical');
  const unanswered = immediateQuestions.filter(q => !q.available);

  // Determine status
  const status: 'good' | 'warning' | 'critical' = 
    criticalGaps.length > 0 ? 'critical' :
    summary.unansweredQuestions > 2 ? 'warning' : 'good';

  const statusColors = {
    good: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    critical: 'bg-red-50 border-red-200 text-red-700'
  };

  const statusIcons = {
    good: <CheckCircle className="w-4 h-4 text-green-600" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    critical: <AlertTriangle className="w-4 h-4 text-red-600" />
  };

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer ${statusColors[status]}`}
        onClick={() => setExpanded(!expanded)}
      >
        {statusIcons[status]}
        <span className="text-sm font-medium">
          {status === 'good' ? 'Data Complete' :
           status === 'warning' ? `${summary.unansweredQuestions} Questions` :
           `${criticalGaps.length} Gaps`}
        </span>
        {status !== 'good' && (
          expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${statusColors[status]}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {statusIcons[status]}
          <div>
            <p className="font-medium">
              {status === 'good' && 'Analysis Ready'}
              {status === 'warning' && `${summary.unansweredQuestions} Unanswered Questions`}
              {status === 'critical' && `${criticalGaps.length} Critical Data Gaps`}
            </p>
            {status !== 'good' && (
              <p className="text-sm opacity-75">
                {criticalGaps[0]?.userQuestion || unanswered[0]?.question}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
              title="Refresh analysis"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          
          {status !== 'good' && onTriggerResearch && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTriggerResearch(criticalGaps.length > 0 ? criticalGaps : gaps);
              }}
              className="px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Bot className="w-4 h-4" />
              Research
            </button>
          )}
          
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Unanswered questions */}
          {unanswered.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4" />
                Questions We Couldn't Answer
              </h4>
              <div className="space-y-1">
                {unanswered.slice(0, 5).map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400">•</span>
                    <span>{q.question}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4" />
                Suggestions
              </h4>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => onSuggestionClick?.(s)}
                    className="px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg text-sm transition-colors"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agent tasks */}
          {agentTasks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4" />
                Background Research
              </h4>
              <div className="space-y-1">
                {agentTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {t.priority === 'immediate' && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span className="capitalize">{t.agentType}</span>
                    <span className="text-gray-400">→</span>
                    <span>{t.task}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      t.priority === 'immediate' ? 'bg-blue-100 text-blue-700' :
                      t.priority === 'background' ? 'bg-gray-100 text-gray-600' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextIndicator;
