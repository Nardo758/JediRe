/**
 * Storage Stats Component
 * Visual display of storage analytics with charts and metrics
 */

import React from 'react';
import { StorageAnalytics } from '../DocumentsFilesSection';
import { formatFileSize } from './utils';

interface StorageStatsProps {
  analytics: StorageAnalytics;
  isPipeline: boolean;
}

export const StorageStats: React.FC<StorageStatsProps> = ({ analytics, isPipeline }) => {
  const maxStorage = 5 * 1024 * 1024 * 1024; // 5 GB
  const usagePercent = (analytics.total_size_bytes / maxStorage) * 100;

  return (
    <div className="storage-stats">
      <div className="stat-card primary">
        <div className="stat-icon">📊</div>
        <div className="stat-content">
          <span className="stat-label">Total Files</span>
          <span className="stat-value">{analytics.total_files}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">💾</div>
        <div className="stat-content">
          <span className="stat-label">Storage Used</span>
          <span className="stat-value">{formatFileSize(analytics.total_size_bytes)}</span>
          <div className="storage-bar">
            <div className="storage-fill" style={{ width: `${usagePercent}%` }} />
          </div>
          <span className="storage-limit">of {formatFileSize(maxStorage)}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🔄</div>
        <div className="stat-content">
          <span className="stat-label">Versions</span>
          <span className="stat-value">{analytics.files_with_versions}</span>
          <span className="stat-sublabel">files with versions</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">⚠️</div>
        <div className="stat-content">
          <span className="stat-label">Required Files</span>
          <span className="stat-value">{analytics.required_files_count}</span>
          <span className="stat-sublabel">for closing</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <span className="stat-label">Recent Activity</span>
          <span className="stat-value">{analytics.files_uploaded_last_7d}</span>
          <span className="stat-sublabel">uploaded this week</span>
        </div>
      </div>

      <style jsx>{`
        .storage-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin: 20px 0;
        }

        .stat-card {
          display: flex;
          gap: 16px;
          padding: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .stat-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .stat-card.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }

        .stat-icon {
          font-size: 32px;
          opacity: 0.9;
        }

        .stat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }

        .stat-card.primary .stat-label {
          color: rgba(255, 255, 255, 0.9);
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1;
        }

        .stat-card.primary .stat-value {
          color: white;
        }

        .stat-sublabel {
          font-size: 12px;
          color: #9ca3af;
        }

        .stat-card.primary .stat-sublabel {
          color: rgba(255, 255, 255, 0.8);
        }

        .storage-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
          margin-top: 8px;
        }

        .storage-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.5s;
        }

        .storage-limit {
          font-size: 11px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
};
