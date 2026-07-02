import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, Users, CreditCard, BarChart3, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface PoolStatus {
  org_id: string;
  subscription_tier: string;
  credits_remaining: number;
  credits_included_monthly: number;
  monthly_credit_cap: number | null;
  credits_used_this_period: number;
  period_start: string;
  period_end: string;
}

interface MemberUsage {
  user_id: string;
  display_name: string;
  calls: number;
  credits_used: number;
}

interface UsageBreakdown {
  org_id: string;
  period_start: string;
  credits_used_this_period: number;
  by_member: MemberUsage[];
}

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
}

function getAuthToken(): string {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<{ data: T | null; status: number; error?: string }> {
  const res = await fetch(path, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { data: null, status: res.status, error: body.error || body.message || 'Request failed' };
  return { data: body as T, status: res.status };
}

export default function OrgActivityPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [pool, setPool]             = useState<PoolStatus | null>(null);
  const [usage, setUsage]           = useState<UsageBreakdown | null>(null);
  const [members, setMembers]       = useState<OrgMember[]>([]);
  const [isOwner, setIsOwner]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    setError('');

    const token = getAuthToken();
    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Fetch pool + members in parallel; try usage (owner-only) and check status
    Promise.all([
      apiFetch<PoolStatus>(`/api/v1/orgs/${orgId}/pool`),
      apiFetch<OrgMember[]>(`/api/v1/orgs/${orgId}/members`),
      apiFetch<UsageBreakdown>(`/api/v1/orgs/${orgId}/usage/by-member`),
    ]).then(([poolRes, membersRes, usageRes]) => {
      if (poolRes.status === 401) {
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (poolRes.status === 403 || poolRes.status === 404) {
        setError(poolRes.error || 'Organization not found or access denied.');
        setLoading(false);
        return;
      }
      if (poolRes.data) setPool(poolRes.data);
      if (membersRes.data) setMembers(membersRes.data);
      if (usageRes.status === 200 && usageRes.data) {
        setUsage(usageRes.data);
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
      setLoading(false);
    }).catch(() => {
      setError('Failed to load organization data.');
      setLoading(false);
    });
  }, [orgId, navigate, refreshKey]);

  if (loading) {
    return (
      <PageShell>
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading organization activity…</p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <div className="text-center py-20 max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">← Back to Dashboard</Link>
        </div>
      </PageShell>
    );
  }

  const periodEnd = pool ? new Date(pool.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const usedPct = pool && pool.monthly_credit_cap
    ? Math.min(100, Math.round((pool.credits_used_this_period / pool.monthly_credit_cap) * 100))
    : null;

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organization Activity</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">{orgId}</p>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Pool Card */}
        {pool && (
          <section>
            <SectionHeader icon={<CreditCard className="w-4 h-4" />} title="Credit Pool" />
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <Stat label="Remaining" value={pool.credits_remaining.toLocaleString()} highlight />
                <Stat label="Used this period" value={pool.credits_used_this_period.toLocaleString()} />
                <Stat label="Monthly cap" value={pool.monthly_credit_cap != null ? pool.monthly_credit_cap.toLocaleString() : '∞'} />
                <Stat label="Resets" value={periodEnd} />
              </div>
              {usedPct !== null && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{usedPct}% used</span>
                    <span>{pool.credits_remaining} remaining</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${usedPct > 85 ? 'bg-red-500' : usedPct > 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 capitalize">
                Tier: <span className="font-medium text-gray-600">{pool.subscription_tier}</span>
                {' · '}Included monthly: <span className="font-medium text-gray-600">{pool.credits_included_monthly.toLocaleString()} credits</span>
              </p>
            </div>
          </section>
        )}

        {/* Per-Member Usage */}
        <section>
          <SectionHeader icon={<BarChart3 className="w-4 h-4" />} title="Usage by Member" badge={isOwner ? undefined : 'Owner only'} />
          {isOwner && usage ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {usage.by_member.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No usage recorded this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Calls</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Credits used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usage.by_member.map(m => (
                      <tr key={m.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{m.display_name}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{m.calls.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-mono">{m.credits_used.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-700" colSpan={2}>Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                        {usage.by_member.reduce((s, m) => s + m.credits_used, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">Per-member usage is visible to org owners only.</p>
            </div>
          )}
        </section>

        {/* Roster */}
        <section>
          <SectionHeader icon={<Users className="w-4 h-4" />} title="Team Roster" />
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {members.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No members found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{m.full_name || m.first_name || m.email}</p>
                        <p className="text-gray-400 text-xs">{m.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={m.role} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </PageShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-4">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Building2 className="w-6 h-6 text-blue-600" />
              <span className="text-lg font-bold text-gray-900">JediRe</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-700">Organization Activity</span>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      {badge && (
        <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xl font-semibold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner:     'bg-purple-100 text-purple-700',
    principal: 'bg-blue-100 text-blue-700',
    analyst:   'bg-green-100 text-green-700',
    viewer:    'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  );
}
