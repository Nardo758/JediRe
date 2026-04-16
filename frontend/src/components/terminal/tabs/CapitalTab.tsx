/**
 * CapitalTab - Debt comparison, waterfall, equity structure
 * Migrated from: Debt Comparison + Waterfall views in FinancialDashboard
 */

import React, { useState, useMemo } from 'react';
import { Check, AlertTriangle, DollarSign, Percent, Building } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';

interface CapitalTabProps {
  dealId: string;
  deal: any;
}

interface LoanOption {
  id: string;
  name: string;
  ltv: number;
  rate: number;
  ioYears: number;
  amortYears: number;
  proceeds: number;
}

export const CapitalTab: React.FC<CapitalTabProps> = ({ dealId, deal }) => {
  const [activeView, setActiveView] = useState<'debt' | 'waterfall' | 'sources'>('debt');

  // Extract loan options
  const { loans, selectedLoan, setSelectedLoan } = useMemo(() => {
    const model = deal?.model || deal?.latestModel || {};
    const debt = model.debt || {};
    const capitalOptions = deal?.capitalOptions || [];

    let loanList: LoanOption[] = [];
    
    if (Object.keys(debt.loans || {}).length > 0) {
      loanList = Object.entries(debt.loans).map(([id, loan]: [string, any]) => ({
        id,
        name: loan.name,
        ltv: loan.ltv,
        rate: loan.rate,
        ioYears: loan.ioYears,
        amortYears: loan.amortYears,
        proceeds: loan.proceeds,
      }));
    } else if (capitalOptions.length > 0) {
      loanList = capitalOptions.map((opt: any, idx: number) => ({
        id: opt.id || `loan${idx}`,
        name: opt.name || opt.loan_type || `Option ${idx + 1}`,
        ltv: opt.ltv || 0.65,
        rate: opt.rate || opt.interest_rate || 0.055,
        ioYears: opt.io_period_months ? opt.io_period_months / 12 : opt.ioPeriod || 2,
        amortYears: opt.amortization_years || 30,
        proceeds: opt.proceeds || opt.loan_amount || 30000000,
      }));
    } else {
      // Default loans
      loanList = [
        { id: 'agency', name: 'Agency (Freddie Mac)', ltv: 0.65, rate: 0.052, ioYears: 2, amortYears: 30, proceeds: 29250000 },
        { id: 'cmbs', name: 'CMBS', ltv: 0.70, rate: 0.058, ioYears: 3, amortYears: 30, proceeds: 31500000 },
        { id: 'bridge', name: 'Bridge Loan', ltv: 0.75, rate: 0.072, ioYears: 3, amortYears: 0, proceeds: 33750000 },
      ];
    }

    return {
      loans: loanList,
      selectedLoan: debt.selectedLoan || loanList[0]?.id,
      setSelectedLoan: (id: string) => {}, // Would update state
    };
  }, [deal]);

  // Sources & Uses
  const sourcesUses = useMemo(() => {
    const model = deal?.model || deal?.latestModel || {};
    const su = model._sourcesAndUses || {};
    const selectedLoanData = loans.find(l => l.id === selectedLoan);
    const purchasePrice = deal?.budget || model?.acquisition?.purchasePrice || 45000000;
    const closingCosts = purchasePrice * 0.02;
    const capex = 1500000;
    const totalUses = purchasePrice + closingCosts + capex;
    const equity = totalUses - (selectedLoanData?.proceeds || 0);

    return {
      sources: su.sources || {
        'Senior Debt': selectedLoanData?.proceeds || 29250000,
        'LP Equity': equity * 0.9,
        'GP Equity': equity * 0.1,
      },
      uses: su.uses || {
        'Purchase Price': purchasePrice,
        'Closing Costs': closingCosts,
        'Renovation Budget': capex,
        'Working Capital': 250000,
      },
      totalSources: selectedLoanData?.proceeds ? selectedLoanData.proceeds + equity : totalUses,
      totalUses,
    };
  }, [deal, loans, selectedLoan]);

  // Waterfall distributions
  const distributions = useMemo(() => {
    const model = deal?.model || deal?.latestModel || {};
    return model._waterfallDistributions || Array.from({ length: 7 }, (_, i) => ({
      year: i + 1,
      lpDistribution: 250000 + i * 50000,
      gpDistribution: 50000 + i * 15000,
      gpPromote: i > 2 ? 25000 + i * 10000 : 0,
      totalDistribution: 300000 + i * 75000,
    }));
  }, [deal]);

  const totals = distributions.reduce((acc, d) => ({
    lp: acc.lp + d.lpDistribution,
    gp: acc.gp + d.gpDistribution,
    promote: acc.promote + d.gpPromote,
  }), { lp: 0, gp: 0, promote: 0 });

  const total = totals.lp + totals.gp;
  const lpPct = total > 0 ? (totals.lp / total * 100).toFixed(0) : '0';
  const gpPct = total > 0 ? (totals.gp / total * 100).toFixed(0) : '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'debt', label: 'Debt Comparison' },
          { key: 'sources', label: 'Sources & Uses' },
          { key: 'waterfall', label: 'Waterfall' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${activeView === v.key ? BT.border.highlight : BT.border.subtle}`,
              background: activeView === v.key ? BT.bg.active : BT.bg.panel,
              color: activeView === v.key ? BT.text.amber : BT.text.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'debt' && (
        <>
          <div style={terminalStyles.sectionLabel}>LOAN OPTIONS — CLICK TO SELECT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {loans.map(loan => (
              <div
                key={loan.id}
                onClick={() => setSelectedLoan(loan.id)}
                style={{
                  ...terminalStyles.card,
                  cursor: 'pointer',
                  borderColor: selectedLoan === loan.id ? BT.text.amber : BT.border.subtle,
                  borderWidth: selectedLoan === loan.id ? 2 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: BT.text.primary,
                  }}>
                    {loan.name}
                  </span>
                  {selectedLoan === loan.id && (
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: BT.text.amber,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={12} style={{ color: BT.bg.terminal }} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: BT.text.muted }}>LTV</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {(loan.ltv * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: BT.text.muted }}>Rate</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {(loan.rate * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: BT.text.muted }}>IO Period</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {loan.ioYears} yrs
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: BT.text.muted }}>Amortization</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {loan.amortYears > 0 ? `${loan.amortYears} yrs` : 'IO Only'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    marginTop: 8,
                    borderTop: `1px solid ${BT.border.subtle}`,
                  }}>
                    <span style={{ fontSize: 11, color: BT.text.muted }}>Proceeds</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(loan.proceeds)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          <div style={{
            background: `linear-gradient(135deg, ${BT.bg.panelAlt} 0%, ${BT.bg.panel} 100%)`,
            border: `1px solid ${BT.text.amber}33`,
            borderRadius: 8,
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: BT.text.amber, fontWeight: 700, fontSize: 12 }}>
              ⚡ AI Debt Analysis
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
                <span style={{ color: BT.text.cyan }}>→</span>
                <span>
                  <strong style={{ color: BT.text.primary }}>
                    {loans.find(l => l.id === selectedLoan)?.name || 'Selected loan'} active.
                  </strong>{' '}
                  {loans.find(l => l.id === selectedLoan)?.ioYears || 0}yr IO provides cash flow runway during stabilization ramp.
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
                <span style={{ color: BT.text.cyan }}>→</span>
                <span>
                  <strong style={{ color: BT.text.primary }}>
                    {((loans.find(l => l.id === selectedLoan)?.rate || 0) * 100).toFixed(2)}% rate
                  </strong>{' '}
                  locked for term — eliminates floating rate risk across the hold period.
                </span>
              </li>
            </ul>
          </div>
        </>
      )}

      {activeView === 'sources' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Sources */}
          <div>
            <div style={terminalStyles.sectionLabel}>SOURCES</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(sourcesUses.sources).map(([k, v]) => (
                    <tr key={k}>
                      <td style={terminalStyles.td}>{k}</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt.currency(v as number)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${BT.border.medium}` }}>
                    <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.primary }}>Total Sources</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(sourcesUses.totalSources)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Uses */}
          <div>
            <div style={terminalStyles.sectionLabel}>USES</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(sourcesUses.uses).map(([k, v]) => (
                    <tr key={k}>
                      <td style={terminalStyles.td}>{k}</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt.currency(v as number)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${BT.border.medium}` }}>
                    <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.primary }}>Total Uses</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 700, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(sourcesUses.totalUses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === 'waterfall' && (
        <>
          {/* LP/GP Split Bar */}
          <div style={terminalStyles.sectionLabel}>LP / GP EQUITY DISTRIBUTION</div>
          <div style={{
            height: 32,
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            marginBottom: 16,
          }}>
            <div style={{
              width: `${lpPct}%`,
              background: BT.text.cyan,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: BT.bg.terminal,
              fontSize: 11,
              fontWeight: 700,
            }}>
              LP {lpPct}%
            </div>
            <div style={{
              width: `${gpPct}%`,
              background: BT.text.amber,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: BT.bg.terminal,
              fontSize: 11,
              fontWeight: 700,
            }}>
              GP {gpPct}%
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{
              ...terminalStyles.card,
              borderColor: BT.text.cyan + '44',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, marginBottom: 8 }}>LP RETURNS</div>
              <div style={{ fontSize: 12, color: BT.text.secondary }}>
                Total LP: <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: BT.text.primary }}>{fmt.currency(totals.lp)}</strong>
              </div>
            </div>
            <div style={{
              ...terminalStyles.card,
              background: BT.bg.panelAlt,
              borderColor: BT.text.amber + '44',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.amber, marginBottom: 8 }}>GP RETURNS</div>
              <div style={{ fontSize: 12, color: BT.text.secondary, lineHeight: 2 }}>
                <div>Total GP: <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: BT.text.primary }}>{fmt.currency(totals.gp)}</strong></div>
                <div>Promote: <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: BT.text.primary }}>{fmt.currency(totals.promote)}</strong></div>
              </div>
            </div>
          </div>

          {/* Annual Distributions Table */}
          <div style={terminalStyles.sectionLabel}>ANNUAL DISTRIBUTIONS</div>
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={terminalStyles.th}>Year</th>
                  <th style={{ ...terminalStyles.th, textAlign: 'right' }}>LP</th>
                  <th style={{ ...terminalStyles.th, textAlign: 'right' }}>GP</th>
                  <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Promote</th>
                  <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map(d => (
                  <tr key={d.year}>
                    <td style={terminalStyles.td}>Year {d.year}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(d.lpDistribution)}
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(d.gpDistribution)}
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(d.gpPromote)}
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(d.totalDistribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CapitalTab;
