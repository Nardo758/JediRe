import React, { useEffect, useState } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

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
        const token = localStorage.getItem('auth_token');
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
      <div className="p-6 mt-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, opacity: 0.5 }}>
        <div className="h-6 mb-4" style={{ background: BT.bg.header, width: '33%' }}></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20" style={{ background: BT.bg.header }}></div>
          <div className="h-20" style={{ background: BT.bg.header }}></div>
          <div className="h-20" style={{ background: BT.bg.header }}></div>
        </div>
      </div>
    );
  }

  if (error || !leaseAnalysis) {
    return (
      <div className="p-6 mt-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <p style={{ color: BT.text.secondary, fontSize: 10, fontFamily: BT.font.mono }}>{error || 'No lease data available'}</p>
      </div>
    );
  }

  const maxTimelineCount = Math.max(...Object.values(leaseAnalysis.expirationTimeline), 1);
  const riskColor = leaseAnalysis.rolloverRiskScore > 40 ? BT.text.red :
    leaseAnalysis.rolloverRiskScore > 20 ? BT.text.amber : BT.text.green;

  return (
    <div className="p-6 mt-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, fontFamily: BT.font.mono }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.display, marginBottom: 16 }}>Lease Rollover Analysis</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div style={{ fontSize: 24, fontWeight: 800, color: BT.text.cyan }}>
            {leaseAnalysis.expiringNext30}
          </div>
          <div style={{ fontSize: 10, color: BT.text.secondary }}>Expiring Next 30 Days</div>
        </div>

        <div className="text-center">
          <div style={{ fontSize: 24, fontWeight: 800, color: BT.text.purple }}>
            {leaseAnalysis.expiringNext90}
          </div>
          <div style={{ fontSize: 10, color: BT.text.secondary }}>Expiring Next 90 Days</div>
        </div>

        <div className="text-center">
          <div style={{ fontSize: 24, fontWeight: 800, color: riskColor }}>
            {leaseAnalysis.rolloverRiskScore}%
          </div>
          <div style={{ fontSize: 10, color: BT.text.secondary }}>Rollover Risk Score</div>
        </div>
      </div>

      {leaseAnalysis.rentGapOpportunity.annualUpside > 0 && (
        <div className="p-4 mb-4" style={{ background: `${BT.text.green}11`, borderLeft: `2px solid ${BT.text.green}` }}>
          <div className="flex items-center">
            <div className="mr-2" style={{ fontSize: 14, color: BT.text.green }}>$</div>
            <div>
              <div style={{ fontWeight: 600, color: BT.text.green, fontSize: 12 }}>
                ${(leaseAnalysis.rentGapOpportunity.annualUpside / 1000).toFixed(0)}K Annual Upside
              </div>
              <div style={{ fontSize: 10, color: BT.text.green }}>
                {leaseAnalysis.rentGapOpportunity.unitsBelow} units below market rate
                (avg ${leaseAnalysis.rentGapOpportunity.monthlyGap} gap/mo)
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: BT.text.secondary, marginBottom: 8 }}>Lease Expirations (Next 12 Months)</div>
      <div className="flex gap-1 h-24 items-end">
        {Object.entries(leaseAnalysis.expirationTimeline).map(([month, count]) => (
          <div key={month} className="flex-1 flex flex-col items-center">
            <div
              className="w-full min-h-[2px]"
              style={{ height: `${(count / maxTimelineCount) * 100}%`, background: BT.text.cyan }}
              title={`${month}: ${count} units`}
            />
            <div className="mt-1" style={{ fontSize: 9, color: BT.text.muted }}>
              {month.slice(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
