import React from 'react';
import { BT, DataRow, SectionPanel, Bd } from './bloomberg-ui';
import { AlertPip } from './AlertPip';
import { useDealStore, useDealType } from '../../stores/dealStore';
import type { LayeredValue, UnitMixRow } from '../../stores/dealContext.types';

const MONO = BT.font.mono;

function fmtDollar(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function LVRow({ label, lv, format }: {
  label: string;
  lv: LayeredValue<number> | null | undefined;
  format?: (v: number) => string;
}) {
  if (!lv) return null;
  const fmt = format ?? ((v: number) => v.toFixed(1));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '3px 8px',
      borderBottom: `1px solid ${BT.border.subtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertPip level={lv.alertLevel} />
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

function UnitMixTable({ rows, readOnly, title }: {
  rows: UnitMixRow[];
  readOnly: boolean;
  title?: string;
}) {
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
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.amber, fontWeight: 700 }}>{row.count}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.secondary }}>{row.avgSF.toLocaleString()}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.met.financial }}>${row.targetRent.value.toLocaleString()}</td>
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
      <LVRow label="MAX DENSITY" lv={zoning.maxDensity} format={v => `${v.toFixed(0)} u/ac`} />
      <LVRow label="MAX HEIGHT" lv={zoning.maxHeight} format={v => `${v.toFixed(0)} ft`} />
      <LVRow label="MAX FAR" lv={zoning.maxFAR} format={v => `${v.toFixed(2)}×`} />
      <LVRow label="LOT COVERAGE" lv={zoning.maxLotCoverage} format={v => `${(v * 100).toFixed(0)}%`} />
      <LVRow label="PARKING RATIO" lv={zoning.parkingRatio} format={v => `${v.toFixed(2)}/unit`} />
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
      <UnitMixTable rows={resolvedUnitMix} readOnly={true} title="UNIT MIX — BROKER STATED" />
      <GapAnalysisPanel />
      <SectionPanel title="ASSUMPTIONS" subtitle="Override Only" borderColor={BT.met.financial}>
        <LVRow label="RENT GROWTH" lv={financial.assumptions.rentGrowth} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="VACANCY" lv={financial.assumptions.vacancy} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="EXIT CAP" lv={financial.assumptions.exitCapRate} format={v => `${(v * 100).toFixed(2)}%`} />
        <LVRow label="CAPEX/UNIT" lv={financial.assumptions.capexPerUnit} format={v => fmtDollar(v)} />
        <LVRow label="HOLD PERIOD" lv={financial.assumptions.holdPeriod} format={v => `${v} yrs`} />
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
        <LVRow label="RENT GROWTH" lv={financial.assumptions.rentGrowth} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="VACANCY" lv={financial.assumptions.vacancy} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="EXIT CAP" lv={financial.assumptions.exitCapRate} format={v => `${(v * 100).toFixed(2)}%`} />
        <LVRow label="MGMT FEE" lv={financial.assumptions.managementFee} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="HOLD PERIOD" lv={financial.assumptions.holdPeriod} format={v => `${v} yrs`} />
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
        <LVRow label="RENT GROWTH" lv={financial.assumptions.rentGrowth} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="VACANCY" lv={financial.assumptions.vacancy} format={v => `${(v * 100).toFixed(1)}%`} />
        <LVRow label="EXIT CAP" lv={financial.assumptions.exitCapRate} format={v => `${(v * 100).toFixed(2)}%`} />
        <LVRow label="CAPEX/UNIT" lv={financial.assumptions.capexPerUnit} format={v => fmtDollar(v)} />
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
