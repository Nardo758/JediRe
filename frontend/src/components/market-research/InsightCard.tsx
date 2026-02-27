/**
 * Insight Card - Key takeaways and recommendations
 */

import React from 'react';
import { Lightbulb, Target } from 'lucide-react';

interface InsightCardProps {
  title: string;
  insights: string[];
  recommendation?: string;
  type?: 'insight' | 'recommendation';
}

export function InsightCard({ 
  title, 
  insights, 
  recommendation,
  type = 'insight'
}: InsightCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start gap-3 mb-4">
        {type === 'insight' ? (
          <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        ) : (
          <Target className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        )}
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </div>

      <ul className="space-y-2 mb-4">
        {insights.map((insight, idx) => (
          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="text-blue-600 flex-shrink-0">•</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>

      {recommendation && (
        <div className="pt-4 border-t border-blue-200">
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">
                Recommendation
              </div>
              <p className="text-sm text-gray-700">{recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
