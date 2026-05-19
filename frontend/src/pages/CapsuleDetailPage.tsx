import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Share2, Download, TrendingUp, Building2, 
  DollarSign, AlertTriangle, CheckCircle, Target,
  BarChart3, MessageSquare, Loader2, Activity, ChevronDown, ChevronUp, ArrowRight, Zap,
  X, Copy, ExternalLink, Users2, RotateCcw, ShieldOff, Clock, Plus
} from 'lucide-react';
import { ThreeColumnComparison } from '../components/deal/ThreeColumnComparison';
import { apiClient } from '../services/api.client';
import { useAuthStore } from '../stores/authStore';
import { M11DebtAdvisorTab } from '../components/m35/M11DebtAdvisorTab';
import { M35KeyEventsHub } from '../components/m35/M35KeyEventsHub';

type TabId = 'overview' | 'layers' | 'collision' | 'training' | 'ai-agent' | 'intelligence' | 'debt-advisor' | 'shares';

interface ShareItem {
  share_id: string;
  share_type: 'external_view' | 'external_agent_enabled';
  recipient_email: string;
  recipient_name: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  preview_text: string | null;
  share_status: 'active' | 'revoked' | 'expired';
  access_token_hint?: string;
}

interface CapsuleData {
  id: string;
  property_address: string;
  asset_class: string;
  status: string;
  jedi_score: number | null;
  collision_score: number | null;
  deal_data: Record<string, unknown>;
  platform_intel: Record<string, unknown>;
  user_adjustments: Record<string, unknown>;
  module_outputs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CollisionResult {
  score: number;
  insight: string;
  recommended_action: string;
}

const DEFAULT_LAYER1 = {
  asking_price: 0,
  broker_noi: 0,
  broker_cap_rate: 0,
  broker_occupancy: 0,
  broker_rent_1br: 0,
  broker_rent_2br: 0,
  units: 0,
  year_built: 0,
  broker_name: '',
  broker_claims: {} as Record<string, string>,
};

const DEFAULT_LAYER2 = {
  market_rent_1br: 0,
  market_rent_2br: 0,
  submarket_vacancy: 0,
  market_cap_rate_avg: 0,
  market_occupancy: 0,
  supply_risk_score: 0,
  nearby_developments: 0,
  units_under_construction: 0,
  employment_growth: 0,
  comp_sales: [] as { address: string; price_per_unit: number; cap_rate: number; date: string }[],
};

const DEFAULT_LAYER3 = {
  preferred_hold_period: 0,
  target_irr: 0,
  max_ltv: 0,
  exit_cap_assumption: 0,
  portfolio_buckhead_exposure: 0,
  past_buckhead_acquisitions: 0,
  avg_rent_premium_achieved: 0,
  adjusted_rent_1br: 0,
  adjusted_rent_2br: 0,
  adjusted_occupancy: 0,
  adjusted_noi: null as number | null,
  adjusted_cap_rate: null as number | null,
};

const DEFAULT_COLLISION: Record<string, CollisionResult> = {
  strategy_arbitrage: { score: 0, insight: 'No collision data available.', recommended_action: 'Run full analysis to generate collision scores.' },
  portfolio_fit: { score: 0, insight: 'No collision data available.', recommended_action: 'Run full analysis to generate collision scores.' },
  broker_validation: { score: 0, insight: 'No collision data available.', recommended_action: 'Run full analysis to generate collision scores.' },
  risk_assessment: { score: 0, insight: 'No collision data available.', recommended_action: 'Run full analysis to generate collision scores.' },
  execution_confidence: { score: 0, insight: 'No collision data available.', recommended_action: 'Run full analysis to generate collision scores.' },
};

/* ─── Capsule Intelligence View (M35 graduation) ─── */
const CAPSULE_FEED = [
  { emoji: '📣', headline: 'Amazon HQ2 Confirmed — 25,000 Jobs', source: 'WSJ', age: '3h', sentiment: 'POSITIVE', sentimentColor: '#10B981', eventRef: '#127' },
  { emoji: '📊', headline: '10Y Treasury: 4.82% ↑0.06bps', source: 'Bloomberg', age: '12h', sentiment: 'NEUTRAL', sentimentColor: '#A0ABBE', eventRef: null },
  { emoji: '🏗️', headline: 'Westshore Supply Pipeline: 1,200 New Units by Q4', source: 'CoStar', age: '2d', sentiment: 'NEUTRAL', sentimentColor: '#A0ABBE', eventRef: null },
  { emoji: '📜', headline: 'FL Insurance Reform Advances in Senate', source: 'Sun Sentinel', age: '3d', sentiment: 'POSITIVE', sentimentColor: '#10B981', eventRef: '#203' },
  { emoji: '💰', headline: 'SOFR: 5.31% | Agency Spreads +12bps', source: 'Trepp', age: '4d', sentiment: 'NEUTRAL', sentimentColor: '#A0ABBE', eventRef: null },
];

const CAPSULE_M35_EVENTS = [
  { scope: 'MSA', name: 'Amazon HQ2 Tampa', status: 'FIRED T+8MO', statusColor: '#10B981', tracking: 'AHEAD', trackColor: '#10B981', proximity: '0.74', proxNote: '2.1mi from site', irrImpact: '+1.8pp by Y2', rentImpact: '+1.4pp projected at T+12', leftColor: '#0891B2' },
  { scope: 'Submarket', name: 'Tampa BRT Phase 2', status: 'PENDING T-4MO', statusColor: '#D97706', tracking: null, trackColor: null, proximity: '0.94', proxNote: 'very close', irrImpact: null, rentImpact: '+$85/unit by Y2 via transit proximity', leftColor: '#6B7A8D' },
  { scope: 'State', name: 'FL Insurance Rate Cap', status: 'PENDING T+2MO', statusColor: '#D97706', tracking: null, trackColor: null, proximity: null, proxNote: null, irrImpact: null, rentImpact: null, insuranceNote: '-4% expense vs baseline by Y1', conf: '85%', leftColor: '#6B7A8D' },
];

const CapsuleIntelligenceView: React.FC<{ address?: string }> = ({ address }) => {
  const [feedFilter, setFeedFilter] = useState('All');

  return (
    <div className="w-full min-h-[600px] rounded-lg overflow-hidden font-mono" style={{ background: '#0B0E1A', color: '#E2E8F0' }}>
      <div className="p-5 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          {address && <div className="text-xs" style={{ color: '#6B7A8D' }}>{address}</div>}
          <h2 className="text-xl font-semibold tracking-wide uppercase" style={{ color: '#E2E8F0' }}>Deal & Market Intelligence</h2>
        </div>

        {/* Raw Intelligence Feed */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center">
              <span className="text-[10px] whitespace-nowrap mr-2 tracking-widest uppercase" style={{ color: '#6B7A8D' }}>── Deal & Market Intelligence</span>
              <div className="h-px w-full" style={{ background: '#1E2538' }}></div>
              <span className="text-[10px] whitespace-nowrap ml-2 tracking-widest uppercase px-1.5 py-0.5 rounded" style={{ color: '#0891B2', background: 'rgba(8,145,178,0.1)' }}>M06 Pipeline</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            {['All', 'Macro', 'Local', 'Rates', 'Regulatory'].map((f) => (
              <button
                key={f}
                onClick={() => setFeedFilter(f)}
                className="px-2 py-1 rounded border transition-colors"
                style={{
                  background: feedFilter === f ? '#1E2538' : 'transparent',
                  color: feedFilter === f ? '#E2E8F0' : '#6B7A8D',
                  borderColor: '#1E2538',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex flex-col rounded overflow-hidden border" style={{ borderColor: '#1E2538', background: '#131929' }}>
            {CAPSULE_FEED.map((item, i, arr) => (
              <div
                key={item.headline}
                className="flex items-center justify-between p-2.5 cursor-pointer transition-colors group"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid #1E2538' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-sm" style={{ color: '#E2E8F0' }}>{item.headline}</span>
                  <span className="text-xs" style={{ color: '#6B7A8D' }}>{item.source}</span>
                  <span className="text-xs" style={{ color: '#6B7A8D' }}>{item.age}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-1 rounded border" style={{ color: item.sentimentColor, background: `${item.sentimentColor}1A`, borderColor: `${item.sentimentColor}4D` }}>
                    {item.sentiment}
                  </span>
                  {item.eventRef && (
                    <span className="text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0891B2' }}>
                      → EVENT {item.eventRef}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* M35 Key Events Hub — This Deal */}
        <section>
          <M35KeyEventsHub variant="capsule" />
        </section>

        {/* F6 M07 Traffic Predictions + M35 Event Overlays */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center">
              <span className="text-[10px] whitespace-nowrap mr-2 tracking-widest uppercase" style={{ color: '#6B7A8D' }}>── M07 Traffic Predictions</span>
              <div className="h-px w-full" style={{ background: '#1E2538' }}></div>
              <span className="text-[10px] whitespace-nowrap ml-2 tracking-widest uppercase px-1.5 py-0.5 rounded" style={{ color: '#0891B2', background: 'rgba(8,145,178,0.1)' }}>M35 Event Overlays</span>
            </div>
          </div>

          {/* Traffic chart with event pins */}
          <div className="rounded border p-4" style={{ background: '#131929', borderColor: '#1E2538' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: '#E2E8F0' }}>Westshore Search Momentum — W/W Index</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded border" style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }}>+18% vs baseline</span>
                <span className="text-[10px]" style={{ color: '#6B7A8D' }}>4wk avg</span>
              </div>
            </div>
            <div className="relative" style={{ height: 80 }}>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                {/* Baseline zone */}
                <path d="M0,55 L60,53 L90,52 L120,54 L150,53 L180,52 L300,52 L300,70 L0,70 Z" fill="#1E2538" fillOpacity="0.5" />
                {/* Actual trace */}
                <polyline points="0,55 30,52 60,48 90,44 110,36 130,28 160,22 190,18 220,15 260,12 300,10" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" />
                {/* Event 1 — Amazon HQ2 */}
                <line x1="110" y1="10" x2="110" y2="80" stroke="#0891B2" strokeWidth="1" strokeDasharray="2,2" />
                <circle cx="110" cy="36" r="3" fill="#0891B2" />
                <text x="112" y="26" fontSize="7" fill="#0891B2">📣 HQ2</text>
                {/* Event 2 — BRT announcement */}
                <line x1="180" y1="10" x2="180" y2="80" stroke="#D97706" strokeWidth="1" strokeDasharray="2,2" />
                <circle cx="180" cy="18" r="3" fill="#D97706" />
                <text x="182" y="14" fontSize="7" fill="#D97706">🚆 BRT</text>
              </svg>
            </div>
            <div className="flex justify-between text-[9px] mt-1" style={{ color: '#6B7A8D', fontFamily: 'monospace' }}>
              {['W-16', 'W-12', 'W-8', 'W-4', 'Now'].map(w => <span key={w}>{w}</span>)}
            </div>
          </div>

          {/* Event contribution table */}
          <div className="rounded border overflow-hidden" style={{ borderColor: '#1E2538' }}>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ background: '#0d111e', color: '#6B7A8D', borderBottom: '1px solid #1E2538' }}>
              M35 Event Contribution Breakdown
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#0B0E1A', color: '#6B7A8D' }}>
                  {['Event', 'Scope', 'Traffic Lift', 'Confidence', 'Calibration'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-mono text-[10px] font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'monospace' }}>
                {[
                  { name: 'Amazon HQ2 Tampa', scope: 'MSA', lift: '+18%', conf: '87%', cal: 'CALIBRATED', calColor: '#10B981' },
                  { name: 'Tampa BRT Phase 2', scope: 'Submarket', lift: '+7%', conf: '63%', cal: 'PENDING', calColor: '#D97706' },
                  { name: 'FL Insurance Reform', scope: 'State', lift: '+2%', conf: '71%', cal: 'CALIBRATED', calColor: '#10B981' },
                ].map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #1E2538', background: i % 2 === 0 ? '#0f1520' : 'transparent' }}>
                    <td className="px-3 py-2" style={{ color: '#E2E8F0' }}>{r.name}</td>
                    <td className="px-3 py-2" style={{ color: r.scope === 'MSA' ? '#6B7280' : r.scope === 'Submarket' ? '#0891B2' : '#D97706' }}>{r.scope}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: '#10B981' }}>{r.lift}</td>
                    <td className="px-3 py-2" style={{ color: '#A0ABBE' }}>{r.conf}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded border text-[9px] font-semibold" style={{ color: r.calColor, background: `${r.calColor}1A`, borderColor: `${r.calColor}4D` }}>{r.cal}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6B7A8D' }}>
            <CheckCircle className="w-3 h-3" style={{ color: '#10B981' }} />
            <span>Playbook: <span style={{ color: '#E2E8F0' }}>MF Value-Add › Employment Anchor</span> — 3 historical analogs · median +22% traffic lift at T+6</span>
          </div>
        </section>
      </div>
    </div>
  );
};

const CapsuleDetailPage: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('dealId');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [capsule, setCapsule] = useState<CapsuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({
    recipient_email: '',
    recipient_name: '',
    share_type: 'external_agent_enabled' as 'external_view' | 'external_agent_enabled',
    preview_text: '',
    expires_at: '',
  });
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<{
    capsule_url: string;
    access_token: string;
    recipient_email: string;
    share_type: string;
    share_id: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Shares management state (#901)
  const [shares, setShares] = useState<ShareItem[] | null>(null);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [revokeLoadingId, setRevokeLoadingId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    if (!id) return;
    setSharesLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/capsules-ext/${id}/shares`);
      setShares(res.data.shares ?? []);
    } catch {
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  }, [id]);

  const revokeShare = useCallback(async (shareId: string) => {
    if (!id) return;
    setRevokeLoadingId(shareId);
    try {
      await apiClient.post(`/api/v1/capsules-ext/${id}/shares/${shareId}/revoke`);
      setShares(prev =>
        prev?.map(s =>
          s.share_id === shareId
            ? { ...s, share_status: 'revoked' as const, revoked_at: new Date().toISOString() }
            : s
        ) ?? null
      );
    } catch (err: any) {
      console.error('Failed to revoke share:', err.response?.data?.error ?? err.message);
    } finally {
      setRevokeLoadingId(null);
    }
  }, [id]);

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capsule || !id) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const payload: Record<string, unknown> = {
        recipient_email: shareForm.recipient_email,
        share_type: shareForm.share_type,
      };
      if (shareForm.recipient_name.trim()) payload.recipient_name = shareForm.recipient_name.trim();
      if (shareForm.preview_text.trim()) payload.preview_text = shareForm.preview_text.trim();
      if (shareForm.expires_at) payload.expires_at = shareForm.expires_at;
      const res = await apiClient.post(`/api/v1/deals/${id}/share/external`, payload);
      setShareResult(res.data);
    } catch (err: any) {
      setShareError(err.response?.data?.error ?? err.message ?? 'Failed to create share');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.capsule_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setShareResult(null);
    setShareError(null);
    setShareForm({ recipient_email: '', recipient_name: '', share_type: 'external_agent_enabled', preview_text: '', expires_at: '' });
  };

  // Load shares when Shares tab becomes active
  useEffect(() => {
    if (activeTab === 'shares' && shares === null) {
      loadShares();
    }
  }, [activeTab, shares, loadShares]);

  useEffect(() => {
    if (!id) return;
    const userId = (user?.id as string) || 'demo-user';
    setLoading(true);

    const loadCapsule = dealId
      ? apiClient.get(`/api/v1/deals/${dealId}/capsule`, { params: { user_id: userId } })
      : apiClient.get(`/api/v1/capsules/${id}`, { params: { user_id: userId } });

    loadCapsule
      .then((res) => {
        const data = res.data;
        // Bridge endpoint returns { capsule, proforma, summary }
        setCapsule(data.capsule || data);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load capsule:', err);
        setError(err.response?.status === 404 ? 'Capsule not found' : 'Failed to load capsule');
      })
      .finally(() => setLoading(false));
  }, [id, dealId, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading capsule...</span>
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <p className="text-gray-700 text-lg">{error || 'Capsule not found'}</p>
        <button onClick={() => navigate('/capsules')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Back to Capsules
        </button>
      </div>
    );
  }

  const layer1 = { ...DEFAULT_LAYER1, ...(capsule.deal_data || {}) };
  const layer2 = { ...DEFAULT_LAYER2, ...(capsule.platform_intel || {}) };
  const layer3 = { ...DEFAULT_LAYER3, ...(capsule.user_adjustments || {}) };

  const rawCollision = (
    (capsule.module_outputs as Record<string, unknown>)?.collision_analysis ??
    (capsule.module_outputs as Record<string, unknown>)?.collision ??
    (capsule.deal_data as Record<string, unknown>)?.collision_results ??
    (capsule.platform_intel as Record<string, unknown>)?.collision_results
  ) as { overall_score?: number; analyses?: Record<string, CollisionResult> } | Record<string, CollisionResult> | undefined;

  const collisionAnalyses: Record<string, CollisionResult> =
    rawCollision && 'analyses' in rawCollision && rawCollision.analyses
      ? rawCollision.analyses
      : (rawCollision as Record<string, CollisionResult>) ?? {};

  const collision = { ...DEFAULT_COLLISION, ...collisionAnalyses };
  const overallScore =
    capsule.collision_score ??
    (rawCollision && 'overall_score' in rawCollision ? (rawCollision.overall_score ?? 0) : null) ??
    (Object.keys(collisionAnalyses).length > 0
      ? Math.round(Object.values(collisionAnalyses).reduce((sum, c) => sum + (c?.score || 0), 0) / Object.keys(collisionAnalyses).length)
      : 0);

  const jediScore = capsule.jedi_score || (capsule.deal_data as Record<string, unknown>)?.jedi_score as number || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/capsules')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Capsules
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{capsule.property_address}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {capsule.asset_class || 'N/A'} {layer1.units ? `• ${layer1.units} Units` : ''}
                </span>
                {layer1.year_built ? (
                  <>
                    <span>•</span>
                    <span>Built {layer1.year_built}</span>
                  </>
                ) : null}
                {layer1.asking_price ? (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      ${(layer1.asking_price / 1000000).toFixed(1)}M
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="text-right">
              {jediScore > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold mb-2">
                  <TrendingUp className="w-5 h-5" />
                  JEDI Score: {jediScore}
                </div>
              )}
              {overallScore > 0 && (
                <div className="text-sm text-gray-600">Collision Score: {overallScore}/100</div>
              )}
            </div>
          </div>

          <div className="flex gap-6 mt-6 border-b border-gray-200">
            {([
              { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
              { id: 'layers' as const, label: 'Three Layers', icon: Target },
              { id: 'collision' as const, label: 'Collision Analysis', icon: AlertTriangle },
              { id: 'training' as const, label: 'Training', icon: Target },
              { id: 'ai-agent' as const, label: 'AI Agent', icon: MessageSquare },
              { id: 'intelligence' as const, label: 'Intelligence', icon: Activity },
              { id: 'debt-advisor' as const, label: 'M11 Advisor', icon: Zap },
              { id: 'shares' as const, label: 'Shares', icon: Users2 },
            ] satisfies { id: TabId; label: string; icon: typeof BarChart3 }[]).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Deal Analysis: Broker vs Market vs Your Model</h2>
                <p className="text-sm text-gray-600">
                  Compare broker claims with market reality. Adjust assumptions to build your pro forma.
                </p>
              </div>
              
              <ThreeColumnComparison
                rows={[
                  {
                    label: 'Rent (1BR)',
                    broker: layer1.broker_rent_1br,
                    market: layer2.market_rent_1br,
                    user: layer3.adjusted_rent_1br || undefined,
                    format: 'currency',
                    editable: true
                  },
                  {
                    label: 'Rent (2BR)',
                    broker: layer1.broker_rent_2br,
                    market: layer2.market_rent_2br,
                    user: layer3.adjusted_rent_2br || undefined,
                    format: 'currency',
                    editable: true
                  },
                  {
                    label: 'Occupancy',
                    broker: layer1.broker_occupancy,
                    market: layer2.submarket_vacancy ? 100 - layer2.submarket_vacancy : 0,
                    user: layer3.adjusted_occupancy || undefined,
                    format: 'percent',
                    editable: true
                  },
                  {
                    label: 'NOI',
                    broker: layer1.broker_noi,
                    market: layer1.broker_noi ? layer1.broker_noi * 0.97 : 0,
                    user: layer3.adjusted_noi || undefined,
                    format: 'currency',
                    editable: false
                  },
                  {
                    label: 'Cap Rate',
                    broker: layer1.broker_cap_rate,
                    market: layer2.market_cap_rate_avg || layer1.broker_cap_rate || 0,
                    user: layer3.adjusted_cap_rate || layer1.broker_cap_rate || undefined,
                    format: 'percent',
                    editable: true
                  }
                ]}
                onUserEdit={(label, value) => {
                  console.log('User editing:', label, value);
                }}
              />

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Collision Analysis Highlights</h2>
                <div className="space-y-4">
                  {Object.entries(collision).map(([key, data]) => {
                    if (!data || typeof data !== 'object') return null;
                    const isGood = data.score >= 80;
                    return (
                      <div key={key} className="flex items-start gap-3">
                        {isGood ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                            <div className={`text-sm font-semibold ${isGood ? 'text-green-600' : 'text-yellow-600'}`}>
                              {data.score}/100
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">{data.insight}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold mb-4">Broker Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-600 mb-1">Broker</div>
                    <div className="font-medium">{layer1.broker_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Status</div>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {capsule.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Created</div>
                    <div>{new Date(capsule.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Run Full Analysis
                  </button>
                  <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    View Comps
                  </button>
                  <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Export to Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'layers' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Three-Layer Intelligence System</h3>
              <p className="text-sm text-blue-700 mb-3">
                Deal data is preserved as-is. Platform provides reality check. You decide final assumptions.
              </p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="bg-white rounded p-2">
                  <div className="font-semibold text-blue-900 mb-1">Layer 1: Truth</div>
                  <div className="text-blue-700">Broker's claims (never changed)</div>
                </div>
                <div className="bg-white rounded p-2">
                  <div className="font-semibold text-purple-900 mb-1">Layer 2: Reality Check</div>
                  <div className="text-purple-700">Market data (comparison only)</div>
                </div>
                <div className="bg-white rounded p-2">
                  <div className="font-semibold text-green-900 mb-1">Layer 3: Your Model</div>
                  <div className="text-green-700">Your assumptions (pro forma)</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Layer 1: Deal Data (Preserved)</h3>
                  <p className="text-sm text-gray-600">Original broker claims - never modified by platform</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Asking Price</div>
                  <div className="font-semibold">{layer1.asking_price ? `$${(layer1.asking_price / 1000000).toFixed(1)}M` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">NOI</div>
                  <div className="font-semibold">{layer1.broker_noi ? `$${(layer1.broker_noi / 1000000).toFixed(1)}M` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Cap Rate</div>
                  <div className="font-semibold">{layer1.broker_cap_rate ? `${layer1.broker_cap_rate}%` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Occupancy</div>
                  <div className="font-semibold">{layer1.broker_occupancy ? `${layer1.broker_occupancy}%` : 'N/A'}</div>
                </div>
              </div>
              {layer1.broker_claims && Object.keys(layer1.broker_claims).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-2">Broker Claims:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(layer1.broker_claims).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}: </span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border-2 border-purple-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Layer 2: Platform Intelligence (Reality Check)</h3>
                  <p className="text-sm text-gray-600">Market data for comparison - does not override deal data</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Market Rent (1BR)</div>
                  <div className="font-semibold">{layer2.market_rent_1br ? `$${layer2.market_rent_1br}` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Submarket Vacancy</div>
                  <div className="font-semibold">{layer2.submarket_vacancy ? `${layer2.submarket_vacancy}%` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Supply Risk</div>
                  <div className="font-semibold">{layer2.supply_risk_score ? `${layer2.supply_risk_score}/100` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Employment Growth</div>
                  <div className="font-semibold text-green-600">{layer2.employment_growth ? `+${layer2.employment_growth}%` : 'N/A'}</div>
                </div>
              </div>
              {layer2.comp_sales && layer2.comp_sales.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-2">Recent Comps:</div>
                  <div className="space-y-2 text-sm">
                    {layer2.comp_sales.map((comp: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-gray-600">{comp.address}</span>
                        <span className="font-medium">${(comp.price_per_unit / 1000).toFixed(0)}K/unit @ {comp.cap_rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border-2 border-green-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Layer 3: Your Model (Pro Forma Input)</h3>
                  <p className="text-sm text-gray-600">Your adjusted assumptions - used in financial models</p>
                </div>
              </div>
              
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Your Adjusted Assumptions:</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">1BR Rent: </span>
                    <span className="font-semibold text-green-700">{layer3.adjusted_rent_1br ? `$${layer3.adjusted_rent_1br}` : 'Not set'}</span>
                    {layer1.broker_rent_1br > 0 && <span className="text-gray-500 ml-1">(vs broker ${layer1.broker_rent_1br})</span>}
                  </div>
                  <div>
                    <span className="text-gray-600">2BR Rent: </span>
                    <span className="font-semibold text-green-700">{layer3.adjusted_rent_2br ? `$${layer3.adjusted_rent_2br}` : 'Not set'}</span>
                    {layer1.broker_rent_2br > 0 && <span className="text-gray-500 ml-1">(vs broker ${layer1.broker_rent_2br})</span>}
                  </div>
                  <div>
                    <span className="text-gray-600">Occupancy: </span>
                    <span className="font-semibold text-green-700">{layer3.adjusted_occupancy ? `${layer3.adjusted_occupancy}%` : 'Not set'}</span>
                    {layer1.broker_occupancy > 0 && <span className="text-gray-500 ml-1">(vs broker {layer1.broker_occupancy}%)</span>}
                  </div>
                </div>
              </div>
              
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Your Investment Criteria:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Target IRR</div>
                    <div className="font-semibold">{layer3.target_irr ? `${layer3.target_irr}%` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Hold Period</div>
                    <div className="font-semibold">{layer3.preferred_hold_period ? `${layer3.preferred_hold_period} years` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Exit Cap</div>
                    <div className="font-semibold">{layer3.exit_cap_assumption ? `${layer3.exit_cap_assumption}%` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Max LTV</div>
                    <div className="font-semibold">{layer3.max_ltv ? `${layer3.max_ltv}%` : 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Portfolio Context:</div>
                <div className="text-sm space-y-1">
                  {layer3.portfolio_buckhead_exposure > 0 && (
                    <div>
                      <span className="text-gray-600">Geographic Exposure: </span>
                      <span className="font-semibold text-yellow-600">{layer3.portfolio_buckhead_exposure}%</span>
                    </div>
                  )}
                  {layer3.avg_rent_premium_achieved > 0 && (
                    <div>
                      <span className="text-gray-600">Your Historical Rent Premium: </span>
                      <span className="font-medium">${layer3.avg_rent_premium_achieved}/unit</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'collision' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-gray-900">Collision Analysis</h2>
                <div className="text-3xl font-bold text-blue-600">{overallScore}/100</div>
              </div>
              <p className="text-gray-700">
                Your personalized analysis based on the intersection of property data, market intelligence, and your specific investment criteria.
              </p>
            </div>

            {Object.entries(collision).map(([key, data]) => {
              if (!data || typeof data !== 'object') return null;
              const colors = {
                high: 'bg-green-50 border-green-200',
                medium: 'bg-yellow-50 border-yellow-200',
                low: 'bg-red-50 border-red-200'
              };
              const level = data.score >= 80 ? 'high' : data.score >= 60 ? 'medium' : 'low';
              
              return (
                <div key={key} className={`bg-white rounded-lg border-2 p-6 ${colors[level]}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold capitalize">{key.replace(/_/g, ' ')}</h3>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-gray-900">{data.score}</div>
                      <div className="text-sm text-gray-600">/100</div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Analysis:</div>
                    <p className="text-gray-700">{data.insight}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-1">Recommended Action:</div>
                    <p className="text-gray-900 font-medium">{data.recommended_action}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'training' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Trained Modules Active</h2>
              <p className="text-gray-700">
                Your modules have been trained on your past deals and are suggesting adjustments based on YOUR style and historical accuracy.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    $
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Financial Module</h3>
                    <div className="text-sm text-blue-600">Pattern + Calibration</div>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Pattern Training:</div>
                    <div className="text-gray-600">Trained on past deals</div>
                    <div className="text-gray-600">Your style: Conservative</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Calibration:</div>
                    <div className="text-gray-600">Active (tracked properties)</div>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="font-medium text-blue-700">Confidence: High</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border-2 border-green-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                    T
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Traffic Engine</h3>
                    <div className="text-sm text-green-600">Calibration Only</div>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Pattern Training:</div>
                    <div className="text-gray-600">N/A (calibration-based)</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Calibration:</div>
                    <div className="text-gray-600">Active (tracked properties)</div>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="font-medium text-green-700">Confidence: Medium</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border-2 border-orange-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
                    D
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Development</h3>
                    <div className="text-sm text-orange-600">Pattern + Calibration</div>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Pattern Training:</div>
                    <div className="text-gray-600">Trained on past projects</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Calibration:</div>
                    <div className="text-gray-600">Active (tracked projects)</div>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="font-medium text-orange-700">Confidence: Medium</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Manage Training Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="px-6 py-3 border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                  Upload More Training Data
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  View Accuracy Reports
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Retrain Modules
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai-agent' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">AI Agent Chat</h3>
              <p className="text-gray-600 mb-6">
                Chat with Financial, Development, or Redevelopment agents for deal analysis
              </p>
              <div className="flex gap-4 justify-center">
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Financial Analysis
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Development Planning
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Redevelopment Strategy
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'intelligence' && (
          <CapsuleIntelligenceView address={capsule?.property_address} />
        )}

        {activeTab === 'debt-advisor' && (
          <div>
            <div className="mb-4 px-1">
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#E2E8F0' }}>M11 Debt Advisor</h2>
              <p className="text-sm" style={{ color: '#6B7A8D' }}>AI-optimized debt structure driven by M08 strategy detection. Bridge-to-perm plan with DSCR recovery timeline.</p>
            </div>
            <M11DebtAdvisorTab />
          </div>
        )}

        {/* ── Shares management tab (#901) ──────────────────────────────── */}
        {activeTab === 'shares' && (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">External Shares</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Frozen snapshots — recipients see the deal as it was at share creation time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadShares}
                  disabled={sharesLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${sharesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Share
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {sharesLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading shares...
                </div>
              ) : !shares || shares.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users2 className="w-10 h-10 text-gray-300" />
                  <p className="text-gray-500 text-sm font-medium">No shares yet</p>
                  <p className="text-gray-400 text-xs">Create a share link to give external parties access to a frozen snapshot of this capsule.</p>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Share
                  </button>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Recipient', 'Type', 'Status', 'Created', 'Expires', 'Actions'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {shares.map(share => {
                        const isActive = share.share_status === 'active';
                        const isRevoked = share.share_status === 'revoked';
                        const created = new Date(share.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const expires = share.expires_at
                          ? new Date(share.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No expiry';
                        const isExpiringSoon = share.expires_at && isActive &&
                          new Date(share.expires_at).getTime() - Date.now() < 7 * 86_400_000;

                        return (
                          <tr key={share.share_id} className={`transition-colors ${isRevoked ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                            <td className="px-5 py-4">
                              <div className="font-medium text-gray-900">{share.recipient_email}</div>
                              {share.recipient_name && (
                                <div className="text-xs text-gray-500 mt-0.5">{share.recipient_name}</div>
                              )}
                              {share.preview_text && (
                                <div className="text-xs text-gray-400 mt-1 truncate max-w-xs italic">"{share.preview_text.slice(0, 60)}{share.preview_text.length > 60 ? '…' : ''}"</div>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                share.share_type === 'external_agent_enabled'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                                {share.share_type === 'external_agent_enabled' ? '⚡ Agent Enabled' : '👁 View Only'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                  Active
                                </span>
                              )}
                              {isRevoked && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                  <ShieldOff className="w-3 h-3" />
                                  Revoked
                                </span>
                              )}
                              {share.share_status === 'expired' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
                                  <Clock className="w-3 h-3" />
                                  Expired
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-gray-500 tabular-nums">{created}</td>
                            <td className="px-5 py-4">
                              <span className={`tabular-nums ${isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                                {expires}
                                {isExpiringSoon && <span className="ml-1 text-xs text-amber-500">soon</span>}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {isActive && (
                                  <button
                                    onClick={() => revokeShare(share.share_id)}
                                    disabled={revokeLoadingId === share.share_id}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                                  >
                                    {revokeLoadingId === share.share_id
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <ShieldOff className="w-3 h-3" />
                                    }
                                    Revoke
                                  </button>
                                )}
                                {isRevoked && (
                                  <span className="text-xs text-gray-400">
                                    Revoked {share.revoked_at ? new Date(share.revoked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Footer stats */}
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
                    <span>{shares.filter(s => s.share_status === 'active').length} active</span>
                    <span>{shares.filter(s => s.share_status === 'revoked').length} revoked</span>
                    <span>{shares.filter(s => s.share_type === 'external_agent_enabled').length} agent-enabled</span>
                    <span className="ml-auto text-gray-400">Recipients see a frozen snapshot — your changes after share creation are not visible to them.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Share Modal ──────────────────────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Share Capsule</h2>
                <p className="text-sm text-gray-500 mt-0.5">{capsule?.property_address}</p>
              </div>
              <button onClick={closeShareModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {shareResult ? (
              <div className="px-6 py-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">Share created — send this link to {shareResult.recipient_email}</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Capsule Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareResult.capsule_url}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 font-mono"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Share Type</div>
                    <div className="font-medium text-gray-700">
                      {shareResult.share_type === 'external_agent_enabled' ? 'Agent Enabled' : 'View Only'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Share ID</div>
                    <div className="font-mono text-xs text-gray-600 truncate">{shareResult.share_id}</div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={closeShareModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => setShareResult(null)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Again
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleShareSubmit} className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={shareForm.recipient_email}
                    onChange={e => setShareForm(f => ({ ...f, recipient_email: e.target.value }))}
                    placeholder="investor@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={shareForm.recipient_name}
                    onChange={e => setShareForm(f => ({ ...f, recipient_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Share Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'external_agent_enabled', label: 'Agent Enabled', desc: 'Recipient can query AI with their own API key' },
                      { value: 'external_view', label: 'View Only', desc: 'Read-only access, no agent interaction' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${shareForm.share_type === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <input
                          type="radio"
                          name="share_type"
                          value={opt.value}
                          checked={shareForm.share_type === opt.value}
                          onChange={() => setShareForm(f => ({ ...f, share_type: opt.value as typeof f.share_type }))}
                          className="sr-only"
                        />
                        <span className={`text-sm font-medium ${shareForm.share_type === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                        <span className={`text-xs leading-snug ${shareForm.share_type === opt.value ? 'text-blue-600' : 'text-gray-400'}`}>{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preview Pitch <span className="text-gray-400 font-normal">(optional, max 500 chars)</span>
                  </label>
                  <textarea
                    value={shareForm.preview_text}
                    onChange={e => setShareForm(f => ({ ...f, preview_text: e.target.value.slice(0, 500) }))}
                    placeholder="Short note to the recipient about this deal…"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="text-xs text-gray-400 text-right mt-0.5">{shareForm.preview_text.length}/500</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires On <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={shareForm.expires_at}
                    onChange={e => setShareForm(f => ({ ...f, expires_at: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {shareError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {shareError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeShareModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={shareLoading || !shareForm.recipient_email}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {shareLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    ) : (
                      <><ExternalLink className="w-4 h-4" /> Create Share Link</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CapsuleDetailPage;
