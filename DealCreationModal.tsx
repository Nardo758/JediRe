/**
 * DealCreationModal — Deal Capsule Creation with Project Type Fork
 *
 * Step 1: Select project type (Existing / Development / Redevelopment)
 * Step 2: Conditional fields based on selection
 * Step 3: Create deal with projectType set → correct overview renders
 *
 * This replaces the existing DealForm.tsx which only has buyer/seller/both
 * deal types and commission tracking. This form creates investment deals.
 *
 * INTEGRATION: Import and use alongside or instead of DealForm in DealPipeline.
 */

import React, { useState, useCallback } from 'react';
import { X, ArrowLeft, Building2, HardHat, RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';
import type { ProjectType } from '@/shared/types/project-type';
import { PROJECT_TYPE_META } from '@/shared/types/project-type';
import { apiClient } from '@/services/api.client';

// ── Field Definitions Per Type ───────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  fullWidth?: boolean;
}

const SHARED_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Deal Name', type: 'text', required: true, placeholder: 'Summit Ridge Apartments', fullWidth: true },
  { key: 'propertyAddress', label: 'Property Address', type: 'text', required: true, placeholder: '4200 Summit Ridge Pkwy, Tampa, FL 33615', fullWidth: true },
];

const TYPE_FIELDS: Record<ProjectType, FieldDef[]> = {
  existing: [
    { key: 'purchasePrice', label: 'Ask Price', type: 'number', required: true, prefix: '$', placeholder: '45000000' },
    { key: 'units', label: 'Units', type: 'number', required: true, placeholder: '240' },
    { key: 'sqft', label: 'Total SF', type: 'number', placeholder: '198000' },
    { key: 'yearBuilt', label: 'Year Built', type: 'number', required: true, placeholder: '1998' },
    { key: 'occupancy', label: 'Occupancy (%)', type: 'number', required: true, placeholder: '92.4' },
    { key: 'noi', label: 'Current NOI', type: 'number', required: true, prefix: '$', placeholder: '2340000' },
    { key: 'capRate', label: 'Going-In Cap Rate (%)', type: 'number', placeholder: '5.2' },
    { key: 'avgRent', label: 'Avg Rent / Unit ($/mo)', type: 'number', placeholder: '1385' },
    { key: 'renovationBudget', label: 'Renovation Budget', type: 'number', prefix: '$', placeholder: '3200000' },
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Multifamily', 'Mixed-Use', 'Office', 'Retail', 'Industrial'], required: true },
  ],
  development: [
    { key: 'landPrice', label: 'Land Price', type: 'number', required: true, prefix: '$', placeholder: '8500000' },
    { key: 'lotSizeAcres', label: 'Lot Size (acres)', type: 'number', required: true, placeholder: '3.58' },
    { key: 'zoning', label: 'Zoning Designation', type: 'text', required: true, placeholder: 'PD-A' },
    { key: 'entitled', label: 'Entitled?', type: 'select', options: ['Yes', 'No', 'In Process'], required: true },
    { key: 'proposedUnits', label: 'Proposed Units', type: 'number', required: true, placeholder: '312' },
    { key: 'proposedSqft', label: 'Proposed SF', type: 'number', placeholder: '298000' },
    { key: 'hardCosts', label: 'Est. Hard Costs', type: 'number', prefix: '$', placeholder: '52800000' },
    { key: 'softCosts', label: 'Est. Soft Costs', type: 'number', prefix: '$', placeholder: '10600000' },
    { key: 'constructionMonths', label: 'Construction (months)', type: 'number', placeholder: '18' },
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Multifamily', 'Mixed-Use', 'Office', 'Retail', 'Industrial'], required: true },
  ],
  redevelopment: [
    { key: 'purchasePrice', label: 'Acquisition Price', type: 'number', required: true, prefix: '$', placeholder: '18500000' },
    { key: 'existingUnits', label: 'Existing Units', type: 'number', required: true, placeholder: '168' },
    { key: 'yearBuilt', label: 'Year Built', type: 'number', required: true, placeholder: '1986' },
    { key: 'occupancy', label: 'Current Occupancy (%)', type: 'number', required: true, placeholder: '84' },
    { key: 'noi', label: 'Current NOI', type: 'number', required: true, prefix: '$', placeholder: '1120000' },
    { key: 'avgRent', label: 'Current Avg Rent ($/mo)', type: 'number', placeholder: '985' },
    { key: 'renovationBudget', label: 'Renovation Budget', type: 'number', prefix: '$', placeholder: '4800000' },
    { key: 'expansionUnits', label: 'Expansion Units (if any)', type: 'number', placeholder: '48' },
    { key: 'expansionBudget', label: 'Expansion Budget', type: 'number', prefix: '$', placeholder: '12600000' },
    { key: 'zoning', label: 'Zoning Designation', type: 'text', placeholder: 'RU-2-15' },
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Multifamily', 'Mixed-Use', 'Office', 'Retail', 'Industrial'], required: true },
  ],
};

