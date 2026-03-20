import React, { useState } from 'react';
import { T as BT, mono as bMono, sans as bSans } from '../bloomberg-tokens';
import { useUnitMixIntelligence } from '../../../hooks/useUnitMixIntelligence';

interface Props {
  deal?: Record<string, unknown>;
  dealId: string;
  dealType?: string;
  onUpdate?: () => void;
  [k: string]: unknown;
}

type TabId = 'program' | 'comps' | 'zoning';

const UNIT_LABELS: Record<string, string> = {
  studio: 'Studio',
  oneBR: '1 BR',
  twoBR: '2 BR',
  threeBR: '3 BR',
};

const fmt = (n: number, prefix = '', suffix = '') =>
  n > 0 ? `${prefix}${n.toLocaleString()}${suffix}` : '—';

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 12px',
      fontSize: 10,
      fontWeight: 700,
      background: active ? BT.cyanL : 'none',
      color: active ? BT.bg.terminal : BT.ts,
      border: `1px solid ${active ? BT.cyanL : BT.border}`,
      cursor: 'pointer',
      letterSpacing: '0.06em',
      ...bSans,
    }}
  >
    {children}
  </button>
);

const SectionHead: React.FC<{ title: string; right?: string; accent?: string }> = ({
  title,
  right,
  accent = BT.cyanL,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderLeft: `3px solid ${accent}`,
      paddingLeft: 8,
      marginBottom: 8,
    }}
  >
    <span style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.1em', ...bSans }}>
      {title}
    </span>
    {right && (
      <span style={{ fontSize: 9, color: BT.td, ...bMono }}>{right}</span>
    )}
  </div>
);

