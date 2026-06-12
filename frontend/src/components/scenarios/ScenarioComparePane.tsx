import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bot, ArrowRightLeft, ChevronDown, GitBranch } from 'lucide-react';
import { BT, SectionPanel, DataRow } from '../../components/deal/bloomberg-ui';
import {
  listScenarios,
  getScenario,
  computeScenarioDiff,
  type UWScenario,
  type ScenarioDiff,
} from '../../services/underwriting-scenarios.api';

const MONO = BT.font.mono;

interface ScenarioComparePaneProps {
  dealId: string;
}

const YEAR1_KEYS = [
  'gpr', 'egi', 'net_rental_income', 'total_opex', 'noi', 'noi_after_reserves',
  'payroll', 'real_estate_tax', 'insurance', 'utilities', 'repairs_maintenance',
  'marketing', 'g_and_a', 'management_fee_dollars', 'replacement_reserves',
  'contract_services', 'turnover', 'vacancy_loss_dollars', 'bad_debt_dollars',
  'concessions', 'management_fee_pct', 'vacancy_pct', 'bad_debt_pct',
];

const KEY_LABELS: Record<string, string> = {
  gpr: 'GPR', egi: 'EGI', net_rental_income: 'NET RENTAL', total_opex: 'TOTAL OPEX',
  noi: 'NOI', noi_after_reserves: 'NOI AFTER RESERVES', payroll: 'PAYROLL',
  real_estate_tax: 'PROPERTY TAX', insurance: 'INSURANCE', utilities: 'UTILITIES',
  repairs_maintenance: 'R&M', marketing: 'MARKETING', g_and_a: 'G&A',
  management_fee_dollars: 'MGMT FEE ($)', replacement_reserves: 'REPLACEMENT RESERVES',
  contract_services: 'CONTRACT SVCS', turnover: 'TURNOVER',
  vacancy_loss_dollars: 'VACANCY ($)', bad_debt_dollars: 'BAD DEBT ($)',
  concessions: 'CONCESSIONS', management_fee_pct: 'MGMT FEE %',
  vacancy_pct: 'VACANCY %', bad_debt_pct: 'BAD DEBT %',
};

