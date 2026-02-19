/**
 * CustomStrategyModal - Create and edit custom investment strategies
 * 
 * Features:
 * - Create new custom strategies
 * - Edit existing custom strategies
 * - Duplicate built-in or custom strategies
 * - Apply to property types
 * - Set default strategies per property type
 * - Define hold periods and exit types
 * - Add custom metrics and assumptions
 * 
 * Usage:
 * - Settings → Property Types & Strategies → "Create Custom Strategy"
 * - Strategy list → Edit button → Opens modal in edit mode
 * - Built-in strategy → Duplicate → Opens modal with pre-filled data
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../shared/Button';

interface CustomStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (strategy: any) => void;
  editStrategy?: any; // If provided, modal is in edit mode
  duplicateFrom?: any; // If provided, modal pre-fills from this strategy
}

interface CustomMetric {
  key: string;
  value: string;
}

const EXIT_TYPES = [
  { value: 'sale', label: 'Sale' },
  { value: 'refinance', label: 'Refinance' },
  { value: '1031_exchange', label: '1031 Exchange' },
  { value: 'cap_rate', label: 'Cap Rate Exit' },
  { value: 'hold_indefinitely', label: 'Hold Indefinitely' },
];

const PROPERTY_TYPES = [
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'retail', label: 'Retail' },
  { value: 'office', label: 'Office' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'land', label: 'Land' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'self_storage', label: 'Self Storage' },
];

export const CustomStrategyModal: React.FC<CustomStrategyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editStrategy,
  duplicateFrom,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    holdPeriodMin: 5,
    holdPeriodMax: null as number | null,
    exitType: 'sale',
    isTemplate: false,
  });

  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [defaultAssumptions, setDefaultAssumptions] = useState({
    rentGrowthPct: '',
    vacancyPct: '',
    exitCapRatePct: '',
    appreciationPct: '',
    capexReservesPct: '',
  });

  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [setAsDefault, setSetAsDefault] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      
      if (editStrategy) {
        // Edit mode - populate from existing strategy
        setFormData({
          name: editStrategy.name || '',
          description: editStrategy.description || '',
          holdPeriodMin: editStrategy.hold_period_min || 5,
          holdPeriodMax: editStrategy.hold_period_max || null,
          exitType: editStrategy.exit_type || 'sale',
          isTemplate: editStrategy.is_template || false,
        });

        if (editStrategy.custom_metrics) {
          const metrics = Object.entries(editStrategy.custom_metrics).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          setCustomMetrics(metrics);
        }

        if (editStrategy.default_assumptions) {
          const assumptions = editStrategy.default_assumptions;
          setDefaultAssumptions({
            rentGrowthPct: assumptions.rent_growth_pct?.toString() || '',
            vacancyPct: assumptions.vacancy_pct?.toString() || '',
            exitCapRatePct: assumptions.exit_cap_rate_pct?.toString() || '',
            appreciationPct: assumptions.appreciation_pct?.toString() || '',
            capexReservesPct: assumptions.capex_reserves_pct?.toString() || '',
          });
        }

        if (editStrategy.assigned_types) {
          setSelectedPropertyTypes(editStrategy.assigned_types.filter(Boolean));
        }
      } else if (duplicateFrom) {
        // Duplicate mode - populate but with new name
        setFormData({
          name: `${duplicateFrom.name} (Copy)`,
          description: duplicateFrom.description || '',
          holdPeriodMin: duplicateFrom.hold_period_min || 5,
          holdPeriodMax: duplicateFrom.hold_period_max || null,
          exitType: duplicateFrom.exit_type || 'sale',
          isTemplate: false,
        });

        if (duplicateFrom.custom_metrics) {
          const metrics = Object.entries(duplicateFrom.custom_metrics).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          setCustomMetrics(metrics);
        }

        if (duplicateFrom.default_assumptions) {
          const assumptions = duplicateFrom.default_assumptions;
          setDefaultAssumptions({
            rentGrowthPct: assumptions.rent_growth_pct?.toString() || '',
            vacancyPct: assumptions.vacancy_pct?.toString() || '',
            exitCapRatePct: assumptions.exit_cap_rate_pct?.toString() || '',
            appreciationPct: assumptions.appreciation_pct?.toString() || '',
            capexReservesPct: assumptions.capex_reserves_pct?.toString() || '',
          });
        }
      }
    }
  }, [isOpen, editStrategy, duplicateFrom]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      holdPeriodMin: 5,
      holdPeriodMax: null,
      exitType: 'sale',
      isTemplate: false,
    });
    setCustomMetrics([]);
    setDefaultAssumptions({
      rentGrowthPct: '',
      vacancyPct: '',
      exitCapRatePct: '',
      appreciationPct: '',
      capexReservesPct: '',
    });
    setSelectedPropertyTypes([]);
    setSetAsDefault(false);
    setError(null);
  };

  const handleAddMetric = () => {
    setCustomMetrics([...customMetrics, { key: '', value: '' }]);
  };

  const handleRemoveMetric = (index: number) => {
    setCustomMetrics(customMetrics.filter((_, i) => i !== index));
  };

  const handleMetricChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customMetrics];
    updated[index][field] = value;
    setCustomMetrics(updated);
  };

  const togglePropertyType = (type: string) => {
    setSelectedPropertyTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Strategy name is required');
      return;
    }

    if (formData.holdPeriodMin < 1) {
      setError('Minimum hold period must be at least 1 year');
      return;
    }

    if (formData.holdPeriodMax && formData.holdPeriodMax < formData.holdPeriodMin) {
      setError('Maximum hold period must be greater than minimum');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build custom metrics object
      const metricsObj: any = {};
      customMetrics.forEach(metric => {
        if (metric.key.trim()) {
          metricsObj[metric.key.trim()] = metric.value.trim();
        }
      });

      // Build assumptions object
      const assumptionsObj: any = {};
      if (defaultAssumptions.rentGrowthPct) {
        assumptionsObj.rent_growth_pct = parseFloat(defaultAssumptions.rentGrowthPct);
      }
      if (defaultAssumptions.vacancyPct) {
        assumptionsObj.vacancy_pct = parseFloat(defaultAssumptions.vacancyPct);
      }
      if (defaultAssumptions.exitCapRatePct) {
        assumptionsObj.exit_cap_rate_pct = parseFloat(defaultAssumptions.exitCapRatePct);
      }
      if (defaultAssumptions.appreciationPct) {
        assumptionsObj.appreciation_pct = parseFloat(defaultAssumptions.appreciationPct);
      }
      if (defaultAssumptions.capexReservesPct) {
        assumptionsObj.capex_reserves_pct = parseFloat(defaultAssumptions.capexReservesPct);
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        holdPeriodMin: formData.holdPeriodMin,
        holdPeriodMax: formData.holdPeriodMax,
        exitType: formData.exitType,
        customMetrics: metricsObj,
        defaultAssumptions: assumptionsObj,
        isTemplate: formData.isTemplate,
      };

      let strategyId: string;

      if (editStrategy) {
        // Update existing strategy
        const response = await fetch(`/api/v1/custom-strategies/${editStrategy.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update strategy');
        }

        const result = await response.json();
        strategyId = result.data.id;
      } else {
        // Create new strategy
        const response = await fetch('/api/v1/custom-strategies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create strategy');
        }

        const result = await response.json();
        strategyId = result.data.id;
      }

      // Apply to property types if selected
      if (selectedPropertyTypes.length > 0) {
        await fetch(`/api/v1/custom-strategies/${strategyId}/apply-to-type`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            propertyTypes: selectedPropertyTypes,
            setAsDefault,
          }),
        });
      }

      onSuccess?.(strategyId);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {editStrategy ? 'Edit' : duplicateFrom ? 'Duplicate' : 'Create'} Custom Strategy
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strategy Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Aggressive Value-Add"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your investment strategy..."
              />
            </div>
          </div>

          {/* Hold Period & Exit */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Investment Timeline</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Hold Period (years) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.holdPeriodMin}
                  onChange={(e) => setFormData({ ...formData, holdPeriodMin: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Hold Period (years)
                </label>
                <input
                  type="number"
                  min={formData.holdPeriodMin}
                  value={formData.holdPeriodMax || ''}
                  onChange={(e) => setFormData({ ...formData, holdPeriodMax: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty for indefinite"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exit Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.exitType}
                onChange={(e) => setFormData({ ...formData, exitType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {EXIT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Metrics */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Custom Metrics</h3>
              <button
                type="button"
                onClick={handleAddMetric}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add Metric
              </button>
            </div>
            
            {customMetrics.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No custom metrics. Click "Add Metric" to create.</p>
            ) : (
              <div className="space-y-2">
                {customMetrics.map((metric, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={metric.key}
                      onChange={(e) => handleMetricChange(index, 'key', e.target.value)}
                      placeholder="Metric name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={metric.value}
                      onChange={(e) => handleMetricChange(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMetric(index)}
                      className="text-red-600 hover:text-red-800 px-3"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Default Assumptions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Default Financial Assumptions (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rent Growth (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultAssumptions.rentGrowthPct}
                  onChange={(e) => setDefaultAssumptions({ ...defaultAssumptions, rentGrowthPct: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 3.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vacancy (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultAssumptions.vacancyPct}
                  onChange={(e) => setDefaultAssumptions({ ...defaultAssumptions, vacancyPct: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 5.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exit Cap Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultAssumptions.exitCapRatePct}
                  onChange={(e) => setDefaultAssumptions({ ...defaultAssumptions, exitCapRatePct: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 5.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appreciation (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultAssumptions.appreciationPct}
                  onChange={(e) => setDefaultAssumptions({ ...defaultAssumptions, appreciationPct: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 3.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CapEx Reserves (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultAssumptions.capexReservesPct}
                  onChange={(e) => setDefaultAssumptions({ ...defaultAssumptions, capexReservesPct: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 5.0"
                />
              </div>
            </div>
          </div>

          {/* Property Type Assignment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Apply to Property Types</h3>
            
            <div className="grid grid-cols-2 gap-2">
              {PROPERTY_TYPES.map(type => (
                <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPropertyTypes.includes(type.value)}
                    onChange={() => togglePropertyType(type.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>

            {selectedPropertyTypes.length > 0 && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Set as default strategy for selected property types
                </span>
              </label>
            )}
          </div>

          {/* Template Option */}
          <div className="space-y-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isTemplate}
                onChange={(e) => setFormData({ ...formData, isTemplate: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Save as template (can be used to quickly create similar strategies)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editStrategy ? 'Update Strategy' : 'Create Strategy'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
