import React, { useState, useCallback } from 'react';
import {
  Loader2, Brain, MessageSquare, Shield, ChevronDown, ChevronUp,
  Sparkles, Target, BarChart3, Scale, AlertTriangle, BookOpen,
  Send, Clock, Layers, TrendingUp, CheckCircle2, FileText
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

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
  step2_baseApplication: any;
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
  const color = value >= 85 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : value >= 50 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10">{value}%</span>
    </div>
  );
}

function ScenarioCard({ scenario, index }: { scenario: any; index: number }) {
  const riskColor = scenario.riskScore === 0 ? 'text-green-600 bg-green-50 border-green-200'
    : scenario.riskScore <= 20 ? 'text-blue-600 bg-blue-50 border-blue-200'
    : scenario.riskScore <= 40 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${riskColor}`}>
          Risk {scenario.riskScore}/100
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3">{scenario.description}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-400 text-xs">Units</span>
          <p className="font-semibold text-gray-900">{scenario.maxUnits.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">GFA</span>
          <p className="font-semibold text-gray-900">{scenario.maxGFA.toLocaleString()} sf</p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Parking</span>
          <p className="font-semibold text-gray-900">{scenario.parkingRequired} spaces</p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Timeline</span>
          <p className="font-semibold text-gray-900">{scenario.timelineMonths === 0 ? 'Immediate' : `${scenario.timelineMonths} mo`}</p>
        </div>
      </div>
      {scenario.estimatedCost > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          Est. entitlement cost: ${scenario.estimatedCost.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function ZoningIntelligencePanel({ deal, dealId, districtCode, municipality, state, landAreaSf }: ZoningIntelligencePanelProps) {
  const resolvedDealId = dealId || deal?.id;
  const [question, setQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
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

  const resolvedDistrict = districtCode || deal?.zoning_code;
  const resolvedMunicipality = municipality || deal?.city;
  const resolvedState = state || deal?.state;
  const resolvedLandArea = landAreaSf || deal?.lot_size_sqft;

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
    if (!resolvedDistrict || !resolvedMunicipality || !resolvedState || !resolvedLandArea) {
      setError('Missing required data: district code, municipality, state, and land area must be set');
      return;
    }

    setAnalysisLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/v1/zoning-intelligence/analyze', {
        dealId: resolvedDealId,
        municipality: resolvedMunicipality,
        state: resolvedState,
        districtCode: resolvedDistrict,
        landAreaSf: resolvedLandArea,
        address: deal?.address,
        lat: deal?.lat,
        lng: deal?.lng,
        propertyType: 'multifamily',
      });

      setAnalysisResult(response.data.data as AnalysisResult);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Full analysis failed');
    } finally {
      setAnalysisLoading(false);
    }
  }, [resolvedDistrict, resolvedMunicipality, resolvedState, resolvedLandArea, resolvedDealId, deal]);

  return (
    <div className="space-y-6 mt-8">
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Brain size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Zoning Intelligence Agent</h3>
              <p className="text-sm text-gray-500">AI-powered zoning analysis with dual-layer knowledge system</p>
            </div>
          </div>
          <button
            onClick={runFullAnalysis}
            disabled={analysisLoading || !resolvedDistrict}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            {analysisLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {analysisLoading ? 'Running Analysis...' : 'Run Full Analysis'}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2 mb-4">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {!resolvedDistrict && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2 mb-4">
            <AlertTriangle size={16} /> Look up a zoning code above to enable the intelligence agent
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_QUESTIONS.map((qq) => (
            <button
              key={qq.label}
              onClick={() => askQuestion(qq.q)}
              disabled={queryLoading || !resolvedDistrict}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 rounded-full transition-colors disabled:opacity-50"
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
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              disabled={!resolvedDistrict}
            />
            <button
              onClick={() => askQuestion()}
              disabled={queryLoading || !question.trim() || !resolvedDistrict}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
            >
              {queryLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        {chatHistory.length > 0 && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : msg.role === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.meta && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          msg.meta.confidence >= 85 ? 'bg-green-100 text-green-700'
                            : msg.meta.confidence >= 70 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {msg.meta.confidence}% confidence
                        </span>
                        <span className="text-xs text-gray-400">
                          Layer {msg.meta.layer} | {msg.meta.intent} | {msg.meta.timeMs}ms
                        </span>
                        {msg.meta.citations?.length > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
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
                  <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                    <span className="text-sm text-gray-500">Agent thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {queryResult?.followUpQuestions && queryResult.followUpQuestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-gray-400">Follow-up:</span>
            {queryResult.followUpQuestions.map((fq, i) => (
              <button
                key={i}
                onClick={() => askQuestion(fq)}
                className="px-3 py-1 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
              >
                {fq}
              </button>
            ))}
          </div>
        )}
      </div>

      {analysisResult && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-indigo-600" />
                <h3 className="font-bold text-gray-900">Full Zoning Analysis</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  analysisResult.step8_confidence.overall >= 85 ? 'bg-green-100 text-green-700'
                    : analysisResult.step8_confidence.overall >= 70 ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {analysisResult.step8_confidence.overall}% Overall Confidence
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} /> {(analysisResult.processingTimeMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-white/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-700">
                  {analysisResult.step2_baseApplication.acres.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Acres</p>
              </div>
              <div className="bg-white/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-700">
                  {analysisResult.step4_capacityScenarios[0]?.maxUnits || 0}
                </p>
                <p className="text-xs text-gray-500">By-Right Units</p>
              </div>
              <div className="bg-white/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-700">
                  {(analysisResult.step4_capacityScenarios[0]?.maxGFA || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Max GFA (sf)</p>
              </div>
              <div className="bg-white/70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-700">
                  {analysisResult.step5_incentivePrograms.length}
                </p>
                <p className="text-xs text-gray-500">Incentives</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => toggleSection('scenarios')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Capacity Scenarios ({analysisResult.step4_capacityScenarios.length})</h3>
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => toggleSection('entitlements')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-purple-600" />
                <h3 className="font-semibold text-gray-900">Entitlement Paths ({analysisResult.step6_entitlementPaths.length})</h3>
              </div>
              {expandedSections.entitlements ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSections.entitlements && (
              <div className="p-4 pt-0 space-y-3">
                {analysisResult.step6_entitlementPaths.map((path, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{path.name}</h4>
                        <p className="text-sm text-gray-500">{path.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${
                          path.approvalProbability >= 80 ? 'text-green-600'
                            : path.approvalProbability >= 60 ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {path.approvalProbability}% approval
                        </span>
                        <p className="text-xs text-gray-400">{path.units} units</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {path.keyFactors.map((f, j) => (
                        <span key={j} className="text-xs px-2 py-1 bg-white rounded border border-gray-200 text-gray-600">{f}</span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 italic">{path.recommendation}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>Timeline: {path.timelineMonths === 0 ? 'Immediate' : `${path.timelineMonths} months`}</span>
                      <span>Est. cost: {path.estimatedCost === 0 ? '$0' : `$${path.estimatedCost.toLocaleString()}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {analysisResult.step5_incentivePrograms.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-green-600" />
                <h3 className="font-semibold text-gray-900">Incentive Programs</h3>
              </div>
              <div className="space-y-2">
                {analysisResult.step5_incentivePrograms.map((inc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inc.program}</p>
                      <p className="text-xs text-gray-500">Trigger: {inc.trigger}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700">{inc.benefit}</p>
                      {inc.codeRef && <p className="text-xs text-gray-400">{inc.codeRef}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => toggleSection('strategy')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Strategy Recommendation</h3>
              </div>
              {expandedSections.strategy ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSections.strategy && (
              <div className="p-4 pt-0">
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {analysisResult.step7_strategyRecommendation}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => toggleSection('confidence')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-gray-600" />
                <h3 className="font-semibold text-gray-900">Confidence Scoring</h3>
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
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100 mt-2">
                  <span className="text-xs text-gray-500 w-32 text-right font-medium">Jurisdiction</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                    analysisResult.step8_confidence.jurisdictionMaturity === 'authority' ? 'bg-green-100 text-green-700'
                      : analysisResult.step8_confidence.jurisdictionMaturity === 'expert' ? 'bg-blue-100 text-blue-700'
                      : analysisResult.step8_confidence.jurisdictionMaturity === 'competent' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {analysisResult.step8_confidence.jurisdictionMaturity}
                  </span>
                </div>
                {analysisResult.citations.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 mt-2">
                    <p className="text-xs text-gray-400 mb-1">Citations:</p>
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.citations.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{c}</span>
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
