/**
 * Module Libraries Page
 * 
 * Main page showing all three module libraries (Financial, Market, Due Diligence)
 * with upload counts and last activity.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api.client';

interface ModuleLibraryStats {
  module: string;
  fileCount: number;
  lastUpload?: string;
}

interface ModuleCardProps {
  module: string;
  icon: string;
  title: string;
  description: string;
  fileCount: number;
  lastUpload?: string;
  onClick: () => void;
}

function ModuleLibraryCard({ module, icon, title, description, fileCount, lastUpload, onClick }: ModuleCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all text-left"
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl">{icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-4">{description}</p>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-600">{fileCount}</span>
              <span className="text-gray-500">files</span>
            </div>
            
            {lastUpload && (
              <div className="flex items-center gap-2 text-gray-500">
                <span>Last upload:</span>
                <span className="font-medium">{lastUpload}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-gray-400 text-2xl">→</div>
      </div>
    </button>
  );
}

export function ModuleLibrariesPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, ModuleLibraryStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Load stats for each module
      const modules = ['financial', 'market', 'due_diligence'];
      const results = await Promise.all(
        modules.map(async (module) => {
          try {
            const response = await apiClient.get(`/api/v1/module-libraries/${module}/files`);
            const files = response.data.files || [];
            
            // Calculate last upload
            let lastUpload = undefined;
            if (files.length > 0) {
              const mostRecent = files[0]; // Assumes sorted by uploadedAt DESC
              const uploadDate = new Date(mostRecent.uploadedAt);
              const now = new Date();
              const diffDays = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (diffDays === 0) {
                lastUpload = 'Today';
              } else if (diffDays === 1) {
                lastUpload = 'Yesterday';
              } else if (diffDays < 7) {
                lastUpload = `${diffDays} days ago`;
              } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                lastUpload = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
              } else {
                const months = Math.floor(diffDays / 30);
                lastUpload = `${months} month${months > 1 ? 's' : ''} ago`;
              }
            }
            
            return {
              module,
              fileCount: files.length,
              lastUpload,
            };
          } catch (error) {
            console.error(`Failed to load stats for ${module}:`, error);
            return {
              module,
              fileCount: 0,
              lastUpload: undefined,
            };
          }
        })
      );
      
      const statsMap: Record<string, ModuleLibraryStats> = {};
      results.forEach(stat => {
        statsMap[stat.module] = stat;
      });
      
      setStats(statsMap);
    } catch (error) {
      console.error('Failed to load module library stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (module: string) => {
    navigate(`/settings/module-libraries/${module}`);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Module Libraries</h1>
        <p className="text-gray-600">
          Upload historical data for Opus to learn from. Build personal data libraries
          for each module to power AI-driven pro forma generation and analysis.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ModuleLibraryCard
          module="financial"
          icon="💰"
          title="Financial Module"
          description="Upload previous pro formas, operating expenses, debt terms, and historical financial data"
          fileCount={stats.financial?.fileCount || 0}
          lastUpload={stats.financial?.lastUpload}
          onClick={() => handleModuleClick('financial')}
        />
        
        <ModuleLibraryCard
          module="market"
          icon="📊"
          title="Market Module"
          description="Upload market reports, proprietary research, comp data, and custom market analysis"
          fileCount={stats.market?.fileCount || 0}
          lastUpload={stats.market?.lastUpload}
          onClick={() => handleModuleClick('market')}
        />
        
        <ModuleLibraryCard
          module="due_diligence"
          icon="✅"
          title="Due Diligence Module"
          description="Upload checklists, template documents, and previous DD files for standardization"
          fileCount={stats.due_diligence?.fileCount || 0}
          lastUpload={stats.due_diligence?.lastUpload}
          onClick={() => handleModuleClick('due_diligence')}
        />
      </div>
      
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🤖</div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">How Opus Learning Works</h3>
            <p className="text-gray-700 text-sm mb-3">
              When you upload historical data, Opus analyzes patterns, formulas, and assumptions
              to understand your unique investment approach. The more data you provide, the more
              accurate and personalized your AI-generated models become.
            </p>
            <p className="text-gray-600 text-sm">
              <strong>Example:</strong> Upload 10 previous multifamily pro formas → Opus learns
              typical OpEx/unit, rent growth rates, cap rates, hold periods → Applies these
              patterns to new deals automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
