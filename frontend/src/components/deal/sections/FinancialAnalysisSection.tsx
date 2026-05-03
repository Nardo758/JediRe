import React, { useState, useEffect, useCallback } from 'react';
import { Deal } from '../../../types';
import ModuleUpsellBanner from './ModuleUpsellBanner';
import { checkModule } from '../../../utils/modules';
import { financialModelsService } from '../../../services/financialModels.service';

export interface FinancialAnalysisSectionProps {
  deal: Deal;
  enhanced: boolean;
  onToggleModule?: () => void;
}

// Component builder blocks for Enhanced version
const COMPONENT_BLOCKS = [
  { id: 1, name: 'Acquisition Costs', icon: '💰', color: 'bg-blue-100' },
  { id: 2, name: 'Financing Terms', icon: '🏦', color: 'bg-green-100' },
  { id: 3, name: 'Operating Income', icon: '📈', color: 'bg-purple-100' },
  { id: 4, name: 'Operating Expenses', icon: '📊', color: 'bg-yellow-100' },
  { id: 5, name: 'Capital Expenditures', icon: '🔧', color: 'bg-red-100' },
  { id: 6, name: 'Reserve Funds', icon: '💵', color: 'bg-indigo-100' },
  { id: 7, name: 'Exit Strategy', icon: '🎯', color: 'bg-pink-100' },
  { id: 8, name: 'IRR Calculator', icon: '📉', color: 'bg-teal-100' },
  { id: 9, name: 'Cash Flow Projection', icon: '💸', color: 'bg-orange-100' },
  { id: 10, name: 'Waterfall Analysis', icon: '🌊', color: 'bg-cyan-100' },
  { id: 11, name: 'Tax Implications', icon: '📝', color: 'bg-lime-100' },
  { id: 12, name: 'Equity Structure', icon: '🏗️', color: 'bg-amber-100' },
  { id: 13, name: 'Sensitivity Dashboard', icon: '🎚️', color: 'bg-violet-100' }
];

