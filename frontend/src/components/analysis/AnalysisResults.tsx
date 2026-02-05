import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  BarChart3,
  MapPin,
  Users,
  Building2,
  DollarSign,
  Home
} from 'lucide-react';
import { analysisAPI } from '@/services/analysisApi';
import { AnalysisInput, AnalysisResult, VerdictType, ATLANTA_NEIGHBORHOODS } from '@/types/analysis';

export default function AnalysisResults() {
  const [input, setInput] = useState<AnalysisInput>({
    name: '',
    population: 50000,
    existing_units: 20000,
    population_growth_rate: 0.018,
    net_migration_annual: 500,
    employment: 70000,
    employment_growth_rate: 0.022,
    median_income: 65000,
    pipeline_units: 500,
    future_permitted_units: 200,
    rent_timeseries: [],
  });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate sample rent timeseries for testing (52 weeks of data)
  const generateSampleRents = (baseRent: number = 1500, trend: 'rising' | 'falling' | 'stable' = 'rising') => {
    const weeks = 52;
    const rents = [];
    for (let i = 0; i < weeks; i++) {
      let noise = (Math.random() - 0.5) * 50; // +/- $25 noise
      let trendValue = 0;
      if (trend === 'rising') {
        trendValue = (i / weeks) * 200; // $200 increase over year
      } else if (trend === 'falling') {
        trendValue = -(i / weeks) * 150; // $150 decrease over year
      }
      rents.push(baseRent + trendValue + noise);
    }
    return rents;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.name || input.population <= 0 || input.existing_units <= 0) {
      setError('Please select a neighborhood and fill in all required fields');
      return;
    }

    // Generate sample rent data if not provided
    const rentData = input.rent_timeseries.length > 0 
      ? input.rent_timeseries 
      : generateSampleRents(1500, 'rising');

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const analysisInput = {
        ...input,
        rent_timeseries: rentData,
      };
      
      const response = await analysisAPI.analyze(analysisInput);
      
      if (response.success && response.result) {
        setResult(response.result);
      } else {
        setError(response.error || 'Analysis failed');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to analyze submarket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getVerdictConfig = (verdict: VerdictType) => {
    switch (verdict) {
      case 'STRONG_OPPORTUNITY':
        return {
          color: 'bg-green-600',
          textColor: 'text-green-600',
          bgLight: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: <TrendingUp className="w-12 h-12" />,
          label: 'STRONG OPPORTUNITY'
        };
      case 'MODERATE_OPPORTUNITY':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-500',
          bgLight: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: <CheckCircle2 className="w-12 h-12" />,
          label: 'MODERATE OPPORTUNITY'
        };
      case 'NEUTRAL':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-600',
          bgLight: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: <BarChart3 className="w-12 h-12" />,
          label: 'NEUTRAL'
        };
      case 'CAUTION':
        return {
          color: 'bg-orange-500',
          textColor: 'text-orange-600',
          bgLight: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: <AlertTriangle className="w-12 h-12" />,
          label: 'CAUTION'
        };
      case 'AVOID':
        return {
          color: 'bg-red-600',
          textColor: 'text-red-600',
          bgLight: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: <TrendingDown className="w-12 h-12" />,
          label: 'AVOID'
        };
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) {
      return 'bg-green-100 text-green-800 border-green-300';
    } else if (confidence >= 0.4) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    } else {
      return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.7) return 'HIGH';
    if (confidence >= 0.4) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Market Imbalance Analysis</h1>
        <p className="text-gray-600">
          Analyze Atlanta submarket dynamics and identify real estate opportunities
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Submarket Analysis</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Neighborhood Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Atlanta Neighborhood *
            </label>
            <select
              value={input.name}
              onChange={(e) => setInput({ ...input, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Select Neighborhood --</option>
              {ATLANTA_NEIGHBORHOODS.map(neighborhood => (
                <option key={neighborhood} value={neighborhood}>
                  {neighborhood}
                </option>
              ))}
            </select>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Population *
              </label>
              <input
                type="number"
                placeholder="e.g., 50000"
                value={input.population || ''}
                onChange={(e) => setInput({ ...input, population: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Existing Units *
              </label>
              <input
                type="number"
                placeholder="e.g., 20000"
                value={input.existing_units || ''}
                onChange={(e) => setInput({ ...input, existing_units: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Median Income
              </label>
              <input
                type="number"
                placeholder="e.g., 65000"
                value={input.median_income || ''}
                onChange={(e) => setInput({ ...input, median_income: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Supply Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Home className="w-4 h-4 inline mr-1" />
                Pipeline Units
              </label>
              <input
                type="number"
                placeholder="e.g., 500"
                value={input.pipeline_units || ''}
                onChange={(e) => setInput({ ...input, pipeline_units: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Units under construction</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Home className="w-4 h-4 inline mr-1" />
                Future Permitted
              </label>
              <input
                type="number"
                placeholder="e.g., 200"
                value={input.future_permitted_units || ''}
                onChange={(e) => setInput({ ...input, future_permitted_units: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Permitted but not started</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Employment
              </label>
              <input
                type="number"
                placeholder="e.g., 70000"
                value={input.employment || ''}
                onChange={(e) => setInput({ ...input, employment: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Rent timeseries data will be automatically generated for testing. 
              In production, this would come from real market data sources.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  Analyze Market
                </>
              )}
            </button>

            {result && (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300"
              >
                Clear Results
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Verdict Card - Big and Bold */}
          <div className={`rounded-lg border-2 p-8 ${getVerdictConfig(result.verdict).bgLight} ${getVerdictConfig(result.verdict).borderColor}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`${getVerdictConfig(result.verdict).textColor}`}>
                  {getVerdictConfig(result.verdict).icon}
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-gray-900">
                    {getVerdictConfig(result.verdict).label}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {result.submarket} Market Analysis
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold text-gray-900">{result.composite_score}</div>
                <div className="text-sm text-gray-600 mt-1">Score (0-100)</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Confidence Level:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getConfidenceBadge(result.confidence)}`}>
                {getConfidenceLabel(result.confidence)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Demand Signal */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Demand Signal
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Strength:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    result.demand_signal.strength === 'STRONG' ? 'bg-green-100 text-green-800' :
                    result.demand_signal.strength === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.demand_signal.strength}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Score:</span>
                  <span className="text-lg font-bold text-gray-900">{result.demand_signal.score}/100</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Rent Growth Rate:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {(result.demand_signal.rent_growth_rate * 100).toFixed(1)}%
                  </span>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">{result.demand_signal.summary}</p>
                </div>
              </div>
            </div>

            {/* Supply Signal */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Supply Signal
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Verdict:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    result.supply_signal.verdict === 'CRITICALLY_UNDERSUPPLIED' || result.supply_signal.verdict === 'UNDERSUPPLIED' ? 'bg-green-100 text-green-800' :
                    result.supply_signal.verdict === 'BALANCED' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {result.supply_signal.verdict.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Saturation:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {result.supply_signal.saturation_pct.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Demand Units:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {result.supply_signal.demand_units.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Total Supply:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {result.supply_signal.total_supply.toLocaleString()}
                  </span>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">{result.supply_signal.summary}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Factors */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Key Factors
              </h3>
              
              {result.key_factors.length === 0 ? (
                <p className="text-gray-500 text-sm">No factors identified</p>
              ) : (
                <ul className="space-y-2">
                  {result.key_factors.map((factor, index) => (
                    <li key={index} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{factor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Risks */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Risks
              </h3>
              
              {result.risks.length === 0 ? (
                <p className="text-gray-500 text-sm">No significant risks identified</p>
              ) : (
                <ul className="space-y-2">
                  {result.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 p-3 rounded-lg bg-red-50">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{risk}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Recommendation
            </h3>
            
            <div className="prose prose-sm text-gray-700 max-w-none">
              <p className="leading-relaxed">{result.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Analyze</h3>
          <p className="text-gray-600">
            Select an Atlanta neighborhood and enter market data to get started
          </p>
        </div>
      )}
    </div>
  );
}
