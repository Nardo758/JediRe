/**
 * Intelligence Layer Dashboard - Admin View
 * Monitor document intelligence, agent learning, and semantic search
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain, FileText, TrendingUp, AlertCircle, 
  CheckCircle, Clock, Database, Zap, ArrowLeft,
  Activity, Target, Network
} from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface IntelligenceStats {
  documents: {
    total: number;
    withEmbeddings: number;
    validated: number;
    flagged: number;
    pendingValidation: number;
    pctEmbedded: number;
  };
  sourceBreakdown: Array<{
    source: string;
    count: number;
    withEmbeddings: number;
    pctEmbedded: number;
  }>;
  typeBreakdown: Array<{
    type: string;
    count: number;
    withEmbeddings: number;
  }>;
  agentLearning: {
    totalTasks: number;
    approved: number;
    corrected: number;
    rejected: number;
    avgExecutionTime: number;
    avgConfidence: number;
    approvalRate: number;
  };
  agentBreakdown: Array<{
    agentType: string;
    taskCount: number;
    approved: number;
    avgConfidence: number;
    approvalRate: number;
  }>;
  patterns: {
    total: number;
    active: number;
    avgConfidence: number;
    avgSampleSize: number;
  };
  qualityIssues: {
    total: number;
    highSeverity: number;
    mediumSeverity: number;
  };
  relationships: Array<{
    type: string;
    count: number;
  }>;
}

export function IntelligenceDashboard() {
  const [stats, setStats] = useState<IntelligenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/intelligence/stats');
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load intelligence statistics');
      console.error('Error loading intelligence stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Error</span>
          </div>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={loadStats}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const pendingEmbeddings = stats.documents.total - stats.documents.withEmbeddings;
  const estimatedCost = (pendingEmbeddings * 0.00002).toFixed(4);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin" className="p-1.5 rounded-md hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </Link>
              <Brain className="w-5 h-5 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-900">Intelligence Layer</h1>
            </div>
            <button
              onClick={loadStats}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText className="w-5 h-5" />}
            label="Total Documents"
            value={stats.documents.total.toLocaleString()}
            sublabel={`${stats.documents.pctEmbedded}% embedded`}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Validated"
            value={stats.documents.validated.toLocaleString()}
            sublabel={`${Math.round((stats.documents.validated / stats.documents.total) * 100)}% of total`}
            color="green"
          />
          <StatCard
            icon={<Brain className="w-5 h-5" />}
            label="Agent Tasks (30d)"
            value={stats.agentLearning.totalTasks.toLocaleString()}
            sublabel={`${stats.agentLearning.approvalRate}% approval`}
            color="purple"
          />
          <StatCard
            icon={<Network className="w-5 h-5" />}
            label="Patterns Discovered"
            value={stats.patterns.active.toLocaleString()}
            sublabel={`${Math.round(stats.patterns.avgConfidence * 100)}% avg confidence`}
            color="indigo"
          />
        </div>

        {/* Embedding Status */}
        {pendingEmbeddings > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900">Embeddings Pending</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {pendingEmbeddings.toLocaleString()} documents need embedding generation
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Estimated cost: ${estimatedCost} • Run: <code className="bg-amber-100 px-1 rounded">npm run embeddings</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quality Issues */}
        {stats.qualityIssues.total > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Data Quality Alerts</h3>
                <p className="text-sm text-red-700 mt-1">
                  {stats.qualityIssues.total} documents flagged for review
                  ({stats.qualityIssues.highSeverity} high severity, {stats.qualityIssues.mediumSeverity} medium)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Sources */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Document Sources</h2>
            </div>
            <div className="space-y-3">
              {stats.sourceBreakdown.map((source) => (
                <div key={source.source} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {source.source.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-600">
                        {source.count.toLocaleString()} docs
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${source.pctEmbedded}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {source.withEmbeddings.toLocaleString()} embedded
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {source.pctEmbedded}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Learning Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Agent Performance (30d)</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.agentLearning.approved}
                  </div>
                  <div className="text-xs text-gray-600">Approved</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {stats.agentLearning.corrected}
                  </div>
                  <div className="text-xs text-gray-600">Corrected</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {stats.agentLearning.rejected}
                  </div>
                  <div className="text-xs text-gray-600">Rejected</div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg Execution Time</span>
                  <span className="font-medium text-gray-900">
                    {Math.round(stats.agentLearning.avgExecutionTime)}ms
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg Confidence</span>
                  <span className="font-medium text-gray-900">
                    {Math.round(stats.agentLearning.avgConfidence * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Approval Rate</span>
                  <span className="font-medium text-green-600">
                    {stats.agentLearning.approvalRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Agent Breakdown</h2>
            </div>
            <div className="space-y-3">
              {stats.agentBreakdown.map((agent) => (
                <div key={agent.agentType} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {agent.agentType.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-600">{agent.taskCount} tasks</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-600">Approval: </span>
                      <span className="font-medium text-green-600">{agent.approvalRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Confidence: </span>
                      <span className="font-medium text-gray-900">
                        {Math.round(agent.avgConfidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {stats.agentBreakdown.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No agent tasks in the last 30 days
                </div>
              )}
            </div>
          </div>

          {/* Document Types */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Document Types</h2>
            </div>
            <div className="space-y-2">
              {stats.typeBreakdown.slice(0, 8).map((type) => (
                <div key={type.type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 capitalize">
                    {type.type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{type.count}</span>
                    <span className="text-xs text-gray-500">
                      ({Math.round((type.withEmbeddings / type.count) * 100)}% embedded)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document Relationships */}
        {stats.relationships.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Network className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Document Relationships</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.relationships.map((rel) => (
                <div key={rel.type} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{rel.count}</div>
                  <div className="text-xs text-gray-600 capitalize mt-1">
                    {rel.type.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  color: 'blue' | 'green' | 'purple' | 'indigo';
}

function StatCard({ icon, label, value, sublabel, color }: StatCardProps) {
  const colors = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    indigo: 'text-indigo-600 bg-indigo-50',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>
        {icon}
      </div>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sublabel}</div>
    </div>
  );
}
