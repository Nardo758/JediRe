import React, { useState, useCallback } from 'react';
import { BT, DataRow, SectionPanel, Bd } from './bloomberg-ui';
import { AlertPip } from './AlertPip';
import { useDealStore, useDealType } from '../../stores/dealStore';
import type { LayeredValue, UnitMixRow, DealIdentity } from '../../stores/dealContext.types';

const MONO = BT.font.mono;
const CAPITAL_INTENT_OPTIONS = ['core', 'core-plus', 'value-add', 'opportunistic', 'development'] as const;

function fmtDollar(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function LVRow({ label, lv, format, fieldPath }: {
  label: string;
  lv: LayeredValue<number> | null | undefined;
  format?: (v: number) => string;
  fieldPath?: string;
}) {
  if (!lv) return null;
  const markFieldReviewed = useDealStore(s => s.markFieldReviewed);
  const fmt = format ?? ((v: number) => v.toFixed(1));

  const handleView = useCallback(() => {
    if (fieldPath && lv.alertLevel === 'info' && !lv.userReviewed) {
      markFieldReviewed(fieldPath);
    }
  }, [fieldPath, lv.alertLevel, lv.userReviewed, markFieldReviewed]);

  return (
    <div
      data-field-path={fieldPath}
      onClick={handleView}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 8px',
        borderBottom: `1px solid ${BT.border.subtle}`,
        cursor: lv.alertLevel === 'info' ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertPip level={lv.alertLevel} onDismiss={lv.alertLevel === 'info' ? handleView : undefined} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber }}>
          {fmt(lv.value)}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 7,
          color: lv.resolvedFrom === 'user' ? BT.text.green
            : lv.resolvedFrom === 'platform' ? BT.text.cyan
            : BT.text.muted,
          textTransform: 'uppercase',
        }}>
          {lv.resolvedFrom}
        </span>
      </div>
    </div>
  );
}

function EditableCell({ value, onCommit, format, color }: {
  value: number;
  onCommit: (v: number) => void;
  format?: (v: number) => string;
  color: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) onCommit(parsed);
    setEditing(false);
  }, [draft, value, onCommit]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          width: 50, fontFamily: MONO, fontSize: 9, fontWeight: 700,
          color, background: BT.bg.input, border: `1px solid ${BT.border.medium}`,
          textAlign: 'right', padding: '1px 4px', outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{ cursor: 'pointer', borderBottom: `1px dashed ${BT.border.bright}` }}
    >
      {format ? format(value) : value}
    </span>
  );
}

function IdentityField({ label, fieldPath, value, onChange, options }: {
  label: string;
  fieldPath: string;
  value: string;
  onChange: (v: string) => void;
  options?: readonly string[];
}) {
  const isEmpty = !value || value === '';
  return (
    <div
      data-field-path={fieldPath}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 8px',
        borderBottom: `1px solid ${BT.border.subtle}`,
        background: isEmpty ? `${BT.text.red}06` : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertPip level={isEmpty ? 'block' : 'none'} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{label}</span>
      </div>
      {options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber,
            background: BT.bg.input, border: `1px solid ${BT.border.medium}`,
            padding: '1px 4px', outline: 'none',
          }}
        >
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Required"
          style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber,
            background: BT.bg.input, border: `1px solid ${BT.border.medium}`,
            padding: '1px 4px', outline: 'none', width: 140, textAlign: 'right',
          }}
        />
      )}
    </div>
  );
}

function IdentityInputSection() {
  const identity = useDealStore(s => s.identity);

  const updateField = useCallback((field: keyof DealIdentity, value: string) => {
    const current = useDealStore.getState().identity;
    useDealStore.setState({ identity: { ...current, [field]: value } });
  }, []);

  return (
    <SectionPanel title="DEAL IDENTITY" subtitle="Required Fields" borderColor={BT.text.red}>
      <IdentityField label="DEAL NAME" fieldPath="identity.name" value={identity.name} onChange={v => updateField('name', v)} />
      <IdentityField label="ADDRESS" fieldPath="identity.address" value={identity.address} onChange={v => updateField('address', v)} />
      <IdentityField label="CITY" fieldPath="identity.city" value={identity.city} onChange={v => updateField('city', v)} />
      <IdentityField label="STATE" fieldPath="identity.state" value={identity.state} onChange={v => updateField('state', v)} />
      <IdentityField label="DEAL TYPE" fieldPath="identity.mode" value={identity.mode} onChange={v => updateField('mode', v)}
        options={['existing', 'development', 'redevelopment']} />
      <IdentityField label="SPONSOR" fieldPath="identity.sponsor" value={identity.sponsor} onChange={v => updateField('sponsor', v)} />
      <IdentityField label="CAPITAL INTENT" fieldPath="identity.capitalIntent" value={identity.capitalIntent}
        onChange={v => updateField('capitalIntent', v)} options={CAPITAL_INTENT_OPTIONS} />
    </SectionPanel>
  );
}