// ── Type Selection Cards ─────────────────────────────────────────────────────

const TYPE_ICONS: Record<ProjectType, React.ReactNode> = {
  existing: <Building2 className="w-8 h-8" />,
  development: <HardHat className="w-8 h-8" />,
  redevelopment: <RotateCcw className="w-8 h-8" />,
};

const TYPE_EXAMPLES: Record<ProjectType, string> = {
  existing: 'e.g. 240-unit Class B apartment, 92% occupied, $2.3M NOI',
  development: 'e.g. 3.6-acre entitled site, PD zoning, 312-unit podium',
  redevelopment: 'e.g. 168-unit Class C, zoning allows 280 — renovate + add 48',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface DealCreationModalProps {
  onClose: () => void;
  onDealCreated: (deal: any) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const DealCreationModal: React.FC<DealCreationModalProps> = ({ onClose, onDealCreated }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback((key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [errors]);

  const validate = useCallback((): boolean => {
    if (!projectType) return false;
    const allFields = [...SHARED_FIELDS, ...TYPE_FIELDS[projectType]];
    const newErrors: Record<string, string> = {};

    for (const f of allFields) {
      if (f.required && !fields[f.key]?.trim()) {
        newErrors[f.key] = `${f.label} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [projectType, fields]);

  const handleSubmit = useCallback(async () => {
    if (!validate() || !projectType) return;

    setIsSubmitting(true);
    try {
      // Build the deal payload
      const payload: Record<string, any> = {
        project_type: projectType, // snake_case for DB
        name: fields.name,
        address: fields.propertyAddress,
        status: 'active',
        state: 'SIGNAL_INTAKE',
      };

      // Map numeric fields
      const numericKeys = ['purchasePrice', 'units', 'sqft', 'yearBuilt', 'occupancy',
        'noi', 'capRate', 'avgRent', 'renovationBudget', 'landPrice', 'lotSizeAcres',
        'proposedUnits', 'proposedSqft', 'hardCosts', 'softCosts', 'constructionMonths',
        'existingUnits', 'expansionUnits', 'expansionBudget'];

      for (const key of numericKeys) {
        if (fields[key]) {
          // Convert to snake_case for DB
          const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          payload[snakeKey] = parseFloat(fields[key]);
        }
      }

      // String fields
      if (fields.zoning) payload.zoning = fields.zoning;
      if (fields.entitled) payload.entitled = fields.entitled === 'Yes';
      if (fields.propertyType) payload.property_type = fields.propertyType.toLowerCase();

      // API call
      const response = await apiClient.post('/api/v1/deals', payload) as any;
      const newDeal = response?.data?.deal || response?.data?.data || response?.data;

      onDealCreated(newDeal);
    } catch (error) {
      console.error('Failed to create deal:', error);
      setErrors({ _form: 'Failed to create deal. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, projectType, fields, onDealCreated]);

  // ── Step 1: Type Selection ───────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">New Deal Capsule</h2>
              <p className="text-xs text-slate-500 mt-0.5">Select the deal type — this determines which modules activate.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
          <div className="p-6 space-y-3">
            {(['existing', 'development', 'redevelopment'] as ProjectType[]).map((type) => {
              const meta = PROJECT_TYPE_META[type];
              return (
                <button
                  key={type}
                  onClick={() => { setProjectType(type); setStep(2); }}
                  className="w-full flex items-start gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/30 transition-all text-left group"
                >
                  <div className={`p-2 rounded-lg ${meta.bgColor} ${meta.color}`}>{TYPE_ICONS[type]}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700">{meta.label}</div>
                    <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1 italic">{TYPE_EXAMPLES[type]}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1">{meta.sectionCount} sections</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Fields ─────────────────────────────────────────────────────────

  const allFields = [...SHARED_FIELDS, ...TYPE_FIELDS[projectType!]];
  const meta = PROJECT_TYPE_META[projectType!];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep(1); setFields({}); setErrors({}); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">New {meta.shortLabel} Deal</h2>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.color}`}>{meta.icon} {meta.shortLabel}</span>
                </div>
                <p className="text-xs text-slate-500">{meta.sectionCount} overview sections will activate</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {errors._form && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors._form}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {allFields.map((f) => (
              <div key={f.key} className={f.fullWidth ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    value={fields[f.key] || ''}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors[f.key] ? 'border-red-500' : 'border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    disabled={isSubmitting}
                  >
                    <option value="">Select...</option>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <div className="relative">
                    {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{f.prefix}</span>}
                    <input
                      type={f.type}
                      value={fields[f.key] || ''}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={`w-full border rounded-lg ${f.prefix ? 'pl-7' : 'pl-3'} pr-3 py-2.5 text-sm ${errors[f.key] ? 'border-red-500' : 'border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      disabled={isSubmitting}
                    />
                    {f.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{f.suffix}</span>}
                  </div>
                )}
                {errors[f.key] && <p className="text-[10px] text-red-500 mt-1">{errors[f.key]}</p>}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Create Deal Capsule</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealCreationModal;
