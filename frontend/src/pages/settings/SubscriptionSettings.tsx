import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api.client';
import { CreditCard, ExternalLink, AlertTriangle, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

interface SubscriptionData {
  tier: string;
  status: string;
  creditsIncludedMonthly: number;
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscription: {
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    cancelAtPeriodEnd: boolean;
    cancelAt: string | null;
  } | null;
}

interface UsageByOperation {
  operation: string;
  call_count: string;
  total_credits: string;
  total_tokens: string;
}

interface UsageData {
  balance: {
    tier: string;
    creditsIncludedMonthly: number;
    creditsRemaining: number;
    creditsUsedThisPeriod: number;
    periodStart: string | null;
    periodEnd: string | null;
  } | null;
  usageByOperation: UsageByOperation[];
  recentUsage: any[];
}

const TIER_CONFIG: Record<string, { label: string; color: string; monthlyPrice: number | null }> = {
  scout: { label: 'Scout', color: BT.text.secondary, monthlyPrice: 97 },
  operator: { label: 'Operator', color: BT.text.cyan, monthlyPrice: 197 },
  principal: { label: 'Principal', color: BT.text.amber, monthlyPrice: 267 },
  institutional: { label: 'Institutional', color: BT.text.purple, monthlyPrice: null },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: BT.text.green },
  trialing: { label: 'Trial', color: BT.text.cyan },
  past_due: { label: 'Past Due', color: BT.text.red },
  canceled: { label: 'Canceled', color: BT.text.secondary },
  incomplete: { label: 'Incomplete', color: BT.text.amber },
  none: { label: 'No Plan', color: BT.text.muted },
};