function UnitMixTable({ rows, readOnly, title }: {
  rows: UnitMixRow[];
  readOnly: boolean;
  title?: string;
}) {
  const overrideUnitMix = useDealStore(s => s.overrideUnitMix);

  if (rows.length === 0) {
    return (
      <SectionPanel title={title ?? 'UNIT MIX'} borderColor={BT.text.cyan}>
        <div style={{ padding: 12, fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          No unit mix data available
        </div>
      </SectionPanel>
    );
  }

  const totalUnits = rows.reduce((s, r) => s + r.count, 0);

  return (
    <SectionPanel title={title ?? 'UNIT MIX'} borderColor={BT.text.cyan}
      right={readOnly ? <Bd c={BT.text.muted}>READ-ONLY</Bd> : <Bd c={BT.text.green}>EDITABLE</Bd>}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
        <thead>
          <tr style={{ background: BT.bg.header }}>
            <th style={{ padding: '3px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.medium}` }}>TYPE</th>
            <th style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.medium}` }}>COUNT</th>
            <th style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.medium}` }}>AVG SF</th>
            <th style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.medium}` }}>RENT</th>
            <th style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.medium}` }}>MIX %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <td style={{ padding: '3px 8px', color: BT.text.primary }}>{row.label}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.amber, fontWeight: 700 }}>
                {readOnly ? row.count : (
                  <EditableCell value={row.count} color={BT.text.amber}
                    onCommit={v => overrideUnitMix(row.id, { count: Math.round(v) })} />
                )}
              </td>
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.secondary }}>
                {readOnly ? row.avgSF.toLocaleString() : (
                  <EditableCell value={row.avgSF} color={BT.text.secondary}
                    format={v => v.toLocaleString()}
                    onCommit={v => overrideUnitMix(row.id, { avgSF: Math.round(v) })} />
                )}
              </td>
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.met.financial }}>
                {readOnly ? `$${row.targetRent.value.toLocaleString()}` : (
                  <EditableCell value={row.targetRent.value} color={BT.met.financial}
                    format={v => `$${v.toLocaleString()}`}
                    onCommit={v => {
                      const rentOverride: LayeredValue<number> = {
                        ...row.targetRent,
                        value: v,
                        resolvedFrom: 'user',
                        alertLevel: 'none',
                        userReviewed: true,
                      };
                      overrideUnitMix(row.id, { targetRent: rentOverride });
                    }} />
                )}
              </td>
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.cyan }}>{(row.mixPct * 100).toFixed(1)}%</td>
            </tr>
          ))}
          <tr style={{ background: BT.bg.header }}>
            <td style={{ padding: '3px 8px', color: BT.text.white, fontWeight: 700 }}>TOTAL</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.white, fontWeight: 700 }}>{totalUnits}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </SectionPanel>
  );
}

function GapAnalysisPanel() {
  const market = useDealStore(s => s.market);
  const existingProperty = useDealStore(s => s.existingProperty);
  const resolvedUnitMix = useDealStore(s => s.resolvedUnitMix);

  const avgUnitRent = resolvedUnitMix.length > 0
    ? resolvedUnitMix.reduce((s, r) => s + r.targetRent.value * r.count, 0) / Math.max(1, resolvedUnitMix.reduce((s, r) => s + r.count, 0))
    : 0;
  const marketRent = market.avgRent.value;
  const gap = marketRent > 0 ? ((avgUnitRent - marketRent) / marketRent) * 100 : 0;

  return (
    <SectionPanel title="GAP ANALYSIS" subtitle="vs. Submarket Optimum" borderColor={BT.text.amber}>
      <DataRow label="PROPERTY AVG RENT" value={`$${avgUnitRent.toFixed(0)}`} valueColor={BT.text.amber} />
      <DataRow label="SUBMARKET AVG RENT" value={`$${marketRent.toFixed(0)}`} valueColor={BT.text.cyan} />
      <DataRow
        label="RENT GAP"
        value={`${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%`}
        valueColor={gap >= 0 ? BT.text.green : BT.text.red}
      />
      {existingProperty && (
        <>
          <DataRow label="OCCUPANCY" value={`${(existingProperty.occupancy.value * 100).toFixed(1)}%`} valueColor={BT.text.green} />
          <DataRow label="GOING-IN CAP" value={`${(existingProperty.goingInCapRate * 100).toFixed(2)}%`} valueColor={BT.met.financial} />
          <DataRow label="CURRENT NOI" value={fmtDollar(existingProperty.currentNOI.value)} valueColor={BT.met.financial} border={false} />
        </>
      )}
    </SectionPanel>
  );
}

