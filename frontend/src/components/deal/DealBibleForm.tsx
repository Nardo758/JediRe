/**
 * Deal Bible Capture Form
 * Captures immutable underwriting assumptions at deal close
 */

import React, { useState } from 'react';

interface DealBibleData {
  // Deal Info
  dealId: string;
  dealName: string;
  closeDate: string;
  purchasePrice: number;
  units: number;
  strategy: string;
  holdPeriod: number; // years
  
  // Market Conditions at Close
  marketCapRate: number;
  marketVacancy: number;
  marketRentGrowth: number;
  fdotAadt?: number;
  digitalDemandIndex?: number;
  jediScore?: number;
  treasuryRate10y?: number;
  
  // Underwriting Assumptions
  exitCapRate: number;
  rentGrowthYr1to3: number;
  rentGrowthYr4to5: number;
  stabilizedVacancy: number;
  capexBudget: number;
  capexScope: string;
  
  // Capital Stack
  lpEquity: number;
  gpEquity: number;
  debtAmount: number;
  debtRate: number;
  debtTerm: number; // years
  acqFee: number;
  mgmtFee: number;
  promoteStructure: string;
  
  // Exit Assumptions
  exitYearBase: number;
  exitNoiBase: number;
  exitValueBase: number;
  exitIrrBase: number;
  exitEmBase: number;
  
  exitNoiBull: number;
  exitValueBull: number;
  exitIrrBull: number;
  exitEmBull: number;
  
  exitNoiBear: number;
  exitValueBear: number;
  exitIrrBear: number;
  exitEmBear: number;
  
  // Key Decisions
  decisions: Array<{
    date: string;
    decision: string;
    rationale: string;
    madeBy: string;
  }>;
  
  // Notes
  notes?: string;
}

interface DealBibleFormProps {
  dealId: string;
  initialData?: Partial<DealBibleData>;
  onSubmit: (data: DealBibleData) => void;
  onCancel: () => void;
}