const ProgramEditor: React.FC<{
  dealId: string;
  zoning: { maxUnits: number | null; maxNetSF: number | null } | null;
  onSaved: () => void;
}> = ({ dealId, zoning, onSaved }) => {
  const defaultUnits = { studio: 0, oneBR: 0, twoBR: 0, threeBR: 0 };
  const defaultMix = { mix: 25, sf: 650, rent: 1800 };

  const [totalUnits, setTotalUnits] = useState(200);
  const [rows, setRows] = useState<Record<string, { mix: number; sf: number; rent: number }>>({
    studio: { ...defaultMix, mix: 20 },
    oneBR: { ...defaultMix, mix: 45, sf: 750, rent: 2200 },
    twoBR: { ...defaultMix, mix: 25, sf: 1050, rent: 2900 },
    threeBR: { ...defaultMix, mix: 10, sf: 1350, rent: 3600 },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const mixTotal = Object.values(rows).reduce((s, r) => s + r.mix, 0);

  const setRow = (key: string, field: 'mix' | 'sf' | 'rent', val: number) => {
    setRows(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/unit-mix/${dealId}/program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalUnits, units: rows }),
      });
      setSaved(true);
      onSaved();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 9, color: BT.td, ...bSans }}>TOTAL UNITS</span>
          <input
            type="number"
            value={totalUnits}
            onChange={e => { setTotalUnits(Number(e.target.value)); setSaved(false); }}
            style={{
              display: 'block',
              background: BT.bg.panel,
              border: `1px solid ${BT.border}`,
              color: BT.text.white,
              fontSize: 11,
              padding: '2px 6px',
              width: 80,
              ...bMono,
            }}
          />
        </div>
        {zoning?.maxUnits && (
          <div style={{ fontSize: 9, color: BT.td, ...bSans }}>
            MAX ZONED: <span style={{ color: BT.cyanL, ...bMono }}>{zoning.maxUnits.toLocaleString()}</span>
          </div>
        )}
        {zoning?.maxNetSF && (
          <div style={{ fontSize: 9, color: BT.td, ...bSans }}>
            MAX NET SF: <span style={{ color: BT.cyanL, ...bMono }}>{zoning.maxNetSF.toLocaleString()}</span>
          </div>
        )}
        <div
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: Math.abs(mixTotal - 100) > 1 ? BT.text.red : BT.greenL,
            ...bMono,
          }}
        >
          MIX: {mixTotal.toFixed(0)}%{Math.abs(mixTotal - 100) > 1 ? ' ⚠' : ' ✓'}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            {['TYPE', 'MIX %', 'AVG SF', 'AVG RENT', 'UNITS', 'NET SF', 'GROSS REV'].map(h => (
              <th
                key={h}
                style={{
                  textAlign: h === 'TYPE' ? 'left' : 'right',
                  color: BT.td,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderBottom: `1px solid ${BT.border}`,
                  ...bSans,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(rows).map(([key, row]) => {
            const unitCount = Math.round(totalUnits * row.mix / 100);
            const netSf = unitCount * row.sf;
            const grossRev = unitCount * row.rent * 12 * 0.95;
            return (
              <tr key={key}>
                <td style={{ padding: '3px 6px', color: BT.text.white, ...bSans, fontSize: 10 }}>
                  {UNIT_LABELS[key] || key}
                </td>
                {(['mix', 'sf', 'rent'] as const).map(field => (
                  <td key={field} style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      value={row[field]}
                      onChange={e => setRow(key, field, Number(e.target.value))}
                      style={{
                        width: '100%',
                        background: BT.bg.panel,
                        border: `1px solid ${BT.border}`,
                        color: BT.cyanL,
                        fontSize: 10,
                        padding: '1px 4px',
                        textAlign: 'right',
                        ...bMono,
                      }}
                    />
                  </td>
                ))}
                <td style={{ textAlign: 'right', padding: '3px 6px', color: BT.text.white, ...bMono, fontSize: 10 }}>
                  {unitCount}
                </td>
                <td style={{ textAlign: 'right', padding: '3px 6px', color: BT.text.white, ...bMono, fontSize: 10 }}>
                  {netSf > 0 ? netSf.toLocaleString() : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '3px 6px', color: BT.greenL, ...bMono, fontSize: 10 }}>
                  {grossRev > 0 ? `$${Math.round(grossRev / 1000)}K` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '4px 16px',
            fontSize: 10,
            fontWeight: 700,
            background: saved ? BT.greenL : BT.cyanL,
            color: BT.bg.terminal,
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            letterSpacing: '0.06em',
            ...bSans,
          }}
        >
          {saving ? 'SAVING…' : saved ? '✓ SAVED' : 'SAVE PROGRAM'}
        </button>
        <span style={{ fontSize: 9, color: BT.td, alignSelf: 'center', ...bSans }}>
          Changes will update the Overview and Pro Forma
        </span>
      </div>
    </div>
  );
};

const UnitMixIntelligence: React.FC<Props> = ({ deal, dealId, dealType }) => {
  const [activeTab, setActiveTab] = useState<TabId>('program');
  const tradeAreaId = deal?.tradeAreaId as string | undefined;
  const { comps, demandScores, program, zoning, loading, refetchProgram } = useUnitMixIntelligence(
    dealId,
    tradeAreaId
  );

  if (!dealId) {
    return (
      <div style={{ padding: 24, color: BT.td, fontSize: 11, ...bSans }}>
        No deal selected
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', background: BT.bg.terminal, minHeight: '100%' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <TabBtn active={activeTab === 'program'} onClick={() => setActiveTab('program')}>
          PROGRAM
        </TabBtn>
        <TabBtn active={activeTab === 'comps'} onClick={() => setActiveTab('comps')}>
          COMP SET
        </TabBtn>
        <TabBtn active={activeTab === 'zoning'} onClick={() => setActiveTab('zoning')}>
          ZONING
        </TabBtn>
      </div>

      {loading && (
        <div style={{ fontSize: 10, color: BT.td, padding: '8px 0', ...bSans }}>
          Loading unit mix data…
        </div>
      )}

      {!loading && activeTab === 'program' && (
        <div>
          <SectionHead
            title="UNIT MIX PROGRAM"
            right={program ? `${program.totalUnits} units · saved` : 'No program saved'}
            accent={BT.cyanL}
          />

          {program && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {[
                { l: 'Total Units', v: program.totalUnits?.toLocaleString() },
                {
                  l: 'Total Net SF',
                  v: program.totalNetSf ? `${Math.round(program.totalNetSf / 1000)}K` : '—',
                },
                {
                  l: 'Gross Rev PA',
                  v: program.grossRevPA
                    ? `$${Math.round(program.grossRevPA / 1000)}K`
                    : '—',
                },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    background: BT.bg.panel,
                    border: `1px solid ${BT.border}`,
                    padding: '6px 8px',
                  }}
                >
                  <div style={{ fontSize: 8, color: BT.td, marginBottom: 2, ...bSans }}>{l}</div>
                  <div style={{ fontSize: 14, color: BT.cyanL, ...bMono }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <SectionHead title="EDIT PROGRAM" accent={BT.text.amber} />
            <ProgramEditor dealId={dealId} zoning={zoning} onSaved={refetchProgram} />
          </div>
        </div>
      )}

      {!loading && activeTab === 'comps' && (
        <div>
          <SectionHead
            title="COMPETITIVE COMP SET"
            right={`${comps.length} properties`}
            accent={BT.greenL}
          />

          {demandScores.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {demandScores.map(ds => (
                <div
                  key={ds.unitType}
                  style={{
                    flex: 1,
                    background: BT.bg.panel,
                    border: `1px solid ${BT.border}`,
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 8, color: BT.td, marginBottom: 2, ...bSans }}>
                    {UNIT_LABELS[ds.unitType] || ds.unitType}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      color:
                        ds.demandScore >= 70
                          ? BT.greenL
                          : ds.demandScore >= 50
                          ? BT.text.amber
                          : BT.text.red,
                      fontWeight: 700,
                      ...bMono,
                    }}
                  >
                    {ds.demandScore}
                  </div>
                  <div style={{ fontSize: 8, color: BT.td, ...bSans }}>DEMAND</div>
                </div>
              ))}
            </div>
          )}

          {comps.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 0',
                background: BT.bg.panel,
                border: `1px solid ${BT.border}`,
              }}
            >
              <div style={{ fontSize: 11, color: BT.ts, marginBottom: 4, ...bSans }}>
                No comp properties found
              </div>
              <div style={{ fontSize: 9, color: BT.td, ...bSans }}>
                Add comps from Competition &amp; Comps module
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  {['PROPERTY', 'CLASS', 'YEAR', 'UNITS', 'STUDIO', '1BR', '2BR', '3BR'].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'PROPERTY' ? 'left' : 'right',
                        color: BT.td,
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderBottom: `1px solid ${BT.border}`,
                        ...bSans,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comps.map(comp => (
                  <tr
                    key={comp.id}
                    style={{ borderBottom: `1px solid ${BT.bg.panel}` }}
                  >
                    <td style={{ padding: '4px 6px', color: BT.text.white, ...bSans, fontSize: 10 }}>
                      {comp.name}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', color: BT.td, ...bMono, fontSize: 10 }}>
                      {comp.cls || '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', color: BT.td, ...bMono, fontSize: 10 }}>
                      {comp.built || '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', color: BT.text.white, ...bMono, fontSize: 10 }}>
                      {comp.total || '—'}
                    </td>
                    {(['studio', 'oneBR', 'twoBR', 'threeBR'] as const).map(ut => (
                      <td
                        key={ut}
                        style={{
                          textAlign: 'right',
                          padding: '4px 6px',
                          color: comp.units[ut]?.rent > 0 ? BT.greenL : BT.td,
                          ...bMono,
                          fontSize: 10,
                        }}
                      >
                        {comp.units[ut]?.rent > 0
                          ? `$${Math.round(comp.units[ut].rent).toLocaleString()}`
                          : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && activeTab === 'zoning' && (
        <div>
          <SectionHead title="ZONING ENVELOPE" accent={BT.text.purple} />
          {!zoning ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 0',
                background: BT.bg.panel,
                border: `1px solid ${BT.border}`,
              }}
            >
              <div style={{ fontSize: 11, color: BT.ts, ...bSans }}>No zoning profile found</div>
              <div style={{ fontSize: 9, color: BT.td, marginTop: 4, ...bSans }}>
                Run Zoning Analysis to populate envelope constraints
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { l: 'Zoning Code', v: zoning.zoningCode || '—' },
                { l: 'Max Height (Stories)', v: zoning.maxHeight ? String(zoning.maxHeight) : '—' },
                { l: 'Max Units', v: zoning.maxUnits ? zoning.maxUnits.toLocaleString() : '—' },
                { l: 'Max Net SF', v: zoning.maxNetSF ? zoning.maxNetSF.toLocaleString() : '—' },
                {
                  l: 'Max Lot Coverage',
                  v: zoning.maxLotCoverage ? `${zoning.maxLotCoverage}%` : '—',
                },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    background: BT.bg.panel,
                    border: `1px solid ${BT.border}`,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ fontSize: 8, color: BT.td, marginBottom: 2, ...bSans }}>{l}</div>
                  <div style={{ fontSize: 13, color: BT.text.purple, ...bMono }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnitMixIntelligence;
