import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Shield, MessageSquare, BookOpen, TrendingUp, Users,
  ChevronDown, ChevronUp, Send, CheckCircle2, XCircle, Clock,
  AlertTriangle, Search, Scale, BarChart3, Star, Award
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface ZoningLearningPanelProps {
  deal?: any;
  dealId?: string;
  districtCode?: string;
  municipality?: string;
  state?: string;
}

interface MaturityData {
  level: string;
  label: string;
  confidenceCap: number;
  totalPrecedents: number;
  totalCorrections: number;
  totalOutcomes: number;
  daysSinceFirst: number;
  disclosure: string;
}

interface PrecedentRecord {
  id: string;
  municipality: string;
  districtCode: string;
  applicationType: string;
  applicationId: string;
  address: string;
  outcome: string;
  conditions: string[];
  supportFactors: string[];
  opposeFactors: string[];
  timelineMonths: number;
  voteDetails: string;
  attorney: string;
  scaleUnits: number | null;
  decisionDetails: string;
  createdAt: string;
}

interface PatternData {
  totalCases: number;
  approvalRate: number;
  avgTimelineMonths: number;
  commonConditions: { condition: string; count: number }[];
  commonSupportFactors: { factor: string; count: number }[];
  outcomeBreakdown: { outcome: string; count: number; pct: number }[];
}

const MATURITY_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  authority: { color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: <Award size={16} /> },
  expert: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <Star size={16} /> },
  competent: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: <TrendingUp size={16} /> },
  novice: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <Clock size={16} /> },
};

