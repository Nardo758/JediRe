import { useState, useEffect, useCallback } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
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
  deal_created: { icon: FileText, color: BT.text.cyan, label: 'created a deal' },
  deal_updated: { icon: FileText, color: BT.text.cyan, label: 'updated deal' },
  collaborator_added: { icon: UserPlus, color: BT.text.green, label: 'added collaborator' },
  collaborator_removed: { icon: UserPlus, color: BT.text.red, label: 'removed collaborator' },
  collaborator_updated: { icon: UserPlus, color: BT.text.amber, label: 'updated collaborator' },
  comment_added: { icon: MessageSquare, color: BT.text.purple, label: 'commented' },
  comment_replied: { icon: MessageSquare, color: BT.text.purple, label: 'replied to comment' },
  comment_resolved: { icon: CheckCircle, color: BT.text.green, label: 'resolved comment' },
  proforma_updated: { icon: TrendingUp, color: BT.text.purple, label: 'updated pro forma' },
  score_changed: { icon: TrendingUp, color: BT.text.amber, label: 'score changed' },
  stage_changed: { icon: Activity, color: BT.text.cyan, label: 'changed stage' },
  task_created: { icon: CheckCircle, color: BT.text.cyan, label: 'created task' },
  task_completed: { icon: CheckCircle, color: BT.text.green, label: 'completed task' },
  member_joined: { icon: UserPlus, color: BT.text.green, label: 'joined' },
  document_uploaded: { icon: FileText, color: BT.text.cyan, label: 'uploaded document' },
  strategy_run: { icon: TrendingUp, color: BT.text.purple, label: 'ran strategy analysis' },
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
        <div className="space-y-3" style={{ opacity: 0.5 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-full" style={{ background: BT.bg.header }} />
              <div className="flex-1">
                <div className="h-3 mb-1" style={{ background: BT.bg.header, width: '75%' }} />
                <div className="h-2" style={{ background: BT.bg.header, width: '50%' }} />
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
        <Activity size={24} style={{ color: BT.text.muted }} className="mx-auto mb-2" />
        <p style={{ fontSize: 9, color: BT.text.muted, fontFamily: BT.font.mono }}>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, fontFamily: BT.font.mono }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: BT.text.secondary }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>Activity</span>
          <span style={{ fontSize: 9, background: BT.bg.active, color: BT.text.secondary, padding: '1px 6px', fontWeight: 500, borderRadius: 2 }}>
            {total}
          </span>
        </div>
      </div>

      <div className={compact ? 'max-h-[300px] overflow-y-auto' : ''}>
        {activities.map((entry) => {
          const config = ACTION_CONFIG[entry.action] || {
            icon: AlertCircle,
            color: BT.text.muted,
            label: entry.action.replace(/_/g, ' '),
          };
          const Icon = config.icon;
          const meta = entry.metadata || {};

          return (
            <div key={entry.id} className="px-4 py-2.5 flex gap-3" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div className="mt-0.5 flex-shrink-0" style={{ color: config.color }}>
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 10, color: BT.text.secondary }}>
                  <span style={{ fontWeight: 500, color: BT.text.primary }}>{entry.user_name}</span>
                  {' '}{config.label}
                  {meta.deal_name && (
                    <span style={{ color: BT.text.muted }}> on <span style={{ fontWeight: 500 }}>{meta.deal_name}</span></span>
                  )}
                  {meta.collaborator_name && (
                    <span style={{ color: BT.text.muted }}> — {meta.collaborator_name}</span>
                  )}
                  {meta.content_preview && (
                    <span style={{ color: BT.text.muted, fontStyle: 'italic' }}> "{meta.content_preview}"</span>
                  )}
                </div>
                <div className="mt-0.5" style={{ fontSize: 9, color: BT.text.muted }}>
                  {timeAgo(entry.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {total > limit && (
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>
          <span style={{ fontSize: 9, color: BT.text.muted }}>
            {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{ fontSize: 9, color: page === 0 ? BT.text.muted : BT.text.cyan, background: 'transparent', border: 'none', cursor: page === 0 ? 'default' : 'pointer', fontFamily: BT.font.mono }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              style={{ fontSize: 9, color: (page + 1) * limit >= total ? BT.text.muted : BT.text.cyan, background: 'transparent', border: 'none', cursor: (page + 1) * limit >= total ? 'default' : 'pointer', fontFamily: BT.font.mono }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