export function SubscriptionSettings() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, usageRes] = await Promise.all([
        apiClient.get('/api/v1/billing/subscription'),
        apiClient.get('/api/v1/billing/usage'),
      ]);
      setSubscription(subRes.data.data);
      setUsage(usageRes.data.data);
    } catch (err: any) {
      console.error('Failed to load billing data:', err);
      setError('Failed to load billing data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await apiClient.post('/api/v1/billing/create-portal-session');
      if (res.data.portalUrl) {
        window.open(res.data.portalUrl, '_blank');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to open billing portal';
      alert(msg);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8" style={{ border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: BT.text.red }} />
          <p className="mb-4" style={{ color: BT.text.red }}>{error}</p>
          <button onClick={loadData} className="px-4 py-2 text-sm" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tier = subscription?.tier || 'scout';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.scout;
  const statusKey = subscription?.status || 'none';
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.none;

  const creditsUsed = subscription?.creditsUsedThisPeriod || 0;
  const creditsTotal = subscription?.creditsIncludedMonthly || 100;
  const creditsRemaining = subscription?.creditsRemaining ?? creditsTotal;
  const usagePercent = creditsTotal > 0 ? Math.min((creditsUsed / creditsTotal) * 100, 100) : 0;
  const isOverage = creditsUsed > creditsTotal;
  const overageAmount = isOverage ? creditsUsed - creditsTotal : 0;

  const periodEnd = subscription?.periodEnd || subscription?.stripeSubscription?.currentPeriodEnd;
  const renewalDate = periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const cancelAtEnd = subscription?.cancelAtPeriodEnd || false;

  const usageBarColor = usagePercent >= 90 ? BT.text.red : usagePercent >= 70 ? BT.text.amber : BT.text.cyan;

  return (
    <div className="space-y-6" style={{ fontFamily: BT.font.label }}>
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: BT.text.primary }}>Current Plan</h2>
            <p className="text-sm mt-1" style={{ color: BT.text.muted }}>Your subscription and billing details</p>
          </div>
          <span className="px-3 py-1 text-sm font-medium" style={{ background: BT.bg.panelAlt, color: statusConfig.color, borderRadius: 2 }}>
            {statusConfig.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 2 }}>
              <Zap className="w-6 h-6" style={{ color: tierConfig.color }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: BT.text.muted }}>Plan</p>
              <p className="text-lg font-semibold" style={{ color: tierConfig.color }}>{tierConfig.label}</p>
            </div>
          </div>

          <div>
            <p className="text-sm" style={{ color: BT.text.muted }}>Price</p>
            <p className="text-lg font-semibold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
              {tierConfig.monthlyPrice !== null ? `$${tierConfig.monthlyPrice}/mo` : 'Custom'}
            </p>
          </div>

          <div>
            <p className="text-sm" style={{ color: BT.text.muted }}>
              {cancelAtEnd ? 'Cancels on' : 'Renews on'}
            </p>
            <p className="text-lg font-semibold" style={{ color: BT.text.primary }}>
              {renewalDate || 'N/A'}
            </p>
            {cancelAtEnd && (
              <p className="text-xs mt-1" style={{ color: BT.text.red }}>Plan will not renew</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="px-4 py-2 flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            style={{ background: BT.text.primary, color: BT.bg.terminal, borderRadius: 0 }}
          >
            {portalLoading ? (
              <div className="h-4 w-4" style={{ border: `2px solid transparent`, borderBottom: `2px solid ${BT.bg.terminal}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Manage Billing
            <ExternalLink className="w-3 h-3" />
          </button>
          <a
            href="/pricing"
            className="px-4 py-2 flex items-center gap-2 text-sm font-medium"
            style={{ border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, borderRadius: 0 }}
          >
            Change Plan
          </a>
        </div>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: BT.text.primary }}>Credit Usage</h3>

        <div className="mb-2 flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{creditsUsed.toLocaleString()}</span>
            <span className="ml-1" style={{ color: BT.text.muted }}>/ {creditsTotal.toLocaleString()} credits</span>
          </div>
          <span className="text-sm font-medium" style={{ color: usageBarColor, fontFamily: BT.font.mono }}>
            {Math.round(usagePercent)}% used
          </span>
        </div>

        <div className="w-full h-3 overflow-hidden" style={{ background: BT.bg.input, borderRadius: 0 }}>
          <div
            className="h-3 transition-all duration-500"
            style={{ width: `${Math.min(usagePercent, 100)}%`, background: usageBarColor, borderRadius: 0 }}
          />
        </div>

        {isOverage && (
          <div className="mt-3 flex items-center gap-2 p-3" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: BT.text.red }} />
            <p className="text-sm" style={{ color: BT.text.red }}>
              You've used {overageAmount.toLocaleString()} credits over your plan limit. Overage charges may apply.
            </p>
          </div>
        )}

        {!isOverage && usagePercent >= 80 && (
          <div className="mt-3 flex items-center gap-2 p-3" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.amber}`, borderRadius: 0 }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: BT.text.amber }} />
            <p className="text-sm" style={{ color: BT.text.amber }}>
              You're approaching your credit limit. {creditsRemaining.toLocaleString()} credits remaining.
            </p>
          </div>
        )}

        <p className="text-xs mt-3" style={{ color: BT.text.muted }}>
          Credits reset each billing period. Remaining: {creditsRemaining.toLocaleString()}
        </p>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5" style={{ color: BT.text.muted }} />
          <h3 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Usage by Operation</h3>
          <span className="text-sm ml-auto" style={{ color: BT.text.muted }}>Last 30 days</span>
        </div>

        {usage?.usageByOperation && usage.usageByOperation.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th className="text-left py-3 px-2 font-medium" style={{ color: BT.text.muted }}>Operation</th>
                  <th className="text-right py-3 px-2 font-medium" style={{ color: BT.text.muted }}>Calls</th>
                  <th className="text-right py-3 px-2 font-medium" style={{ color: BT.text.muted }}>Credits</th>
                  <th className="text-right py-3 px-2 font-medium" style={{ color: BT.text.muted }}>Tokens</th>
                  <th className="text-left py-3 px-2 font-medium w-1/3" style={{ color: BT.text.muted }}></th>
                </tr>
              </thead>
              <tbody>
                {usage.usageByOperation.map((op, i) => {
                  const totalCredits = usage.usageByOperation.reduce((sum, o) => sum + parseFloat(o.total_credits || '0'), 0);
                  const opCredits = parseFloat(op.total_credits || '0');
                  const barPercent = totalCredits > 0 ? (opCredits / totalCredits) * 100 : 0;

                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td className="py-3 px-2 font-medium capitalize" style={{ color: BT.text.primary }}>
                        {op.operation.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-2 text-right" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>
                        {parseInt(op.call_count || '0').toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {parseFloat(op.total_credits || '0').toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-3 px-2 text-right" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>
                        {parseInt(op.total_tokens || '0').toLocaleString()}
                      </td>
                      <td className="py-3 px-2">
                        <div className="w-full h-2" style={{ background: BT.bg.input, borderRadius: 0 }}>
                          <div
                            className="h-2"
                            style={{ width: `${barPercent}%`, background: BT.text.cyan, borderRadius: 0 }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: BT.text.muted }} />
            <p className="text-sm" style={{ color: BT.text.muted }}>No usage data yet</p>
            <p className="text-xs mt-1" style={{ color: BT.text.muted }}>Usage will appear here as you use AI features</p>
          </div>
        )}
      </div>
    </div>
  );
}
