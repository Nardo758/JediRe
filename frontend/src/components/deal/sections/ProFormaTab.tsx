import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DollarSign, TrendingUp, BarChart3, Edit3, RotateCcw,
  ChevronDown, ChevronRight, Loader2, CheckCircle2,
  ArrowRight, Info, Download, Zap, Plus, Trash2, Building2, Hammer,
} from 'lucide-react';
import { Deal } from '@/types';
import { apiClient } from '@/services/api.client';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { useDealType } from '../../../stores/dealStore';
import { getProFormaTemplate, PROFORMA_TEMPLATES } from '../../../shared/config/deal-type-visibility';
import { T as BT, mono as bMono, sans as bSans } from '../bloomberg-tokens';

interface UnitMixRow {
  floorPlan: string;
  unitSize: number;
  beds: number;
  units: number;
  occupied: number;
  vacant: number;
  marketRent: number;
  inPlaceRent: number;
}

interface OtherIncomeItem {
  perUnitMonth: number;
  penetration: number;
}

interface ExpenseItem {
  amount: number;
  type: string;
  growthRate: number;
}

interface CapexLineItem {
  description: string;
  amount: number;
}

interface WaterfallHurdle {
  hurdleRate: number;
  promoteToGP: number;
  lpSplit: number;
}

interface FieldDef {
  key: string;
  label: string;
  unit: '$' | '%' | 'yrs' | 'mo' | 'units' | 'sf' | 'text' | '$/sf' | 'x';
  platformDefault: any;
  section: string;
  tooltip?: string;
  showFor?: 'existing' | 'development' | 'both';
}

interface ModelResults {
  summary: any;
  annualCashFlow: any[];
  sourcesAndUses: any;
  debtMetrics: any;
  sensitivityAnalysis: any;
  waterfallDistributions: any[];
}

interface ProFormaTabProps {
  deal?: Deal;
  dealId?: string;
}

const DEFAULT_OTHER_INCOME: Record<string, OtherIncomeItem> = {
  'Parking': { perUnitMonth: 75, penetration: 0.40 },
  'Storage': { perUnitMonth: 50, penetration: 0.15 },
  'RUBS (Water/Sewer)': { perUnitMonth: 45, penetration: 1.0 },
  'Valet Trash': { perUnitMonth: 35, penetration: 1.0 },
  'Pest Control': { perUnitMonth: 5, penetration: 1.0 },
  'Cable/Internet': { perUnitMonth: 50, penetration: 0.60 },
  'Pet Rent': { perUnitMonth: 50, penetration: 0.35 },
  'Package Lockers': { perUnitMonth: 10, penetration: 1.0 },
  'Tech Fee': { perUnitMonth: 30, penetration: 1.0 },
  'Washer/Dryer': { perUnitMonth: 40, penetration: 0.25 },
  'Renters Insurance': { perUnitMonth: 15, penetration: 0.90 },
};

const DEFAULT_EXPENSES: Record<string, ExpenseItem> = {
  'Repairs & Maintenance': { amount: 0, type: 'perUnit', growthRate: 0.03 },
  'Contract Services': { amount: 0, type: 'perUnit', growthRate: 0.03 },
  'Security': { amount: 0, type: 'total', growthRate: 0.03 },
  'Landscaping': { amount: 0, type: 'total', growthRate: 0.03 },
  'Personnel / Payroll': { amount: 0, type: 'total', growthRate: 0.035 },
  'Marketing': { amount: 0, type: 'total', growthRate: 0.03 },
  'Leasing Commissions': { amount: 0, type: 'total', growthRate: 0.03 },
  'Administrative / G&A': { amount: 0, type: 'total', growthRate: 0.03 },
  'Turnover': { amount: 0, type: 'perUnit', growthRate: 0.03 },
  'Water / Sewer': { amount: 0, type: 'total', growthRate: 0.04 },
  'Electric': { amount: 0, type: 'total', growthRate: 0.04 },
  'Gas': { amount: 0, type: 'total', growthRate: 0.04 },
  'Other Utilities': { amount: 0, type: 'total', growthRate: 0.04 },
  'Insurance': { amount: 0, type: 'total', growthRate: 0.05 },
  'Trash Removal': { amount: 0, type: 'total', growthRate: 0.03 },
  'Pest Control': { amount: 0, type: 'total', growthRate: 0.03 },
  'Valet Trash': { amount: 0, type: 'total', growthRate: 0.03 },
  'Cable / Internet': { amount: 0, type: 'total', growthRate: 0.03 },
  'Amenity Fees': { amount: 0, type: 'total', growthRate: 0.03 },
  'Franchise Tax': { amount: 0, type: 'total', growthRate: 0.02 },
  'Vacant Electric': { amount: 0, type: 'total', growthRate: 0.04 },
  'Management Fee': { amount: 0.035, type: 'pctEGR', growthRate: 0 },
  'RE Taxes': { amount: 0, type: 'total', growthRate: 0.025 },
};

