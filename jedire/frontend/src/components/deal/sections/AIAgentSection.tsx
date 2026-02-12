import React from 'react';
import { Deal } from '../../../types/deal';

interface AIAgentSectionProps {
  deal: Deal;
  isPremium?: boolean;
}

export const AIAgentSection: React.FC<AIAgentSectionProps> = ({ deal, isPremium }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🤖</span>
          <div>
            <h4 className="font-semibold text-gray-900">AI Agent (Opus)</h4>
            <p className="text-sm text-gray-600">Claude Opus-powered deal analysis & recommendations</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <div className="text-sm font-medium text-purple-600 mb-1">Deal Score</div>
            <div className="text-2xl font-bold text-purple-900">—</div>
            <div className="text-xs text-gray-500">AI-generated assessment</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="text-sm font-medium text-blue-600 mb-1">Recommendations</div>
            <div className="text-2xl font-bold text-blue-900">—</div>
            <div className="text-xs text-gray-500">Actionable insights</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3">AI Capabilities</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Deal Analysis & Scoring</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Risk Assessment</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Market Narrative Generation</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Strategy Recommendations</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
        </div>
      </div>

      {!isPremium && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <p className="text-sm text-purple-700">Upgrade to Pro for AI-powered deal analysis and recommendations</p>
        </div>
      )}
    </div>
  );
};
