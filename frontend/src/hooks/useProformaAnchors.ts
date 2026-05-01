/**
 * useProformaAnchors — Hook for per-line-item anchor data
 *
 * Fetches anchor configs + state rules from the sigma API,
 * provides a lookup function for expense keys.
 *
 * Phase B3 — see M36_PROFORMA_LINE_ITEM_ANCHORS.md
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnchorLabel {
  lineItemId: string;
  label: string;
  category: string;
  macroSeriesId: string | null;
  structuralPremium: number;
  timingChangeType: string;
  description: string;  // built from fields
}

export interface StateRuleInfo {
  stateCode: string;
  lineItemId: string;
  ruleType: string;
  ruleValue: number | null;
  ruleText: string;
}

export interface AnchorTooltipData {
  anchor: AnchorLabel | null;
  stateRule: StateRuleInfo | null;
}

// ─── Fallback anchors (no API needed) ───────────────────────────────────────

const SERIES_NAMES: Record<string, string> = {
  'CUSR0000SEHC': 'CPI-OER',
  'ECIWAG': 'ECI Wages',
  'DGS10': '10Y Treasury',
  'WPSFD49207': 'PPI Residential',
  'T10YIE': '10Y Breakeven',
};

const FALLBACK_ANCHORS: AnchorLabel[] = [
  { lineItemId: 'insurance', label: 'Insurance', category: 'opex', macroSeriesId: 'WPSFD49207', structuralPremium: 0.010, timingChangeType: 'annual_step', description: 'PPI Residential + 1.0% (annual step)' },
  { lineItemId: 'taxes', label: 'Property Taxes', category: 'opex', macroSeriesId: null, structuralPremium: 0.030, timingChangeType: 'trigger_once', description: 'County growth + 3% (on-sale trigger or annual)' },
  { lineItemId: 'mgmt_fees', label: 'Management Fees', category: 'opex', macroSeriesId: 'ECIWAG', structuralPremium: 0.005, timingChangeType: 'annual_step', description: 'ECI Wages + 0.5% (annual step)' },
  { lineItemId: 'utilities', label: 'Utilities', category: 'opex', macroSeriesId: 'CUSR0000SEHC', structuralPremium: 0.005, timingChangeType: 'annual_step', description: 'CPI-OER + 0.5% (annual step)' },
  { lineItemId: 'repairs_maint', label: 'Repairs & Maintenance', category: 'opex', macroSeriesId: 'WPSFD49207', structuralPremium: 0.005, timingChangeType: 'annual_step', description: 'PPI Residential + 0.5% (annual step)' },
  { lineItemId: 'reserves', label: 'Replacement Reserves', category: 'opex', macroSeriesId: 'WPSFD49207', structuralPremium: 0.025, timingChangeType: 'annual_step', description: 'PPI Residential + 2.5% (annual step)' },
  { lineItemId: 'rent_income', label: 'Gross Rent Income', category: 'revenue', macroSeriesId: 'CUSR0000SEHC', structuralPremium: 0.008, timingChangeType: 'annual_step', description: 'CPI-OER + 0.8% (annual step)' },
  { lineItemId: 'other_income', label: 'Other Income', category: 'revenue', macroSeriesId: null, structuralPremium: 0.020, timingChangeType: 'annual_step', description: 'Previous year + 2% (annual step)' },
  { lineItemId: 'capex', label: 'Capital Expenditures', category: 'capex', macroSeriesId: null, structuralPremium: 0.030, timingChangeType: 'annual_step', description: 'Prev year + 3% (annual step)' },
];

// ─── Expense → Anchor Key Mapping ────────────────────────────────────────────

const EXPENSE_TO_ANCHOR: Record<string, string> = {
  'insurance': 'insurance',
  'real_estate_tax': 'taxes',
  'personal_property_tax': 'taxes',
  'property_tax': 'taxes',
  'property taxes': 'taxes',
  'utilities': 'utilities',
  'repairs_maintenance': 'repairs_maint',
  'repairs & maintenance': 'repairs_maint',
  'repairs': 'repairs_maint',
  'management_fee': 'mgmt_fees',
  'management': 'mgmt_fees',
  'replacement_reserves': 'reserves',
  'reserves': 'reserves',
  'payroll': 'mgmt_fees',
  'contract_services': 'utilities',
  'turnover': 'repairs_maint',
  'hoa_dues': 'utilities',
  'rent': 'rent_income',
  'rent_income': 'rent_income',
  'other_income': 'other_income',
  'capex': 'capex',
};

// ─── Build Description ───────────────────────────────────────────────────────

function buildAnchorDescription(anchor: AnchorLabel): string {
  const seriesName = anchor.macroSeriesId ? SERIES_NAMES[anchor.macroSeriesId] ?? anchor.macroSeriesId : null;
  const parts: string[] = [];
  if (seriesName) parts.push(seriesName);
  if (anchor.structuralPremium > 0) parts.push(`+${(anchor.structuralPremium * 100).toFixed(1)}%`);
  
  const timingLabels: Record<string, string> = {
    'annual_step': 'annual step',
    'locked': 'locked',
    'trigger_once': 'trigger-on-sale',
    'cycle': 'cyclical',
    'market': 'market-based',
  };
  const timingLabel = timingLabels[anchor.timingChangeType] ?? anchor.timingChangeType;
  parts.push(`(${timingLabel})`);

  return parts.join(' ') || 'Default growth';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProformaAnchors(stateCode?: string) {
  const [anchors, setAnchors] = useState<AnchorLabel[]>(FALLBACK_ANCHORS);
  const [stateRules, setStateRules] = useState<StateRuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch anchors from API (fallback to FALLBACK_ANCHORS)
  useEffect(() => {
    const fetchAnchors = async () => {
      try {
        const r = await fetch('/api/v1/sigma/anchors');
        const d = await r.json();
        if (d.success && d.data?.length) {
          setAnchors(d.data.map((a: any) => {
            const label: AnchorLabel = {
              lineItemId: a.lineItemId,
              label: a.lineItemLabel || a.lineItemId,
              category: a.category || 'opex',
              macroSeriesId: a.macroSeriesId ?? null,
              structuralPremium: a.structuralPremium ?? 0,
              timingChangeType: a.timing?.changeType ?? 'annual_step',
              description: '',
            };
            label.description = buildAnchorDescription(label);
            return label;
          }));
        }
      } catch (e: any) {
        // Use fallback — already set in useState
        console.warn('Anchor API unavailable, using fallback', e.message);
        setError('Using fallback anchor data');
      } finally {
        setLoading(false);
      }
    };
    fetchAnchors();
  }, []);

  // Fetch state rules
  useEffect(() => {
    if (!stateCode) return;
    const fetchRules = async () => {
      try {
        const r = await fetch(`/api/v1/sigma/anchors/state/${stateCode}`);
        const d = await r.json();
        if (d.success && d.data?.length) {
          setStateRules(d.data);
        }
      } catch (e) {
        console.warn(`State rules unavailable for ${stateCode}`);
      }
    };
    fetchRules();
  }, [stateCode]);

  // Lookup function
  const getAnchorTooltip = useCallback((expenseKey: string): AnchorTooltipData => {
    const anchorId = EXPENSE_TO_ANCHOR[expenseKey.toLowerCase()];
    const anchor = anchorId ? anchors.find(a => a.lineItemId === anchorId) ?? null : null;
    const stateRule = anchorId ? stateRules.find(r => r.lineItemId === anchorId) ?? null : null;
    return { anchor, stateRule };
  }, [anchors, stateRules]);

  return { anchors, stateRules, loading, error, getAnchorTooltip };
}

export default useProformaAnchors;
