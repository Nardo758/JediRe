import React, { useState, useCallback } from 'react';
import {
  Activity, Search, Filter, ChevronDown, ChevronRight, MapPin,
  FileText, Users, TrendingUp, Edit, CheckCircle, Bot,
  RefreshCw, AlertTriangle, Clock, Zap, DollarSign, XCircle,
  Copy, Check
} from 'lucide-react';
import { Deal } from '@/types';

// ── Types ─────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  dealId: string;
  type: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  kind: 'activity';
}

/** Normalized display status (maps backend succeeded→completed, aborted→cancelled) */
type DisplayStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'budget_exceeded';

interface AgentRunItem {
  id: string;
  dealId: string;
  agentId: string;
  agentVersion: string;
  /** display_status is pre-normalized by the API */
  status: DisplayStatus;
  triggeredBy: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  kind: 'agent_run';
}

interface RunStep {
  id: string;
  step_index: number;
  step_type: string;
  tool_name: string | null;
  duration_ms: number | null;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

type FeedItem = ActivityItem | AgentRunItem;

interface ActivityFeedSectionProps {
  deal: Deal;
}

// ── Config ────────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<string, {
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  label: string;
}> = {
  deal_created: { icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Deal Created' },
  boundary_defined: { icon: MapPin, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Boundary Defined' },
  property_added: { icon: MapPin, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Property Added' },
  property_removed: { icon: MapPin, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Property Removed' },
  analysis_run: { icon: TrendingUp, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Analysis Run' },
  document_uploaded: { icon: FileText, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Document Uploaded' },
  team_member_invited: { icon: Users, color: 'text-cyan-600', bgColor: 'bg-cyan-100', label: 'Team Member Invited' },
  stage_changed: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Stage Changed' },
  note_added: { icon: Edit, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Note Added' },
  'research.completed': { icon: Bot, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Research Completed' },
  default: { icon: Activity, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Activity' },
};

const AGENT_STATUS_CONFIG: Record<DisplayStatus, {
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  badgeColor: string;
  label: string;
  spin?: boolean;
}> = {
  pending: {
    icon: Clock,
    color: 'text-gray-500', bgColor: 'bg-gray-100',
    badgeColor: 'bg-gray-100 text-gray-600', label: 'Pending',
  },
  running: {
    icon: RefreshCw,
    color: 'text-blue-600', bgColor: 'bg-blue-100',
    badgeColor: 'bg-blue-100 text-blue-800', label: 'Running', spin: true,
  },
  completed: {
    icon: Bot,
    color: 'text-violet-600', bgColor: 'bg-violet-100',
    badgeColor: 'bg-violet-100 text-violet-800', label: 'Completed',
  },
  failed: {
    icon: AlertTriangle,
    color: 'text-red-600', bgColor: 'bg-red-100',
    badgeColor: 'bg-red-100 text-red-800', label: 'Failed',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-gray-500', bgColor: 'bg-gray-100',
    badgeColor: 'bg-gray-100 text-gray-600', label: 'Cancelled',
  },
  budget_exceeded: {
    icon: DollarSign,
    color: 'text-amber-600', bgColor: 'bg-amber-100',
    badgeColor: 'bg-amber-100 text-amber-800', label: 'Budget Exceeded',
  },
};

const ACTIVITY_TYPES = [
  { value: 'all', label: 'All Activity' },
  { value: 'agent_run', label: 'Agent Runs' },
  { value: 'deal_created', label: 'Deal Created' },
  { value: 'boundary_defined', label: 'Boundary' },
  { value: 'property_added', label: 'Properties' },
  { value: 'analysis_run', label: 'Analysis' },
  { value: 'document_uploaded', label: 'Documents' },
  { value: 'team_member_invited', label: 'Team' },
  { value: 'stage_changed', label: 'Stage Changes' },
  { value: 'note_added', label: 'Notes' },
];

const AGENT_LABELS: Record<string, string> = {
  research: 'Research Agent',
  underwriting: 'Underwriting Agent',
  risk: 'Risk Agent',
};

// ── Helpers ───────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) {
    return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}, ${timeStr}`;
  }
  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).format(date)}, ${timeStr}`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// ── Run detail panel ──────────────────────────────────────────────

function RunDetailPanel({ runId }: { runId: string }) {
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/v1/agents/runs/${runId}/steps`)
      .then(r => r.json())
      .then(data => setSteps(data.steps ?? []))
      .catch(() => setError('Could not load run steps'))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="py-3 text-xs text-gray-500 flex items-center gap-2">
        <RefreshCw className="w-3 h-3 animate-spin" /> Loading steps...
      </div>
    );
  }

  if (error) {
    return <div className="py-2 text-xs text-red-500">{error}</div>;
  }

  if (steps.length === 0) {
    return <div className="py-2 text-xs text-gray-500">No steps recorded yet</div>;
  }

  return (
    <div className="mt-3 space-y-1">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3 text-xs py-1 border-t border-gray-100">
          <span className="w-5 text-gray-400 text-right">{step.step_index + 1}</span>
          <span className="font-medium text-gray-700 capitalize">{step.step_type.replace('_', ' ')}</span>
          {step.tool_name && (
            <span className="text-violet-600 font-mono">{step.tool_name}</span>
          )}
          {step.duration_ms != null && (
            <span className="text-gray-400 ml-auto">{formatDuration(step.duration_ms)}</span>
          )}
          {(step.tokens_in + step.tokens_out) > 0 && (
            <span className="text-gray-400">{(step.tokens_in + step.tokens_out).toLocaleString()} tok</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Copy-to-clipboard mini component ─────────────────────────────

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy run ID"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      <span className="font-mono">{id.slice(0, 8)}…</span>
    </button>
  );
}

// ── AgentRunCard ──────────────────────────────────────────────────

function AgentRunCard({ run, isLast }: { run: AgentRunItem; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const cfg = AGENT_STATUS_CONFIG[run.status] ?? AGENT_STATUS_CONFIG.failed;
  const Icon = cfg.icon;
  const agentLabel = AGENT_LABELS[run.agentId] ?? `${run.agentId} Agent`;

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Timeline icon */}
        <div className="relative flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full ${cfg.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`} />
          </div>
          {!isLast && (
            <div className="w-0.5 h-full bg-gray-200 absolute top-10 bottom-0" />
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-gray-900">{agentLabel}</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.badgeColor}`}>
                {cfg.label}
              </span>
              {run.durationMs != null && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatDuration(run.durationMs)}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTimestamp(run.startedAt)}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {run.triggeredBy === 'user' ? 'Manual run' : `Auto (${run.triggeredBy})`}
            </span>
            {(run.tokensIn + run.tokensOut) > 0 && (
              <span>{(run.tokensIn + run.tokensOut).toLocaleString()} tokens</span>
            )}
            {run.costUsd != null && run.costUsd > 0 && (
              <span>${run.costUsd.toFixed(4)}</span>
            )}
            <CopyId id={run.id} />
          </div>

          {/* Error */}
          {(run.status === 'failed' || run.status === 'budget_exceeded') && run.error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-100 font-mono">
              {run.error.slice(0, 240)}{run.error.length > 240 ? '…' : ''}
            </div>
          )}

          {/* Expandable steps */}
          <div className="mt-2">
            <button
              onClick={() => setExpanded(e => !e)}
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors"
            >
              {expanded
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />}
              {expanded ? 'Hide steps' : 'View steps'}
            </button>

            {expanded && <RunDetailPanel runId={run.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ActivityCard ──────────────────────────────────────────────────

function ActivityCard({ activity, isLast }: { activity: ActivityItem; isLast: boolean }) {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
  const Icon = config.icon;

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        <div className="relative flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          {!isLast && (
            <div className="w-0.5 h-full bg-gray-200 absolute top-10 bottom-0" />
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start justify-between gap-4 mb-1">
            <p className="text-sm font-medium text-gray-900 flex-1 min-w-0">
              {activity.description}
            </p>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTimestamp(activity.timestamp)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{activity.userName}</span>
            {activity.userId === 'ai' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                AI
              </span>
            )}
          </div>

          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {activity.type === 'boundary_defined' && activity.metadata.acres && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                  <MapPin className="w-3 h-3" />
                  {activity.metadata.acres.toFixed(1)} acres
                </span>
              )}
              {activity.type === 'property_added' && activity.metadata.count && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                  {activity.metadata.count} properties
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export function ActivityFeedSection({ deal }: ActivityFeedSectionProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [displayCount, setDisplayCount] = useState(20);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [activityRes, runsRes] = await Promise.allSettled([
        fetch(`/api/v1/deals/${deal.id}/team/activity`),
        fetch(`/api/v1/deals/${deal.id}/agent-runs`),
      ]);

      if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
        const data = await activityRes.value.json();
        const items: ActivityItem[] = (data || []).map((a: any) => ({
          id: a.id,
          dealId: a.deal_id,
          type: a.action || 'default',
          description: a.details?.description || a.action || 'Activity',
          userId: a.actor_id || 'system',
          userName: a.actor_name || 'System',
          timestamp: new Date(a.created_at),
          metadata: a.details || {},
          kind: 'activity' as const,
        }));
        setActivities(items);
      }

      if (runsRes.status === 'fulfilled' && runsRes.value.ok) {
        const data = await runsRes.value.json();
        const runs: AgentRunItem[] = (data.runs || []).map((r: any) => ({
          id: r.id,
          dealId: r.deal_id,
          agentId: r.agent_id,
          agentVersion: r.agent_version,
          // API returns pre-normalized display_status; fall back to raw status normalization
          status: (r.display_status ?? r.status ?? 'failed') as DisplayStatus,
          triggeredBy: r.triggered_by,
          tokensIn: r.tokens_in || 0,
          tokensOut: r.tokens_out || 0,
          costUsd: r.cost_usd ?? null,
          startedAt: new Date(r.started_at),
          completedAt: r.completed_at ? new Date(r.completed_at) : null,
          durationMs: r.duration_ms ?? null,
          error: r.error ?? null,
          kind: 'agent_run' as const,
        }));
        setAgentRuns(runs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [deal.id]);

  React.useEffect(() => {
    if (deal.id) fetchData();
  }, [deal.id, fetchData]);

  const allItems: FeedItem[] = [...activities, ...agentRuns];

  const filteredItems = allItems
    .filter(item => {
      if (selectedType === 'agent_run') return item.kind === 'agent_run';
      if (selectedType !== 'all') {
        if (item.kind === 'agent_run') return false;
        return item.type === selectedType;
      }
      return true;
    })
    .filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      if (item.kind === 'activity') {
        return (
          item.description.toLowerCase().includes(q) ||
          item.userName.toLowerCase().includes(q)
        );
      }
      const agentLabel = (AGENT_LABELS[item.agentId] ?? item.agentId).toLowerCase();
      return agentLabel.includes(q) || item.agentId.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const ta = a.kind === 'activity' ? a.timestamp : a.startedAt;
      const tb = b.kind === 'activity' ? b.timestamp : b.startedAt;
      const cmp = tb.getTime() - ta.getTime();
      return sortOrder === 'newest' ? cmp : -cmp;
    })
    .slice(0, displayCount);

  const hasMore = filteredItems.length < Math.min(allItems.length, displayCount + 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading activity feed...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-2">Error loading activity feed</p>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-sm text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const runningCount = agentRuns.filter(r => r.status === 'running').length;
  const completedCount = agentRuns.filter(r => r.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {ACTIVITY_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Filter className="w-4 h-4" />
            {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>

          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Agent summary bar */}
        {agentRuns.length > 0 && (
          <div className="mt-3 flex items-center gap-3 text-xs">
            <Bot className="w-4 h-4 text-violet-600" />
            {completedCount > 0 && (
              <span className="text-gray-600">
                {completedCount} run{completedCount !== 1 ? 's' : ''} completed
              </span>
            )}
            {runningCount > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {runningCount} running
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No activity yet</h3>
          <p className="text-sm text-gray-600">
            Activity will appear here as you work on this deal
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredItems.map((item, index) => {
              const isLast = index === filteredItems.length - 1;
              if (item.kind === 'agent_run') {
                return <AgentRunCard key={`run-${item.id}`} run={item} isLast={isLast} />;
              }
              return <ActivityCard key={`act-${item.id}`} activity={item} isLast={isLast} />;
            })}
          </div>

          {hasMore && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => setDisplayCount(c => c + 20)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Load More Activity
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats footer */}
      {filteredItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredItems.length} of {allItems.length} events
              {selectedType !== 'all' && ` (${ACTIVITY_TYPES.find(t => t.value === selectedType)?.label})`}
            </span>
            {allItems.length > 0 && (
              <span>
                Last: {formatTimestamp(
                  allItems
                    .map(i => i.kind === 'activity' ? i.timestamp : i.startedAt)
                    .sort((a, b) => b.getTime() - a.getTime())[0]
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
