import React, { useState, useCallback, useEffect } from 'react';
import {
  Loader2, Brain, MessageSquare, Shield, ChevronDown, ChevronUp,
  Sparkles, Target, BarChart3, Scale, AlertTriangle, BookOpen,
  Send, Clock, Layers, TrendingUp, CheckCircle2, FileText, MapPin
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '../bloomberg-ui';

interface ZoningIntelligencePanelProps {
  deal?: any;
  dealId?: string;
  districtCode?: string;
  municipality?: string;
  state?: string;
  landAreaSf?: number;
}

interface QueryResponse {
  intent: string;
  answer: string;
  data: any;
  confidence: number;
  citations: string[];
  processingLayer: string;
  processingTimeMs: number;
  followUpQuestions?: string[];
}

interface AnalysisResult {
  step1_ruleStack: any;
  step2_baseApplication: {
    landAreaSf: number;
    acres: number;
    maxDensityUnits: number | null;
    maxFARGfa: number | null;
    buildableFootprint: number;
    setbacks: { front: number; side: number; rear: number };
    footprintSource?: string;
    constraintAdjustment?: number;
    constraintFlags?: any;
    [key: string]: any;
  };
  step3_overlayAdjustments: any[];
  step4_capacityScenarios: any[];
  step5_incentivePrograms: any[];
  step6_entitlementPaths: any[];
  step7_strategyRecommendation: string;
  step8_confidence: {
    dimensionalStandards: number;
    parkingCalculations: number;
    overlayApplication: number;
    incentiveEligibility: number;
    approvalProbability: number;
    overall: number;
    jurisdictionMaturity: string;
  };
  citations: string[];
  processingTimeMs: number;
}

const QUICK_QUESTIONS = [
  { label: 'What can I build?', q: 'What can I build by right on this parcel?' },
  { label: 'Height limits?', q: 'What is the maximum building height?' },
  { label: 'Parking required?', q: 'How much parking is required?' },
  { label: 'Incentives?', q: 'What incentive programs are available?' },
  { label: 'Rezone viable?', q: 'What is the likelihood of a successful rezone?' },
];

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const color = value >= 85 ? 'bg-neutral-800' : value >= 70 ? 'bg-neutral-700' : value >= 50 ? 'bg-neutral-700' : 'bg-neutral-800';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-32 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold w-10">{value}%</span>
    </div>
  );
}