function fmt$(n: number): string {
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtPctRaw(n: number): string {
  return `${n.toFixed(2)}%`;
}

export const ProFormaTab: React.FC<ProFormaTabProps> = ({ deal, dealId }) => {
  const id = deal?.id || dealId;
  const { debtTerms, updateFinancial, emitEvent, lastEvent, market, strategy, design3D, absorptionData } = useDealModule();
  const dealType = useDealType();
  const proformaTemplate = useMemo(() => getProFormaTemplate(dealType), [dealType]);

  // Map template to modelType: 'acquisition' -> 'existing', 'development' -> 'development', 'redevelopment' -> 'development'
  const defaultModelType = useMemo(() => {
    if (proformaTemplate === 'acquisition') return 'existing' as const;
    return 'development' as const;
  }, [proformaTemplate]);

  const lastAppliedTimestamp = useRef(0);
  const lastAppliedDesign3DTimestamp = useRef(0);
  const [designSource, setDesignSource] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'existing' | 'development'>(defaultModelType);
  const [holdPeriod, setHoldPeriod] = useState(5);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['dealInfo', 'unitMix', 'acquisition']));
  const [platformData, setPlatformData] = useState<Record<string, any>>({});

  const [dealName, setDealName] = useState(deal?.name || 'Untitled Deal');
  const [totalUnitsManual, setTotalUnitsManual] = useState<number | null>(null);
  const [netRentableSF, setNetRentableSF] = useState(deal?.netRentableSF || deal?.total_sqft || deal?.deal_data?.total_sqft || 0);
  const [vintage, setVintage] = useState(deal?.yearBuilt || deal?.year_built || deal?.deal_data?.year_built || 0);
  const [address, setAddress] = useState(deal?.address || deal?.property_address || '');
  const [city, setCity] = useState(deal?.city || deal?.deal_data?.city || '');
  const [state, setState] = useState(deal?.state || deal?.deal_data?.state || '');

  const [unitMix, setUnitMix] = useState<UnitMixRow[]>([
    { floorPlan: '1BR/1BA', unitSize: 0, beds: 1, units: 0, occupied: 0, vacant: 0, marketRent: 0, inPlaceRent: 0 },
    { floorPlan: '2BR/2BA', unitSize: 0, beds: 2, units: 0, occupied: 0, vacant: 0, marketRent: 0, inPlaceRent: 0 },
  ]);

  const totalUnits = totalUnitsManual ?? unitMix.reduce((s, u) => s + u.units, 0);
  const setTotalUnits = (v: number) => setTotalUnitsManual(v);

  const [purchasePrice, setPurchasePrice] = useState(deal?.purchasePrice || deal?.purchase_price || deal?.budget || deal?.deal_data?.asking_price || 0);
  const [capRate, setCapRate] = useState(deal?.capRate ? deal.capRate / 100 : deal?.deal_data?.broker_cap_rate ? deal.deal_data.broker_cap_rate / 100 : 0);
  const [closingCosts, setClosingCosts] = useState<Record<string, number>>({
    'Misc/Broker': 0,
    'Transfer Tax': 0,
    'Escrows': 0,
    'Rate Cap': 0,
    'Legal/Title': 0,
  });
  const [exitCapRate, setExitCapRate] = useState(0.055);
  const [sellingCosts, setSellingCosts] = useState(0.02);
  const [saleNOIMethod, setSaleNOIMethod] = useState('Forward 12mo');

  const [rentGrowth, setRentGrowth] = useState([0.035, 0.032, 0.030, 0.028, 0.027, 0.026, 0.025, 0.024, 0.023, 0.022]);
  const [lossToLease, setLossToLease] = useState(0.03);
  const [stabilizedOccupancy, setStabilizedOccupancy] = useState(0.94);
  const [collectionLoss, setCollectionLoss] = useState(0.015);
  const [concessionFreeWeeks, setConcessionFreeWeeks] = useState(0);
  const [concessionUnitsPct, setConcessionUnitsPct] = useState(0);
  const [concessionDurationMonths, setConcessionDurationMonths] = useState(0);
  const [concessionOngoing, setConcessionOngoing] = useState(modelType === 'existing');
  const [absorptionLinked, setAbsorptionLinked] = useState(false);

  const applyAbsorptionData = useCallback((data: { concessionPeriodMonths: number; eligibleUnitsPct: number; dealType: string }) => {
    const { concessionPeriodMonths, eligibleUnitsPct, dealType: absDealType } = data;
    if (absDealType === 'development' || absDealType === 'redevelopment') {
      setConcessionDurationMonths(concessionPeriodMonths || 0);
      setConcessionUnitsPct(eligibleUnitsPct > 1 ? eligibleUnitsPct / 100 : eligibleUnitsPct || 0);
      if (concessionFreeWeeks === 0) {
        setConcessionFreeWeeks(absDealType === 'development' ? 4 : 2);
      }
      setAbsorptionLinked(true);
    }
  }, [concessionFreeWeeks]);

  useEffect(() => {
    if (absorptionData && !absorptionLinked) {
      applyAbsorptionData(absorptionData);
    }
  }, [absorptionData]);

  useEffect(() => {
    if (lastEvent?.type === 'absorption-updated' && lastEvent.payload) {
      applyAbsorptionData(lastEvent.payload);
    }
  }, [lastEvent]);

  const [otherIncome, setOtherIncome] = useState<Record<string, OtherIncomeItem>>({ ...DEFAULT_OTHER_INCOME });

  const [expenses, setExpenses] = useState<Record<string, ExpenseItem>>({ ...DEFAULT_EXPENSES });

  const [loanAmount, setLoanAmount] = useState(deal?.loanAmount || deal?.loan_amount || 0);
  const [loanType, setLoanType] = useState('Fixed');
  const [interestRate, setInterestRate] = useState(0);
  const [spread, setSpread] = useState(0);
  const [loanTerm, setLoanTerm] = useState(10);
  const [amortization, setAmortization] = useState(30);
  const [ioPeriod, setIoPeriod] = useState(0);
  const [originationFee, setOriginationFee] = useState(0.01);
  const [rateCapCost, setRateCapCost] = useState(0);
  const [prepayPenalty, setPrepayPenalty] = useState(0.01);
  const [debtSource, setDebtSource] = useState<string | null>(null);

  useEffect(() => {
    const dealUnits = deal?.units || deal?.targetUnits || deal?.target_units || deal?.deal_data?.units || 0;
    if (dealUnits > 0 && totalUnitsManual === null) {
      setTotalUnitsManual(dealUnits);
    }
  }, [deal]);

  useEffect(() => {
    if (debtTerms && debtTerms.source && debtTerms.lastUpdated > lastAppliedTimestamp.current) {
      lastAppliedTimestamp.current = debtTerms.lastUpdated;
      if (debtTerms.loanAmount > 0) setLoanAmount(debtTerms.loanAmount);
      setLoanType(debtTerms.rateType === 'floating' ? 'Floating' : 'Fixed');
      if (debtTerms.interestRate > 0) setInterestRate(debtTerms.interestRate / 100);
      if (debtTerms.spread > 0) setSpread(debtTerms.spread / 100);
      if (debtTerms.term > 0) setLoanTerm(Math.round(debtTerms.term / 12));
      if (debtTerms.amortization > 0) setAmortization(Math.round(debtTerms.amortization / 12));
      if (debtTerms.ioPeriod > 0) setIoPeriod(debtTerms.ioPeriod);
      if (debtTerms.originationFee > 0) setOriginationFee(debtTerms.originationFee / 100);
      if (debtTerms.rateCapCost > 0) setRateCapCost(debtTerms.rateCapCost);
      setDebtSource('Debt & Equity');
    }
  }, [debtTerms]);

  // Sync modelType with ProForma template based on deal type
  useEffect(() => {
    setModelType(defaultModelType);
  }, [defaultModelType]);

  const lastStrategyTimestamp = useRef(0);
  useEffect(() => {
    if (lastEvent?.type === 'strategy-selected' && lastEvent.timestamp > lastStrategyTimestamp.current) {
      lastStrategyTimestamp.current = lastEvent.timestamp;
      const selected = strategy?.selectedStrategy || lastEvent.payload?.strategy;
      if (selected) {
        const strategyDefaults: Record<string, { exitCap: number; holdYears: number; capexMultiplier: number }> = {
          'build_to_sell': { exitCap: 0.045, holdYears: 3, capexMultiplier: 0 },
          'flip': { exitCap: 0.05, holdYears: 3, capexMultiplier: 1.5 },
          'rental_value_add': { exitCap: 0.055, holdYears: 5, capexMultiplier: 1.0 },
          'rental_stabilized': { exitCap: 0.06, holdYears: 7, capexMultiplier: 0.5 },
          'str': { exitCap: 0.065, holdYears: 5, capexMultiplier: 0.8 },
        };
        const defaults = strategyDefaults[selected] || strategyDefaults['rental_value_add'];
        setExitCapRate(defaults.exitCap);
        setHoldPeriod(defaults.holdYears);
      }
    }
  }, [lastEvent, strategy]);

  const lastMarketTimestamp = useRef(0);
  useEffect(() => {
    if (lastEvent?.type === 'market-updated' && lastEvent.timestamp > lastMarketTimestamp.current) {
      lastMarketTimestamp.current = lastEvent.timestamp;
      if (market) {
        if (market.occupancy > 0) {
          setStabilizedOccupancy(market.occupancy);
        }
        if (market.rentGrowth > 0) {
          setRentGrowth(prev => prev.map((_, i) => {
            const base = market.rentGrowth;
            return Math.max(0.01, base - (i * 0.002));
          }));
        }
      }
    }
  }, [lastEvent, market]);

  useEffect(() => {
    if (design3D && design3D.lastUpdated > 0 && design3D.lastUpdated > lastAppliedDesign3DTimestamp.current) {
      lastAppliedDesign3DTimestamp.current = design3D.lastUpdated;
      if (design3D.totalUnits > 0) setTotalUnitsManual(design3D.totalUnits);
      if (design3D.rentableSF > 0) setNetRentableSF(design3D.rentableSF);
      const mix = design3D.unitMix;
      if (mix && (mix.studio + mix.oneBed + mix.twoBed + mix.threeBed) > 0) {
        const newMix: UnitMixRow[] = [];
        if (mix.studio > 0) newMix.push({ floorPlan: 'Studio', unitSize: 550, beds: 0, units: mix.studio, occupied: Math.round(mix.studio * 0.94), vacant: mix.studio - Math.round(mix.studio * 0.94), marketRent: 1350, inPlaceRent: 1300 });
        if (mix.oneBed > 0) newMix.push({ floorPlan: '1BR/1BA', unitSize: 750, beds: 1, units: mix.oneBed, occupied: Math.round(mix.oneBed * 0.94), vacant: mix.oneBed - Math.round(mix.oneBed * 0.94), marketRent: 1550, inPlaceRent: 1480 });
        if (mix.twoBed > 0) newMix.push({ floorPlan: '2BR/2BA', unitSize: 1050, beds: 2, units: mix.twoBed, occupied: Math.round(mix.twoBed * 0.94), vacant: mix.twoBed - Math.round(mix.twoBed * 0.94), marketRent: 1900, inPlaceRent: 1820 });
        if (mix.threeBed > 0) newMix.push({ floorPlan: '3BR/2BA', unitSize: 1350, beds: 3, units: mix.threeBed, occupied: Math.round(mix.threeBed * 0.94), vacant: mix.threeBed - Math.round(mix.threeBed * 0.94), marketRent: 2400, inPlaceRent: 2300 });
        if (newMix.length > 0) setUnitMix(newMix);
      }
      setDesignSource('3D Design');
    }
  }, [design3D]);

  const lastDesignEventTimestamp = useRef(0);
  useEffect(() => {
    if (lastEvent?.type === 'design-updated' && lastEvent.timestamp > lastDesignEventTimestamp.current) {
      lastDesignEventTimestamp.current = lastEvent.timestamp;
      if (design3D && design3D.lastUpdated > lastAppliedDesign3DTimestamp.current) {
        lastAppliedDesign3DTimestamp.current = design3D.lastUpdated;
        if (design3D.totalUnits > 0) setTotalUnitsManual(design3D.totalUnits);
        if (design3D.rentableSF > 0) setNetRentableSF(design3D.rentableSF);
        const mix = design3D.unitMix;
        if (mix && (mix.studio + mix.oneBed + mix.twoBed + mix.threeBed) > 0) {
          const newMix: UnitMixRow[] = [];
          if (mix.studio > 0) newMix.push({ floorPlan: 'Studio', unitSize: 550, beds: 0, units: mix.studio, occupied: Math.round(mix.studio * 0.94), vacant: mix.studio - Math.round(mix.studio * 0.94), marketRent: 1350, inPlaceRent: 1300 });
          if (mix.oneBed > 0) newMix.push({ floorPlan: '1BR/1BA', unitSize: 750, beds: 1, units: mix.oneBed, occupied: Math.round(mix.oneBed * 0.94), vacant: mix.oneBed - Math.round(mix.oneBed * 0.94), marketRent: 1550, inPlaceRent: 1480 });
          if (mix.twoBed > 0) newMix.push({ floorPlan: '2BR/2BA', unitSize: 1050, beds: 2, units: mix.twoBed, occupied: Math.round(mix.twoBed * 0.94), vacant: mix.twoBed - Math.round(mix.twoBed * 0.94), marketRent: 1900, inPlaceRent: 1820 });
          if (mix.threeBed > 0) newMix.push({ floorPlan: '3BR/2BA', unitSize: 1350, beds: 3, units: mix.threeBed, occupied: Math.round(mix.threeBed * 0.94), vacant: mix.threeBed - Math.round(mix.threeBed * 0.94), marketRent: 2400, inPlaceRent: 2300 });
          if (newMix.length > 0) setUnitMix(newMix);
        }
        setDesignSource('3D Design');
      }
    }
  }, [lastEvent, design3D]);

  const [capexItems, setCapexItems] = useState<CapexLineItem[]>([
    { description: 'Interior Renovations', amount: 1500000 },
    { description: 'Exterior / Amenity Upgrades', amount: 500000 },
    { description: 'Deferred Maintenance', amount: 300000 },
  ]);
  const [contingencyPct, setContingencyPct] = useState(0.05);
  const [reservesPerUnit, setReservesPerUnit] = useState(250);

  const [lpShare, setLpShare] = useState(0.90);
  const [gpShare, setGpShare] = useState(0.10);
  const [equityContribution, setEquityContribution] = useState(12000000);
  const [hurdles, setHurdles] = useState<WaterfallHurdle[]>([
    { hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 },
    { hurdleRate: 0.12, promoteToGP: 0.30, lpSplit: 0.70 },
    { hurdleRate: 0.15, promoteToGP: 0.40, lpSplit: 0.60 },
  ]);

  const [landCost, setLandCost] = useState(5000000);
  const [hardCostPerSF, setHardCostPerSF] = useState(175);
  const [hardCostContingency, setHardCostContingency] = useState(0.05);
  const [softCostPct, setSoftCostPct] = useState(0.20);
  const [developerFee, setDeveloperFee] = useState(0.04);
  const [constructionPeriod, setConstructionPeriod] = useState(24);
  const [leaseUpVelocity, setLeaseUpVelocity] = useState(15);
  const [constructionLoanLTC, setConstructionLoanLTC] = useState(0.65);
  const [constructionLoanRate, setConstructionLoanRate] = useState(0.065);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [proformaRes, trafficRes, strategyRes, latestModelRes] = await Promise.allSettled([
          apiClient.get(`/api/v1/proforma/${id}`),
          apiClient.get(`/api/v1/leasing-traffic/v2/intelligence/${id}`),
          apiClient.get(`/api/v1/strategy-analyses/${id}`),
          apiClient.get(`/api/v1/financial-model/${id}/latest`),
        ]);

        if (cancelled) return;

        const pd: Record<string, any> = {};

        if (proformaRes.status === 'fulfilled' && proformaRes.value?.data) {
          const pf = proformaRes.value.data?.data || proformaRes.value.data;
          if (pf?.assumptions) {
            pd.proforma = pf.assumptions;
          }
        }

        if (trafficRes.status === 'fulfilled' && trafficRes.value?.data) {
          const traffic = trafficRes.value.data?.data || trafficRes.value.data;
          if (traffic?.occupancyTrajectory) {
            pd.occupancy = traffic.occupancyTrajectory.map((p: any) => p.occ / 100);
          }
          if (traffic?.rentTrajectory) {
            pd.rentGrowth = traffic.rentTrajectory.map((p: any) => p.growth / 100);
          }
        }

        if (strategyRes.status === 'fulfilled' && strategyRes.value?.data) {
          const raw = strategyRes.value.data;
          const strats = raw?.data || raw?.analyses || raw;
          if (strats && Array.isArray(strats) && strats.length > 0) {
            const s = strats[0];
            if (s?.assumptions?.exitCap) pd.exitCap = s.assumptions.exitCap / 100;
            if (s?.assumptions?.holdPeriod) pd.holdPeriod = s.assumptions.holdPeriod;
            if (s?.assumptions?.capex) pd.capexBudget = s.assumptions.capex;
          }
        }

        if (latestModelRes.status === 'fulfilled' && (latestModelRes.value as any)?.data?.data) {
          const model = (latestModelRes.value as any).data.data;
          if (model?.results) {
            setModelResults(model.results);
          }
        }

        setPlatformData(pd);
      } catch {
        console.warn('ProFormaTab: using defaults');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  const buildAssumptionsPayload = useCallback(() => {
    return {
      dealInfo: { dealName, totalUnits, netRentableSF, vintage, address, city, state },
      modelType,
      holdPeriod,
      unitMix,
      acquisition: { purchasePrice, capRate, closingCosts },
      disposition: { exitCapRate, sellingCosts, saleNOIMethod },
      revenue: {
        rentGrowth: rentGrowth.slice(0, holdPeriod),
        lossToLease,
        stabilizedOccupancy,
        collectionLoss,
        concessions: {
          freeWeeks: concessionFreeWeeks,
          unitsPct: concessionUnitsPct,
          durationMonths: concessionDurationMonths,
          ongoing: concessionOngoing,
        },
        otherIncome,
      },
      expenses,
      financing: {
        loanAmount, loanType, interestRate, spread, term: loanTerm,
        amortization, ioPeriod, originationFee, rateCapCost, prepayPenalty,
      },
      capex: { lineItems: capexItems, contingencyPct, reservesPerUnit },
      waterfall: { lpShare, gpShare, hurdles, equityContribution },
      ...(modelType === 'development' ? {
        development: {
          landCost, hardCostPerSF, hardCostContingency, softCostPct, developerFee,
          constructionPeriod, leaseUpVelocity, constructionLoanLTC, constructionLoanRate,
        },
      } : {}),
    };
  }, [
    dealName, totalUnits, netRentableSF, vintage, address, city, state, modelType, holdPeriod,
    unitMix, purchasePrice, capRate, closingCosts, exitCapRate, sellingCosts, saleNOIMethod,
    rentGrowth, lossToLease, stabilizedOccupancy, collectionLoss, otherIncome, expenses,
    loanAmount, loanType, interestRate, spread, loanTerm, amortization, ioPeriod,
    originationFee, rateCapCost, prepayPenalty, capexItems, contingencyPct, reservesPerUnit,
    lpShare, gpShare, hurdles, equityContribution, landCost, hardCostPerSF, hardCostContingency,
    softCostPct, developerFee, constructionPeriod, leaseUpVelocity, constructionLoanLTC, constructionLoanRate,
    concessionFreeWeeks, concessionUnitsPct, concessionDurationMonths, concessionOngoing,
  ]);

  const handleBuildModel = async () => {
    if (!id) return;
    setBuilding(true);
    setModelResults(null);
    try {
      const assumptions = buildAssumptionsPayload();
      const res = await apiClient.post('/api/v1/financial-model/build', { dealId: id, assumptions });
      const data = (res as any)?.data;
      let results: ModelResults | null = null;
      if (data?.data) {
        results = data.data;
        setModelResults(data.data);
      } else if (data) {
        results = data;
        setModelResults(data);
      }

      if (results) {
        const summary = results.summary || {};
        const totalCapex = capexItems.reduce((s, i) => s + i.amount, 0);
        const contingency = totalCapex * contingencyPct;
        const hardCostsVal = modelType === 'development'
          ? hardCostPerSF * netRentableSF * (1 + hardCostContingency)
          : totalCapex + contingency;
        const softCostsVal = modelType === 'development'
          ? hardCostPerSF * netRentableSF * softCostPct
          : Object.values(closingCosts).reduce((s, v) => s + v, 0);
        const totalDevCost = modelType === 'development'
          ? landCost + hardCostsVal + softCostsVal + (hardCostPerSF * netRentableSF * developerFee)
          : purchasePrice + softCostsVal + hardCostsVal;

        updateFinancial({
          totalDevelopmentCost: summary.totalDevelopmentCost ?? totalDevCost,
          landCost: summary.landCost ?? (modelType === 'development' ? landCost : 0),
          hardCosts: summary.hardCosts ?? hardCostsVal,
          softCosts: summary.softCosts ?? softCostsVal,
          noi: summary.noi ?? summary.year1NOI ?? summary.noiYear1 ?? 0,
          irr: summary.irr ?? 0,
          equityMultiple: summary.equityMultiple ?? 0,
          cashOnCash: Array.isArray(summary.cashOnCash) ? summary.cashOnCash[0] : (summary.cashOnCash ?? 0),
          purchasePrice,
          totalUnits,
          goingInCapRate: capRate,
          exitCapRate,
          stabilizedOccupancy,
          dscr: Array.isArray(summary.dscr) ? summary.dscr[0] : (summary.dscr ?? 0),
          debtService: summary.debtService ?? summary.annualDebtService ?? 0,
          yieldOnCost: summary.yieldOnCost ?? 0,
        });
        emitEvent({ source: 'ProFormaTab', type: 'financial-updated', payload: {
          dealId: id,
          noi: summary.noi ?? summary.year1NOI ?? summary.noiYear1 ?? 0,
          purchasePrice,
          capRate,
          exitCapRate,
          stabilizedOccupancy,
          totalUnits,
          dscr: Array.isArray(summary.dscr) ? summary.dscr[0] : (summary.dscr ?? 0),
        } });
      }
    } catch (err: any) {
      console.error('Model build failed:', err);
      alert('Model build failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setBuilding(false);
    }
  };

  const handleExportExcel = async () => {
    if (!id) return;
    try {
      const response = await apiClient.get(`/api/v1/financial-model/${id}/export/excel`, {
        responseType: 'blob',
      });
      const blob = new Blob([(response as any).data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dealName.replace(/[^a-zA-Z0-9]/g, '_')}_Model.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Excel export failed:', err);
      alert('Excel export failed: ' + (err?.response?.data?.error || err.message));
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto mb-3" />
          <div className="text-xs text-stone-400">Loading Pro Forma data...</div>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'dealInfo', label: 'Deal Info', icon: Building2 },
    { id: 'unitMix', label: 'Unit Mix & Rents', icon: BarChart3 },
    { id: 'acquisition', label: modelType === 'development' ? 'Development Costs' : 'Acquisition', icon: DollarSign },
    { id: 'disposition', label: 'Disposition', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue Assumptions', icon: TrendingUp },
    { id: 'concessions', label: 'Concessions', icon: ArrowRight },
    { id: 'otherIncome', label: 'Other Income', icon: DollarSign },
    { id: 'expenses', label: 'Operating Expenses', icon: BarChart3 },
    { id: 'financing', label: 'Financing', icon: DollarSign },
    { id: 'capex', label: 'Capital Expenditures', icon: Hammer },
    { id: 'waterfall', label: 'Waterfall / Partnership', icon: TrendingUp },
  ];

  return (
    <div style={{ background: BT.bgBase, minHeight: '100%' }}>
      {/* F8 Banner */}
      <div style={{ background: BT.blueBg, borderBottom: `1px solid ${BT.blue}40`, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.blueL, background: `${BT.blue}30`, border: `1px solid ${BT.blue}50`, borderRadius: 3, padding: '2px 6px', letterSpacing: 1, ...bMono }}>F8</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: BT.blueL, ...bSans }}>PRO FORMA CONTROL GRID</span>
        <span style={{ fontSize: 10, color: BT.td, ...bSans, marginLeft: 4 }}>Financial model · DCF · Waterfall · Sensitivity</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setModelType('existing')}
            style={{ fontSize: 10, fontWeight: modelType === 'existing' ? 700 : 500, color: modelType === 'existing' ? BT.blueL : BT.td, background: modelType === 'existing' ? `${BT.blue}20` : 'none', border: `1px solid ${modelType === 'existing' ? BT.blue : BT.border}`, borderRadius: 3, padding: '3px 9px', cursor: 'pointer', ...bSans }}
          >
            <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
            EXISTING
          </button>
          <button
            onClick={() => setModelType('development')}
            style={{ fontSize: 10, fontWeight: modelType === 'development' ? 700 : 500, color: modelType === 'development' ? BT.blueL : BT.td, background: modelType === 'development' ? `${BT.blue}20` : 'none', border: `1px solid ${modelType === 'development' ? BT.blue : BT.border}`, borderRadius: 3, padding: '3px 9px', cursor: 'pointer', ...bSans }}
          >
            <Hammer size={10} style={{ display: 'inline', marginRight: 4 }} />
            DEVELOPMENT
          </button>
        </div>
      </div>

      {/* Model Engine Bar */}
      <div style={{ background: BT.bgCard, borderBottom: `1px solid ${BT.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Zap size={13} color={BT.blueL} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: BT.tm, ...bSans }}>FINANCIAL MODEL ENGINE</div>
          <div style={{ fontSize: 10, color: BT.td, ...bSans }}>Claude AI builds a complete {holdPeriod}-year financial model from assumptions below</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={holdPeriod}
            onChange={(e) => setHoldPeriod(Number(e.target.value))}
            style={{ fontSize: 10, border: `1px solid ${BT.border}`, borderRadius: 3, padding: '3px 6px', background: BT.bgPanel, color: BT.tm, ...bMono }}
          >
            <option value={3}>3-Year</option>
            <option value={5}>5-Year</option>
            <option value={7}>7-Year</option>
            <option value={10}>10-Year</option>
          </select>
          <button
            onClick={handleBuildModel}
            disabled={building}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: building ? BT.bgPanel : BT.blue, border: `1px solid ${BT.blue}`, borderRadius: 3, color: building ? BT.td : '#fff', fontSize: 10, fontWeight: 700, cursor: building ? 'not-allowed' : 'pointer', opacity: building ? 0.6 : 1, ...bSans }}
          >
            {building ? (
              <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> BUILDING...</>
            ) : (
              <><Zap size={11} /> {modelResults ? 'REBUILD MODEL' : 'BUILD MODEL'}</>
            )}
          </button>
          {modelResults && (
            <button
              onClick={handleExportExcel}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: BT.green, border: `1px solid ${BT.greenL}`, borderRadius: 3, color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', ...bSans }}
            >
              <Download size={11} /> EXPORT EXCEL
            </button>
          )}
        </div>
      </div>

      {modelResults && <ModelResultsSummary results={modelResults} />}

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sections.map(section => {
          const isExpanded = expandedSections.has(section.id);
          const Icon = section.icon;

          return (
            <div key={section.id} style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <button
                onClick={() => toggleSection(section.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: isExpanded ? BT.bgPanel : 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s' } as any}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={12} color={isExpanded ? BT.amber : BT.td} />
                  <span style={{ fontSize: 11, fontWeight: isExpanded ? 700 : 600, color: isExpanded ? BT.tm : BT.ts, letterSpacing: 0.5, ...bSans }}>{section.label.toUpperCase()}</span>
                </div>
                {isExpanded ? <ChevronDown size={12} color={BT.amber} /> : <ChevronRight size={12} color={BT.td} />}
              </button>

              {isExpanded && (
                <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${BT.border}` }}>
                  {section.id === 'dealInfo' && (
                    <>
                      {designSource && (
                        <div className="mt-2 mb-1 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                            Source: {designSource}
                          </span>
                          <span className="text-[10px] text-stone-400">Units & SF pre-filled from 3D Design module — edit to override</span>
                        </div>
                      )}
                      <DealInfoSection
                        dealName={dealName} setDealName={setDealName}
                        totalUnits={totalUnits} setTotalUnits={setTotalUnits}
                        netRentableSF={netRentableSF} setNetRentableSF={setNetRentableSF}
                        vintage={vintage} setVintage={setVintage}
                        address={address} setAddress={setAddress}
                        city={city} setCity={setCity}
                        state={state} setState={setState}
                        platformData={platformData}
                      />
                    </>
                  )}
                  {section.id === 'unitMix' && (
                    <>
                      {designSource && (
                        <div className="mt-2 mb-1 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                            Source: {designSource}
                          </span>
                          <span className="text-[10px] text-stone-400">Unit mix pre-filled from 3D Design module — edit to override</span>
                        </div>
                      )}
                      <UnitMixSection unitMix={unitMix} setUnitMix={setUnitMix} platformData={platformData} />
                    </>
                  )}
                  {section.id === 'acquisition' && modelType === 'existing' && (
                    <AcquisitionSection
                      purchasePrice={purchasePrice} setPurchasePrice={setPurchasePrice}
                      capRate={capRate} setCapRate={setCapRate}
                      closingCosts={closingCosts} setClosingCosts={setClosingCosts}
                      platformData={platformData}
                      totalUnits={totalUnits}
                    />
                  )}
                  {section.id === 'acquisition' && modelType === 'development' && (
                    <DevelopmentCostsSection
                      landCost={landCost} setLandCost={setLandCost}
                      hardCostPerSF={hardCostPerSF} setHardCostPerSF={setHardCostPerSF}
                      hardCostContingency={hardCostContingency} setHardCostContingency={setHardCostContingency}
                      softCostPct={softCostPct} setSoftCostPct={setSoftCostPct}
                      developerFee={developerFee} setDeveloperFee={setDeveloperFee}
                      constructionPeriod={constructionPeriod} setConstructionPeriod={setConstructionPeriod}
                      leaseUpVelocity={leaseUpVelocity} setLeaseUpVelocity={setLeaseUpVelocity}
                      constructionLoanLTC={constructionLoanLTC} setConstructionLoanLTC={setConstructionLoanLTC}
                      constructionLoanRate={constructionLoanRate} setConstructionLoanRate={setConstructionLoanRate}
                      netRentableSF={netRentableSF}
                    />
                  )}
                  {section.id === 'disposition' && (
                    <DispositionSection
                      exitCapRate={exitCapRate} setExitCapRate={setExitCapRate}
                      sellingCosts={sellingCosts} setSellingCosts={setSellingCosts}
                      saleNOIMethod={saleNOIMethod} setSaleNOIMethod={setSaleNOIMethod}
                      holdPeriod={holdPeriod}
                      platformData={platformData}
                    />
                  )}
                  {section.id === 'revenue' && (
                    <RevenueSection
                      rentGrowth={rentGrowth} setRentGrowth={setRentGrowth}
                      lossToLease={lossToLease} setLossToLease={setLossToLease}
                      stabilizedOccupancy={stabilizedOccupancy} setStabilizedOccupancy={setStabilizedOccupancy}
                      collectionLoss={collectionLoss} setCollectionLoss={setCollectionLoss}
                      holdPeriod={holdPeriod}
                      platformData={platformData}
                    />
                  )}
                  {section.id === 'concessions' && (
                    <ConcessionsSection
                      freeWeeks={concessionFreeWeeks} setFreeWeeks={setConcessionFreeWeeks}
                      unitsPct={concessionUnitsPct} setUnitsPct={setConcessionUnitsPct}
                      durationMonths={concessionDurationMonths} setDurationMonths={setConcessionDurationMonths}
                      ongoing={concessionOngoing} setOngoing={setConcessionOngoing}
                      absorptionLinked={absorptionLinked}
                      totalUnits={totalUnits}
                      unitMix={unitMix}
                      modelType={modelType}
                    />
                  )}
                  {section.id === 'otherIncome' && (
                    <OtherIncomeSection
                      otherIncome={otherIncome} setOtherIncome={setOtherIncome}
                      totalUnits={totalUnits}
                    />
                  )}
                  {section.id === 'expenses' && (
                    <ExpensesSection
                      expenses={expenses} setExpenses={setExpenses}
                      totalUnits={totalUnits}
                    />
                  )}
                  {section.id === 'financing' && (
                    <>
                      {debtSource && (
                        <div className="mt-2 mb-1 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                            Source: {debtSource}
                          </span>
                          <span className="text-[10px] text-stone-400">Values pre-filled from Debt & Equity module — edit to override</span>
                        </div>
                      )}
                      <FinancingSection
                        loanAmount={loanAmount} setLoanAmount={setLoanAmount}
                        loanType={loanType} setLoanType={setLoanType}
                        interestRate={interestRate} setInterestRate={setInterestRate}
                        spread={spread} setSpread={setSpread}
                        loanTerm={loanTerm} setLoanTerm={setLoanTerm}
                        amortization={amortization} setAmortization={setAmortization}
                        ioPeriod={ioPeriod} setIoPeriod={setIoPeriod}
                        originationFee={originationFee} setOriginationFee={setOriginationFee}
                        rateCapCost={rateCapCost} setRateCapCost={setRateCapCost}
                        prepayPenalty={prepayPenalty} setPrepayPenalty={setPrepayPenalty}
                      />
                    </>
                  )}
                  {section.id === 'capex' && (
                    <CapexSection
                      capexItems={capexItems} setCapexItems={setCapexItems}
                      contingencyPct={contingencyPct} setContingencyPct={setContingencyPct}
                      reservesPerUnit={reservesPerUnit} setReservesPerUnit={setReservesPerUnit}
                    />
                  )}
                  {section.id === 'waterfall' && (
                    <WaterfallSection
                      lpShare={lpShare} setLpShare={setLpShare}
                      gpShare={gpShare} setGpShare={setGpShare}
                      equityContribution={equityContribution} setEquityContribution={setEquityContribution}
                      hurdles={hurdles} setHurdles={setHurdles}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InputField: React.FC<{
  label: string;
  value: number | string;
  onChange: (val: any) => void;
  type?: 'number' | 'text' | 'percent' | 'currency';
  platformValue?: any;
  platformSource?: string;
  step?: number;
  suffix?: string;
  className?: string;
}> = ({ label, value, onChange, type = 'number', platformValue, platformSource, step, suffix, className = '' }) => (
  <div className={`${className}`}>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[11px] font-medium text-stone-600">{label}</label>
      {platformValue !== undefined && (
        <span className="text-[9px] text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded font-mono" title={platformSource}>
          Platform: {typeof platformValue === 'number' ? (type === 'percent' ? fmtPct(platformValue) : type === 'currency' ? fmt$(platformValue) : platformValue) : platformValue}
        </span>
      )}
    </div>
    <div className="flex items-center">
      {type === 'currency' && <span className="text-xs text-stone-400 mr-1">$</span>}
      <input
        type={type === 'text' ? 'text' : 'number'}
        value={value}
        onChange={(e) => onChange(type === 'text' ? e.target.value : parseFloat(e.target.value) || 0)}
        step={step || (type === 'percent' ? 0.001 : type === 'currency' ? 1000 : 1)}
        className="w-full text-xs font-mono border border-stone-200 rounded-lg px-2.5 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
      />
      {suffix && <span className="text-xs text-stone-400 ml-1">{suffix}</span>}
      {type === 'percent' && <span className="text-xs text-stone-400 ml-1">×100=%</span>}
    </div>
  </div>
);

const DealInfoSection: React.FC<any> = ({ dealName, setDealName, totalUnits, setTotalUnits, netRentableSF, setNetRentableSF, vintage, setVintage, address, setAddress, city, setCity, state, setState }) => (
  <div className="grid grid-cols-3 gap-4 mt-3">
    <InputField label="Deal Name" value={dealName} onChange={setDealName} type="text" className="col-span-2" />
    <InputField label="Vintage / Year Built" value={vintage} onChange={setVintage} />
    <InputField label="Total Units" value={totalUnits} onChange={setTotalUnits} />
    <InputField label="Net Rentable SF" value={netRentableSF} onChange={setNetRentableSF} step={1000} />
    <InputField label="Avg Unit SF" value={netRentableSF > 0 && totalUnits > 0 ? Math.round(netRentableSF / totalUnits) : 0} onChange={() => {}} />
    <InputField label="Address" value={address} onChange={setAddress} type="text" />
    <InputField label="City" value={city} onChange={setCity} type="text" />
    <InputField label="State" value={state} onChange={setState} type="text" />
  </div>
);

const UnitMixSection: React.FC<{ unitMix: UnitMixRow[]; setUnitMix: (v: UnitMixRow[]) => void; platformData: any }> = ({ unitMix, setUnitMix, platformData }) => {
  const updateRow = (index: number, field: keyof UnitMixRow, value: any) => {
    const updated = [...unitMix];
    (updated[index] as any)[field] = value;
    if (field === 'units' || field === 'occupied') {
      updated[index].vacant = updated[index].units - updated[index].occupied;
    }
    setUnitMix(updated);
  };

  const addRow = () => {
    setUnitMix([...unitMix, { floorPlan: 'New Plan', unitSize: 800, beds: 1, units: 0, occupied: 0, vacant: 0, marketRent: 1500, inPlaceRent: 1400 }]);
  };

  const removeRow = (index: number) => {
    setUnitMix(unitMix.filter((_, i) => i !== index));
  };

  const totals = unitMix.reduce((acc, u) => ({
    units: acc.units + u.units,
    occupied: acc.occupied + u.occupied,
    vacant: acc.vacant + u.vacant,
    weightedRent: acc.weightedRent + u.marketRent * u.units,
    totalSF: acc.totalSF + u.unitSize * u.units,
  }), { units: 0, occupied: 0, vacant: 0, weightedRent: 0, totalSF: 0 });

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-stone-500 border-b border-stone-200">
              <th className="text-left py-2 px-2 font-medium">Floor Plan</th>
              <th className="text-right py-2 px-2 font-medium">SF</th>
              <th className="text-right py-2 px-2 font-medium">Beds</th>
              <th className="text-right py-2 px-2 font-medium">Units</th>
              <th className="text-right py-2 px-2 font-medium">Occ</th>
              <th className="text-right py-2 px-2 font-medium">Vac</th>
              <th className="text-right py-2 px-2 font-medium">Market Rent</th>
              <th className="text-right py-2 px-2 font-medium">Rent/SF</th>
              <th className="text-right py-2 px-2 font-medium">In-Place</th>
              <th className="py-2 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {unitMix.map((row, i) => (
              <tr key={i} className="border-b border-stone-100 hover:bg-stone-50">
                <td className="py-1.5 px-2">
                  <input type="text" value={row.floorPlan} onChange={(e) => updateRow(i, 'floorPlan', e.target.value)}
                    className="w-24 text-xs font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={row.unitSize} onChange={(e) => updateRow(i, 'unitSize', parseInt(e.target.value) || 0)}
                    className="w-16 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={row.beds} onChange={(e) => updateRow(i, 'beds', parseInt(e.target.value) || 0)}
                    className="w-12 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={row.units} onChange={(e) => updateRow(i, 'units', parseInt(e.target.value) || 0)}
                    className="w-14 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={row.occupied} onChange={(e) => updateRow(i, 'occupied', parseInt(e.target.value) || 0)}
                    className="w-14 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-stone-500">{row.vacant}</td>
                <td className="py-1.5 px-2">
                  <input type="number" value={row.marketRent} onChange={(e) => updateRow(i, 'marketRent', parseInt(e.target.value) || 0)}
                    className="w-18 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" step={25} />
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-stone-500">
                  ${row.unitSize > 0 ? (row.marketRent / row.unitSize).toFixed(2) : '0.00'}
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={row.inPlaceRent} onChange={(e) => updateRow(i, 'inPlaceRent', parseInt(e.target.value) || 0)}
                    className="w-18 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" step={25} />
                </td>
                <td className="py-1.5 px-1">
                  <button onClick={() => removeRow(i)} className="text-stone-300 hover:text-red-500 p-0.5">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-stone-50 font-semibold text-stone-700">
              <td className="py-2 px-2">TOTAL</td>
              <td className="py-2 px-2 text-right font-mono">{totals.units > 0 ? Math.round(totals.totalSF / totals.units) : 0}</td>
              <td className="py-2 px-2"></td>
              <td className="py-2 px-2 text-right font-mono">{totals.units}</td>
              <td className="py-2 px-2 text-right font-mono">{totals.occupied}</td>
              <td className="py-2 px-2 text-right font-mono">{totals.vacant}</td>
              <td className="py-2 px-2 text-right font-mono">${totals.units > 0 ? Math.round(totals.weightedRent / totals.units) : 0}</td>
              <td className="py-2 px-2 text-right font-mono">
                ${totals.totalSF > 0 ? (totals.weightedRent / totals.totalSF).toFixed(2) : '0.00'}
              </td>
              <td className="py-2 px-2"></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
        <Plus size={12} /> Add Floor Plan
      </button>
      <div className="mt-2 text-[10px] text-stone-400 font-mono">
        GPR: ${(totals.weightedRent * 12).toLocaleString()}/yr | Avg Rent: ${totals.units > 0 ? Math.round(totals.weightedRent / totals.units) : 0}/unit/mo | Occupancy: {totals.units > 0 ? ((totals.occupied / totals.units) * 100).toFixed(1) : 0}%
      </div>
    </div>
  );
};

const AcquisitionSection: React.FC<any> = ({ purchasePrice, setPurchasePrice, capRate, setCapRate, closingCosts, setClosingCosts, platformData, totalUnits }) => (
  <div className="mt-3 space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <InputField label="Purchase Price" value={purchasePrice} onChange={setPurchasePrice} type="currency" step={100000} />
      <InputField label="Going-In Cap Rate" value={capRate} onChange={setCapRate} type="percent" step={0.0025}
        platformValue={platformData?.exitCap} platformSource="Strategy Module" suffix="(decimal)" />
      <div>
        <label className="text-[11px] font-medium text-stone-600">Price/Unit</label>
        <div className="text-sm font-mono text-stone-700 mt-1">{totalUnits > 0 ? fmt$(Math.round(purchasePrice / totalUnits)) : '—'}</div>
      </div>
    </div>
    <div>
      <label className="text-[11px] font-medium text-stone-600 mb-2 block">Closing Costs</label>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(closingCosts).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-stone-500 w-24 truncate">{key}</span>
            <input type="number" value={val} onChange={(e) => setClosingCosts({ ...closingCosts, [key]: parseInt(e.target.value) || 0 })}
              className="flex-1 text-xs text-right font-mono border border-stone-200 rounded px-2 py-1 focus:border-blue-400 outline-none" step={5000} />
          </div>
        ))}
      </div>
      <div className="text-[10px] text-stone-400 font-mono mt-2">
        Total Closing Costs: {fmt$(Object.values(closingCosts).reduce((s, v) => s + v, 0))}
      </div>
    </div>
  </div>
);

