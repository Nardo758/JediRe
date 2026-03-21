import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';
import { Activity, MessageSquare, UserPlus, FileText, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

interface ActivityEntry {
  id: string;
  deal_id: string | null;
  org_id: string | null;
  user_id: string;
  user_name: string;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface ActivityFeedProps {
  dealId?: string;
  orgId?: string;
  limit?: number;
  compact?: boolean;
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  deal_created: { icon: FileText, color: 'text-blue-500', label: 'created a deal' },
  deal_updated: { icon: FileText, color: 'text-blue-500', label: 'updated deal' },
  collaborator_added: { icon: UserPlus, color: 'text-green-500', label: 'added collaborator' },
  collaborator_removed: { icon: UserPlus, color: 'text-red-500', label: 'removed collaborator' },
  collaborator_updated: { icon: UserPlus, color: 'text-amber-500', label: 'updated collaborator' },
  comment_added: { icon: MessageSquare, color: 'text-indigo-500', label: 'commented' },
  comment_replied: { icon: MessageSquare, color: 'text-indigo-400', label: 'replied to comment' },
  comment_resolved: { icon: CheckCircle, color: 'text-green-500', label: 'resolved comment' },
  proforma_updated: { icon: TrendingUp, color: 'text-purple-500', label: 'updated pro forma' },
  score_changed: { icon: TrendingUp, color: 'text-amber-500', label: 'score changed' },
  stage_changed: { icon: Activity, color: 'text-cyan-500', label: 'changed stage' },
  task_created: { icon: CheckCircle, color: 'text-blue-500', label: 'created task' },
  task_completed: { icon: CheckCircle, color: 'text-green-500', label: 'completed task' },
  member_joined: { icon: UserPlus, color: 'text-green-500', label: 'joined' },
  document_uploaded: { icon: FileText, color: 'text-blue-500', label: 'uploaded document' },
  strategy_run: { icon: TrendingUp, color: 'text-purple-500', label: 'ran strategy analysis' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ActivityFeed({ dealId, orgId, limit = 20, compact = false }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      const offset = page * limit;
      let url: string;
      if (dealId) {
        url = `/api/v1/deals/${dealId}/activity?limit=${limit}&offset=${offset}`;
      } else if (orgId) {
        url = `/api/v1/orgs/${orgId}/activity?limit=${limit}&offset=${offset}`;
      } else {
        return;
      }
      const response = await apiClient.get(url) as any;
      const data = response?.data || {};
      setActivities(data.activities || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
    }
  }, [dealId, orgId, limit, page]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (loading && activities.length === 0) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 bg-slate-200 rounded-full" />
              <div className="flex-1">
                <div className="h-3 bg-slate-200 rounded w-3/4 mb-1" />
                <div className="h-2 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-6 text-center">
        <Activity size={24} className="text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Activity</span>
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
            {total}
          </span>
        </div>
      </div>

      <div className={compact ? 'max-h-[300px] overflow-y-auto' : ''}>
        {activities.map((entry) => {
          const config = ACTION_CONFIG[entry.action] || {
            icon: AlertCircle,
            color: 'text-slate-400',
            label: entry.action.replace(/_/g, ' '),
          };
          const Icon = config.icon;
          const meta = entry.metadata || {};

          return (
            <div key={entry.id} className="px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 flex gap-3">
              <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-700">
                  <span className="font-medium">{entry.user_name}</span>
                  {' '}{config.label}
                  {meta.deal_name && (
                    <span className="text-slate-500"> on <span className="font-medium">{meta.deal_name}</span></span>
                  )}
                  {meta.collaborator_name && (
                    <span className="text-slate-500"> — {meta.collaborator_name}</span>
                  )}
                  {meta.content_preview && (
                    <span className="text-slate-400 italic"> "{meta.content_preview}"</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {timeAgo(entry.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {total > limit && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="text-[10px] text-blue-600 hover:text-blue-700 disabled:text-slate-300"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="text-[10px] text-blue-600 hover:text-blue-700 disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
