/**
 * Market Research Layout - Three-Panel Layout with Sidebar
 */

import React, { ReactNode } from 'react';
import { TrendingUp, Download, Share2, RefreshCw, ChevronRight } from 'lucide-react';

interface MarketResearchLayoutProps {
  children: ReactNode;
  quickStats: {
    label: string;
    value: string;
    change?: string;
    status?: 'good' | 'warning' | 'bad';
  }[];
  onRegenerate?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  relatedLinks?: {
    label: string;
    href: string;
    icon: string;
  }[];
}

export function MarketResearchLayout({
  children,
  quickStats,
  onRegenerate,
  onExport,
  onShare,
  relatedLinks = []
}: MarketResearchLayoutProps) {
  return (
    <div className="flex h-full">
      {/* Left Sidebar - 25% */}
      <div className="w-1/4 bg-gray-50 border-r border-gray-200 p-6 overflow-y-auto">
        {/* Quick Stats */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Quick Stats
          </h3>
          <div className="space-y-3">
            {quickStats.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-600 mb-1">{stat.label}</div>
                <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                {stat.change && (
                  <div className={`text-xs font-medium ${
                    stat.status === 'good' ? 'text-green-600' :
                    stat.status === 'bad' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {stat.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Actions
          </h3>
          <div className="space-y-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}
          </div>
        </div>

        {/* Related Links */}
        {relatedLinks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Related
            </h3>
            <div className="space-y-1">
              {relatedLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Content - 75% */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