function ZoningConstraintsSummary() {
  const zoning = useDealStore(s => s.zoning);
  return (
    <SectionPanel title="ZONING HARD GATES" subtitle="M02 Constraints" borderColor={BT.text.red}>
      <LVRow label="MAX DENSITY" lv={zoning.maxDensity} fieldPath="zoning.maxDensity" format={v => `${v.toFixed(0)} u/ac`} />
      <LVRow label="MAX HEIGHT" lv={zoning.maxHeight} fieldPath="zoning.maxHeight" format={v => `${v.toFixed(0)} ft`} />
      <LVRow label="MAX FAR" lv={zoning.maxFAR} fieldPath="zoning.maxFAR" format={v => `${v.toFixed(2)}×`} />
      <LVRow label="LOT COVERAGE" lv={zoning.maxLotCoverage} fieldPath="zoning.maxLotCoverage" format={v => `${(v * 100).toFixed(0)}%`} />
      <LVRow label="PARKING RATIO" lv={zoning.parkingRatio} fieldPath="zoning.parkingRatio" format={v => `${v.toFixed(2)}/unit`} />
    </SectionPanel>
  );
}

function ParkingConstraint() {
  const zoning = useDealStore(s => s.zoning);
  const totalUnits = useDealStore(s => s.totalUnits);
  const requiredSpaces = totalUnits * zoning.parkingRatio.value;
  const guestSpaces = totalUnits * zoning.guestParkingRatio.value;

  return (
    <SectionPanel title="PARKING — BINDING CONSTRAINT" borderColor={BT.text.orange}>
      <DataRow label="REQUIRED SPACES" value={Math.ceil(requiredSpaces).toLocaleString()} valueColor={BT.text.amber} />
      <DataRow label="GUEST SPACES" value={Math.ceil(guestSpaces).toLocaleString()} valueColor={BT.text.muted} />
      <DataRow label="TOTAL REQUIRED" value={Math.ceil(requiredSpaces + guestSpaces).toLocaleString()} valueColor={BT.text.red} />
      <DataRow label="RATIO" value={`${zoning.parkingRatio.value.toFixed(2)}/unit`} valueColor={BT.text.cyan} border={false} />
    </SectionPanel>
  );
}

export function ExistingOverview() {
  const resolvedUnitMix = useDealStore(s => s.resolvedUnitMix);
  const financial = useDealStore(s => s.financial);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <IdentityInputSection />
      <UnitMixTable rows={resolvedUnitMix} readOnly={true} title="UNIT MIX — BROKER STATED" />
      <GapAnalysisPanel />
      <SectionPanel title="ASSUMPTIONS" subtitle="Override Only" borderColor={BT.met.financial}>
        <LVRow label="RENT GROWTH" lv={financial.assumptions.rentGrowth} fieldPath="financial.assumptions.rentGrowth" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="VACANCY" lv={financial.assumptions.vacancy} fieldPath="financial.assumptions.vacancy" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="EXIT CAP" lv={financial.assumptions.exitCapRate} fieldPath="financial.assumptions.exitCapRate" format={v => `${(v * 100).toFixed(2)}%`} />
        <LVRow label="CAPEX/UNIT" lv={financial.assumptions.capexPerUnit} fieldPath="financial.assumptions.capexPerUnit" format={v => fmtDollar(v)} />
        <LVRow label="HOLD PERIOD" lv={financial.assumptions.holdPeriod} fieldPath="financial.assumptions.holdPeriod" format={v => `${v} yrs`} />
      </SectionPanel>
    </div>
  );
}

export function DevelopmentOverview() {
  const resolvedUnitMix = useDealStore(s => s.resolvedUnitMix);
  const selectedPath = useDealStore(s => s.getSelectedPath());
  const financial = useDealStore(s => s.financial);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <IdentityInputSection />
      {selectedPath && (
        <SectionPanel title="SELECTED PATH" borderColor={BT.text.green}>
          <DataRow label="BUILDING TYPE" value={selectedPath.buildingType.toUpperCase()} valueColor={BT.text.green} />
          <DataRow label="STORIES" value={selectedPath.stories} valueColor={BT.text.amber} />
          <DataRow label="TOTAL UNITS" value={selectedPath.totalUnits.toLocaleString()} valueColor={BT.text.amber} />
          <DataRow label="GFA" value={`${selectedPath.grossFloorArea.toLocaleString()} SF`} valueColor={BT.text.cyan} />
          <DataRow label="DEV COST" value={fmtDollar(selectedPath.constructionCost.totalDevelopmentCost)} valueColor={BT.met.financial} />
          <DataRow label="COST/UNIT" value={fmtDollar(selectedPath.constructionCost.costPerUnit)} valueColor={BT.met.financial} />
          <DataRow label="TIMELINE" value={`${selectedPath.timeline.totalMonths} mo`} valueColor={BT.text.muted} border={false} />
        </SectionPanel>
      )}

      <UnitMixTable rows={resolvedUnitMix} readOnly={false} title="UNIT MIX BUILDER" />
      <ZoningConstraintsSummary />
      <ParkingConstraint />

      <SectionPanel title="DEVELOPMENT ASSUMPTIONS" borderColor={BT.met.financial}>
        <LVRow label="RENT GROWTH" lv={financial.assumptions.rentGrowth} fieldPath="financial.assumptions.rentGrowth" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="VACANCY" lv={financial.assumptions.vacancy} fieldPath="financial.assumptions.vacancy" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="EXIT CAP" lv={financial.assumptions.exitCapRate} fieldPath="financial.assumptions.exitCapRate" format={v => `${(v * 100).toFixed(2)}%`} />
        <LVRow label="MGMT FEE" lv={financial.assumptions.managementFee} fieldPath="financial.assumptions.managementFee" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="HOLD PERIOD" lv={financial.assumptions.holdPeriod} fieldPath="financial.assumptions.holdPeriod" format={v => `${v} yrs`} />
      </SectionPanel>
    </div>
  );
}