export const FinancialAnalysisSection: React.FC<FinancialAnalysisSectionProps> = ({
  deal,
  enhanced,
  onToggleModule
}) => {
  // Persistence state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);

  // Basic calculator state
  const [purchasePrice, setPurchasePrice] = useState<number>(deal.dealValue || 0);
  const [downPayment, setDownPayment] = useState<number>(20); // percentage
  const [interestRate, setInterestRate] = useState<number>(6.5); // percentage
  const [loanTerm, setLoanTerm] = useState<number>(30); // years
  const [estimatedNOI, setEstimatedNOI] = useState<number>(0);
  const [capRate, setCapRate] = useState<number>(0);

  // Enhanced version state
  const [activeComponents, setActiveComponents] = useState<number[]>([1, 2, 3]);
  
  // Sensitivity analysis state
  const [revenueAdjust, setRevenueAdjust] = useState<number>(0); // -10 to +10
  const [expenseAdjust, setExpenseAdjust] = useState<number>(0); // -5 to +5
  const [capRateAdjust, setCapRateAdjust] = useState<number>(0); // -0.5 to +0.5

  // Load existing financial model on mount
  useEffect(() => {
    const loadModel = async () => {
      if (!enhanced) {
        setLoading(false);
        return;
      }

      try {
        const response = await financialModelsService.getFinancialModel(deal.id);
        const model = response.data;
        
        setModelId(model.id);
        
        // Load assumptions
        if (model.assumptions) {
          setPurchasePrice(model.assumptions.purchasePrice || deal.dealValue || 0);
          setDownPayment(model.assumptions.downPayment || 20);
          setInterestRate(model.assumptions.interestRate || 6.5);
          setLoanTerm(model.assumptions.loanTerm || 30);
          setEstimatedNOI(model.assumptions.estimatedNOI || 0);
          setCapRate(model.assumptions.capRate || 0);
          setRevenueAdjust(model.assumptions.revenueAdjust || 0);
          setExpenseAdjust(model.assumptions.expenseAdjust || 0);
          setCapRateAdjust(model.assumptions.capRateAdjust || 0);
        }
        
        // Load components
        if (model.components?.activeComponents) {
          setActiveComponents(model.components.activeComponents);
        }
      } catch (error: any) {
        // Model doesn't exist yet - that's okay
        console.log('No existing model, will create on save');
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [deal.id, enhanced]);

  // Auto-save function with debouncing
  const autoSave = useCallback(async () => {
    if (!enhanced) return;

    setSaving(true);
    setSaveError(null);

    try {
      const modelData = {
        dealId: deal.id,
        name: `Financial Model - ${deal.name}`,
        components: {
          activeComponents
        },
        assumptions: {
          purchasePrice,
          downPayment,
          interestRate,
          loanTerm,
          estimatedNOI,
          capRate,
          revenueAdjust,
          expenseAdjust,
          capRateAdjust
        },
        results: {
          noi: estimatedNOI,
          cashOnCashReturn,
          debtServiceCoverageRatio,
          monthlyPayment,
          annualDebtService
        }
      };

      if (modelId) {
        await financialModelsService.updateFinancialModel(modelId, modelData);
      } else {
        const response = await financialModelsService.saveFinancialModel(modelData);
        setModelId(response.data.id);
      }
    } catch (error: any) {
      console.error('Auto-save failed:', error);
      setSaveError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [
    enhanced, deal.id, deal.name, modelId, activeComponents,
    purchasePrice, downPayment, interestRate, loanTerm,
    estimatedNOI, capRate, revenueAdjust, expenseAdjust, capRateAdjust
  ]);

  // Calculate loan amount
  const loanAmount = purchasePrice * (1 - downPayment / 100);
  
  // Calculate monthly payment using standard mortgage formula
  const monthlyRate = interestRate / 100 / 12;
  const numberOfPayments = loanTerm * 12;
  const monthlyPayment = loanAmount > 0 && monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
    : 0;
  
  // Calculate annual debt service
  const annualDebtService = monthlyPayment * 12;

  // Calculate basic metrics
  const cashOnCashReturn = estimatedNOI > 0 && purchasePrice > 0
    ? ((estimatedNOI - annualDebtService) / (purchasePrice * downPayment / 100)) * 100
    : 0;

  const debtServiceCoverageRatio = annualDebtService > 0
    ? estimatedNOI / annualDebtService
    : 0;

  // Handle input blur (auto-save)
  const handleBlur = () => {
    if (enhanced && !loading) {
      autoSave();
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const toggleComponent = (id: number) => {
    setActiveComponents(prev => {
      const newComponents = prev.includes(id) 
        ? prev.filter(cid => cid !== id)
        : [...prev, id];
      
      // Trigger auto-save after state update
      setTimeout(() => autoSave(), 100);
      
      return newComponents;
    });
  };

  // Enhanced version content
  if (enhanced) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Financial Analysis</h2>
              <p className="text-sm text-gray-600 mt-1">
                Professional-grade financial modeling for {deal.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
              {saving && (
                <span className="text-sm text-blue-600">💾 Saving...</span>
              )}
              {!loading && !saving && saveError && (
                <span className="text-sm text-red-600">⚠️ {saveError}</span>
              )}
              {!loading && !saving && !saveError && modelId && (
                <span className="text-sm text-green-600">✓ Saved</span>
              )}
            </div>
          </div>

          {/* Component Builder */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📦 Component Builder
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select components to build your custom financial model
            </p>
            
            <div className="grid grid-cols-4 gap-3">
              {COMPONENT_BLOCKS.map(block => (
                <button
                  key={block.id}
                  onClick={() => toggleComponent(block.id)}
                  className={`p-4 rounded-lg border-2 transition ${
                    activeComponents.includes(block.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-12 h-12 ${block.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                    <span className="text-2xl">{block.icon}</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-700 text-center">
                    {block.name}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm text-gray-600">
              {activeComponents.length} of {COMPONENT_BLOCKS.length} components selected
            </div>
          </div>

          {/* Sensitivity Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              🎚️ Sensitivity Analysis
            </h3>
            
            <div className="space-y-6">
              {/* Revenue Adjustment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Revenue Adjustment
                  </label>
                  <span className="text-sm font-semibold text-blue-600">
                    {revenueAdjust > 0 ? '+' : ''}{revenueAdjust.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={revenueAdjust}
                  onChange={(e) => setRevenueAdjust(parseFloat(e.target.value))}
                  onBlur={handleBlur}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-10%</span>
                  <span>0%</span>
                  <span>+10%</span>
                </div>
              </div>

              {/* Expense Adjustment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Expense Adjustment
                  </label>
                  <span className="text-sm font-semibold text-orange-600">
                    {expenseAdjust > 0 ? '+' : ''}{expenseAdjust.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.25"
                  value={expenseAdjust}
                  onChange={(e) => setExpenseAdjust(parseFloat(e.target.value))}
                  onBlur={handleBlur}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-5%</span>
                  <span>0%</span>
                  <span>+5%</span>
                </div>
              </div>

              {/* Cap Rate Adjustment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Cap Rate Adjustment
                  </label>
                  <span className="text-sm font-semibold text-purple-600">
                    {capRateAdjust > 0 ? '+' : ''}{(capRateAdjust * 100).toFixed(0)} bps
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.05"
                  value={capRateAdjust}
                  onChange={(e) => setCapRateAdjust(parseFloat(e.target.value))}
                  onBlur={handleBlur}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-50 bps</span>
                  <span>0 bps</span>
                  <span>+50 bps</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monte Carlo Results */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              🎲 Monte Carlo Simulation Results
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              10,000 simulations across varying market conditions
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="text-sm text-gray-600 mb-1">P90 (Conservative)</div>
                <div className="text-3xl font-bold text-red-600">8.2%</div>
                <div className="text-xs text-gray-500 mt-1">IRR</div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-400">
                <div className="text-sm text-gray-600 mb-1">P50 (Expected)</div>
                <div className="text-3xl font-bold text-blue-600">14.7%</div>
                <div className="text-xs text-gray-500 mt-1">IRR</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-gray-600 mb-1">P10 (Optimistic)</div>
                <div className="text-3xl font-bold text-green-600">22.1%</div>
                <div className="text-xs text-gray-500 mt-1">IRR</div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600">
                📊 Probability of achieving target 15% IRR: <span className="font-bold text-gray-900">67%</span>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📤 Export Analysis
            </h3>
            
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                📊 Export to Excel
              </button>
              <button className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">
                📄 Export to PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Basic version content
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">
            Basic financial calculator for {deal.name}
          </p>
        </div>

        {/* Module Upsell Banner */}
        <ModuleUpsellBanner
          moduleName="Financial Modeling Pro"
          price="$29"
          benefits={[
            'Professional component builder with 13 customizable blocks',
            'Sensitivity analysis with revenue, expense, and cap rate sliders',
            'Monte Carlo simulation with P90/P50/P10 IRR projections',
            'Export to Excel and PDF for investor presentations',
            'Advanced waterfall analysis and equity structuring',
            'Real-time collaboration and version control'
          ]}
          bundleInfo={{
            name: 'Developer Bundle',
            price: '$149',
            savings: '30%'
          }}
          onAddModule={onToggleModule}
          onUpgradeBundle={() => console.log('Upgrade to bundle clicked')}
          onLearnMore={() => console.log('Learn more clicked')}
        />

        {/* Basic Calculator */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Loan Calculator
          </h3>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Purchase Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  onBlur={handleBlur}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Down Payment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Down Payment (%)
              </label>
              <input
                type="number"
                value={downPayment}
                onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.125"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Loan Term */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loan Term (years)
              </label>
              <input
                type="number"
                value={loanTerm}
                onChange={(e) => setLoanTerm(parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Calculated Outputs */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Monthly Payment</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(monthlyPayment)}
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Annual Debt Service</div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(annualDebtService)}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Loan Amount</div>
                <div className="text-xl font-bold text-gray-700">
                  {formatCurrency(loanAmount)}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Down Payment</div>
                <div className="text-xl font-bold text-gray-700">
                  {formatCurrency(purchasePrice * downPayment / 100)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Property Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Property Metrics
          </h3>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Estimated NOI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated NOI (Annual)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={estimatedNOI}
                  onChange={(e) => setEstimatedNOI(parseFloat(e.target.value) || 0)}
                  onBlur={handleBlur}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cap Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cap Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={capRate}
                onChange={(e) => setCapRate(parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.0"
              />
            </div>
          </div>

          {/* Basic Metrics Display */}
          {estimatedNOI > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Key Performance Indicators
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Cash-on-Cash Return</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatPercent(cashOnCashReturn)}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">DSCR</div>
                  <div className="text-xl font-bold text-yellow-600">
                    {debtServiceCoverageRatio.toFixed(2)}x
                  </div>
                </div>
                
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Cap Rate</div>
                  <div className="text-xl font-bold text-indigo-600">
                    {formatPercent(capRate)}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-900">
                  💡 <span className="font-semibold">Tip:</span> Upgrade to Financial Modeling Pro for detailed cash flow projections, IRR calculations, and sensitivity analysis.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">
            📚 Understanding the Basics
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li><strong>NOI (Net Operating Income):</strong> Annual rental income minus operating expenses</li>
            <li><strong>Cap Rate:</strong> NOI divided by purchase price (measures return on investment)</li>
            <li><strong>Cash-on-Cash Return:</strong> Annual cash flow divided by cash invested</li>
            <li><strong>DSCR (Debt Service Coverage Ratio):</strong> NOI divided by annual debt payments (lenders typically require 1.25x or higher)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FinancialAnalysisSection;
