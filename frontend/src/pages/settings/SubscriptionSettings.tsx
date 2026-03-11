import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api.client';
import { CreditCard, ExternalLink, AlertTriangle, TrendingUp, Zap, BarChart3 } from 'lucide-react';

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

const TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string; monthlyPrice: number | null }> = {
  scout: { label: 'Scout', color: 'text-gray-700', bgColor: 'bg-gray-100', monthlyPrice: 97 },
  operator: { label: 'Operator', color: 'text-blue-700', bgColor: 'bg-blue-100', monthlyPrice: 197 },
  principal: { label: 'Principal', color: 'text-indigo-700', bgColor: 'bg-indigo-100', monthlyPrice: 267 },
  institutional: { label: 'Institutional', color: 'text-purple-700', bgColor: 'bg-purple-100', monthlyPrice: null },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' },
  trialing: { label: 'Trial', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  past_due: { label: 'Past Due', color: 'text-red-700', bgColor: 'bg-red-100' },
  canceled: { label: 'Canceled', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  incomplete: { label: 'Incomplete', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  none: { label: 'No Plan', color: 'text-gray-500', bgColor: 'bg-gray-50' },
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
            <p className="text-sm text-gray-500 mt-1">Your subscription and billing details</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tierConfig.bgColor}`}>
              <Zap className={`w-6 h-6 ${tierConfig.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className={`text-lg font-semibold ${tierConfig.color}`}>{tierConfig.label}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-lg font-semibold text-gray-900">
              {tierConfig.monthlyPrice !== null ? `$${tierConfig.monthlyPrice}/mo` : 'Custom'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              {cancelAtEnd ? 'Cancels on' : 'Renews on'}
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {renewalDate || 'N/A'}
            </p>
            {cancelAtEnd && (
              <p className="text-xs text-red-500 mt-1">Plan will not renew</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 flex items-center gap-2 text-sm font-medium"
          >
            {portalLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Manage Billing
            <ExternalLink className="w-3 h-3" />
          </button>
          <a
            href="/pricing"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
          >
            Change Plan
          </a>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Credit Usage</h3>

        <div className="mb-2 flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold text-gray-900">{creditsUsed.toLocaleString()}</span>
            <span className="text-gray-500 ml-1">/ {creditsTotal.toLocaleString()} credits</span>
          </div>
          <span className={`text-sm font-medium ${usagePercent >= 90 ? 'text-red-600' : usagePercent >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
            {Math.round(usagePercent)}% used
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>

        {isOverage && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              You've used {overageAmount.toLocaleString()} credits over your plan limit. Overage charges may apply.
            </p>
          </div>
        )}

        {!isOverage && usagePercent >= 80 && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-700">
              You're approaching your credit limit. {creditsRemaining.toLocaleString()} credits remaining.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Credits reset each billing period. Remaining: {creditsRemaining.toLocaleString()}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Usage by Operation</h3>
          <span className="text-sm text-gray-400 ml-auto">Last 30 days</span>
        </div>

        {usage?.usageByOperation && usage.usageByOperation.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Operation</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Calls</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Credits</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Tokens</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-1/3"></th>
                </tr>
              </thead>
              <tbody>
                {usage.usageByOperation.map((op, i) => {
                  const totalCredits = usage.usageByOperation.reduce((sum, o) => sum + parseFloat(o.total_credits || '0'), 0);
                  const opCredits = parseFloat(op.total_credits || '0');
                  const barPercent = totalCredits > 0 ? (opCredits / totalCredits) * 100 : 0;

                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900 capitalize">
                        {op.operation.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-600">
                        {parseInt(op.call_count).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 font-medium">
                        {parseFloat(op.total_credits || '0').toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500">
                        {parseInt(op.total_tokens || '0').toLocaleString()}
                      </td>
                      <td className="py-3 px-2">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${barPercent}%` }}
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
            <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No usage data yet</p>
            <p className="text-gray-400 text-xs mt-1">Usage will appear here as you use AI features</p>
          </div>
        )}
      </div>
    </div>
  );
}