export function ZoningLearningPanel({
  deal, dealId, districtCode, municipality, state,
}: ZoningLearningPanelProps) {
  const [activeTab, setActiveTab] = useState<'maturity' | 'precedents' | 'corrections' | 'outcomes'>('maturity');
  const [maturity, setMaturity] = useState<MaturityData | null>(null);
  const [precedents, setPrecedents] = useState<PrecedentRecord[]>([]);
  const [patterns, setPatterns] = useState<PatternData | null>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [correctionForm, setCorrectionForm] = useState({
    fieldCorrected: '',
    oldValue: '',
    newValue: '',
    justification: '',
    codeReference: '',
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<any>(null);

  const [precedentSearch, setPrecedentSearch] = useState({
    applicationType: '',
  });

  const resolvedMunicipality = municipality || deal?.city;
  const resolvedState = state || deal?.state;

  const fetchMaturity = useCallback(async () => {
    if (!resolvedMunicipality) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/v1/zoning-learning/maturity/${encodeURIComponent(resolvedMunicipality)}`);
      if (res.data.success) {
        setMaturity(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch maturity:', e);
    } finally {
      setLoading(false);
    }
  }, [resolvedMunicipality]);

  const fetchPrecedents = useCallback(async () => {
    if (!resolvedMunicipality) return;
    try {
      setLoading(true);
      const params: any = { municipality: resolvedMunicipality };
      if (districtCode) params.districtCode = districtCode;
      if (precedentSearch.applicationType) params.applicationType = precedentSearch.applicationType;

      const res = await apiClient.get('/api/v1/zoning-learning/precedents/search', { params });
      if (res.data.success) setPrecedents(res.data.data);
    } catch (e) {
      console.error('Failed to fetch precedents:', e);
    } finally {
      setLoading(false);
    }
  }, [resolvedMunicipality, districtCode, precedentSearch.applicationType]);

  const fetchPatterns = useCallback(async () => {
    if (!resolvedMunicipality) return;
    try {
      const params: any = { municipality: resolvedMunicipality };
      if (districtCode) params.districtCode = districtCode;
      const res = await apiClient.get('/api/v1/zoning-learning/precedents/patterns', { params });
      if (res.data.success) setPatterns(res.data.data);
    } catch (e) {
      console.error('Failed to fetch patterns:', e);
    }
  }, [resolvedMunicipality, districtCode]);

  const fetchCorrections = useCallback(async () => {
    if (!resolvedMunicipality) return;
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v1/zoning-learning/corrections', {
        params: { municipality: resolvedMunicipality, limit: 20 },
      });
      if (res.data.success) setCorrections(res.data.data);
    } catch (e) {
      console.error('Failed to fetch corrections:', e);
    } finally {
      setLoading(false);
    }
  }, [resolvedMunicipality]);

  useEffect(() => {
    if (activeTab === 'maturity') fetchMaturity();
    else if (activeTab === 'precedents') { fetchPrecedents(); fetchPatterns(); }
    else if (activeTab === 'corrections') fetchCorrections();
  }, [activeTab, fetchMaturity, fetchPrecedents, fetchPatterns, fetchCorrections]);

  const submitCorrection = async () => {
    if (!correctionForm.fieldCorrected || !correctionForm.newValue || !correctionForm.justification) return;
    try {
      setSubmittingCorrection(true);
      const res = await apiClient.post('/api/v1/zoning-learning/corrections', {
        municipality: resolvedMunicipality,
        state: resolvedState,
        districtCode,
        fieldCorrected: correctionForm.fieldCorrected,
        oldValue: correctionForm.oldValue,
        newValue: correctionForm.newValue,
        justification: correctionForm.justification,
        codeReference: correctionForm.codeReference,
      });
      if (res.data.success) {
        setCorrectionResult(res.data.data);
        setCorrectionForm({ fieldCorrected: '', oldValue: '', newValue: '', justification: '', codeReference: '' });
        fetchCorrections();
      }
    } catch (e) {
      console.error('Correction submit error:', e);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const tabs = [
    { id: 'maturity' as const, label: 'Jurisdiction Maturity', icon: <Shield size={14} /> },
    { id: 'precedents' as const, label: 'Precedent Library', icon: <BookOpen size={14} /> },
    { id: 'corrections' as const, label: 'Corrections', icon: <MessageSquare size={14} /> },
    { id: 'outcomes' as const, label: 'Outcome Tracking', icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={18} className="text-violet-600" />
          <h3 className="font-bold text-gray-900">Learning Engine</h3>
          <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">Phase 3</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-violet-500" />
          </div>
        )}

        {!loading && activeTab === 'maturity' && (
          <MaturityView maturity={maturity} municipality={resolvedMunicipality} />
        )}

        {!loading && activeTab === 'precedents' && (
          <PrecedentsView
            precedents={precedents}
            patterns={patterns}
            search={precedentSearch}
            onSearchChange={setPrecedentSearch}
            onSearch={fetchPrecedents}
          />
        )}

        {!loading && activeTab === 'corrections' && (
          <CorrectionsView
            corrections={corrections}
            form={correctionForm}
            onFormChange={setCorrectionForm}
            onSubmit={submitCorrection}
            submitting={submittingCorrection}
            result={correctionResult}
          />
        )}

        {!loading && activeTab === 'outcomes' && (
          <OutcomesView municipality={resolvedMunicipality} />
        )}
      </div>
    </div>
  );
}

function MaturityView({ maturity, municipality }: { maturity: MaturityData | null; municipality?: string }) {
  if (!municipality) {
    return <p className="text-sm text-gray-500">No municipality selected. Set a city on the deal to see maturity data.</p>;
  }

  if (!maturity) {
    return <p className="text-sm text-gray-500">No maturity data available for {municipality}.</p>;
  }

  const config = MATURITY_CONFIG[maturity.level] || MATURITY_CONFIG.novice;
  const nextLevel = maturity.level === 'novice' ? 'competent'
    : maturity.level === 'competent' ? 'expert'
    : maturity.level === 'expert' ? 'authority' : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} ${config.color}`}>
          {config.icon}
          <span className="font-bold text-sm capitalize">{maturity.label}</span>
        </div>
        <span className="text-sm text-gray-500">Confidence cap: {maturity.confidenceCap}%</span>
      </div>

      <p className="text-sm text-gray-700">{maturity.disclosure}</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{maturity.totalPrecedents}</p>
          <p className="text-xs text-gray-500">Precedent Cases</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{maturity.totalCorrections}</p>
          <p className="text-xs text-gray-500">Verified Corrections</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{maturity.totalOutcomes}</p>
          <p className="text-xs text-gray-500">Outcomes Tracked</p>
        </div>
      </div>

      {nextLevel && (
        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
          <p className="text-xs font-medium text-indigo-700">
            Next level: <span className="capitalize">{nextLevel}</span>
          </p>
          <p className="text-xs text-indigo-600 mt-1">
            {nextLevel === 'competent' && 'Requires 10+ precedent cases and 5+ verified corrections'}
            {nextLevel === 'expert' && 'Requires 50+ precedent cases and 20+ verified corrections'}
            {nextLevel === 'authority' && 'Requires 200+ precedent cases and 50+ verified corrections over 1 year'}
          </p>
        </div>
      )}
    </div>
  );
}

function PrecedentsView({
  precedents, patterns, search, onSearchChange, onSearch,
}: {
  precedents: PrecedentRecord[];
  patterns: PatternData | null;
  search: { applicationType: string };
  onSearchChange: (s: { applicationType: string }) => void;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={search.applicationType}
          onChange={e => onSearchChange({ applicationType: e.target.value })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Types</option>
          <option value="variance">Variance</option>
          <option value="rezone">Rezone</option>
          <option value="cup">Conditional Use Permit</option>
          <option value="sap">Special Administrative Permit</option>
          <option value="site_plan">Site Plan Approval</option>
        </select>
        <button
          onClick={onSearch}
          className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Search size={14} />
          Search
        </button>
      </div>

      {patterns && patterns.totalCases > 0 && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Pattern Analysis ({patterns.totalCases} cases)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-amber-700">Approval Rate: <span className="font-bold">{patterns.approvalRate.toFixed(0)}%</span></p>
              <p className="text-xs text-amber-700">Avg Timeline: <span className="font-bold">{patterns.avgTimelineMonths.toFixed(1)} months</span></p>
            </div>
            <div>
              {patterns.outcomeBreakdown.slice(0, 3).map((o, i) => (
                <p key={i} className="text-xs text-amber-700 capitalize">
                  {o.outcome}: {o.count} ({o.pct.toFixed(0)}%)
                </p>
              ))}
            </div>
          </div>
          {patterns.commonConditions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-200">
              <p className="text-xs text-amber-700 font-medium">Common Conditions:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {patterns.commonConditions.slice(0, 5).map((c, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    {c.condition} ({c.count}x)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {precedents.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No precedent cases found. Add precedents to improve agent accuracy.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {precedents.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.applicationType?.toUpperCase()} — {p.applicationId || 'N/A'}</p>
                  <p className="text-xs text-gray-500">{p.address || 'Address not specified'} | {p.districtCode}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  p.outcome === 'approved' || p.outcome === 'approved_with_conditions'
                    ? 'bg-green-100 text-green-700'
                    : p.outcome === 'denied' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.outcome?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {p.timelineMonths > 0 && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} /> {p.timelineMonths} months
                  </span>
                )}
                {p.voteDetails && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users size={12} /> {p.voteDetails}
                  </span>
                )}
                {p.scaleUnits && (
                  <span className="text-xs text-gray-500">{p.scaleUnits} units</span>
                )}
              </div>
              {(p.supportFactors?.length > 0 || p.opposeFactors?.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.supportFactors?.map((f, i) => (
                    <span key={`s-${i}`} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">+ {f}</span>
                  ))}
                  {p.opposeFactors?.map((f, i) => (
                    <span key={`o-${i}`} className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700 rounded">- {f}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectionsView({
  corrections, form, onFormChange, onSubmit, submitting, result,
}: {
  corrections: any[];
  form: { fieldCorrected: string; oldValue: string; newValue: string; justification: string; codeReference: string };
  onFormChange: (f: typeof form) => void;
  onSubmit: () => void;
  submitting: boolean;
  result: any;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {corrections.length} correction{corrections.length !== 1 ? 's' : ''} submitted
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
        >
          <MessageSquare size={14} />
          Submit Correction
        </button>
      </div>

      {showForm && (
        <div className="bg-violet-50 rounded-lg p-4 border border-violet-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Field to Correct</label>
              <input
                type="text"
                value={form.fieldCorrected}
                onChange={e => onFormChange({ ...form, fieldCorrected: e.target.value })}
                placeholder="e.g. parking.min_ratio"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Code Reference</label>
              <input
                type="text"
                value={form.codeReference}
                onChange={e => onFormChange({ ...form, codeReference: e.target.value })}
                placeholder="e.g. Section 16-18.013(3)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Current (Wrong) Value</label>
              <input
                type="text"
                value={form.oldValue}
                onChange={e => onFormChange({ ...form, oldValue: e.target.value })}
                placeholder="What the agent currently says"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Correct Value</label>
              <input
                type="text"
                value={form.newValue}
                onChange={e => onFormChange({ ...form, newValue: e.target.value })}
                placeholder="What it should be"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Justification</label>
            <textarea
              value={form.justification}
              onChange={e => onFormChange({ ...form, justification: e.target.value })}
              placeholder="Explain why this is wrong and cite the relevant code section..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 h-20 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSubmit}
              disabled={submitting || !form.fieldCorrected || !form.newValue || !form.justification}
              className="flex items-center gap-1 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>

          {result && (
            <div className={`rounded-lg p-3 text-sm ${
              result.applied ? 'bg-green-50 text-green-700 border border-green-200'
                : result.verificationStatus === 'pending_review' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {result.applied ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Correction verified and applied automatically</span>
                </div>
              ) : result.verificationStatus === 'pending_review' ? (
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span>Correction submitted for manual review</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>Could not auto-verify. Flagged for review. (Weight: {result.userWeight?.toFixed(2)})</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {corrections.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {corrections.map((c: any) => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.field_corrected}</p>
                  <p className="text-xs text-gray-500">
                    <span className="line-through text-red-400">{c.old_value}</span>
                    {' '}&rarr;{' '}
                    <span className="text-green-600 font-medium">{c.new_value}</span>
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.verification_status === 'verified' ? 'bg-green-100 text-green-700'
                    : c.verification_status === 'pending_review' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {c.verification_status?.replace(/_/g, ' ')}
                </span>
              </div>
              {c.justification && (
                <p className="text-xs text-gray-500 mt-1 italic">"{c.justification}"</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{c.user_tier} | weight: {parseFloat(c.user_weight || 0).toFixed(2)}</span>
                {c.applied && <span className="text-xs text-green-600 font-medium">Applied</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OutcomesView({ municipality }: { municipality?: string }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!municipality) return;
    setLoading(true);
    apiClient.get(`/api/v1/zoning-learning/calibration/${encodeURIComponent(municipality)}`)
      .then(res => {
        if (res.data.success) setSummary(res.data.data);
      })
      .catch(e => console.error('Calibration fetch error:', e))
      .finally(() => setLoading(false));
  }, [municipality]);

  if (!municipality) {
    return <p className="text-sm text-gray-500">No municipality selected.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-violet-500" />
      </div>
    );
  }

  if (!summary || (Array.isArray(summary) && summary.length === 0)) {
    return (
      <div className="text-center py-8">
        <TrendingUp size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No outcome data yet for {municipality}.</p>
        <p className="text-xs text-gray-400 mt-1">
          As the agent makes predictions and outcomes are recorded, calibration data will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 font-medium">Prediction Calibration — {municipality}</p>
      {Array.isArray(summary) && summary.map((cal: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900 capitalize">{cal.predictionType}</span>
            <span className="text-xs text-gray-500">{cal.totalOutcomes} outcomes</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-500">Predicted Approval</p>
              <p className="text-sm font-bold text-gray-900">{cal.avgPredictedProbability?.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Actual Approval</p>
              <p className="text-sm font-bold text-gray-900">{cal.actualApprovalRate?.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Bias</p>
              <p className={`text-sm font-bold ${Math.abs(cal.probabilityBias) < 5 ? 'text-green-600' : 'text-orange-600'}`}>
                {cal.probabilityBias > 0 ? '+' : ''}{cal.probabilityBias?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
