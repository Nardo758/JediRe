import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Save } from 'lucide-react';
import { commissionAPI } from '@/services/api';
import { Commission } from '@/types';

interface CommissionCalculatorProps {
  onSave?: (commission: Commission) => void;
}

export default function CommissionCalculator({ onSave }: CommissionCalculatorProps) {
  const [dealValue, setDealValue] = useState<string>('');
  const [commissionRate, setCommissionRate] = useState<string>('3');
  const [splitPercentage, setSplitPercentage] = useState<string>('50');
  const [grossCommission, setGrossCommission] = useState<number>(0);
  const [netCommission, setNetCommission] = useState<number>(0);
  const [showToast, setShowToast] = useState(false);

  // Scenarios for what-if calculator
  const [scenarios] = useState([
    { name: 'Standard', rate: 3, split: 50 },
    { name: 'Premium', rate: 5, split: 60 },
    { name: 'Low Split', rate: 3, split: 40 },
    { name: 'High Rate', rate: 6, split: 50 },
  ]);

  useEffect(() => {
    calculateCommission();
  }, [dealValue, commissionRate, splitPercentage]);

  const calculateCommission = () => {
    const value = parseFloat(dealValue) || 0;
    const rate = parseFloat(commissionRate) || 0;
    const split = parseFloat(splitPercentage) || 0;

    const { grossCommission: gross, netCommission: net } = commissionAPI.calculate(
      value,
      rate,
      split
    );

    setGrossCommission(gross);
    setNetCommission(net);
  };

  const handleSaveCommission = async () => {
    if (!dealValue || parseFloat(dealValue) <= 0) {
      alert('Please enter a valid deal value');
      return;
    }

    try {
      const commission = await commissionAPI.create({
        dealValue: parseFloat(dealValue),
        commissionRate: parseFloat(commissionRate),
        splitPercentage: parseFloat(splitPercentage),
        grossCommission,
        netCommission,
        status: 'pending',
      });

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      onSave?.(commission);

      // Reset form
      setDealValue('');
      setCommissionRate('3');
      setSplitPercentage('50');
    } catch (error) {
      console.error('Failed to save commission:', error);
      alert('Failed to save commission');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const applyScenario = (scenario: { rate: number; split: number }) => {
    setCommissionRate(scenario.rate.toString());
    setSplitPercentage(scenario.split.toString());
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Commission Calculator</h2>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <span className="text-sm font-medium">✓ Commission saved successfully!</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg mb-4">Input Values</h3>

          {/* Deal Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Value <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="commission-deal-value"
                name="dealValue"
                type="number"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                aria-label="Deal value"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="500000"
                min="0"
                step="1000"
              />
            </div>
          </div>

          {/* Commission Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Commission Rate (%)
            </label>
            <input
              id="commission-rate"
              name="commissionRate"
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              aria-label="Commission rate percentage"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="3"
              min="0"
              max="100"
              step="0.1"
            />
            <input
              id="commission-rate-slider"
              name="commissionRateSlider"
              type="range"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              aria-label="Commission rate slider"
              min="0"
              max="10"
              step="0.1"
              className="w-full mt-2"
            />
          </div>

          {/* Split Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Split (%)
            </label>
            <input
              id="commission-split-percentage"
              name="splitPercentage"
              type="number"
              value={splitPercentage}
              onChange={(e) => setSplitPercentage(e.target.value)}
              aria-label="Your split percentage"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="50"
              min="0"
              max="100"
              step="1"
            />
            <input
              id="commission-split-slider"
              name="splitPercentageSlider"
              type="range"
              value={splitPercentage}
              onChange={(e) => setSplitPercentage(e.target.value)}
              aria-label="Your split percentage slider"
              min="0"
              max="100"
              step="1"
              className="w-full mt-2"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveCommission}
            className="w-full mt-4 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Save Commission
          </button>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg mb-4">Breakdown</h3>

          {/* Gross Commission */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-700 font-medium mb-1">Gross Commission</div>
            <div className="text-3xl font-bold text-blue-900">{formatCurrency(grossCommission)}</div>
            <div className="text-xs text-blue-600 mt-1">
              {dealValue ? `${commissionRate}% of ${formatCurrency(parseFloat(dealValue))}` : '—'}
            </div>
          </div>

          {/* Split Visual */}
          {grossCommission > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-700 font-medium mb-2">Commission Split</div>
              <div className="h-8 flex rounded-lg overflow-hidden">
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${splitPercentage}%` }}
                >
                  You ({splitPercentage}%)
                </div>
                <div
                  className="bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-medium"
                  style={{ width: `${100 - parseFloat(splitPercentage)}%` }}
                >
                  Broker ({100 - parseFloat(splitPercentage)}%)
                </div>
              </div>
            </div>
          )}

          {/* Net Commission */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-700 font-medium mb-1">Your Net Commission</div>
            <div className="text-3xl font-bold text-green-900">{formatCurrency(netCommission)}</div>
            <div className="text-xs text-green-600 mt-1">
              {grossCommission > 0 ? `${splitPercentage}% of gross` : '—'}
            </div>
          </div>

          {/* Scenarios */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-700 font-medium mb-3">Quick Scenarios</div>
            <div className="grid grid-cols-2 gap-2">
              {scenarios.map((scenario) => {
                const { netCommission: scenarioNet } = commissionAPI.calculate(
                  parseFloat(dealValue) || 0,
                  scenario.rate,
                  scenario.split
                );
                return (
                  <button
                    key={scenario.name}
                    onClick={() => applyScenario(scenario)}
                    className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm transition-all"
                  >
                    <div className="text-xs font-medium text-gray-900 mb-1">
                      {scenario.name}
                    </div>
                    <div className="text-xs text-gray-600">
                      {scenario.rate}% @ {scenario.split}% split
                    </div>
                    <div className="text-sm font-semibold text-blue-600 mt-1">
                      {formatCurrency(scenarioNet)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      {dealValue && parseFloat(dealValue) > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-1">Commission Rate</div>
              <div className="text-xl font-bold text-gray-900">{commissionRate}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Your Split</div>
              <div className="text-xl font-bold text-gray-900">{splitPercentage}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Effective Rate</div>
              <div className="text-xl font-bold text-gray-900">
                {((parseFloat(commissionRate) * parseFloat(splitPercentage)) / 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
