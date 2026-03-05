import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";

interface CompUnit {
  mix: number;
  sf: number;
  rent: number;
  vac: number;
  dom: number;
  conc: number;
}

export interface CompProperty {
  id: string;
  name: string;
  cls: string;
  built: number;
  total: number;
  sourceUrl: string | null;
  units: Record<string, CompUnit>;
}

export interface DemandScore {
  unitType: string;
  demandScore: number;
  avgVac: number;
  avgDom: number;
  avgRent: number;
  avgConc: number;
}

export interface TrendPoint {
  mo: string;
  vac: number;
  dom: number;
  rent: number;
  conc: number;
}

export interface ZoningData {
  zoningCode: string | null;
  maxUnits: number | null;
  maxNetSF: number | null;
  excludesParking: boolean | null;
  maxHeight: number | null;
  maxLotCoverage: number | null;
  source: string | null;
  sourceUrl: string | null;
  confidence: number | null;
}

export interface UnitProgram {
  totalUnits: number;
  units: Record<string, { mix: number; sf: number; rent: number }>;
  totalNetSf?: number;
  grossRevPA?: number;
}

export function useUnitMixIntelligence(dealId: string | undefined, tradeAreaId: string | undefined) {
  const [comps, setComps] = useState<CompProperty[] | null>(null);
  const [demandScores, setDemandScores] = useState<DemandScore[] | null>(null);
  const [trends, setTrends] = useState<Record<string, TrendPoint[]> | null>(null);
  const [zoning, setZoning] = useState<ZoningData | null>(null);
  const [program, setProgram] = useState<UnitProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dealId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const tradeAreaParam = tradeAreaId ? `?tradeAreaId=${tradeAreaId}` : "";
        const [compsRes, trendsRes, zoningRes, programRes] = await Promise.all([
          axios.get(`/api/v1/unit-mix/${dealId}/comps${tradeAreaParam}`).then(r => r.data).catch(() => ({ comps: null, demandScores: null })),
          axios.get(`/api/v1/unit-mix/${dealId}/trends${tradeAreaParam}`).then(r => r.data).catch(() => ({ trends: null })),
          axios.get(`/api/v1/unit-mix/${dealId}/zoning`).then(r => r.data).catch(() => ({ zoning: null })),
          axios.get(`/api/v1/unit-mix/${dealId}/program`).then(r => r.data).catch(() => ({ program: null })),
        ]);

        if (cancelled) return;

        setComps(compsRes.comps);
        setDemandScores(compsRes.demandScores);
        setTrends(trendsRes.trends);
        setZoning(zoningRes.zoning);
        setProgram(programRes.program);
      } catch (e: any) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [dealId, tradeAreaId]);

  const handleProgramChange = useCallback((newProgram: UnitProgram) => {
    setProgram(newProgram);
    if (!dealId) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      axios.post(`/api/v1/unit-mix/${dealId}/program`, newProgram).catch(err => {
        console.error("Failed to save unit program:", err);
      });
    }, 1500);
  }, [dealId]);

  return { comps, demandScores, trends, zoning, program, loading, error, handleProgramChange };
}
