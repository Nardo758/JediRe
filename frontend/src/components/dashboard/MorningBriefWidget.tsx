/**
 * Morning Brief Widget
 * 
 * Dashboard widget showing the AI-generated morning briefing.
 * NOT the same as tasks list — this is a synthesized summary including:
 * - Portfolio status
 * - Urgent items (deadlines, expirations, alerts)
 * - Market insights
 * - Agent activity
 * - Tasks are just one input
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, AlertTriangle, Calendar, TrendingUp, 
  MessageSquare, ChevronRight, Clock, Bell, Building
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';

// ============================================================================
// TYPES
// ============================================================================

interface MorningBrief {
  generatedAt: string;
  greeting: string;
  summary: string;
  
  portfolio: {
    totalDeals: number;
    byStatus: Record<string, number>;
    changesOvernight: { dealId: string; dealName: string; change: string }[];
  };
  
  urgent: {
    type: 'deadline' | 'expiration' | 'alert' | 'threshold';
    title: string;
    detail: string;
    dealId?: string;
    dealName?: string;
    dueDate?: string;
  }[];
  
  tasksSummary: {
    dueToday: number;
    dueThisWeek: number;
    overdue: number;
    topTasks: { id: string; title: string; dealName: string; dueDate: string; priority: string }[];
  };
  
  agentActivity: {
    agentId: string;
    agentName: string;
    insight: string;
    dealName?: string;
  }[];
  
  narrative: string;
}

// ============================================================================
// WIDGET
// ============================================================================

export const MorningBriefWidget: React.FC = () => {
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadBrief();
  }, []);

  const loadBrief = async () => {
    try {
      const res = await api.get('/morning-brief');
      if (res.data?.success) {
        setBrief(res.data.brief);
      }
    } catch (error) {
      console.error('Failed to load morning brief:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBrief = async () => {
    setRefreshing(true);
    try {
      const res = await api.post('/morning-brief/refresh');
      if (res.data?.success) {
        setBrief(res.data.brief);
      }
    } catch (error) {
      console.error('Failed to refresh brief:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: T.bg.panel,
        borderRadius: 12,
        padding: 20,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.text.muted,
        fontFamily: T.font.mono,
      }}>
        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
        Loading brief...
      </div>
    );
  }

  if (!brief) {
    return (
      <div style={{
        background: T.bg.panel,
        borderRadius: 12,
        padding: 20,
        color: T.text.muted,
        fontFamily: T.font.mono,
        textAlign: 'center',
      }}>
        Unable to load morning brief
      </div>
    );
  }

  const urgentCount = brief.urgent.length;
  const hasUrgent = urgentCount > 0;

  return (
    <div style={{
      background: T.bg.panel,
      borderRadius: 12,
      fontFamily: T.font.mono,
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${T.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: hasUrgent ? `${T.text.amber}08` : undefined,
      }}>
        <div>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 700, 
            color: T.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            ☀️ {brief.greeting}
            {hasUrgent && (
              <span style={{
                background: T.text.red,
                color: '#fff',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 10,
                fontWeight: 600,
              }}>
                {urgentCount} URGENT
              </span>
            )}
          </div>
          <div style={{ 
            fontSize: 10, 
            color: T.text.muted, 
            marginTop: 2 
          }}>
            Generated {new Date(brief.generatedAt).toLocaleTimeString()}
          </div>
        </div>
        <button
          onClick={refreshBrief}
          disabled={refreshing}
          style={{
            background: 'transparent',
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 6,
            padding: '6px 10px',
            color: T.text.muted,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
          }}
        >
          <RefreshCw size={12} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
          Refresh
        </button>
      </div>

      {/* Narrative Summary */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${T.border.subtle}`,
        background: T.bg.panelAlt,
      }}>
        <p style={{
          margin: 0,
          fontSize: 12,
          color: T.text.primary,
          lineHeight: 1.5,
        }}>
          {brief.narrative}
        </p>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {/* Urgent Items */}
        {brief.urgent.length > 0 && (
          <Section
            title="⚠️ Needs Attention"
            count={brief.urgent.length}
            color={T.text.red}
            expanded={expandedSection === 'urgent'}
            onToggle={() => setExpandedSection(expandedSection === 'urgent' ? null : 'urgent')}
          >
            {brief.urgent.map((item, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                background: T.bg.terminal,
                borderRadius: 6,
                marginBottom: 6,
                borderLeft: `3px solid ${T.text.red}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text.primary }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 10, color: T.text.muted, marginTop: 2 }}>
                  {item.dealName && <span style={{ color: T.text.cyan }}>{item.dealName}</span>}
                  {item.dealName && ' • '}
                  {item.detail}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Portfolio Snapshot */}
        <Section
          title="📊 Portfolio"
          count={brief.portfolio.totalDeals}
          color={T.text.cyan}
          expanded={expandedSection === 'portfolio'}
          onToggle={() => setExpandedSection(expandedSection === 'portfolio' ? null : 'portfolio')}
          defaultExpanded
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {Object.entries(brief.portfolio.byStatus).filter(([_, v]) => v > 0).map(([status, count]) => (
              <div key={status} style={{
                padding: '6px 10px',
                background: T.bg.terminal,
                borderRadius: 4,
                fontSize: 10,
              }}>
                <span style={{ color: T.text.muted }}>{status.replace('_', ' ')}</span>
                <span style={{ color: T.text.primary, fontWeight: 600, marginLeft: 6 }}>{count}</span>
              </div>
            ))}
          </div>
          {brief.portfolio.changesOvernight.length > 0 && (
            <div style={{ fontSize: 10, color: T.text.muted, marginTop: 8 }}>
              <div style={{ marginBottom: 4, color: T.text.secondary }}>Overnight changes:</div>
              {brief.portfolio.changesOvernight.slice(0, 3).map((change, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  • <span style={{ color: T.text.cyan }}>{change.dealName}</span>: {change.change}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Tasks */}
        <Section
          title="✅ Tasks"
          count={brief.tasksSummary.dueToday}
          countLabel="due today"
          color={brief.tasksSummary.overdue > 0 ? T.text.amber : T.text.green}
          expanded={expandedSection === 'tasks'}
          onToggle={() => setExpandedSection(expandedSection === 'tasks' ? null : 'tasks')}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <Stat label="Overdue" value={brief.tasksSummary.overdue} color={brief.tasksSummary.overdue > 0 ? T.text.red : T.text.muted} />
            <Stat label="Today" value={brief.tasksSummary.dueToday} color={T.text.amber} />
            <Stat label="This Week" value={brief.tasksSummary.dueThisWeek} color={T.text.cyan} />
          </div>
          {brief.tasksSummary.topTasks.slice(0, 3).map(task => (
            <div key={task.id} style={{
              padding: '8px 10px',
              background: T.bg.terminal,
              borderRadius: 4,
              marginBottom: 4,
              fontSize: 10,
              borderLeft: `2px solid ${
                task.priority === 'critical' ? T.text.red :
                task.priority === 'high' ? T.text.orange :
                T.text.muted
              }`,
            }}>
              <div style={{ color: T.text.primary }}>{task.title}</div>
              <div style={{ color: T.text.muted, marginTop: 2 }}>
                {task.dealName} • {new Date(task.dueDate).toLocaleDateString()}
              </div>
            </div>
          ))}
        </Section>

        {/* Agent Activity */}
        {brief.agentActivity.length > 0 && (
          <Section
            title="🤖 Agent Insights"
            count={brief.agentActivity.length}
            color={T.text.purple}
            expanded={expandedSection === 'agents'}
            onToggle={() => setExpandedSection(expandedSection === 'agents' ? null : 'agents')}
          >
            {brief.agentActivity.map((activity, i) => (
              <div key={i} style={{
                padding: '8px 10px',
                background: T.bg.terminal,
                borderRadius: 4,
                marginBottom: 4,
                fontSize: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ 
                    color: T.text.purple, 
                    fontWeight: 600,
                    fontSize: 9,
                    padding: '1px 4px',
                    background: `${T.text.purple}20`,
                    borderRadius: 3,
                  }}>
                    {activity.agentName}
                  </span>
                  {activity.dealName && (
                    <span style={{ color: T.text.muted }}>on {activity.dealName}</span>
                  )}
                </div>
                <div style={{ color: T.text.primary, marginTop: 4 }}>{activity.insight}</div>
              </div>
            ))}
          </Section>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SectionProps {
  title: string;
  count?: number;
  countLabel?: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ 
  title, count, countLabel, color, expanded, onToggle, defaultExpanded, children 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || expanded);

  useEffect(() => {
    setIsExpanded(expanded || defaultExpanded);
  }, [expanded, defaultExpanded]);

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: T.text.secondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
          {count !== undefined && (
            <span style={{
              fontSize: 10,
              padding: '2px 6px',
              background: `${color}20`,
              color: color,
              borderRadius: 10,
            }}>
              {count} {countLabel || ''}
            </span>
          )}
        </div>
        <ChevronRight 
          size={14} 
          style={{ 
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }} 
        />
      </button>
      {isExpanded && (
        <div style={{ paddingTop: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 9, color: T.text.muted }}>{label}</div>
  </div>
);

export default MorningBriefWidget;
