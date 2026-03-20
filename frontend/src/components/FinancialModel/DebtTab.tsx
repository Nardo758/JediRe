const T = {
  bg: { panel:"#0F1319",header:"#1A1F2E" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4" },
  border: { subtle:"#1E2538" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface DebtTabProps {
  output: any;
  modelType?: string;
}

export default function DebtTab({ output, modelType }: DebtTabProps) {
  if (!output || !output.debtStructure) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>No debt structure data available</div>;
  }

  const { debtStructure } = output;
  const { seniorLoan, mezDebt, preferredEquity } = debtStructure;

  const formatMoney = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  const DebtLayerCard = ({ layer, title, color }: any) => {
    if (!layer) return null;

    return (
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{
          background: T.bg.header,
          padding: '8px 12px',
          borderBottom: `1px solid ${T.border.subtle}`,
          fontSize: 10,
          fontFamily: T.font.mono,
          fontWeight: 700,
          color,
        }}>
          {title}
        </div>
        
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Principal</div>
              <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>{formatMoney(layer.amount)}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Interest Rate</div>
              <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>{formatPercent(layer.interestRate)}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Term (years)</div>
              <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>{layer.termYears}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Amortization</div>
              <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>
                {layer.amortizationYears ? `${layer.amortizationYears} yrs` : 'Interest Only'}
              </div>
            </div>
          </div>

          {layer.schedule && layer.schedule.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 8, fontFamily: T.font.mono }}>PAYMENT SCHEDULE</div>
              <div style={{ 
                maxHeight: 300, 
                overflow: 'auto',
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 3,
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: T.font.mono,
                  fontSize: 8,
                }}>
                  <thead style={{ position: 'sticky', top: 0, background: T.bg.header }}>
                    <tr>
                      <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.secondary, fontWeight: 600 }}>YEAR</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>INTEREST</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>PRINCIPAL</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>TOTAL</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layer.schedule.map((payment: any, idx: number) => (
                      <tr 
                        key={idx}
                        style={{ 
                          borderBottom: `1px solid ${T.border.subtle}`,
                          background: idx % 2 === 0 ? 'transparent' : '#00000015'
                        }}
                      >
                        <td style={{ padding: '6px 8px', color: T.text.amber }}>{payment.year}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{formatMoney(payment.interest)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{formatMoney(payment.principal)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.amber, fontWeight: 600 }}>{formatMoney(payment.totalPayment)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>{formatMoney(payment.endingBalance)}</td>
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

  return (
    <div>
      {/* Debt Stack Summary */}
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        padding: 16,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, marginBottom: 12 }}>
          CAPITAL STACK
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Total Debt</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.red }}>
              {formatMoney((seniorLoan?.amount || 0) + (mezDebt?.amount || 0))}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>LTV</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>
              {formatPercent(debtStructure.loanToValue || 0)}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Weighted Avg Rate</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>
              {formatPercent(debtStructure.weightedAvgRate || 0)}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Annual Debt Service</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.red }}>
              {formatMoney(debtStructure.annualDebtService || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Debt Layers */}
      <DebtLayerCard layer={seniorLoan} title="SENIOR LOAN" color={T.text.cyan} />
      <DebtLayerCard layer={mezDebt} title="MEZZANINE DEBT" color="#FFA500" />
      <DebtLayerCard layer={preferredEquity} title="PREFERRED EQUITY" color="#9B59B6" />

      {/* Debt Covenants */}
      {debtStructure.covenants && (
        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            background: T.bg.header,
            padding: '8px 12px',
            borderBottom: `1px solid ${T.border.subtle}`,
            fontSize: 10,
            fontFamily: T.font.mono,
            fontWeight: 700,
            color: T.text.amber,
          }}>
            COVENANTS & REQUIREMENTS
          </div>
          <div style={{ padding: 16 }}>
            {Object.entries(debtStructure.covenants).map(([key, value]: any) => (
              <div key={key} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 9, 
                fontFamily: T.font.mono, 
                marginBottom: 6,
                paddingBottom: 6,
                borderBottom: `1px solid ${T.border.subtle}`
              }}>
                <span style={{ color: T.text.secondary }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style={{ color: T.text.primary, fontWeight: 600 }}>{typeof value === 'number' ? formatPercent(value) : value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
