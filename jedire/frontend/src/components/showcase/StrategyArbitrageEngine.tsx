import React, { useState } from 'react';
import ShowcaseDataService from '../../services/showcase.service';

export function StrategyArbitrageEngine() {
  const strategies = ShowcaseDataService.getStrategies();
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'roi' | 'risk' | 'cost'>('roi');

  const toggleStrategy = (id: string) => {
    if (selectedStrategies.includes(id)) {
      setSelectedStrategies(selectedStrategies.filter(s => s !== id));
    } else if (selectedStrategies.length < 4) {
      setSelectedStrategies([...selectedStrategies, id]);
    }
  };

  const sortedStrategies = [...strategies].sort((a, b) => {
    switch (sortBy) {
      case 'roi': return b.projectedROI - a.projectedROI;
      case 'cost': return a.implementationCost - b.implementationCost;
      case 'risk': {
        const riskOrder = { low: 1, medium: 2, high: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      default: return 0;
    }
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'value-add': '🔨',
      operational: '⚙️',
      development: '🏗️',
      financial: '💰',
      arbitrage: '🔄',
      'market-timing': '⏰'
    };
    return icons[category] || '📊';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Strategy Arbitrage Engine</h2>
          <p className="text-sm text-gray-600 mt-1">39 strategies analyzed • Select up to 4 to compare</p>
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="roi">Sort by ROI</option>
            <option value="cost">Sort by Cost</option>
            <option value="risk">Sort by Risk</option>
          </select>
        </div>
      </div>

      {/* Strategy Comparison Matrix (if strategies selected) */}
      {selectedStrategies.length > 0 && (
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-4">
            Strategy Comparison ({selectedStrategies.length}/4)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 text-sm font-medium text-blue-800">Metric</th>
                  {selectedStrategies.map(id => {
                    const strategy = strategies.find(s => s.id === id);
                    return (
                      <th key={id} className="p-2 text-sm font-medium text-blue-800">
                        {strategy?.name}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t border-blue-200">
                  <td className="p-2 font-medium">ROI</td>
                  {selectedStrategies.map(id => {
                    const strategy = strategies.find(s => s.id === id);
                    return (
                      <td key={id} className="p-2 font-semibold text-green-700">
                        {strategy?.projectedROI.toFixed(1)}%
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-blue-200">
                  <td className="p-2 font-medium">Cost</td>
                  {selectedStrategies.map(id => {
                    const strategy = strategies.find(s => s.id === id);
                    return (
                      <td key={id} className="p-2">
                        ${(strategy!.implementationCost / 1000).toFixed(0)}K
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-blue-200">
                  <td className="p-2 font-medium">Timeframe</td>
                  {selectedStrategies.map(id => {
                    const strategy = strategies.find(s => s.id === id);
                    return <td key={id} className="p-2">{strategy?.timeframe}</td>;
                  })}
                </tr>
                <tr className="border-t border-blue-200">
                  <td className="p-2 font-medium">Risk Level</td>
                  {selectedStrategies.map(id => {
                    const strategy = strategies.find(s => s.id === id);
                    return (
                      <td key={id} className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRiskColor(strategy!.riskLevel)}`}>
                          {strategy?.riskLevel}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-blue-200">
                  <td className="p-2 font-medium">Confidence</td>
                  {selectedStrategies.map(id => {
                    const strategy = strategies.find(s => s.id === id);
                    return <td key={id} className="p-2">{strategy?.confidence}%</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Strategy List */}
      <div className="grid gap-3">
        {sortedStrategies.map(strategy => {
          const isSelected = selectedStrategies.includes(strategy.id);
          
          return (
            <div
              key={strategy.id}
              onClick={() => toggleStrategy(strategy.id)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getCategoryIcon(strategy.category)}</div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
                        {isSelected && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{strategy.description}</p>
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-green-600">
                        {strategy.projectedROI.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">ROI</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-3">
                    <div>
                      <div className="text-xs text-gray-600">Cost</div>
                      <div className="font-semibold text-gray-900">
                        ${(strategy.implementationCost / 1000).toFixed(0)}K
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Timeframe</div>
                      <div className="font-semibold text-gray-900">{strategy.timeframe}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Risk</div>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getRiskColor(strategy.riskLevel)}`}>
                        {strategy.riskLevel}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Confidence</div>
                      <div className="font-semibold text-gray-900">{strategy.confidence}%</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${strategy.applicability}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{strategy.applicability}% applicable</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Heatmap */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-4">Risk vs. Return Heatmap</h3>
        <div className="relative h-64 bg-gradient-to-br from-green-100 via-yellow-100 to-red-100 rounded-lg p-4">
          {strategies.slice(0, 10).map((strategy, i) => {
            const riskValue = { low: 20, medium: 50, high: 80 }[strategy.riskLevel];
            const left = (strategy.projectedROI / 45) * 100;
            const top = 100 - riskValue;
            
            return (
              <div
                key={strategy.id}
                className="absolute w-3 h-3 bg-blue-600 rounded-full cursor-pointer hover:scale-150 transition-transform"
                style={{ left: `${left}%`, top: `${top}%` }}
                title={`${strategy.name}: ${strategy.projectedROI}% ROI, ${strategy.riskLevel} risk`}
              />
            );
          })}
          
          <div className="absolute bottom-2 left-2 text-xs text-gray-600">Low ROI →</div>
          <div className="absolute bottom-2 right-2 text-xs text-gray-600">← High ROI</div>
          <div className="absolute top-2 left-2 text-xs text-gray-600">High Risk ↑</div>
          <div className="absolute bottom-2 left-2 text-xs text-gray-600">↓ Low Risk</div>
        </div>
      </div>
    </div>
  );
}
