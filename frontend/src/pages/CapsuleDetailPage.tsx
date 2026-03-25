import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Share2, Download, TrendingUp, Building2, 
  DollarSign, AlertTriangle, CheckCircle, Target,
  BarChart3, MessageSquare, Loader2
} from 'lucide-react';
import { ThreeColumnComparison } from '../components/deal/ThreeColumnComparison';
import { apiClient } from '../services/api.client';
import { useAuthStore } from '../stores/authStore';

type TabId = 'overview' | 'layers' | 'collision' | 'training' | 'ai-agent';

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

const CapsuleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [capsule, setCapsule] = useState<CapsuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const userId = user?.id || 'demo-user';
    setLoading(true);
    apiClient.get(`/api/v1/capsules/${id}`, { params: { user_id: userId } })
      .then((res) => {
        const data = res.data;
        setCapsule(data.capsule || data);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load capsule:', err);
        setError(err.response?.status === 404 ? 'Capsule not found' : 'Failed to load capsule');
      })
      .finally(() => setLoading(false));
  }, [id, user?.id]);

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
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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
              { id: 'ai-agent' as const, label: 'AI Agent', icon: MessageSquare }
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
      </div>
    </div>
  );
};

export default CapsuleDetailPage;