const DevelopmentCostsSection: React.FC<any> = ({
  landCost, setLandCost, hardCostPerSF, setHardCostPerSF,
  hardCostContingency, setHardCostContingency, softCostPct, setSoftCostPct,
  developerFee, setDeveloperFee, constructionPeriod, setConstructionPeriod,
  leaseUpVelocity, setLeaseUpVelocity, constructionLoanLTC, setConstructionLoanLTC,
  constructionLoanRate, setConstructionLoanRate, netRentableSF,
}) => {
  const hardCost = hardCostPerSF * netRentableSF;
  const totalDev = landCost + hardCost * (1 + hardCostContingency) + hardCost * softCostPct + (hardCost + hardCost * softCostPct) * developerFee;

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <InputField label="Land Cost" value={landCost} onChange={setLandCost} type="currency" step={100000} />
        <InputField label="Hard Cost / SF" value={hardCostPerSF} onChange={setHardCostPerSF} step={5} suffix="$/SF" />
        <InputField label="Hard Cost Contingency" value={hardCostContingency} onChange={setHardCostContingency} type="percent" suffix="(decimal)" />
        <InputField label="Soft Cost % of Hard" value={softCostPct} onChange={setSoftCostPct} type="percent" suffix="(decimal)" />
        <InputField label="Developer Fee %" value={developerFee} onChange={setDeveloperFee} type="percent" suffix="(decimal)" />
        <InputField label="Construction Period" value={constructionPeriod} onChange={setConstructionPeriod} suffix="months" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <InputField label="Lease-Up Velocity" value={leaseUpVelocity} onChange={setLeaseUpVelocity} suffix="units/mo" />
        <InputField label="Construction Loan LTC" value={constructionLoanLTC} onChange={setConstructionLoanLTC} type="percent" suffix="(decimal)" />
        <InputField label="Construction Loan Rate" value={constructionLoanRate} onChange={setConstructionLoanRate} type="percent" suffix="(decimal)" />
      </div>
      <div className="bg-stone-50 rounded-lg p-3 text-[10px] font-mono text-stone-500">
        Hard Cost: {fmt$(hardCost)} | Total Dev Cost (est): {fmt$(totalDev)} | Loan: {fmt$(totalDev * constructionLoanLTC)} | Equity: {fmt$(totalDev * (1 - constructionLoanLTC))}
      </div>
    </div>
  );
};