export function RedevelopmentOverview() {
  const resolvedUnitMix = useDealStore(s => s.resolvedUnitMix);
  const existingProperty = useDealStore(s => s.existingProperty);
  const redevelopment = useDealStore(s => s.redevelopment);
  const financial = useDealStore(s => s.financial);

  const existingMix = existingProperty?.unitMixProgram ?? [];
  const existingUnits = existingMix.reduce((s, r) => s + r.count, 0);
  const proposedUnits = resolvedUnitMix.reduce((s, r) => s + r.count, 0);
  const unitDelta = proposedUnits - existingUnits;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <IdentityInputSection />
      <div style={{ display: 'flex', gap: 1 }}>
        <div style={{ flex: 1 }}>
          <SectionPanel title="AS-IS" borderColor={BT.text.amber}>
            <DataRow label="TOTAL UNITS" value={existingUnits} valueColor={BT.text.amber} />
            {existingProperty && (
              <>
                <DataRow label="CURRENT NOI" value={fmtDollar(existingProperty.currentNOI.value)} valueColor={BT.met.financial} />
                <DataRow label="OCCUPANCY" value={`${(existingProperty.occupancy.value * 100).toFixed(1)}%`} valueColor={BT.text.green} />
              </>
            )}
            <UnitMixTable rows={existingMix} readOnly={true} title="EXISTING MIX" />
          </SectionPanel>
        </div>

        <div style={{ flex: 1 }}>
          <SectionPanel title="AS-RECONFIGURED" borderColor={BT.text.green}>
            <DataRow label="PROPOSED UNITS" value={proposedUnits} valueColor={BT.text.green} />
            <DataRow
              label="UNIT DELTA"
              value={`${unitDelta >= 0 ? '+' : ''}${unitDelta}`}
              valueColor={unitDelta >= 0 ? BT.text.green : BT.text.red}
            />
            {redevelopment && (
              <DataRow label="PROJECTED NOI" value={fmtDollar(redevelopment.projectedNOI.value)} valueColor={BT.met.financial} />
            )}
            <UnitMixTable rows={resolvedUnitMix} readOnly={false} title="PROPOSED MIX" />
          </SectionPanel>
        </div>
      </div>

      {redevelopment && redevelopment.deltas.length > 0 && (
        <SectionPanel title="SCOPE OF WORK" borderColor={BT.text.purple}>
          {redevelopment.deltas.map(d => (
            <DataRow
              key={d.id}
              label={d.description.toUpperCase()}
              value={fmtDollar(d.costEstimate)}
              valueColor={BT.met.financial}
              sub={`${d.timelineMonths}mo`}
            />
          ))}
        </SectionPanel>
      )}

      <SectionPanel title="ASSUMPTIONS" borderColor={BT.met.financial}>
        <LVRow label="RENT GROWTH" lv={financial.assumptions.rentGrowth} fieldPath="financial.assumptions.rentGrowth" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="VACANCY" lv={financial.assumptions.vacancy} fieldPath="financial.assumptions.vacancy" format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="EXIT CAP" lv={financial.assumptions.exitCapRate} fieldPath="financial.assumptions.exitCapRate" format={v => `${(v * 100).toFixed(2)}%`} />
        <LVRow label="CAPEX/UNIT" lv={financial.assumptions.capexPerUnit} fieldPath="financial.assumptions.capexPerUnit" format={v => fmtDollar(v)} />
      </SectionPanel>
    </div>
  );
}

export function OverviewRouter() {
  const dealType = useDealType();

  switch (dealType) {
    case 'development':
      return <DevelopmentOverview />;
    case 'redevelopment':
      return <RedevelopmentOverview />;
    case 'existing':
    default:
      return <ExistingOverview />;
  }
}
