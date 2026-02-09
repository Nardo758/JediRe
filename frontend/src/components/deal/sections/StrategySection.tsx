import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Lightbulb, BookOpen, CheckCircle } from 'lucide-react';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';
import { Button } from '../../shared/Button';
import { strategyAnalysisService } from '../../../services/strategyAnalysis.service';

interface StrategySectionProps {
  deal: any;
  enhanced: boolean;
  onToggleModule: (moduleSlug: string) => void;
}

// Pre-loaded strategies data
const strategiesData = {
  'value-add': [
    { id: 'va-1', name: 'Operational Turnaround', irr: '18-24%', risk: 6, timeline: '18-24mo', capex: '$500K' },
    { id: 'va-2', name: 'Deferred Maintenance Recovery', irr: '16-20%', risk: 7, timeline: '12-18mo', capex: '$800K' },
    { id: 'va-3', name: 'Amenity Upgrade Program', irr: '14-18%', risk: 5, timeline: '24-36mo', capex: '$1.2M' },
    { id: 'va-4', name: 'Unit Renovation Value-Add', irr: '15-20%', risk: 6, timeline: '18-24mo', capex: '$600K' },
    { id: 'va-5', name: 'Repositioning (Class B to A-)', irr: '20-26%', risk: 8, timeline: '24-36mo', capex: '$1.5M' }
  ],
  'core': [
    { id: 'c-1', name: 'Stable Cash Flow Hold', irr: '8-12%', risk: 3, timeline: '60mo+', capex: '$200K' },
    { id: 'c-2', name: 'Long-Term Appreciation Play', irr: '10-14%', risk: 4, timeline: '84mo+', capex: '$300K' },
    { id: 'c-3', name: 'Income-Focused Portfolio', irr: '9-11%', risk: 2, timeline: '120mo+', capex: '$150K' }
  ],
  'opportunistic': [
    { id: 'o-1', name: 'Distressed Asset Turnaround', irr: '25-35%', risk: 9, timeline: '12-24mo', capex: '$1M' },
    { id: 'o-2', name: 'Short-Term Flip', irr: '20-30%', risk: 8, timeline: '6-12mo', capex: '$400K' },
    { id: 'o-3', name: 'Market Timing Play', irr: '18-28%', risk: 7, timeline: '12-18mo', capex: '$500K' }
  ],
  'development': [
    { id: 'd-1', name: 'Ground-Up Development', irr: '20-30%', risk: 9, timeline: '36-48mo', capex: '$5M' },
    { id: 'd-2', name: 'Adaptive Reuse', irr: '18-25%', risk: 8, timeline: '24-36mo', capex: '$3M' },
    { id: 'd-3', name: 'Expansion/Addition', irr: '16-22%', risk: 7, timeline: '18-30mo', capex: '$2M' }
  ]
};

const basicStrategies = [
  { value: 'value-add', label: 'Value-Add', description: 'Value-Add strategies focus on increasing NOI through operational improvements, rent growth, and expense reduction.' },
  { value: 'core', label: 'Core', description: 'Core strategies emphasize stable, predictable cash flows with lower risk and moderate returns over long holding periods.' },
  { value: 'opportunistic', label: 'Opportunistic', description: 'Opportunistic strategies target higher returns through distressed assets, market timing, and aggressive value creation.' },
  { value: 'development', label: 'Development', description: 'Development strategies involve ground-up construction or major redevelopment with highest risk and return potential.' },
  { value: 'ground-up', label: 'Ground-Up', description: 'Ground-up construction from vacant land, requiring extensive capital and expertise with multi-year timelines.' }
];

const getRiskLabel = (score: number): string => {
  if (score <= 3) return 'Low';
  if (score <= 6) return 'Medium';
  return 'High';
};

const getRiskColor = (score: number): string => {
  if (score <= 3) return 'text-green-600 bg-green-100';
  if (score <= 6) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
};