const DispositionSection: React.FC<any> = ({ exitCapRate, setExitCapRate, sellingCosts, setSellingCosts, saleNOIMethod, setSaleNOIMethod, holdPeriod, platformData }) => (
  <div className="mt-3 grid grid-cols-3 gap-4">
    <InputField label="Exit Cap Rate" value={exitCapRate} onChange={setExitCapRate} type="percent"
      platformValue={platformData?.exitCap} platformSource="Strategy Module" suffix="(decimal)" />
    <InputField label="Selling Costs" value={sellingCosts} onChange={setSellingCosts} type="percent" suffix="(decimal)" />
    <div>
      <label className="text-[11px] font-medium text-stone-600 mb-1 block">Sale NOI Method</label>
      <select value={saleNOIMethod} onChange={(e) => setSaleNOIMethod(e.target.value)}
        className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:border-blue-400 outline-none">
        <option>Forward 12mo</option>
        <option>T-12</option>
      </select>
    </div>
  </div>
);

const RevenueSection: React.FC<any> = ({ rentGrowth, setRentGrowth, lossToLease, setLossToLease, stabilizedOccupancy, setStabilizedOccupancy, collectionLoss, setCollectionLoss, holdPeriod, platformData }) => (
  <div className="mt-3 space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <InputField label="Loss-to-Lease" value={lossToLease} onChange={setLossToLease} type="percent" suffix="(decimal)" />
      <InputField label="Stabilized Occupancy" value={stabilizedOccupancy} onChange={setStabilizedOccupancy} type="percent"
        platformValue={platformData?.occupancy?.[0]} platformSource="Traffic Module" suffix="(decimal)" />
      <InputField label="Collection Loss" value={collectionLoss} onChange={setCollectionLoss} type="percent" suffix="(decimal)" />
    </div>
    <div>
      <label className="text-[11px] font-medium text-stone-600 mb-2 block">
        Annual Rent Growth
        {platformData?.rentGrowth && (
          <span className="ml-2 text-[9px] text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded font-mono">
            Platform data available
          </span>
        )}
      </label>
      <div className="flex gap-2 flex-wrap">
        {rentGrowth.slice(0, Math.max(holdPeriod, 5)).map((val, i) => (
          <div key={i} className="text-center">
            <div className="text-[9px] text-stone-400 mb-1">Y{i + 1}</div>
            <input type="number" value={val} onChange={(e) => {
              const updated = [...rentGrowth];
              updated[i] = parseFloat(e.target.value) || 0;
              setRentGrowth(updated);
            }}
              className="w-16 text-xs text-center font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none"
              step={0.001} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface ConcessionsSectionProps {
  freeWeeks: number;
  setFreeWeeks: (v: number) => void;
  unitsPct: number;
  setUnitsPct: (v: number) => void;
  durationMonths: number;
  setDurationMonths: (v: number) => void;
  ongoing: boolean;
  setOngoing: (v: boolean) => void;
  totalUnits: number;
  unitMix: UnitMixRow[];
  modelType: 'existing' | 'development';
  absorptionLinked?: boolean;
}

const ConcessionsSection: React.FC<ConcessionsSectionProps> = ({
  freeWeeks, setFreeWeeks, unitsPct, setUnitsPct,
  durationMonths, setDurationMonths, ongoing, setOngoing,
  totalUnits, unitMix, modelType, absorptionLinked,
}) => {
  const avgMonthlyRent = unitMix.length > 0
    ? unitMix.reduce((s, u) => s + u.marketRent * u.units, 0) / Math.max(1, unitMix.reduce((s, u) => s + u.units, 0))
    : 1500;
  const weeklyRent = avgMonthlyRent / 4.33;
  const concessionUnits = Math.round(totalUnits * unitsPct);
  const concessionCostPerUnit = weeklyRent * freeWeeks;
  const leaseUpCycles = durationMonths > 0 ? Math.max(1, Math.ceil(durationMonths / 12)) : 1;
  const totalConcessionCost = ongoing
    ? concessionCostPerUnit * concessionUnits * leaseUpCycles
    : concessionCostPerUnit * concessionUnits;
  const annualizedConcessionCost = ongoing
    ? concessionCostPerUnit * concessionUnits
    : durationMonths > 0
      ? (concessionCostPerUnit * concessionUnits * 12) / Math.max(1, durationMonths)
      : concessionCostPerUnit * concessionUnits;
  const gpr = unitMix.reduce((s, u) => s + u.marketRent * u.units * 12, 0);
  const concessionPctOfGPR = gpr > 0 ? annualizedConcessionCost / gpr : 0;

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Info size={14} className="text-blue-500" />
        <span className="text-[11px] text-stone-500">
          {modelType === 'development'
            ? `Concessions reduce EGI during the ${durationMonths > 0 ? durationMonths + '-month ' : ''}lease-up period. Duration and eligible units are auto-linked from the Absorption Schedule (Traffic module).`
            : ongoing
              ? 'Ongoing renewal concessions are annualized and reduce effective rent collection each year.'
              : 'One-time lease-up concessions applied during the specified duration period.'
          }
        </span>
        {absorptionLinked && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            Linked to Absorption
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Free Rent (weeks)</label>
          <input type="number" value={freeWeeks} min={0} max={12} step={0.5}
            onChange={e => setFreeWeeks(parseFloat(e.target.value) || 0)}
            className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
          <div className="text-[9px] text-stone-400 mt-0.5">per lease</div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Units Receiving (%)</label>
          <input type="number" value={unitsPct} min={0} max={1} step={0.05}
            onChange={e => setUnitsPct(parseFloat(e.target.value) || 0)}
            className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
          <div className="text-[9px] text-stone-400 mt-0.5">{concessionUnits} units</div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Duration (months)</label>
          <input type="number" value={durationMonths} min={0} max={36}
            onChange={e => setDurationMonths(parseInt(e.target.value) || 0)}
            className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
          <div className="text-[9px] text-stone-400 mt-0.5">concession period</div>
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Ongoing?</label>
          <button
            onClick={() => setOngoing(!ongoing)}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              ongoing ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-stone-50 border-stone-200 text-stone-500'
            }`}
          >
            {ongoing ? 'Yes — recurring' : 'No — lease-up only'}
          </button>
          <div className="text-[9px] text-stone-400 mt-0.5">renewal concessions</div>
        </div>
      </div>

      {(freeWeeks > 0 && unitsPct > 0) && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
          <h5 className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider mb-3">Concession Impact</h5>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">Cost / Unit</div>
              <div className="text-sm font-bold font-mono text-stone-900">{fmt$(Math.round(concessionCostPerUnit))}</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">
                {ongoing ? 'Annual Cost' : 'Total Cost'}
              </div>
              <div className="text-sm font-bold font-mono text-red-700">{fmt$(Math.round(totalConcessionCost))}</div>
              {durationMonths > 0 && !ongoing && (
                <div className="text-[9px] text-stone-400 mt-0.5">over {durationMonths} months</div>
              )}
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">Annualized</div>
              <div className="text-sm font-bold font-mono text-red-600">{fmt$(Math.round(annualizedConcessionCost))}/yr</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">% of GPR</div>
              <div className="text-sm font-bold font-mono text-amber-700">{(concessionPctOfGPR * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">EGI Reduction</div>
              <div className="text-sm font-bold font-mono text-red-600">({fmt$(Math.round(annualizedConcessionCost))})</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-200">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Gross Potential Rent</span>
              <span className="font-mono text-stone-800">{fmt$(Math.round(gpr))}</span>
            </div>
            <div className="flex justify-between text-xs text-red-600 mt-1">
              <span>Less: Concessions {ongoing ? '(annual)' : durationMonths > 0 ? `(annualized from ${durationMonths}mo)` : ''}</span>
              <span className="font-mono">({fmt$(Math.round(annualizedConcessionCost))})</span>
            </div>
            <div className="flex justify-between text-xs font-semibold mt-1 pt-1 border-t border-stone-200">
              <span className="text-stone-800">Effective Gross Income (post-concessions)</span>
              <span className="font-mono text-stone-900">{fmt$(Math.round(gpr - annualizedConcessionCost))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OtherIncomeSection: React.FC<{ otherIncome: Record<string, OtherIncomeItem>; setOtherIncome: (v: Record<string, OtherIncomeItem>) => void; totalUnits: number }> = ({ otherIncome, setOtherIncome, totalUnits }) => {
  const totalAnnual = Object.values(otherIncome).reduce((sum, oi) => sum + oi.perUnitMonth * totalUnits * 12 * oi.penetration, 0);

  return (
    <div className="mt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-stone-500 border-b border-stone-200">
            <th className="text-left py-2 px-2 font-medium">Income Item</th>
            <th className="text-right py-2 px-2 font-medium">$/Unit/Mo</th>
            <th className="text-right py-2 px-2 font-medium">Penetration</th>
            <th className="text-right py-2 px-2 font-medium">Annual</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(otherIncome).map(([name, oi]) => (
            <tr key={name} className="border-b border-stone-100">
              <td className="py-1.5 px-2 text-stone-700">{name}</td>
              <td className="py-1.5 px-2">
                <input type="number" value={oi.perUnitMonth} step={5}
                  onChange={(e) => setOtherIncome({ ...otherIncome, [name]: { ...oi, perUnitMonth: parseFloat(e.target.value) || 0 } })}
                  className="w-16 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2">
                <input type="number" value={oi.penetration} step={0.05}
                  onChange={(e) => setOtherIncome({ ...otherIncome, [name]: { ...oi, penetration: parseFloat(e.target.value) || 0 } })}
                  className="w-16 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-stone-600">
                {fmt$(Math.round(oi.perUnitMonth * totalUnits * 12 * oi.penetration))}
              </td>
            </tr>
          ))}
          <tr className="bg-stone-50 font-semibold">
            <td className="py-2 px-2">TOTAL OTHER INCOME</td>
            <td></td><td></td>
            <td className="py-2 px-2 text-right font-mono">{fmt$(Math.round(totalAnnual))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ExpensesSection: React.FC<{ expenses: Record<string, ExpenseItem>; setExpenses: (v: Record<string, ExpenseItem>) => void; totalUnits: number }> = ({ expenses, setExpenses, totalUnits }) => {
  const totalExpenses = Object.values(expenses).reduce((sum, e) => {
    if (e.type === 'pctEGR') return sum;
    return sum + (e.type === 'perUnit' ? e.amount * totalUnits : e.amount);
  }, 0);

  return (
    <div className="mt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-stone-500 border-b border-stone-200">
            <th className="text-left py-2 px-2 font-medium">Expense Category</th>
            <th className="text-right py-2 px-2 font-medium">Amount</th>
            <th className="text-right py-2 px-2 font-medium">Type</th>
            <th className="text-right py-2 px-2 font-medium">Growth</th>
            <th className="text-right py-2 px-2 font-medium">Annual</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(expenses).map(([name, exp]) => (
            <tr key={name} className="border-b border-stone-100">
              <td className="py-1.5 px-2 text-stone-700">{name}</td>
              <td className="py-1.5 px-2">
                <input type="number" value={exp.amount}
                  step={exp.type === 'pctEGR' ? 0.005 : 1000}
                  onChange={(e) => setExpenses({ ...expenses, [name]: { ...exp, amount: parseFloat(e.target.value) || 0 } })}
                  className="w-20 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2">
                <select value={exp.type}
                  onChange={(e) => setExpenses({ ...expenses, [name]: { ...exp, type: e.target.value } })}
                  className="text-[10px] border border-stone-200 rounded px-1 py-0.5 outline-none">
                  <option value="total">Total</option>
                  <option value="perUnit">Per Unit</option>
                  <option value="pctEGR">% of EGR</option>
                </select>
              </td>
              <td className="py-1.5 px-2">
                <input type="number" value={exp.growthRate} step={0.005}
                  onChange={(e) => setExpenses({ ...expenses, [name]: { ...exp, growthRate: parseFloat(e.target.value) || 0 } })}
                  className="w-14 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-stone-600">
                {exp.type === 'pctEGR' ? fmtPct(exp.amount) : fmt$(exp.type === 'perUnit' ? exp.amount * totalUnits : exp.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-stone-50 font-semibold">
            <td className="py-2 px-2">TOTAL EXPENSES (excl. Mgmt %)</td>
            <td></td><td></td><td></td>
            <td className="py-2 px-2 text-right font-mono">{fmt$(Math.round(totalExpenses))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const FinancingSection: React.FC<any> = ({
  loanAmount, setLoanAmount, loanType, setLoanType, interestRate, setInterestRate,
  spread, setSpread, loanTerm, setLoanTerm, amortization, setAmortization,
  ioPeriod, setIoPeriod, originationFee, setOriginationFee, rateCapCost, setRateCapCost,
  prepayPenalty, setPrepayPenalty,
}) => (
  <div className="mt-3 space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <InputField label="Loan Amount" value={loanAmount} onChange={setLoanAmount} type="currency" step={100000} />
      <div>
        <label className="text-[11px] font-medium text-stone-600 mb-1 block">Loan Type</label>
        <select value={loanType} onChange={(e) => setLoanType(e.target.value)}
          className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:border-blue-400 outline-none">
          <option>Fixed</option>
          <option>Floating</option>
        </select>
      </div>
      <InputField label="Interest Rate" value={interestRate} onChange={setInterestRate} type="percent" suffix="(decimal)" />
    </div>
    <div className="grid grid-cols-3 gap-4">
      {loanType === 'Floating' && <InputField label="Spread" value={spread} onChange={setSpread} type="percent" suffix="(decimal)" />}
      <InputField label="Term (Years)" value={loanTerm} onChange={setLoanTerm} />
      <InputField label="Amortization (Years)" value={amortization} onChange={setAmortization} />
      <InputField label="IO Period (Months)" value={ioPeriod} onChange={setIoPeriod} />
    </div>
    <div className="grid grid-cols-3 gap-4">
      <InputField label="Origination Fee" value={originationFee} onChange={setOriginationFee} type="percent" suffix="(decimal)" />
      <InputField label="Rate Cap Cost" value={rateCapCost} onChange={setRateCapCost} type="currency" />
      <InputField label="Prepayment Penalty" value={prepayPenalty} onChange={setPrepayPenalty} type="percent" suffix="(decimal)" />
    </div>
  </div>
);

const CapexSection: React.FC<{
  capexItems: CapexLineItem[]; setCapexItems: (v: CapexLineItem[]) => void;
  contingencyPct: number; setContingencyPct: (v: number) => void;
  reservesPerUnit: number; setReservesPerUnit: (v: number) => void;
}> = ({ capexItems, setCapexItems, contingencyPct, setContingencyPct, reservesPerUnit, setReservesPerUnit }) => {
  const subtotal = capexItems.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="mt-3 space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-stone-500 border-b border-stone-200">
            <th className="text-left py-2 px-2 font-medium">Description</th>
            <th className="text-right py-2 px-2 font-medium">Amount</th>
            <th className="py-2 px-1"></th>
          </tr>
        </thead>
        <tbody>
          {capexItems.map((item, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="py-1.5 px-2">
                <input type="text" value={item.description} onChange={(e) => {
                  const updated = [...capexItems];
                  updated[i] = { ...item, description: e.target.value };
                  setCapexItems(updated);
                }}
                  className="w-full text-xs font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2">
                <input type="number" value={item.amount} step={10000} onChange={(e) => {
                  const updated = [...capexItems];
                  updated[i] = { ...item, amount: parseInt(e.target.value) || 0 };
                  setCapexItems(updated);
                }}
                  className="w-28 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-1">
                <button onClick={() => setCapexItems(capexItems.filter((_, idx) => idx !== i))} className="text-stone-300 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setCapexItems([...capexItems, { description: 'New Item', amount: 0 }])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
        <Plus size={12} /> Add Line Item
      </button>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[11px] font-medium text-stone-600">Subtotal</label>
          <div className="text-sm font-mono text-stone-700">{fmt$(subtotal)}</div>
        </div>
        <InputField label="GC Contingency" value={contingencyPct} onChange={setContingencyPct} type="percent" suffix="(decimal)" />
        <InputField label="Reserves/Unit/Year" value={reservesPerUnit} onChange={setReservesPerUnit} step={25} suffix="$/unit" />
      </div>
      <div className="text-[10px] font-mono text-stone-400">
        Total CapEx (with contingency): {fmt$(Math.round(subtotal * (1 + contingencyPct)))}
      </div>
    </div>
  );
};

const WaterfallSection: React.FC<{
  lpShare: number; setLpShare: (v: number) => void;
  gpShare: number; setGpShare: (v: number) => void;
  equityContribution: number; setEquityContribution: (v: number) => void;
  hurdles: WaterfallHurdle[]; setHurdles: (v: WaterfallHurdle[]) => void;
}> = ({ lpShare, setLpShare, gpShare, setGpShare, equityContribution, setEquityContribution, hurdles, setHurdles }) => (
  <div className="mt-3 space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <InputField label="Total Equity" value={equityContribution} onChange={setEquityContribution} type="currency" step={100000} />
      <InputField label="LP Share" value={lpShare} onChange={(v: number) => { setLpShare(v); setGpShare(+(1 - v).toFixed(4)); }} type="percent" suffix="(decimal)" />
      <InputField label="GP Share" value={gpShare} onChange={(v: number) => { setGpShare(v); setLpShare(+(1 - v).toFixed(4)); }} type="percent" suffix="(decimal)" />
    </div>
    <div>
      <label className="text-[11px] font-medium text-stone-600 mb-2 block">Promote Hurdles</label>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-stone-500 border-b border-stone-200">
            <th className="text-left py-2 px-2 font-medium">Tier</th>
            <th className="text-right py-2 px-2 font-medium">Hurdle IRR</th>
            <th className="text-right py-2 px-2 font-medium">GP Promote</th>
            <th className="text-right py-2 px-2 font-medium">LP Split</th>
            <th className="py-2 px-1"></th>
          </tr>
        </thead>
        <tbody>
          {hurdles.map((h, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="py-1.5 px-2 text-stone-600">Tier {i + 1}</td>
              <td className="py-1.5 px-2">
                <input type="number" value={h.hurdleRate} step={0.01}
                  onChange={(e) => { const u = [...hurdles]; u[i] = { ...h, hurdleRate: parseFloat(e.target.value) || 0 }; setHurdles(u); }}
                  className="w-16 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2">
                <input type="number" value={h.promoteToGP} step={0.05}
                  onChange={(e) => { const u = [...hurdles]; u[i] = { ...h, promoteToGP: parseFloat(e.target.value) || 0 }; setHurdles(u); }}
                  className="w-16 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-2">
                <input type="number" value={h.lpSplit} step={0.05}
                  onChange={(e) => { const u = [...hurdles]; u[i] = { ...h, lpSplit: parseFloat(e.target.value) || 0 }; setHurdles(u); }}
                  className="w-16 text-xs text-right font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none" />
              </td>
              <td className="py-1.5 px-1">
                <button onClick={() => setHurdles(hurdles.filter((_, idx) => idx !== i))} className="text-stone-300 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setHurdles([...hurdles, { hurdleRate: 0.20, promoteToGP: 0.50, lpSplit: 0.50 }])}
        className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
        <Plus size={12} /> Add Hurdle Tier
      </button>
    </div>
  </div>
);

const ModelResultsSummary: React.FC<{ results: ModelResults }> = ({ results }) => {
  const s = results.summary;
  if (!s) return null;

  return (
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.green}60`, borderRadius: 4, overflow: 'hidden', margin: '0 16px' }}>
      <div style={{ padding: '8px 14px', background: BT.greenBg, borderBottom: `1px solid ${BT.green}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={13} color={BT.greenL} />
        <span style={{ fontSize: 11, fontWeight: 700, color: BT.greenL, letterSpacing: 0.5, ...bSans }}>MODEL RESULTS</span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
          <MetricCard label="Levered IRR" value={s.irr != null ? `${(s.irr * 100).toFixed(1)}%` : '—'} color={BT.blueL} />
          <MetricCard label="Equity Multiple" value={s.equityMultiple != null ? `${s.equityMultiple.toFixed(2)}x` : '—'} color={BT.greenL} />
          <MetricCard label="Year 1 NOI" value={s.noiYear1 ? fmt$(s.noiYear1) : '—'} color={BT.violL} />
          <MetricCard label="Exit Value" value={s.exitValue ? fmt$(s.exitValue) : '—'} color={BT.amber} />
          <MetricCard label="DSCR (Y1)" value={Array.isArray(s.dscr) && s.dscr[0] ? `${s.dscr[0].toFixed(2)}x` : (s.dscr ? `${Number(s.dscr).toFixed(2)}x` : '—')} color={BT.ts} />
        </div>

        {results.annualCashFlow && results.annualCashFlow.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, marginBottom: 8, ...bMono }}>ANNUAL CASH FLOW SUMMARY</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', ...bMono }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BT.border}` }}>
                    <th style={{ textAlign: 'left', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>Year</th>
                    {results.annualCashFlow.map((cf, i) => (
                      <th key={i} style={{ textAlign: 'right', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>Y{cf.year || i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CashFlowRow label="EGR" values={results.annualCashFlow.map(y => y.effectiveGrossRevenue)} />
                  <CashFlowRow label="NOI" values={results.annualCashFlow.map(y => y.noi)} bold />
                  <CashFlowRow label="Debt Service" values={results.annualCashFlow.map(y => y.debtService)} negative />
                  <CashFlowRow label="Levered CF" values={results.annualCashFlow.map(y => y.leveredCashFlow)} bold highlight />
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results.sensitivityAnalysis?.exitCapVsHoldPeriod?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, marginBottom: 8, ...bMono }}>SENSITIVITY: EXIT CAP vs HOLD PERIOD (IRR)</div>
            <SensitivityGrid data={results.sensitivityAnalysis.exitCapVsHoldPeriod} rowKey="holdPeriod" colKey="capRate" rowLabel="Hold" colLabel="Cap Rate" formatCol={(v: number) => `${(v * 100).toFixed(1)}%`} formatRow={(v: number) => `${v}yr`} />
          </div>
        )}

        {results.waterfallDistributions?.length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, marginBottom: 8, ...bMono }}>WATERFALL DISTRIBUTIONS</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', ...bMono }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BT.border}` }}>
                    <th style={{ textAlign: 'left', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>Year</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>LP</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>GP</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px', color: BT.greenL, fontWeight: 600 }}>PROMOTE</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {results.waterfallDistributions.map((w, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${BT.border}` }}>
                      <td style={{ padding: '4px 8px', color: BT.ts }}>Y{w.year}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.tm }}>{fmt$(Math.round(w.lpDistribution))}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.tm }}>{fmt$(Math.round(w.gpDistribution))}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.greenL }}>{fmt$(Math.round(w.gpPromote))}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.amber, fontWeight: 700 }}>{fmt$(Math.round(w.totalDistribution))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', padding: '8px', background: BT.bgPanel, borderRadius: 3, border: `1px solid ${BT.border}` }}>
    <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1.2, marginBottom: 4, ...bSans }}>{label.toUpperCase()}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color, ...bMono }}>{value}</div>
  </div>
);

