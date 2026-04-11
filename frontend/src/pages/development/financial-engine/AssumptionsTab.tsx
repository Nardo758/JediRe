import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd } from '../../../components/deal/bloomberg-ui';
import { AssumptionsPanel } from '../../../components/deal/AssumptionsPanel';
import type { FinancialEngineTabProps, InputSource, UnitMixRow, CapexLineItem, WaterfallHurdle } from './types';
import { fmt$, fmtPct } from './types';

const MONO = BT.font.mono;

const SOURCE_COLORS: Record<InputSource, string> = {
  broker: BT.text.cyan,
  platform: BT.text.purple,
  user: BT.text.amber,
  agent: BT.met.financial,
  capsule: BT.text.teal,
};

function SourceBadge({ source }: { source: InputSource }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, padding: '1px 4px', borderRadius: 2,
      color: SOURCE_COLORS[source], border: `1px solid ${SOURCE_COLORS[source]}40`,
      letterSpacing: 0.5, textTransform: 'uppercase',
    }}>{source}</span>
  );
}

function InputField({ label, value, source, linked, editable = true }: {
  label: string; value: string; source?: InputSource; linked?: string; editable?: boolean;
}) {
  const textColor = linked ? BT.met.financial : editable ? BT.text.cyan : BT.text.secondary;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '3px 8px', borderBottom: `1px solid ${BT.border.subtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{label}</span>
        {source && <SourceBadge source={source} />}
        {linked && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.met.financial, opacity: 0.7 }}>← {linked}</span>
        )}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: textColor, fontWeight: editable ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );
}

type SectionKey = 'keystone' | 'dealInfo' | 'acquisition' | 'unitMix' | 'revenue' | 'expenses' | 'capex' | 'financing' | 'disposition' | 'waterfall' | 'development' | 'renovation';

export function AssumptionsTab({ dealId, deal, dealType, assumptions, onAssumptionsChange }: FinancialEngineTabProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['keystone', 'dealInfo', 'acquisition', 'unitMix', 'revenue', 'expenses', 'capex', 'financing', 'disposition', 'waterfall'])
  );

  const a = assumptions;

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const SectionHeader = ({ sKey, label, color, badge }: { sKey: SectionKey; label: string; color: string; badge?: string }) => (
    <div
      onClick={() => toggleSection(sKey)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 8px', background: BT.bg.header, cursor: 'pointer',
        borderBottom: `1px solid ${BT.border.medium}`, borderLeft: `2px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color }}>{expandedSections.has(sKey) ? '▾' : '▸'}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color, fontWeight: 700, letterSpacing: 0.8 }}>{label}</span>
        {badge && <Bd c={color}>{badge}</Bd>}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        {expandedSections.has(sKey) ? 'COLLAPSE' : 'EXPAND'}
      </span>
    </div>
  );

  const showDevelopment = dealType === 'development' || a?.modelType === 'development';
  const showRedevelopment = dealType === 'redevelopment';
  const showAcquisition = dealType === 'existing' || dealType === 'redevelopment';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>MODEL INPUTS · ALL ASSUMPTIONS</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>■ BLUE = hardcoded input</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.met.financial }}>■ GREEN = linked from sheet</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>■ AMBER = user override</span>
        </div>
      </div>

      <SectionHeader sKey="keystone" label="KEYSTONE ASSUMPTIONS" color={BT.text.amber} badge="EDITABLE" />
      {expandedSections.has('keystone') && (
        <AssumptionsPanel />
      )}

      <SectionHeader sKey="dealInfo" label="DEAL INFO" color={BT.text.secondary} badge="CAPSULE" />
      {expandedSections.has('dealInfo') && (
        <div>
          <InputField label="DEAL NAME" value={a?.dealInfo?.dealName ?? '—'} source="capsule" />
          <InputField label="ADDRESS" value={a?.dealInfo?.address ?? '—'} source="capsule" />
          <InputField label="CITY / STATE" value={`${a?.dealInfo?.city ?? '—'}, ${a?.dealInfo?.state ?? '—'}`} source="capsule" />
          <InputField label="TOTAL UNITS" value={a?.dealInfo?.totalUnits?.toString() ?? '—'} source="capsule" />
          <InputField label="NET RENTABLE SF" value={a?.dealInfo?.netRentableSF?.toLocaleString() ?? '—'} source="capsule" />
          <InputField label="VINTAGE" value={a?.dealInfo?.vintage?.toString() ?? '—'} source="capsule" />
        </div>
      )}

      {showAcquisition && (
        <>
          <SectionHeader sKey="acquisition" label="ACQUISITION" color={BT.text.cyan} />
          {expandedSections.has('acquisition') && (
            <div>
              <InputField label="PURCHASE PRICE" value={a?.acquisition?.purchasePrice != null ? fmt$(a.acquisition.purchasePrice) : '—'} source="broker" />
              <InputField label="CAP RATE" value={a?.acquisition?.capRate != null ? fmtPct(a.acquisition.capRate * 100) : '—'} source="broker" />
              {a?.acquisition?.closingCosts && Object.entries(a.acquisition.closingCosts).map(([k, v]) => (
                <InputField key={k} label={`  ${k.toUpperCase()}`} value={fmt$(v)} source="user" />
              ))}
            </div>
          )}
        </>
      )}

      <SectionHeader sKey="unitMix" label="UNIT MIX & RENT ROLL" color={BT.text.purple} badge="RENT ROLL" />
      {expandedSections.has('unitMix') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
                {['FLOOR PLAN', 'SIZE', 'BEDS', 'UNITS', 'OCC', 'VAC', 'MKT RENT', 'IN-PLACE'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', color: BT.text.muted, textAlign: h === 'FLOOR PLAN' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(a?.unitMix ?? []).map((row: UnitMixRow, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '3px 6px', color: BT.text.cyan }}>{row.floorPlan}</td>
                  <td style={{ padding: '3px 6px', color: BT.text.secondary, textAlign: 'right' }}>{row.unitSize} SF</td>
                  <td style={{ padding: '3px 6px', color: BT.text.secondary, textAlign: 'right' }}>{row.beds}</td>
                  <td style={{ padding: '3px 6px', color: BT.text.primary, textAlign: 'right' }}>{row.units}</td>
                  <td style={{ padding: '3px 6px', color: BT.met.financial, textAlign: 'right' }}>{row.occupied}</td>
                  <td style={{ padding: '3px 6px', color: BT.text.red, textAlign: 'right' }}>{row.vacant}</td>
                  <td style={{ padding: '3px 6px', color: BT.text.amber, textAlign: 'right' }}>{fmt$(row.marketRent)}</td>
                  <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.inPlaceRent)}</td>
                </tr>
              ))}
              {(!a?.unitMix || a.unitMix.length === 0) && (
                <tr><td colSpan={8} style={{ padding: '8px 6px', color: BT.text.muted, textAlign: 'center' }}>No unit mix data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SectionHeader sKey="revenue" label="REVENUE ASSUMPTIONS" color={BT.met.financial} />
      {expandedSections.has('revenue') && (
        <div>
          <InputField label="LOSS TO LEASE" value={a?.revenue?.lossToLease != null ? fmtPct(a.revenue.lossToLease * 100) : '—'} source="user" />
          <InputField label="STABILIZED OCCUPANCY" value={a?.revenue?.stabilizedOccupancy != null ? fmtPct(a.revenue.stabilizedOccupancy * 100) : '—'} source="platform" linked="Traffic Intel" />
          <InputField label="COLLECTION LOSS" value={a?.revenue?.collectionLoss != null ? fmtPct(a.revenue.collectionLoss * 100) : '—'} source="user" />
          {a?.revenue?.rentGrowth && (
            <div style={{ padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 3 }}>RENT GROWTH BY YEAR</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {a.revenue.rentGrowth.map((g: number, i: number) => (
                  <div key={i} style={{ fontFamily: MONO, fontSize: 9 }}>
                    <span style={{ color: BT.text.muted }}>Y{i + 1}: </span>
                    <span style={{ color: BT.text.cyan }}>{fmtPct(g * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {a?.revenue?.otherIncome && (
            <div style={{ padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 3 }}>OTHER INCOME</div>
              {Object.entries(a.revenue.otherIncome).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{k}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>{fmt$(v.perUnitMonth)}/unit · {fmtPct(v.penetration * 100)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SectionHeader sKey="expenses" label="OPERATING EXPENSES" color={BT.text.red} badge="T-12" />
      {expandedSections.has('expenses') && (
        <div>
          {a?.expenses && Object.entries(a.expenses).map(([k, v]) => (
            <InputField key={k} label={`  ${k.toUpperCase()}`} value={v.type === 'pctEGR' ? fmtPct(v.amount * 100) + ' of EGR' : fmt$(v.amount)} source="capsule" />
          ))}
        </div>
      )}

      <SectionHeader sKey="capex" label="CAPEX SCHEDULE" color={BT.text.orange} />
      {expandedSections.has('capex') && (
        <div>
          {(a?.capex?.lineItems ?? []).map((item: CapexLineItem, i: number) => (
            <InputField key={i} label={`  ${item.description.toUpperCase()}`} value={fmt$(item.amount)} source="user" />
          ))}
          <InputField label="CONTINGENCY" value={a?.capex?.contingencyPct != null ? fmtPct(a.capex.contingencyPct * 100) : '—'} source="user" />
          <InputField label="RESERVES / UNIT" value={a?.capex?.reservesPerUnit != null ? fmt$(a.capex.reservesPerUnit) : '—'} source="user" />
        </div>
      )}

      <SectionHeader sKey="financing" label="FINANCING" color={BT.text.cyan} badge="DEBT AGENT" />
      {expandedSections.has('financing') && (
        <div>
          <InputField label="LOAN AMOUNT" value={a?.financing?.loanAmount != null ? fmt$(a.financing.loanAmount) : '—'} source="capsule" linked="Debt Schedule" />
          <InputField label="LOAN TYPE" value={a?.financing?.loanType ?? '—'} source="user" />
          <InputField label="INTEREST RATE" value={a?.financing?.interestRate != null ? fmtPct(a.financing.interestRate * 100) : '—'} source="capsule" linked="Debt Schedule" />
          <InputField label="SPREAD" value={a?.financing?.spread != null ? `${(a.financing.spread * 10000).toFixed(0)} bps` : '—'} source="user" />
          <InputField label="TERM" value={a?.financing?.term != null ? `${a.financing.term} years` : '—'} source="user" />
          <InputField label="AMORTIZATION" value={a?.financing?.amortization != null ? `${a.financing.amortization} years` : '—'} source="user" />
          <InputField label="IO PERIOD" value={a?.financing?.ioPeriod != null ? `${a.financing.ioPeriod} months` : '—'} source="user" />
          <InputField label="ORIGINATION FEE" value={a?.financing?.originationFee != null ? fmtPct(a.financing.originationFee * 100) : '—'} source="user" />
        </div>
      )}

      <SectionHeader sKey="disposition" label="DISPOSITION" color={BT.text.amber} />
      {expandedSections.has('disposition') && (
        <div>
          <InputField label="EXIT CAP RATE" value={a?.disposition?.exitCapRate != null ? fmtPct(a.disposition.exitCapRate * 100) : '—'} source="platform" linked="Strategy" />
          <InputField label="SELLING COSTS" value={a?.disposition?.sellingCosts != null ? fmtPct(a.disposition.sellingCosts * 100) : '—'} source="user" />
          <InputField label="SALE NOI METHOD" value={a?.disposition?.saleNOIMethod ?? '—'} source="user" />
          <InputField label="HOLD PERIOD" value={a?.holdPeriod != null ? `${a.holdPeriod} years` : '—'} source="user" />
        </div>
      )}

      <SectionHeader sKey="waterfall" label="WATERFALL STRUCTURE" color={BT.text.purple} />
      {expandedSections.has('waterfall') && (
        <div>
          <InputField label="LP SHARE" value={a?.waterfall?.lpShare != null ? fmtPct(a.waterfall.lpShare * 100) : '—'} source="user" />
          <InputField label="GP SHARE" value={a?.waterfall?.gpShare != null ? fmtPct(a.waterfall.gpShare * 100) : '—'} source="user" />
          <InputField label="EQUITY CONTRIBUTION" value={a?.waterfall?.equityContribution != null ? fmt$(a.waterfall.equityContribution) : '—'} source="user" />
          {(a?.waterfall?.hurdles ?? []).map((h: WaterfallHurdle, i: number) => (
            <InputField key={i} label={`  TIER ${i + 1}: ${fmtPct(h.hurdleRate * 100)} HURDLE`} value={`GP ${fmtPct(h.promoteToGP * 100)} / LP ${fmtPct(h.lpSplit * 100)}`} source="user" />
          ))}
        </div>
      )}

      {showDevelopment && (
        <>
          <SectionHeader sKey="development" label="DEVELOPMENT INPUTS" color={BT.met.financial} badge="DEV ONLY" />
          {expandedSections.has('development') && (
            <div>
              <InputField label="LAND COST" value={a?.development?.landCost != null ? fmt$(a.development.landCost) : '—'} source="user" />
              <InputField label="HARD COST / SF" value={a?.development?.hardCostPerSF != null ? `$${a.development.hardCostPerSF}/SF` : '—'} source="user" />
              <InputField label="HARD COST CONTINGENCY" value={a?.development?.hardCostContingency != null ? fmtPct(a.development.hardCostContingency * 100) : '—'} source="user" />
              <InputField label="SOFT COST %" value={a?.development?.softCostPct != null ? fmtPct(a.development.softCostPct * 100) : '—'} source="user" />
              <InputField label="DEVELOPER FEE" value={a?.development?.developerFee != null ? fmtPct(a.development.developerFee * 100) : '—'} source="user" />
              <InputField label="CONSTRUCTION PERIOD" value={a?.development?.constructionPeriod != null ? `${a.development.constructionPeriod} months` : '—'} source="user" />
              <InputField label="LEASE-UP VELOCITY" value={a?.development?.leaseUpVelocity != null ? `${a.development.leaseUpVelocity} units/mo` : '—'} source="user" />
              <InputField label="CONSTRUCTION LOAN LTC" value={a?.development?.constructionLoanLTC != null ? fmtPct(a.development.constructionLoanLTC * 100) : '—'} source="user" />
              <InputField label="CONSTRUCTION LOAN RATE" value={a?.development?.constructionLoanRate != null ? fmtPct(a.development.constructionLoanRate * 100) : '—'} source="user" />
            </div>
          )}
        </>
      )}

      {showRedevelopment && (
        <>
          <SectionHeader sKey="renovation" label="RENOVATION INPUTS" color={BT.text.orange} badge="REDEV ONLY" />
          {expandedSections.has('renovation') && (
            <div>
              <InputField label="RENOVATION BUDGET / UNIT" value="—" source="user" />
              <InputField label="RENOVATION TIMELINE" value="—" source="user" />
              <InputField label="LEASE-UP DURING RENO" value="—" source="user" />
              <InputField label="UNIT DOWNTIME" value="—" source="user" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AssumptionsTab;
