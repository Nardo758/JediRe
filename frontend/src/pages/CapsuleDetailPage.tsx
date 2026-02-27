import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Share2, Download, TrendingUp, Building2, 
  DollarSign, Users, AlertTriangle, CheckCircle, Target,
  BarChart3, MessageSquare, FileText
} from 'lucide-react';
import { ThreeColumnComparison } from '../components/deal/ThreeColumnComparison';

const CapsuleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'layers' | 'collision' | 'training' | 'ai-agent'>('overview');

  // Mock capsule data
  const capsule = {
    id,
    property_address: '3500 Peachtree Rd NE, Atlanta, GA 30326',
    asset_class: 'Multifamily',
    asking_price: 45000000,
    units: 280,
    year_built: 2018,
    jedi_score: 87,
    status: 'DISCOVER',
    broker_name: 'Colliers International',
    created_at: '2026-02-15T10:30:00Z',
    
    // Layer 1: Capsule Data
    layer1: {
      asking_price: 45000000,
      noi: 2700000,
      cap_rate: 6.0,
      occupancy: 94.5,
      avg_rent_1br: 1850,
      avg_rent_2br: 2450,
      parking_ratio: 1.2,
      broker_claims: {
        rent_upside: '$150/unit',
        occupancy_stabilized: '96%',
        capex_deferred: 'None',
        major_tenant: 'None'
      }
    },
    
    // Layer 2: Platform Intelligence
    layer2: {
      market_rent_1br: 1825,
      market_rent_2br: 2400,
      submarket_vacancy: 5.8,
      supply_risk_score: 42,
      nearby_developments: 3,
      units_under_construction: 1200,
      employment_growth: 3.2,
      comp_sales: [
        { address: '3400 Peachtree Rd NE', price_per_unit: 165000, cap_rate: 5.9, date: '2025-12-10' },
        { address: '3600 Piedmont Rd NE', price_per_unit: 158000, cap_rate: 6.1, date: '2025-11-22' }
      ]
    },
    
    // Layer 3: User's Data & Adjustments
    layer3: {
      // User preferences
      preferred_hold_period: 7,
      target_irr: 18,
      max_ltv: 70,
      exit_cap_assumption: 6.5,
      portfolio_buckhead_exposure: 28,
      past_buckhead_acquisitions: 2,
      avg_rent_premium_achieved: 97, // $97/unit vs broker claim of $150
      
      // User's adjusted assumptions (used in pro forma)
      adjusted_rent_1br: 1800, // Conservative vs broker $1,850
      adjusted_rent_2br: 2400, // Using market rate
      adjusted_occupancy: 95, // Between broker 94.5% and claimed 96%
      adjusted_noi: null, // Calculated from adjustments
      adjusted_cap_rate: null // Using broker's cap rate
    }
  };

  // Collision analysis results
  const collisionResults = {
    overall_score: 78,
    strategy_arbitrage: {
      score: 72,
      insight: 'Broker claims $150/unit rent upside. Your last 3 projects averaged $97/unit (35% lower). Adjust pro forma accordingly.',
      recommended_action: 'Use $100/unit assumption (conservative vs your history)'
    },
    portfolio_fit: {
      score: 65,
      insight: 'Adding this deal increases Buckhead exposure to 40% of portfolio (from 28%). Consider geographic diversification.',
      recommended_action: 'Review exposure limits or pass on next Buckhead deal'
    },
    broker_validation: {
      score: 81,
      insight: 'Broker rent claims within 2% of market. Occupancy claim (96%) aggressive vs submarket (94.2% avg).',
      recommended_action: 'Use 95% stabilized occupancy assumption'
    },
    risk_assessment: {
      score: 76,
      insight: '1,200 units delivering within 2 miles (2026-2027). Supply risk elevated FOR YOU because you own adjacent property.',
      recommended_action: 'Model 6-month lease-up extension scenario'
    },
    execution_confidence: {
      score: 92,
      insight: 'You have completed 4 similar multifamily acquisitions in Buckhead. Strong track record.',
      recommended_action: 'Proceed with standard due diligence timeline'
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                  {capsule.asset_class} • {capsule.units} Units
                </span>
                <span>•</span>
                <span>Built {capsule.year_built}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  ${(capsule.asking_price / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold mb-2">
                <TrendingUp className="w-5 h-5" />
                JEDI Score: {capsule.jedi_score}
              </div>
              <div className="text-sm text-gray-600">Collision Score: {collisionResults.overall_score}/100</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-6 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'layers', label: 'Three Layers', icon: Target },
              { id: 'collision', label: 'Collision Analysis', icon: AlertTriangle },
              { id: 'training', label: 'Training', icon: Target },
              { id: 'ai-agent', label: 'AI Agent', icon: MessageSquare }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Three Column Comparison */}
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
                    broker: capsule.layer1.avg_rent_1br,
                    market: capsule.layer2.market_rent_1br,
                    user: capsule.layer3?.adjusted_rent_1br,
                    format: 'currency',
                    editable: true
                  },
                  {
                    label: 'Rent (2BR)',
                    broker: capsule.layer1.avg_rent_2br,
                    market: capsule.layer2.market_rent_2br,
                    user: capsule.layer3?.adjusted_rent_2br,
                    format: 'currency',
                    editable: true
                  },
                  {
                    label: 'Occupancy',
                    broker: capsule.layer1.occupancy,
                    market: 100 - capsule.layer2.submarket_vacancy,
                    user: capsule.layer3?.adjusted_occupancy,
                    format: 'percent',
                    editable: true
                  },
                  {
                    label: 'NOI',
                    broker: capsule.layer1.noi,
                    market: capsule.layer1.noi * 0.97, // Market adjusted estimate
                    user: capsule.layer3?.adjusted_noi,
                    format: 'currency',
                    editable: false
                  },
                  {
                    label: 'Cap Rate',
                    broker: capsule.layer1.cap_rate,
                    market: 6.0, // Market average
                    user: capsule.layer3?.adjusted_cap_rate || capsule.layer1.cap_rate,
                    format: 'percent',
                    editable: true
                  }
                ]}
                onUserEdit={(label, value) => {
                  console.log('User editing:', label, value);
                  // TODO: Update user adjustments in state/backend
                }}
              />

              {/* Collision Highlights */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Collision Analysis Highlights</h2>
                <div className="space-y-4">
                  {Object.entries(collisionResults).filter(([key]) => key !== 'overall_score').map(([key, data]) => {
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

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold mb-4">Broker Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-600 mb-1">Broker</div>
                    <div className="font-medium">{capsule.broker_name}</div>
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

            {/* Layer 1 */}
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
                  <div className="font-semibold">${(capsule.layer1.asking_price / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">NOI</div>
                  <div className="font-semibold">${(capsule.layer1.noi / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Cap Rate</div>
                  <div className="font-semibold">{capsule.layer1.cap_rate}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Occupancy</div>
                  <div className="font-semibold">{capsule.layer1.occupancy}%</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">Broker Claims:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(capsule.layer1.broker_claims).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}: </span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Layer 2 */}
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
                  <div className="font-semibold">${capsule.layer2.market_rent_1br}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Submarket Vacancy</div>
                  <div className="font-semibold">{capsule.layer2.submarket_vacancy}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Supply Risk</div>
                  <div className="font-semibold">{capsule.layer2.supply_risk_score}/100</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Employment Growth</div>
                  <div className="font-semibold text-green-600">+{capsule.layer2.employment_growth}%</div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">Recent Comps:</div>
                <div className="space-y-2 text-sm">
                  {capsule.layer2.comp_sales.map((comp, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-gray-600">{comp.address}</span>
                      <span className="font-medium">${(comp.price_per_unit / 1000).toFixed(0)}K/unit @ {comp.cap_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Layer 3 */}
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
              
              {/* User's Adjusted Assumptions */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Your Adjusted Assumptions:</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">1BR Rent: </span>
                    <span className="font-semibold text-green-700">${capsule.layer3.adjusted_rent_1br}</span>
                    <span className="text-gray-500 ml-1">(vs broker ${capsule.layer1.avg_rent_1br})</span>
                  </div>
                  <div>
                    <span className="text-gray-600">2BR Rent: </span>
                    <span className="font-semibold text-green-700">${capsule.layer3.adjusted_rent_2br}</span>
                    <span className="text-gray-500 ml-1">(vs broker ${capsule.layer1.avg_rent_2br})</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Occupancy: </span>
                    <span className="font-semibold text-green-700">{capsule.layer3.adjusted_occupancy}%</span>
                    <span className="text-gray-500 ml-1">(vs broker {capsule.layer1.occupancy}%)</span>
                  </div>
                </div>
              </div>
              
              {/* User Preferences */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Your Investment Criteria:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Target IRR</div>
                    <div className="font-semibold">{capsule.layer3.target_irr}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Hold Period</div>
                    <div className="font-semibold">{capsule.layer3.preferred_hold_period} years</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Exit Cap</div>
                    <div className="font-semibold">{capsule.layer3.exit_cap_assumption}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Max LTV</div>
                    <div className="font-semibold">{capsule.layer3.max_ltv}%</div>
                  </div>
                </div>
              </div>
              
              {/* Portfolio Context */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Portfolio Context:</div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-600">Buckhead Exposure: </span>
                    <span className="font-semibold text-yellow-600">{capsule.layer3.portfolio_buckhead_exposure}%</span>
                    <span className="text-gray-500 ml-1">(adding this = 40%)</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Your Historical Rent Premium: </span>
                    <span className="font-medium">${capsule.layer3.avg_rent_premium_achieved}/unit</span>
                    <span className="text-gray-500 ml-1">(vs broker claim ${capsule.layer1.broker_claims.rent_upside})</span>
                  </div>
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
                <div className="text-3xl font-bold text-blue-600">{collisionResults.overall_score}/100</div>
              </div>
              <p className="text-gray-700">
                Your personalized analysis based on the intersection of property data, market intelligence, and your specific investment criteria.
              </p>
            </div>

            {Object.entries(collisionResults).filter(([key]) => key !== 'overall_score').map(([key, data]) => {
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
            {/* Training Status Banner */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🎓 Trained Modules Active</h2>
              <p className="text-gray-700">
                Your modules have been trained on your past deals and are suggesting adjustments based on YOUR style and historical accuracy.
              </p>
            </div>

            {/* Module Training Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Module */}
              <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    💰
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Financial Module</h3>
                    <div className="text-sm text-blue-600">Pattern + Calibration</div>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Pattern Training:</div>
                    <div className="text-gray-600">✓ Trained on 50 past deals</div>
                    <div className="text-gray-600">Your style: Conservative (3.2% rent growth)</div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-700">Calibration:</div>
                    <div className="text-gray-600">✓ Active (4 properties tracked)</div>
                    <div className="text-gray-600">Accuracy: 97.5% (2.5% optimistic on NOI)</div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="font-medium text-blue-700">Confidence: 94%</div>
                  </div>
                </div>
              </div>

              {/* Traffic Engine */}
              <div className="bg-white rounded-lg border-2 border-green-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                    🚶
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
                    <div className="text-gray-600">✓ Active (3 properties)</div>
                    <div className="text-gray-600">Your factor: 0.79x (21% below forecast)</div>
                    <div className="text-gray-500 text-xs mt-1">Based on 54 months data</div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="font-medium text-green-700">Confidence: 85%</div>
                  </div>
                </div>
              </div>

              {/* Development Module */}
              <div className="bg-white rounded-lg border-2 border-orange-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
                    🏗️
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Development</h3>
                    <div className="text-sm text-orange-600">Pattern + Calibration</div>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Pattern Training:</div>
                    <div className="text-gray-600">✓ Trained on 8 projects</div>
                    <div className="text-gray-600">Your style: B+ class, 60/30/10 mix</div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-700">Calibration:</div>
                    <div className="text-gray-600">✓ Active (2 projects)</div>
                    <div className="text-gray-600">Cost overrun: +8% avg</div>
                    <div className="text-gray-600">Timeline: +3 months typical</div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="font-medium text-orange-700">Confidence: 78%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Module Suggestions for Current Deal */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">How Training Affects This Deal</h3>
              
              <div className="space-y-6">
                {/* Financial Suggestions */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="font-medium text-gray-900 mb-3">Financial Module Suggestions:</div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start justify-between bg-blue-50 rounded p-3">
                      <div className="flex-1">
                        <div className="font-medium">1BR Rent: $1,800</div>
                        <div className="text-sm text-gray-600">Your typical -3% vs broker ($1,850)</div>
                        <div className="text-xs text-gray-500 mt-1">Confidence: 94% • Based on 50 deals</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                          Accept
                        </button>
                        <button className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50">
                          Modify
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between bg-blue-50 rounded p-3">
                      <div className="flex-1">
                        <div className="font-medium">Occupancy: 95%</div>
                        <div className="text-sm text-gray-600">Your conservative standard (broker claims 96%)</div>
                        <div className="text-xs text-gray-500 mt-1">Confidence: 94%</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                          Accept
                        </button>
                        <button className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50">
                          Modify
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between bg-blue-50 rounded p-3">
                      <div className="flex-1">
                        <div className="font-medium">Exit Cap: 6.5%</div>
                        <div className="text-sm text-gray-600">Your typical +50bps spread (entry 6.0%)</div>
                        <div className="text-xs text-gray-500 mt-1">Confidence: 94%</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                          Accept
                        </button>
                        <button className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50">
                          Modify
                        </button>
                      </div>
                    </div>

                    <button className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Accept All Financial Suggestions
                    </button>
                  </div>
                </div>

                {/* Traffic Forecast */}
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="font-medium text-gray-900 mb-3">Traffic Engine Forecast (Calibrated):</div>
                  
                  <div className="bg-green-50 rounded p-4">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-gray-600">Base Model Forecast:</div>
                        <div className="text-2xl font-bold text-gray-900">2,847</div>
                        <div className="text-xs text-gray-500">weekly walk-ins</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Your Calibrated Forecast:</div>
                        <div className="text-2xl font-bold text-green-700">2,250</div>
                        <div className="text-xs text-gray-500">weekly walk-ins (×0.79)</div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-700">
                      <div className="font-medium mb-1">Why this adjustment?</div>
                      <div className="text-gray-600">
                        Based on your 3 properties (54 months data), your properties generate 21% less traffic than the base model forecasts.
                        This is likely due to your typical tenant mix (B/C class vs A class retail).
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="text-xs text-gray-600">
                        Confidence: 85% • Range: 1,950 - 2,550 walk-ins/week (±15%)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manage Training Data */}
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