const CashFlowRow: React.FC<{ label: string; values: number[]; bold?: boolean; negative?: boolean; highlight?: boolean }> = ({ label, values, bold, negative, highlight }) => (
  <tr style={{ borderBottom: `1px solid ${BT.border}`, background: highlight ? BT.blueBg : 'transparent' }}>
    <td style={{ padding: '4px 8px', fontWeight: bold ? 700 : 500, color: negative ? BT.redL : bold ? BT.tm : BT.ts }}>{label}</td>
    {(values || []).map((v, i) => (
      <td key={i} style={{ textAlign: 'right', padding: '4px 8px', fontWeight: bold ? 700 : 400, color: negative ? BT.redL : bold ? BT.amber : BT.tm }}>
        {v != null ? fmt$(Math.round(v)) : '—'}
      </td>
    ))}
  </tr>
);

const SensitivityGrid: React.FC<{ data: any[]; rowKey: string; colKey: string; rowLabel: string; colLabel: string; formatCol: (v: number) => string; formatRow: (v: number) => string }> = ({ data, rowKey, colKey, rowLabel, colLabel, formatCol, formatRow }) => {
  const rows = [...new Set(data.map((d: any) => d[rowKey]))].sort((a: number, b: number) => a - b);
  const cols = [...new Set(data.map((d: any) => d[colKey]))].sort((a: number, b: number) => a - b);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', ...bMono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BT.border}` }}>
            <th style={{ textAlign: 'left', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>{rowLabel}\{colLabel}</th>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: 'right', padding: '5px 8px', color: BT.td, fontWeight: 600 }}>{formatCol(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${BT.border}` }}>
              <td style={{ padding: '4px 8px', color: BT.ts, fontWeight: 600 }}>{formatRow(r)}</td>
              {cols.map((c, ci) => {
                const cell = data.find((d: any) => d[rowKey] === r && d[colKey] === c);
                const irrVal = cell ? cell.irr * 100 : null;
                return (
                  <td key={ci} style={{ textAlign: 'right', padding: '4px 8px', color: irrVal != null ? (irrVal >= 20 ? BT.greenL : irrVal >= 15 ? BT.amber : BT.redL) : BT.td }}>
                    {irrVal != null ? `${irrVal.toFixed(1)}%` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProFormaTab;
