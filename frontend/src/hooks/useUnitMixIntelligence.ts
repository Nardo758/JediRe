import { useState, useEffect } from 'react';

export interface UnitTypeData {
  mix: number;
  sf: number;
  rent: number;
  vac?: number;
  dom?: number;
  conc?: number;
}

export interface CompProperty {
  id: string;
  name: string;
  cls: string;
  built: number;
  total: number;
  sourceUrl?: string;
  units: Record<string, UnitTypeData>;
}

export interface DemandScore {
  unitType: string;
  demandScore: number;
  avgVac: number;
  avgDom: number;
  avgRent: number;
  avgConc: number;
}

export interface UnitProgram {
  totalUnits: number;
  units: Record<string, { mix: number; sf: number; rent: number }>;
  totalNetSf?: number;
  grossRevPA?: number;
}

export interface ZoningForUnitMix {
  zoningCode: string | null;
  maxUnits: number | null;
  maxNetSF: number | null;
  excludesParking: null;
  maxHeight: number | null;
  maxLotCoverage: number | null;
  source: null;
  sourceUrl: null;
  confidence: null;
}

interface UseUnitMixResult {
  comps: CompProperty[];
  demandScores: DemandScore[];
  program: UnitProgram | null;
  zoning: ZoningForUnitMix | null;
  loading: boolean;
  error: string | null;
  refetchProgram: () => void;
}

export function useUnitMixIntelligence(
  dealId: string | undefined,
  tradeAreaId?: string
): UseUnitMixResult {
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [demandScores, setDemandScores] = useState<DemandScore[]>([]);
  const [program, setProgram] = useState<UnitProgram | null>(null);
  const [zoning, setZoning] = useState<ZoningForUnitMix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programVersion, setProgramVersion] = useState(0);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    setError(null);

    const compsUrl = tradeAreaId
      ? `/api/v1/unit-mix/${dealId}/comps?tradeAreaId=${tradeAreaId}`
      : `/api/v1/unit-mix/${dealId}/comps`;

    Promise.all([
      fetch(compsUrl).then(r => r.json()).catch(() => ({ comps: [], demandScores: [] })),
      fetch(`/api/v1/unit-mix/${dealId}/program`).then(r => r.json()).catch(() => ({ program: null })),
      fetch(`/api/v1/unit-mix/${dealId}/zoning`).then(r => r.json()).catch(() => ({ zoning: null })),
    ]).then(([compsData, programData, zoningData]) => {
      setComps(compsData.comps || []);
      setDemandScores(compsData.demandScores || []);
      setProgram(programData.program || null);
      setZoning(zoningData.zoning || null);
    }).catch(err => {
      setError(err.message || 'Failed to load unit mix data');
    }).finally(() => {
      setLoading(false);
    });
  }, [dealId, tradeAreaId, programVersion]);

  const refetchProgram = () => setProgramVersion(v => v + 1);

  return { comps, demandScores, program, zoning, loading, error, refetchProgram };
}
