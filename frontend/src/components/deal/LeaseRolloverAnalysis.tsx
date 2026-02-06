import React, { useEffect, useState } from 'react';

interface LeaseAnalysis {
  totalUnits: number;
  expiringNext30: number;
  expiringNext90: number;
  rolloverRiskScore: number;
  rolloverRiskLevel: 'high' | 'medium' | 'low';
  rentGapOpportunity: {
    unitsBelow: number;
    monthlyGap: number;
    annualUpside: number;
  };
  expirationTimeline: Record<string, number>;
}

interface LeaseRolloverAnalysisProps {
  dealId: string;
}

export default function LeaseRolloverAnalysis({ dealId }: LeaseRolloverAnalysisProps) {
  const [leaseAnalysis, setLeaseAnalysis] = useState<LeaseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/deals/${dealId}/lease-analysis`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setLeaseAnalysis(data.data);
        } else {
          setError(data.error || 'Failed to load lease analysis');
        }
      } catch (err) {
        setError('Failed to load lease analysis');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalysis();
  }, [dealId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !leaseAnalysis) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <p className="text-gray-500 text-sm">{error || 'No lease data available'}</p>
      </div>
    );
  }

  const maxTimelineCount = Math.max(...Object.values(leaseAnalysis.expirationTimeline), 1);

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">Lease Rollover Analysis</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {leaseAnalysis.expiringNext30}
          </div>
          <div className="text-sm text-gray-600">Expiring Next 30 Days</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-purple-600">
            {leaseAnalysis.expiringNext90}
          </div>
          <div className="text-sm text-gray-600">Expiring Next 90 Days</div>
        </div>

        <div className="text-center">
          <div className={`text-3xl font-bold ${
            leaseAnalysis.rolloverRiskScore > 40 ? 'text-red-600' :
            leaseAnalysis.rolloverRiskScore > 20 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {leaseAnalysis.rolloverRiskScore}%
          </div>
          <div className="text-sm text-gray-600">Rollover Risk Score</div>
        </div>
      </div>

      {leaseAnalysis.rentGapOpportunity.annualUpside > 0 && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
          <div className="flex items-center">
            <div className="mr-2 text-lg">$</div>
            <div>
              <div className="font-semibold text-green-900">
                ${(leaseAnalysis.rentGapOpportunity.annualUpside / 1000).toFixed(0)}K Annual Upside
              </div>
              <div className="text-sm text-green-700">
                {leaseAnalysis.rentGapOpportunity.unitsBelow} units below market rate
                (avg ${leaseAnalysis.rentGapOpportunity.monthlyGap} gap/mo)
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600 mb-2">Lease Expirations (Next 12 Months)</div>
      <div className="flex gap-1 h-24 items-end">
        {Object.entries(leaseAnalysis.expirationTimeline).map(([month, count]) => (
          <div key={month} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-500 rounded-t min-h-[2px]"
              style={{ height: `${(count / maxTimelineCount) * 100}%` }}
              title={`${month}: ${count} units`}
            />
            <div className="text-[10px] mt-1 text-gray-500">
              {month.slice(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
