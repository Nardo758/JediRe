import { useState, useEffect } from 'react';
import { Deal, DealType, DealPriority, DealFormData, Client } from '@/types';
import { X, Save, Loader2 } from 'lucide-react';

interface DealFormProps {
  deal?: Deal;
  clients: Client[];
  onSubmit: (data: DealFormData) => Promise<void>;
  onCancel: () => void;
}

export default function DealForm({ deal, clients, onSubmit, onCancel }: DealFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<DealFormData>({
    clientId: deal?.clientId || '',
    propertyAddress: deal?.propertyAddress || '',
    dealType: deal?.dealType || 'buyer',
    dealValue: deal?.dealValue || 0,
    commissionRate: deal?.commissionRate || 3,
    expectedCloseDate: deal?.expectedCloseDate || null,
    priority: deal?.priority || 'medium',
    notes: deal?.notes || '',
  });

  const commissionEstimate = (formData.dealValue * formData.commissionRate) / 100;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientId) {
      newErrors.clientId = 'Client is required';
    }
    if (!formData.propertyAddress.trim()) {
      newErrors.propertyAddress = 'Property address is required';
    }
    if (formData.dealValue <= 0) {
      newErrors.dealValue = 'Deal value must be greater than 0';
    }
    if (formData.commissionRate < 0 || formData.commissionRate > 100) {
      newErrors.commissionRate = 'Commission rate must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to submit deal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof DealFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
        <h2 className="text-xl font-bold text-gray-900">
          {deal ? 'Edit Deal' : 'Add New Deal'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.clientId}
            onChange={(e) => updateField('clientId', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.clientId ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          >
            <option value="">Select a client...</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.email})
              </option>
            ))}
          </select>
          {errors.clientId && (
            <p className="text-xs text-red-500 mt-1">{errors.clientId}</p>
          )}
        </div>

        {/* Property Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.propertyAddress}
            onChange={(e) => updateField('propertyAddress', e.target.value)}
            placeholder="123 Main St, Austin, TX 78701"
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.propertyAddress ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.propertyAddress && (
            <p className="text-xs text-red-500 mt-1">{errors.propertyAddress}</p>
          )}
        </div>

        {/* Deal Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deal Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {(['buyer', 'seller', 'both'] as DealType[]).map(type => (
              <label
                key={type}
                className={`
                  flex-1 border-2 rounded-lg p-3 cursor-pointer transition-all
                  ${formData.dealType === type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="dealType"
                  value={type}
                  checked={formData.dealType === type}
                  onChange={(e) => updateField('dealType', e.target.value as DealType)}
                  className="sr-only"
                  disabled={isSubmitting}
                />
                <div className="text-center font-medium capitalize">{type}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Deal Value & Commission Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Value <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.dealValue || ''}
                onChange={(e) => updateField('dealValue', parseFloat(e.target.value) || 0)}
                placeholder="500000"
                className={`w-full border rounded-lg pl-8 pr-3 py-2 ${
                  errors.dealValue ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
                min="0"
                step="1000"
              />
            </div>
            {errors.dealValue && (
              <p className="text-xs text-red-500 mt-1">{errors.dealValue}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Commission Rate <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.commissionRate || ''}
                onChange={(e) => updateField('commissionRate', parseFloat(e.target.value) || 0)}
                placeholder="3"
                className={`w-full border rounded-lg px-3 py-2 pr-8 ${
                  errors.commissionRate ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
                min="0"
                max="100"
                step="0.1"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            </div>
            {errors.commissionRate && (
              <p className="text-xs text-red-500 mt-1">{errors.commissionRate}</p>
            )}
          </div>
        </div>

        {/* Commission Estimate */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700 mb-1">Estimated Commission</div>
          <div className="text-3xl font-bold text-green-600">
            ${commissionEstimate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Expected Close Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected Close Date
          </label>
          <input
            type="date"
            value={formData.expectedCloseDate || ''}
            onChange={(e) => updateField('expectedCloseDate', e.target.value || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            disabled={isSubmitting}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <div className="flex gap-3">
            {(['low', 'medium', 'high'] as DealPriority[]).map(priority => (
              <label
                key={priority}
                className={`
                  flex-1 border-2 rounded-lg p-3 cursor-pointer transition-all
                  ${formData.priority === priority
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="priority"
                  value={priority}
                  checked={formData.priority === priority}
                  onChange={(e) => updateField('priority', e.target.value as DealPriority)}
                  className="sr-only"
                  disabled={isSubmitting}
                />
                <div className="text-center font-medium capitalize">{priority}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Additional notes about this deal..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
            disabled={isSubmitting}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {deal ? 'Update Deal' : 'Create Deal'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