export const DealBibleForm: React.FC<DealBibleFormProps> = ({
  dealId,
  initialData,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<DealBibleData>>({
    dealId,
    decisions: [],
    ...initialData,
  });

  const [currentTab, setCurrentTab] = useState<'info' | 'market' | 'assumptions' | 'capital' | 'exit' | 'decisions'>('info');

  const updateField = (field: keyof DealBibleData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addDecision = () => {
    const newDecision = {
      date: new Date().toISOString().split('T')[0],
      decision: '',
      rationale: '',
      madeBy: '',
    };
    setFormData(prev => ({
      ...prev,
      decisions: [...(prev.decisions || []), newDecision],
    }));
  };

  const updateDecision = (index: number, field: string, value: string) => {
    const decisions = [...(formData.decisions || [])];
    decisions[index] = { ...decisions[index], [field]: value };
    setFormData(prev => ({ ...prev, decisions }));
  };

  const removeDecision = (index: number) => {
    setFormData(prev => ({
      ...prev,
      decisions: prev.decisions?.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as DealBibleData);
  };

  const tabs = [
    { id: 'info', label: 'Deal Info' },
    { id: 'market', label: 'Market Conditions' },
    { id: 'assumptions', label: 'Underwriting' },
    { id: 'capital', label: 'Capital Stack' },
    { id: 'exit', label: 'Exit Scenarios' },
    { id: 'decisions', label: 'Decision Log' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-5xl mx-auto">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">
          📚 Deal Bible - Capture Underwriting Assumptions
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          This record is <strong>immutable</strong> once saved. It serves as the permanent archive of assumptions at close.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                currentTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6">
        {/* Tab 1: Deal Info */}
        {currentTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Name</label>
                <input
                  type="text"
                  value={formData.dealName || ''}
                  onChange={e => updateField('dealName', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Close Date</label>
                <input
                  type="date"
                  value={formData.closeDate || ''}
                  onChange={e => updateField('closeDate', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
                <input
                  type="number"
                  value={formData.purchasePrice || ''}
                  onChange={e => updateField('purchasePrice', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                <input
                  type="number"
                  value={formData.units || ''}
                  onChange={e => updateField('units', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hold Period (years)</label>
                <input
                  type="number"
                  value={formData.holdPeriod || ''}
                  onChange={e => updateField('holdPeriod', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
              <select
                value={formData.strategy || ''}
                onChange={e => updateField('strategy', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Select strategy...</option>
                <option value="VALUE-ADD RENTAL">Value-Add Rental</option>
                <option value="CORE">Core</option>
                <option value="CORE+">Core+</option>
                <option value="BTS">Build-to-Sell</option>
                <option value="STR">Short-Term Rental</option>
                <option value="FLIP">Fix & Flip</option>
              </select>
            </div>
          </div>
        )}

        {/* Tab 2: Market Conditions */}
        {currentTab === 'market' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800">
                Capture market conditions as they were <strong>at the time of close</strong>. These provide context for future analysis.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Market Cap Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.marketCapRate || ''}
                  onChange={e => updateField('marketCapRate', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Market Vacancy (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.marketVacancy || ''}
                  onChange={e => updateField('marketVacancy', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">YoY Rent Growth (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.marketRentGrowth || ''}
                  onChange={e => updateField('marketRentGrowth', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">FDOT AADT (vpd)</label>
                <input
                  type="number"
                  value={formData.fdotAadt || ''}
                  onChange={e => updateField('fdotAadt', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Digital Demand Index</label>
                <input
                  type="number"
                  value={formData.digitalDemandIndex || ''}
                  onChange={e => updateField('digitalDemandIndex', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JEDI Score</label>
                <input
                  type="number"
                  value={formData.jediScore || ''}
                  onChange={e => updateField('jediScore', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">10-Year Treasury (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.treasuryRate10y || ''}
                  onChange={e => updateField('treasuryRate10y', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="At close"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Underwriting Assumptions */}
        {currentTab === 'assumptions' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exit Cap Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exitCapRate || ''}
                  onChange={e => updateField('exitCapRate', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stabilized Vacancy (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.stabilizedVacancy || ''}
                  onChange={e => updateField('stabilizedVacancy', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rent Growth Yr 1-3 (% p.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.rentGrowthYr1to3 || ''}
                  onChange={e => updateField('rentGrowthYr1to3', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rent Growth Yr 4-5 (% p.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.rentGrowthYr4to5 || ''}
                  onChange={e => updateField('rentGrowthYr4to5', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CapEx Budget ($)</label>
                <input
                  type="number"
                  value={formData.capexBudget || ''}
                  onChange={e => updateField('capexBudget', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CapEx Scope</label>
                <input
                  type="text"
                  value={formData.capexScope || ''}
                  onChange={e => updateField('capexScope', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., 140-unit interior reno"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Capital Stack */}
        {currentTab === 'capital' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LP Equity ($)</label>
                <input
                  type="number"
                  value={formData.lpEquity || ''}
                  onChange={e => updateField('lpEquity', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GP Equity ($)</label>
                <input
                  type="number"
                  value={formData.gpEquity || ''}
                  onChange={e => updateField('gpEquity', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debt Amount ($)</label>
                <input
                  type="number"
                  value={formData.debtAmount || ''}
                  onChange={e => updateField('debtAmount', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debt Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.debtRate || ''}
                  onChange={e => updateField('debtRate', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debt Term (years)</label>
                <input
                  type="number"
                  value={formData.debtTerm || ''}
                  onChange={e => updateField('debtTerm', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Fee ($)</label>
                <input
                  type="number"
                  value={formData.acqFee || ''}
                  onChange={e => updateField('acqFee', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Mgmt Fee ($)</label>
                <input
                  type="number"
                  value={formData.mgmtFee || ''}
                  onChange={e => updateField('mgmtFee', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promote Structure</label>
              <textarea
                value={formData.promoteStructure || ''}
                onChange={e => updateField('promoteStructure', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="e.g., 70/30 after 15% IRR"
              />
            </div>
          </div>
        )}

        {/* Tab 5: Exit Scenarios */}
        {currentTab === 'exit' && (
          <div className="space-y-6">
            {/* Base Case */}
            <div className="border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Base Case</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit Year</label>
                  <input
                    type="number"
                    value={formData.exitYearBase || ''}
                    onChange={e => updateField('exitYearBase', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit NOI ($)</label>
                  <input
                    type="number"
                    value={formData.exitNoiBase || ''}
                    onChange={e => updateField('exitNoiBase', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit Value ($)</label>
                  <input
                    type="number"
                    value={formData.exitValueBase || ''}
                    onChange={e => updateField('exitValueBase', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target IRR (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.exitIrrBase || ''}
                    onChange={e => updateField('exitIrrBase', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target EM (x)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.exitEmBase || ''}
                    onChange={e => updateField('exitEmBase', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Bull Case */}
            <div className="border border-green-200 rounded-md p-4 bg-green-50">
              <h3 className="text-sm font-semibold text-green-900 mb-3">Bull Case</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit NOI ($)</label>
                  <input
                    type="number"
                    value={formData.exitNoiBull || ''}
                    onChange={e => updateField('exitNoiBull', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit Value ($)</label>
                  <input
                    type="number"
                    value={formData.exitValueBull || ''}
                    onChange={e => updateField('exitValueBull', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IRR (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.exitIrrBull || ''}
                    onChange={e => updateField('exitIrrBull', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EM (x)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.exitEmBull || ''}
                    onChange={e => updateField('exitEmBull', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Bear Case */}
            <div className="border border-red-200 rounded-md p-4 bg-red-50">
              <h3 className="text-sm font-semibold text-red-900 mb-3">Bear Case</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit NOI ($)</label>
                  <input
                    type="number"
                    value={formData.exitNoiBear || ''}
                    onChange={e => updateField('exitNoiBear', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exit Value ($)</label>
                  <input
                    type="number"
                    value={formData.exitValueBear || ''}
                    onChange={e => updateField('exitValueBear', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IRR (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.exitIrrBear || ''}
                    onChange={e => updateField('exitIrrBear', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EM (x)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.exitEmBear || ''}
                    onChange={e => updateField('exitEmBear', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Decision Log */}
        {currentTab === 'decisions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600">
                Document key decisions made during underwriting. This helps future analysis understand <em>why</em> certain assumptions were made.
              </p>
              <button
                type="button"
                onClick={addDecision}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
              >
                + Add Decision
              </button>
            </div>

            {formData.decisions && formData.decisions.length > 0 ? (
              <div className="space-y-3">
                {formData.decisions.map((decision, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-4 relative">
                    <button
                      type="button"
                      onClick={() => removeDecision(index)}
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-sm"
                    >
                      ✕ Remove
                    </button>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={decision.date}
                          onChange={e => updateDecision(index, 'date', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Made By</label>
                        <input
                          type="text"
                          value={decision.madeBy}
                          onChange={e => updateDecision(index, 'madeBy', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="Name or role"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                      <input
                        type="text"
                        value={decision.decision}
                        onChange={e => updateDecision(index, 'decision', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="e.g., Increased exit cap rate by 25bps"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rationale</label>
                      <textarea
                        value={decision.rationale}
                        onChange={e => updateDecision(index, 'rationale', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        rows={2}
                        placeholder="Why was this decision made?"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No decisions logged yet. Click "Add Decision" to start.
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            📚 Save Deal Bible (Immutable)
          </button>
        </div>
      </form>
    </div>
  );
};

export default DealBibleForm;
