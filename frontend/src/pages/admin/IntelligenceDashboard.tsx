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
import { BT } from '@/components/deal/bloomberg-ui';

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
        <div className="h-12 w-12" style={{ border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
          <div className="flex items-center gap-2" style={{ color: BT.text.red }}>
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Error</span>
          </div>
          <p className="mt-2" style={{ color: BT.text.red }}>{error}</p>
          <button
            onClick={loadStats}
            className="mt-4 px-4 py-2 text-sm"
            style={{ background: BT.text.red, color: BT.bg.terminal, borderRadius: 0 }}
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
    <div className="min-h-screen" style={{ background: BT.bg.terminal, fontFamily: BT.font.label }}>
      {/* Header */}
      <div style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin" className="p-1.5" style={{ borderRadius: 2 }}>
                <ArrowLeft className="w-4 h-4" style={{ color: BT.text.secondary }} />
              </Link>
              <Brain className="w-5 h-5" style={{ color: BT.text.purple }} />
              <h1 className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Intelligence Layer</h1>
            </div>
            <button
              onClick={loadStats}
              className="px-4 py-2 text-sm font-medium"
              style={{ background: BT.bg.panel, color: BT.text.secondary, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}
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
            color="cyan"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Validated"
            value={stats.documents.validated.toLocaleString()}
            sublabel={`${stats.documents.total > 0 ? Math.round((stats.documents.validated / stats.documents.total) * 100) : 0}% of total`}
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
            color="amber"
          />
        </div>

        {/* Embedding Status */}
        {pendingEmbeddings > 0 && (
          <div className="p-4" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.amber}`, borderRadius: 0 }}>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 mt-0.5" style={{ color: BT.text.amber }} />
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: BT.text.amber }}>Embeddings Pending</h3>
                <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                  {pendingEmbeddings.toLocaleString()} documents need embedding generation
                </p>
                <p className="text-xs mt-1" style={{ color: BT.text.muted }}>
                  Estimated cost: ${estimatedCost} &bull; Run: <code style={{ background: BT.bg.input, padding: '0 4px', borderRadius: 2, fontFamily: BT.font.mono }}>npm run embeddings</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quality Issues */}
        {stats.qualityIssues.total > 0 && (
          <div className="p-4" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: BT.text.red }} />
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: BT.text.red }}>Data Quality Alerts</h3>
                <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>
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
          <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5" style={{ color: BT.text.secondary }} />
              <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Document Sources</h2>
            </div>
            <div className="space-y-3">
              {stats.sourceBreakdown.map((source) => (
                <div key={source.source} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize" style={{ color: BT.text.secondary }}>
                        {source.source.replace('_', ' ')}
                      </span>
                      <span className="text-sm" style={{ color: BT.text.secondary }}>
                        {source.count.toLocaleString()} docs
                      </span>
                    </div>
                    <div className="w-full h-2" style={{ background: BT.bg.input, borderRadius: 0 }}>
                      <div
                        className="h-2"
                        style={{ width: `${source.pctEmbedded}%`, background: BT.text.cyan, borderRadius: 0 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs" style={{ color: BT.text.muted }}>
                        {source.withEmbeddings.toLocaleString()} embedded
                      </span>
                      <span className="text-xs font-medium" style={{ color: BT.text.secondary }}>
                        {source.pctEmbedded}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Learning Stats */}
          <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5" style={{ color: BT.text.secondary }} />
              <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Agent Performance (30d)</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>
                    {stats.agentLearning.approved}
                  </div>
                  <div className="text-xs" style={{ color: BT.text.secondary }}>Approved</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: BT.text.amber, fontFamily: BT.font.mono }}>
                    {stats.agentLearning.corrected}
                  </div>
                  <div className="text-xs" style={{ color: BT.text.secondary }}>Corrected</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: BT.text.red, fontFamily: BT.font.mono }}>
                    {stats.agentLearning.rejected}
                  </div>
                  <div className="text-xs" style={{ color: BT.text.secondary }}>Rejected</div>
                </div>
              </div>
              <div className="pt-4 space-y-2" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: BT.text.secondary }}>Avg Execution Time</span>
                  <span className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                    {Math.round(stats.agentLearning.avgExecutionTime)}ms
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: BT.text.secondary }}>Avg Confidence</span>
                  <span className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                    {Math.round(stats.agentLearning.avgConfidence * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: BT.text.secondary }}>Approval Rate</span>
                  <span className="font-medium" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>
                    {stats.agentLearning.approvalRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Breakdown */}
          <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5" style={{ color: BT.text.secondary }} />
              <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Agent Breakdown</h2>
            </div>
            <div className="space-y-3">
              {stats.agentBreakdown.map((agent) => (
                <div key={agent.agentType} className="p-3" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize" style={{ color: BT.text.primary }}>
                      {agent.agentType.replace('_', ' ')}
                    </span>
                    <span className="text-sm" style={{ color: BT.text.secondary }}>{agent.taskCount} tasks</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span style={{ color: BT.text.secondary }}>Approval: </span>
                      <span className="font-medium" style={{ color: BT.text.green }}>{agent.approvalRate}%</span>
                    </div>
                    <div>
                      <span style={{ color: BT.text.secondary }}>Confidence: </span>
                      <span className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {Math.round(agent.avgConfidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {stats.agentBreakdown.length === 0 && (
                <div className="text-center py-4" style={{ color: BT.text.muted }}>
                  No agent tasks in the last 30 days
                </div>
              )}
            </div>
          </div>

          {/* Document Types */}
          <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" style={{ color: BT.text.secondary }} />
              <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Document Types</h2>
            </div>
            <div className="space-y-2">
              {stats.typeBreakdown.slice(0, 8).map((type) => (
                <div key={type.type} className="flex items-center justify-between text-sm">
                  <span className="capitalize" style={{ color: BT.text.secondary }}>
                    {type.type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>{type.count}</span>
                    <span className="text-xs" style={{ color: BT.text.muted }}>
                      ({type.count > 0 ? Math.round((type.withEmbeddings / type.count) * 100) : 0}% embedded)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document Relationships */}
        {stats.relationships.length > 0 && (
          <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-4">
              <Network className="w-5 h-5" style={{ color: BT.text.secondary }} />
              <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Document Relationships</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.relationships.map((rel) => (
                <div key={rel.type} className="text-center p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                  <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{rel.count}</div>
                  <div className="text-xs capitalize mt-1" style={{ color: BT.text.secondary }}>
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
  color: 'cyan' | 'green' | 'purple' | 'amber';
}

function StatCard({ icon, label, value, sublabel, color }: StatCardProps) {
  const colorMap = {
    cyan: BT.text.cyan,
    green: BT.text.green,
    purple: BT.text.purple,
    amber: BT.text.amber,
  };

  const iconColor = colorMap[color];

  return (
    <div className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
      <div className="inline-flex p-2 mb-3" style={{ borderRadius: 2, background: BT.bg.panelAlt, color: iconColor }}>
        {icon}
      </div>
      <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: BT.text.muted }}>{sublabel}</div>
    </div>
  );
}