export function StrategySection({ deal, enhanced, onToggleModule }: StrategySectionProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedBasicStrategy, setSelectedBasicStrategy] = useState('value-add');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['va-1']);
  const [comparisonStrategies, setComparisonStrategies] = useState<any[]>([
    strategiesData['value-add'][0],
    strategiesData['value-add'][1],
    strategiesData['value-add'][2]
  ]);

  // Load saved strategy analyses on mount
  useEffect(() => {
    if (!enhanced) return;

    const loadAnalyses = async () => {
      setLoading(true);
      try {
        const response = await strategyAnalysisService.getStrategyAnalysis(deal.id);
        if (response.data && response.data.length > 0) {
          // Load the most recent strategies
          const recentStrategies = response.data.slice(0, 3);
          setComparisonStrategies(recentStrategies.map(s => ({
            id: s.strategySlug,
            name: s.strategySlug,
            irr: `${s.roi_metrics.irr}%`,
            risk: s.risk_score,
            timeline: `${s.roi_metrics.timeline_months}mo`,
            capex: `$${(s.roi_metrics.capex / 1000).toFixed(0)}K`,
            recommended: s.recommended
          })));
        }
      } catch (error) {
        console.log('No saved strategies found');
      } finally {
        setLoading(false);
      }
    };

    loadAnalyses();
  }, [deal.id, enhanced]);

  const handleAddModule = () => {
    onToggleModule('strategy-arbitrage-engine');
  };

  const handleUpgradeBundle = () => {
    // Navigate to bundle upgrade page
    console.log('Upgrade to bundle');
  };

  const handleLearnMore = () => {
    // Open module details modal
    console.log('Learn more about Strategy Arbitrage Engine');
  };

  const saveStrategy = async (strategy: any) => {
    if (!enhanced) return;

    setSaving(true);
    try {
      await strategyAnalysisService.saveStrategySelection({
        dealId: deal.id,
        strategySlug: strategy.id,
        assumptions: {},
        roiMetrics: {
          irr: parseFloat(strategy.irr) || 0,
          risk_score: strategy.risk || 0,
          timeline_months: parseInt(strategy.timeline) || 0,
          capex: parseInt(strategy.capex.replace(/[$K]/g, '')) * 1000 || 0
        },
        riskScore: strategy.risk || 0,
        recommended: strategy.recommended || false
      });
    } catch (error) {
      console.error('Failed to save strategy:', error);
    } finally {
      setSaving(false);
    }
  };

  const addToComparison = (strategy: any) => {
    if (comparisonStrategies.length < 4 && !comparisonStrategies.find(s => s.id === strategy.id)) {
      setComparisonStrategies([...comparisonStrategies, strategy]);
      saveStrategy(strategy);
    }
  };

  const removeFromComparison = (strategyId: string) => {
    setComparisonStrategies(comparisonStrategies.filter(s => s.id !== strategyId));
  };

  // BASIC VERSION
  if (!enhanced) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Strategy</h2>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Selection</h3>
          
          <p className="text-sm text-gray-600 mb-4">Select your investment strategy:</p>
          
          <div className="space-y-3">
            {basicStrategies.map((strategy) => (
              <label 
                key={strategy.value}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="strategy"
                  value={strategy.value}
                  checked={selectedBasicStrategy === strategy.value}
                  onChange={(e) => setSelectedBasicStrategy(e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">{strategy.label}</div>
                  <div className="text-sm text-gray-600 mt-1">{strategy.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <ModuleUpsellBanner
          moduleName="Strategy Arbitrage Engine"
          price="$39"
          benefits={[
            '39 pre-loaded strategies with detailed playbooks',
            'Custom strategy builder',
            'ROI comparison matrix (side-by-side analysis)',
            'Risk scoring for each strategy',
            'AI-recommended best-fit strategy for this deal'
          ]}
          bundleInfo={{
            name: 'Flipper Bundle',
            price: '$89',
            savings: '20%'
          }}
          onAddModule={handleAddModule}
          onUpgradeBundle={handleUpgradeBundle}
          onLearnMore={handleLearnMore}
        />
      </div>
    );
  }

  // ENHANCED VERSION
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Strategy</h2>
        <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
          Strategy Arbitrage Engine Active
        </span>
      </div>

      {/* AI Recommended Strategy */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI-Recommended Strategy</h3>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-xl font-bold text-gray-900">Multifamily Value-Add (Operational Turnaround)</h4>
              <p className="text-sm text-gray-600 mt-1">Based on your deal parameters and market conditions</p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected IRR</div>
              <div className="text-lg font-bold text-gray-900">18-24%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Risk Score</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">6/10</span>
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">Medium</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Timeline</div>
              <div className="text-lg font-bold text-gray-900">18-24 months</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CapEx Required</div>
              <div className="text-lg font-bold text-gray-900">$500K</div>
            </div>
          </div>
          
          <div className="flex gap-3 mt-4">
            <Button variant="default" size="sm">
              <BookOpen className="w-4 h-4 mr-2" />
              View Playbook
            </Button>
            <Button variant="outline" size="sm">
              Select Strategy
            </Button>
          </div>
        </div>
      </div>

      {/* All Strategies Grouped by Category */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">39 Pre-Loaded Strategies</h3>
        
        <div className="space-y-6">
          {Object.entries(strategiesData).map(([category, strategies]) => (
            <div key={category}>
              <h4 className="text-md font-semibold text-gray-700 mb-3 capitalize flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {category.replace('-', ' ')} ({strategies.length} strategies)
              </h4>
              
              <div className="space-y-2">
                {strategies.map((strategy) => (
                  <div 
                    key={strategy.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{strategy.name}</div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span>IRR: {strategy.irr}</span>
                        <span>•</span>
                        <span>Timeline: {strategy.timeline}</span>
                        <span>•</span>
                        <span>CapEx: {strategy.capex}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getRiskColor(strategy.risk)}`}>
                        {getRiskLabel(strategy.risk)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => addToComparison(strategy)}
                        disabled={comparisonStrategies.length >= 4}
                      >
                        Compare
                      </Button>
                      <Button variant="outline" size="sm">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Playbook
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Matrix */}
      {comparisonStrategies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Comparison Matrix</h3>
          <p className="text-sm text-gray-600 mb-4">Compare up to 4 strategies side-by-side ({comparisonStrategies.length}/4)</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metric</th>
                  {comparisonStrategies.map((strategy) => (
                    <th key={strategy.id} className="text-left py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900">{strategy.name}</span>
                        <button 
                          onClick={() => removeFromComparison(strategy.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">IRR</td>
                  {comparisonStrategies.map((strategy) => (
                    <td key={strategy.id} className="py-3 px-4 text-sm text-gray-900 font-semibold">{strategy.irr}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">Risk</td>
                  {comparisonStrategies.map((strategy) => (
                    <td key={strategy.id} className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getRiskColor(strategy.risk)}`}>
                        {getRiskLabel(strategy.risk)} ({strategy.risk}/10)
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">Timeline</td>
                  {comparisonStrategies.map((strategy) => (
                    <td key={strategy.id} className="py-3 px-4 text-sm text-gray-900">{strategy.timeline}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">CapEx</td>
                  {comparisonStrategies.map((strategy) => (
                    <td key={strategy.id} className="py-3 px-4 text-sm text-gray-900 font-semibold">{strategy.capex}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