function ScenarioCard({ scenario, index }: { scenario: any; index: number }) {
  const riskColor = scenario.riskScore === 0 ? 'text-green-400 bg-neutral-800 border-green-700'
    : scenario.riskScore <= 20 ? 'text-blue-300 bg-neutral-800 border-blue-700'
    : scenario.riskScore <= 40 ? 'text-yellow-300 bg-neutral-700 border-yellow-700'
    : 'text-red-400 bg-neutral-800 border-red-700';

  return (
    <div className="p-4 rounded-lg border hover:border-blue-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold">{scenario.name}</h4>
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${riskColor}`}>
          Risk {scenario.riskScore}/100
        </span>
      </div>
      <p className="text-sm mb-3">{scenario.description}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-neutral-400 text-xs">Units</span>
          <p className="font-semibold">{scenario.maxUnits.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-neutral-400 text-xs">GFA</span>
          <p className="font-semibold">{scenario.maxGFA.toLocaleString()} sf</p>
        </div>
        <div>
          <span className="text-neutral-400 text-xs">Parking</span>
          <p className="font-semibold">{scenario.parkingRequired} spaces</p>
        </div>
        <div>
          <span className="text-neutral-400 text-xs">Timeline</span>
          <p className="font-semibold">{scenario.timelineMonths === 0 ? 'Immediate' : `${scenario.timelineMonths} mo`}</p>
        </div>
      </div>
      {scenario.estimatedCost > 0 && (
        <div className="mt-2 text-xs">
          Est. entitlement cost: ${scenario.estimatedCost.toLocaleString()}
        </div>
      )}
    </div>
  );
}

interface BoundaryResolution {
  hasBoundary: boolean;
  boundary: {
    parcelAreaSF: number | null;
    buildableAreaSF: number | null;
    buildablePercentage: number | null;
    setbacks: { front: number; side: number; rear: number } | null;
    constraints: any;
    centroid: any;
    hasGeoJSON: boolean;
    updatedAt: string | null;
  } | null;
  deal: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    acres: number | null;
    projectType: string | null;
    zoningCode: string | null;
  } | null;
  zoningLookup: {
    districtCode: string | null;
    municipality: string | null;
    state: string | null;
    source: string;
  };
  dataCompleteness: {
    hasBoundary: boolean;
    hasSetbacks: boolean;
    hasConstraints: boolean;
    hasZoningCode: boolean;
    hasMunicipality: boolean;
    hasLandArea: boolean;
    score: number;
  };
}

export function ZoningIntelligencePanel({ deal, dealId, districtCode, municipality, state, landAreaSf }: ZoningIntelligencePanelProps) {
  const resolvedDealId = dealId || deal?.id;
  const [question, setQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [boundaryData, setBoundaryData] = useState<BoundaryResolution | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scenarios: true,
    entitlements: true,
    confidence: true,
    strategy: true,
  });
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string; meta?: any }>>([]);
  const [error, setError] = useState('');

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setBoundaryLoading(true);

    apiClient.get(`/api/v1/zoning-intelligence/resolve/${resolvedDealId}`)
      .then((response: any) => {
        if (!cancelled && response.data?.success) {
          setBoundaryData(response.data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBoundaryLoading(false);
      });

    return () => { cancelled = true; };
  }, [resolvedDealId]);

  const resolvedDistrict = districtCode || boundaryData?.zoningLookup?.districtCode || deal?.zoning_code;
  const resolvedMunicipality = municipality || boundaryData?.zoningLookup?.municipality || deal?.city;
  const resolvedState = state || boundaryData?.zoningLookup?.state || deal?.state;
  const resolvedLandArea = landAreaSf || boundaryData?.boundary?.parcelAreaSF || deal?.lot_size_sqft;

  const askQuestion = useCallback(async (q?: string) => {
    const question_text = q || question;
    if (!question_text.trim()) return;

    setQueryLoading(true);
    setError('');
    setChatHistory(prev => [...prev, { role: 'user', content: question_text }]);

    try {
      const response = await apiClient.post('/api/v1/zoning-intelligence/query', {
        question: question_text,
        districtCode: resolvedDistrict,
        municipality: resolvedMunicipality,
        state: resolvedState,
        parcelContext: resolvedLandArea ? { landAreaSf: resolvedLandArea } : undefined,
        dealId: resolvedDealId,
      });

      const result = response.data.data as QueryResponse;
      setQueryResult(result);
      setChatHistory(prev => [...prev, {
        role: 'agent',
        content: result.answer,
        meta: {
          confidence: result.confidence,
          layer: result.processingLayer,
          intent: result.intent,
          timeMs: result.processingTimeMs,
          citations: result.citations,
        },
      }]);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to process question';
      setError(msg);
      setChatHistory(prev => [...prev, { role: 'error', content: msg }]);
    } finally {
      setQueryLoading(false);
      setQuestion('');
    }
  }, [question, resolvedDistrict, resolvedMunicipality, resolvedState, resolvedLandArea, resolvedDealId]);

  const runFullAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    setError('');
    setAnalysisSource(null);

    try {
      const payload: any = {
        dealId: resolvedDealId,
        propertyType: 'multifamily',
      };

      if (resolvedMunicipality) payload.municipality = resolvedMunicipality;
      if (resolvedState) payload.state = resolvedState;
      if (resolvedDistrict) payload.districtCode = resolvedDistrict;
      if (resolvedLandArea) payload.landAreaSf = resolvedLandArea;
      if (deal?.address) payload.address = deal.address;
      if (deal?.lat) payload.lat = deal.lat;
      if (deal?.lng) payload.lng = deal.lng;

      const response = await apiClient.post('/api/v1/zoning-intelligence/analyze', payload);
      setAnalysisResult(response.data.data as AnalysisResult);
      setAnalysisSource(response.data.resolvedFrom || 'manual');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Full analysis failed');
    } finally {
      setAnalysisLoading(false);
    }
  }, [resolvedDistrict, resolvedMunicipality, resolvedState, resolvedLandArea, resolvedDealId, deal]);

  return (
    <div className="space-y-6 mt-8" style={{ background: BT.bg.terminal, color: BT.text.primary, padding: 16 }}>
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 rounded-lg">
              <Brain size={20} className="text-indigo-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Zoning Intelligence Agent</h3>
              <p className="text-sm">AI-powered zoning analysis with dual-layer knowledge system</p>
            </div>
          </div>
          <button
            onClick={runFullAnalysis}
            disabled={analysisLoading || !resolvedDistrict}
            className="flex items-center gap-2 px-5 py-2 bg-neutral-800 hover:bg-neutral-800 disabled:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            {analysisLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {analysisLoading ? 'Running Analysis...' : 'Run Full Analysis'}
          </button>
        </div>

        {boundaryData && (
          <div className={`p-3 rounded-lg border text-sm mb-4 ${boundaryData.hasBoundary ? 'bg-neutral-800 border-green-700' : 'bg-neutral-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={14} className={boundaryData.hasBoundary ? 'text-emerald-400' : 'text-neutral-400'} />
                <span className={boundaryData.hasBoundary ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
                  {boundaryData.hasBoundary ? 'Property boundary detected' : 'No property boundary set'}
                </span>
                {boundaryData.hasBoundary && (
                  <span className="text-xs px-2 py-0.5 bg-neutral-800 text-emerald-400 rounded-full">
                    {boundaryData.boundary?.parcelAreaSF ? `${(boundaryData.boundary.parcelAreaSF / 43560).toFixed(2)} acres` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  boundaryData.dataCompleteness.score >= 80 ? 'bg-neutral-800 text-green-400'
                    : boundaryData.dataCompleteness.score >= 50 ? 'bg-neutral-700 text-yellow-300'
                    : 'bg-neutral-800'
                }`}>
                  {boundaryData.dataCompleteness.score}% data ready
                </span>
              </div>
            </div>
            {boundaryData.hasBoundary && boundaryData.boundary?.constraints && (
              <div className="flex items-center gap-2 mt-2">
                {boundaryData.boundary.constraints.floodplain && (
                  <span className="text-xs px-2 py-0.5 bg-neutral-800 text-blue-300 rounded-full">Floodplain</span>
                )}
                {boundaryData.boundary.constraints.wetlands && (
                  <span className="text-xs px-2 py-0.5 bg-neutral-800 text-cyan-400 rounded-full">Wetlands</span>
                )}
                {boundaryData.boundary.constraints.protectedArea && (
                  <span className="text-xs px-2 py-0.5 bg-neutral-700 text-amber-400 rounded-full">Protected</span>
                )}
                {boundaryData.boundary.setbacks && (
                  <span className="text-xs">
                    Setbacks: {boundaryData.boundary.setbacks.front}/{boundaryData.boundary.setbacks.side}/{boundaryData.boundary.setbacks.rear} ft
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-neutral-800 border border-red-700 rounded-lg text-sm text-red-400 flex items-center gap-2 mb-4">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {!resolvedDistrict && !boundaryData?.zoningLookup?.districtCode && (
          <div className="p-4 bg-neutral-700 border border-amber-700 rounded-lg text-sm text-amber-400 flex items-center gap-2 mb-4">
            <AlertTriangle size={16} /> Look up a zoning code above or draw a property boundary to enable the intelligence agent
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_QUESTIONS.map((qq) => (
            <button
              key={qq.label}
              onClick={() => askQuestion(qq.q)}
              disabled={queryLoading || !resolvedDistrict}
              className="px-3 py-1.5 text-xs font-medium hover:bg-neutral-800 hover:text-indigo-300 rounded-full transition-colors disabled:opacity-50"
            >
              {qq.label}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
              placeholder="Ask the zoning agent anything... (e.g., 'Can I build a hotel here?')"
              className="flex-1 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-700 placeholder-gray-400"
              disabled={!resolvedDistrict}
            />
            <button
              onClick={() => askQuestion()}
              disabled={queryLoading || !question.trim() || !resolvedDistrict}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-800 disabled:bg-neutral-800 text-white rounded-lg transition-colors"
            >
              {queryLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        {chatHistory.length > 0 && (
          <div className=" rounded-xl border p-4 mb-6 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-neutral-800 text-white'
                      : msg.role === 'error'
                        ? 'bg-neutral-800 text-red-400 border border-red-700'
                        : 'bg-neutral-900 border-neutral-700'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.meta && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          msg.meta.confidence >= 85 ? 'bg-neutral-800 text-green-400'
                            : msg.meta.confidence >= 70 ? 'bg-neutral-700 text-yellow-300'
                            : 'bg-neutral-700 text-orange-400'
                        }`}>
                          {msg.meta.confidence}% confidence
                        </span>
                        <span className="text-xs">
                          Layer {msg.meta.layer} | {msg.meta.intent} | {msg.meta.timeMs}ms
                        </span>
                        {msg.meta.citations?.length > 0 && (
                          <span className="text-xs flex items-center gap-1">
                            <BookOpen size={10} /> {msg.meta.citations.length} refs
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {queryLoading && (
                <div className="flex justify-start">
                  <div className="border rounded-lg p-3 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-300" />
                    <span className="text-sm">Agent thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {queryResult?.followUpQuestions && queryResult.followUpQuestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs">Follow-up:</span>
            {queryResult.followUpQuestions.map((fq, i) => (
              <button
                key={i}
                onClick={() => askQuestion(fq)}
                className="px-3 py-1 text-xs bg-neutral-800 text-indigo-300 hover:bg-neutral-800 rounded-full transition-colors"
              >
                {fq}
              </button>
            ))}
          </div>
        )}
      </div>

      {analysisResult && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-xl border border-indigo-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-indigo-300" />
                <h3 className="font-bold">Full Zoning Analysis</h3>
                {analysisSource === 'property_boundary' && (
                  <span className="text-xs px-2 py-0.5 bg-neutral-800 text-emerald-400 rounded-full font-medium">
                    From Boundary
                  </span>
                )}
                {analysisResult.step2_baseApplication.footprintSource && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    analysisResult.step2_baseApplication.footprintSource === 'property_boundary' ? 'bg-neutral-800 text-emerald-400'
                      : analysisResult.step2_baseApplication.footprintSource === 'geometry_calculated' ? 'bg-neutral-800 text-blue-300'
                      : 'bg-neutral-800'
                  }`}>
                    {analysisResult.step2_baseApplication.footprintSource === 'property_boundary' ? 'Measured Footprint'
                      : analysisResult.step2_baseApplication.footprintSource === 'geometry_calculated' ? 'GeoJSON Calculated'
                      : 'Estimated'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  analysisResult.step8_confidence.overall >= 85 ? 'bg-neutral-800 text-green-400'
                    : analysisResult.step8_confidence.overall >= 70 ? 'bg-neutral-700 text-yellow-300'
                    : 'bg-neutral-700 text-orange-400'
                }`}>
                  {analysisResult.step8_confidence.overall}% Overall Confidence
                </span>
                <span className="text-xs flex items-center gap-1">
                  <Clock size={12} /> {(analysisResult.processingTimeMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-neutral-800/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-300">
                  {analysisResult.step2_baseApplication.acres.toFixed(2)}
                </p>
                <p className="text-xs">Acres</p>
              </div>
              <div className="bg-neutral-800/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-300">
                  {analysisResult.step4_capacityScenarios[0]?.maxUnits || 0}
                </p>
                <p className="text-xs">By-Right Units</p>
              </div>
              <div className="bg-neutral-800/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-300">
                  {(analysisResult.step4_capacityScenarios[0]?.maxGFA || 0).toLocaleString()}
                </p>
                <p className="text-xs">Max GFA (sf)</p>
              </div>
              <div className="bg-neutral-800/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-300">
                  {analysisResult.step5_incentivePrograms.length}
                </p>
                <p className="text-xs">Incentives</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border shadow-sm">
            <button
              onClick={() => toggleSection('scenarios')}
              className="w-full flex items-center justify-between p-4  transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-300" />
                <h3 className="font-semibold">Capacity Scenarios ({analysisResult.step4_capacityScenarios.length})</h3>
              </div>
              {expandedSections.scenarios ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSections.scenarios && (
              <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysisResult.step4_capacityScenarios.map((s, i) => (
                  <ScenarioCard key={i} scenario={s} index={i} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border shadow-sm">
            <button
              onClick={() => toggleSection('entitlements')}
              className="w-full flex items-center justify-between p-4  transition-colors"
            >
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-purple-300" />
                <h3 className="font-semibold">Entitlement Paths ({analysisResult.step6_entitlementPaths.length})</h3>
              </div>
              {expandedSections.entitlements ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSections.entitlements && (
              <div className="p-4 pt-0 space-y-3">
                {analysisResult.step6_entitlementPaths.map((path, i) => (
                  <div key={i} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{path.name}</h4>
                        <p className="text-sm">{path.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${
                          path.approvalProbability >= 80 ? 'text-green-400'
                            : path.approvalProbability >= 60 ? 'text-yellow-300'
                            : 'text-red-400'
                        }`}>
                          {path.approvalProbability}% approval
                        </span>
                        <p className="text-xs">{path.units} units</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {path.keyFactors.map((f, j) => (
                        <span key={j} className="text-xs px-2 py-1 rounded border">{f}</span>
                      ))}
                    </div>
                    <p className="text-sm italic">{path.recommendation}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span>Timeline: {path.timelineMonths === 0 ? 'Immediate' : `${path.timelineMonths} months`}</span>
                      <span>Est. cost: {path.estimatedCost === 0 ? '$0' : `$${path.estimatedCost.toLocaleString()}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {analysisResult.step5_incentivePrograms.length > 0 && (
            <div className="rounded-xl border shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-green-400" />
                <h3 className="font-semibold">Incentive Programs</h3>
              </div>
              <div className="space-y-2">
                {analysisResult.step5_incentivePrograms.map((inc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg border border-green-700">
                    <div>
                      <p className="text-sm font-medium">{inc.program}</p>
                      <p className="text-xs">Trigger: {inc.trigger}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-400">{inc.benefit}</p>
                      {inc.codeRef && <p className="text-xs">{inc.codeRef}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border shadow-sm">
            <button
              onClick={() => toggleSection('strategy')}
              className="w-full flex items-center justify-between p-4  transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-300" />
                <h3 className="font-semibold">Strategy Recommendation</h3>
              </div>
              {expandedSections.strategy ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSections.strategy && (
              <div className="p-4 pt-0">
                <div className="p-4 bg-neutral-800 rounded-lg border border-indigo-700">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {analysisResult.step7_strategyRecommendation}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border shadow-sm">
            <button
              onClick={() => toggleSection('confidence')}
              className="w-full flex items-center justify-between p-4  transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-neutral-400" />
                <h3 className="font-semibold">Confidence Scoring</h3>
              </div>
              {expandedSections.confidence ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSections.confidence && (
              <div className="p-4 pt-0 space-y-2">
                <ConfidenceBar value={analysisResult.step8_confidence.dimensionalStandards} label="Dimensional Standards" />
                <ConfidenceBar value={analysisResult.step8_confidence.parkingCalculations} label="Parking Calculations" />
                <ConfidenceBar value={analysisResult.step8_confidence.overlayApplication} label="Overlay Application" />
                <ConfidenceBar value={analysisResult.step8_confidence.incentiveEligibility} label="Incentive Eligibility" />
                <ConfidenceBar value={analysisResult.step8_confidence.approvalProbability} label="Approval Probability" />
                <div className="flex items-center gap-3 pt-2 border-t mt-2">
                  <span className="text-xs w-32 text-right font-medium">Jurisdiction</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                    analysisResult.step8_confidence.jurisdictionMaturity === 'authority' ? 'bg-neutral-800 text-green-400'
                      : analysisResult.step8_confidence.jurisdictionMaturity === 'expert' ? 'bg-neutral-800 text-blue-300'
                      : analysisResult.step8_confidence.jurisdictionMaturity === 'competent' ? 'bg-neutral-700 text-yellow-300'
                      : 'bg-neutral-800'
                  }`}>
                    {analysisResult.step8_confidence.jurisdictionMaturity}
                  </span>
                </div>
                {analysisResult.citations.length > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs mb-1">Citations:</p>
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.citations.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