function getResolvedValue(year1: Record<string, unknown>, key: string): number | null {
  const entry = year1[key] as Record<string, unknown> | undefined;
  if (entry == null) return null;
  const v = entry.resolved ?? entry.agent ?? entry.platform ?? entry.t12 ?? entry.om ?? entry.override;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export const ScenarioComparePane: React.FC<ScenarioComparePaneProps> = ({ dealId }) => {
  const [scenarios, setScenarios] = useState<UWScenario[]>([]);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [aScenario, setAScenario] = useState<UWScenario | null>(null);
  const [bScenario, setBScenario] = useState<UWScenario | null>(null);
  const [diff, setDiff] = useState<ScenarioDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aOpen, setAOpen] = useState(false);
  const [bOpen, setBOpen] = useState(false);

  const fetchScenarios = useCallback(async () => {
    if (!dealId) return;
    try {
      const list = await listScenarios(dealId);
      setScenarios(list);
      if (!aId && list.length > 0) setAId(list[0].id);
      if (!bId && list.length > 1) setBId(list[1].id);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load scenarios');
    }
  }, [dealId, aId, bId]);

  useEffect(() => { void fetchScenarios(); }, [fetchScenarios]);

  useEffect(() => {
    if (!dealId || !aId) return;
    let cancelled = false;
    getScenario(dealId, aId).then(s => { if (!cancelled) setAScenario(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [dealId, aId]);

  useEffect(() => {
    if (!dealId || !bId) return;
    let cancelled = false;
    getScenario(dealId, bId).then(s => { if (!cancelled) setBScenario(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [dealId, bId]);

  const runDiff = async () => {
    if (!dealId || !aId || !bId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await computeScenarioDiff(dealId, aId, bId);
      setDiff(d);
    } catch (e: any) {
      setError(e?.message ?? 'Diff failed');
    } finally {
      setLoading(false);
    }
  };

  const diffMap = useMemo(() => {
    const m = new Map<string, ScenarioDiff['field_diffs'][0]>();
    if (diff) {
      for (const f of diff.field_diffs) m.set(f.field_path, f);
    }
    return m;
  }, [diff]);

  const aYear1 = aScenario?.year1 ?? {};
  const bYear1 = bScenario?.year1 ?? {};

  const renderPicker = (
    label: string,
    selectedId: string | null,
    open: boolean,
    setOpen: (o: boolean) => void,
    setId: (id: string) => void,
  ) => (
    <div style={{ position: 'relative', flex: 1 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px',
          background: BT.bg.panel,
          border: `1px solid ${BT.border.medium}`,
          borderRadius: 2,
          cursor: 'pointer',
          fontFamily: MONO,
          fontSize: 10,
          color: BT.text.primary,
        }}
      >
        <span style={{ fontSize: 8, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.5 }}>{label}</span>
        {(() => {
          const s = scenarios.find(x => x.id === selectedId);
          if (!s) return <span style={{ color: BT.text.muted }}>Select…</span>;
          const isAgent = s.created_by === 'agent';
          return (
            <>
              {isAgent && <Bot size={10} color="#8B5CF6" />}
              <span style={{ fontWeight: 700, color: isAgent ? '#8B5CF6' : '#F5A623' }}>{s.name}</span>
              {s.parent_id && <GitBranch size={8} color={BT.text.muted} />}
            </>
          );
        })()}
        <ChevronDown size={10} color={BT.text.muted} style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: '#0F1319', border: `1px solid ${BT.border.medium}`, borderRadius: 2,
          maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {scenarios.map(s => {
            const isAgent = s.created_by === 'agent';
            return (
              <button
                key={s.id}
                onClick={() => { setId(s.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  width: '100%', padding: '4px 8px',
                  background: 'transparent', border: 'none', borderBottom: `1px solid ${BT.border.subtle}20`,
                  cursor: 'pointer', fontFamily: MONO, fontSize: 9, color: BT.text.primary,
                  textAlign: 'left',
                }}
              >
                {isAgent && <Bot size={9} color="#8B5CF6" />}
                <span style={{ color: isAgent ? '#8B5CF6' : '#F5A623' }}>{s.name}</span>
                {s.is_active && <span style={{ fontSize: 7, color: '#10B981', marginLeft: 'auto', fontWeight: 700 }}>ACTIVE</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, fontFamily: MONO, letterSpacing: 0.8 }}>
          ⇔ SCENARIO COMPARE
        </span>
        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>
          M40 · TWO-PANE
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={runDiff}
          disabled={loading || !aId || !bId}
          style={{
            background: BT.met.financial, border: 'none', color: '#000',
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            padding: '2px 10px', cursor: 'pointer', borderRadius: 2,
            opacity: loading || !aId || !bId ? 0.5 : 1,
          }}
        >
          {loading ? 'COMPUTING…' : 'RUN DIFF'}
        </button>
      </div>

      {/* Pickers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0,
      }}>
        {renderPicker('A', aId, aOpen, setAOpen, setAId)}
        <ArrowRightLeft size={14} color={BT.text.muted} />
        {renderPicker('B', bId, bOpen, setBOpen, setBId)}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '4px 10px', background: '#EF444410',
          borderBottom: `1px solid #EF444444`,
          fontFamily: MONO, fontSize: 9, color: '#EF4444', flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Diff summary */}
      {diff && (
        <div style={{
          padding: '4px 10px', background: `${BT.met.financial}10`,
          borderBottom: `1px solid ${BT.met.financial}44`,
          fontFamily: MONO, fontSize: 9, color: BT.met.financial,
          flexShrink: 0, display: 'flex', gap: 10,
        }}>
          <span>{diff.summary.fields_with_changes} CHANGED</span>
          <span>{diff.summary.fields_unchanged} SAME</span>
          <span style={{ color: '#EF4444' }}>{diff.summary.materially_different} MAJOR</span>
        </div>
      )}

      {/* Two-pane table */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        {/* Left pane */}
        <div style={{ flex: 1, borderRight: `1px solid ${BT.border.subtle}` }}>
          <div style={{
            padding: '6px 10px', background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
            fontFamily: MONO, fontSize: 9, fontWeight: 700, color: aScenario?.created_by === 'agent' ? '#8B5CF6' : '#F5A623',
          }}>
            {aScenario?.name ?? '—'}
          </div>
          <div style={{ padding: '4px 0' }}>
            {YEAR1_KEYS.map(key => {
              const v = getResolvedValue(aYear1, key);
              const fd = diffMap.get(key);
              return (
                <div key={key} style={{
                  padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: MONO, fontSize: 9,
                  borderBottom: `1px solid ${BT.border.subtle}10`,
                  background: fd?.significance === 'major' ? '#EF444410' : fd?.significance === 'minor' ? '#F59E0B10' : 'transparent',
                }}>
                  <span style={{ width: 140, color: BT.text.secondary, flexShrink: 0 }}>{KEY_LABELS[key] ?? key}</span>
                  <span style={{ flex: 1, textAlign: 'right', color: BT.text.primary, fontWeight: 700 }}>
                    {fmt(v)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane */}
        <div style={{ flex: 1 }}>
          <div style={{
            padding: '6px 10px', background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
            fontFamily: MONO, fontSize: 9, fontWeight: 700, color: bScenario?.created_by === 'agent' ? '#8B5CF6' : '#F5A623',
          }}>
            {bScenario?.name ?? '—'}
          </div>
          <div style={{ padding: '4px 0' }}>
            {YEAR1_KEYS.map(key => {
              const v = getResolvedValue(bYear1, key);
              const fd = diffMap.get(key);
              const delta = fd?.delta_pct;
              return (
                <div key={key} style={{
                  padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: MONO, fontSize: 9,
                  borderBottom: `1px solid ${BT.border.subtle}10`,
                  background: fd?.significance === 'major' ? '#EF444410' : fd?.significance === 'minor' ? '#F59E0B10' : 'transparent',
                }}>
                  <span style={{ width: 140, color: BT.text.secondary, flexShrink: 0 }}>{KEY_LABELS[key] ?? key}</span>
                  <span style={{ flex: 1, textAlign: 'right', color: BT.text.primary, fontWeight: 700 }}>
                    {fmt(v)}
                  </span>
                  {delta != null && (
                    <span style={{
                      width: 50, textAlign: 'right',
                      color: delta > 0 ? BT.text.green : delta < 0 ? '#EF4444' : BT.text.muted,
                      fontSize: 8,
                    }}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenarioComparePane;
