const T = {
  bg: { panel:"#0F1319",header:"#1A1F2E" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757" },
  border: { subtle:"#1E2538" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface ProjectionsTabProps {
  output: any;
  modelType?: string;
}

export default function ProjectionsTab({ output, modelType }: ProjectionsTabProps) {
  if (!output || !output.projections) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>No projections data available</div>;
  }

  const { projections } = output;

  const formatMoney = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div>
      {/* Projections Table */}
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        overflow: 'auto',
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
          ANNUAL PROJECTIONS ({projections.length} YEARS)
        </div>
        
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: T.font.mono,
          fontSize: 9,
        }}>
          <thead>
            <tr style={{ background: T.bg.header }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: T.text.secondary, fontWeight: 600 }}>YEAR</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>GPR</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>VACANCY</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>EGI</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>OPEX</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>NOI</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>DEBT SVC</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>CASH FLOW</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: T.text.secondary, fontWeight: 600 }}>DSCR</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((proj: any, idx: number) => (
              <tr 
                key={idx}
                style={{ 
                  borderBottom: `1px solid ${T.border.subtle}`,
                  background: idx % 2 === 0 ? 'transparent' : '#00000015'
                }}
              >
                <td style={{ padding: '8px 12px', color: T.text.amber, fontWeight: 600 }}>Y{proj.year}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.primary }}>{formatMoney(proj.grossPotentialRent)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.muted }}>{formatPercent(proj.vacancyRate)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.primary }}>{formatMoney(proj.effectiveGrossIncome)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.red }}>{formatMoney(proj.operatingExpenses)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.green, fontWeight: 600 }}>{formatMoney(proj.netOperatingIncome)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.red }}>{formatMoney(proj.debtService || 0)}</td>
                <td style={{ 
                  padding: '8px 12px', 
                  textAlign: 'right', 
                  color: (proj.cashFlowAfterDebt || 0) >= 0 ? T.text.green : T.text.red,
                  fontWeight: 600
                }}>
                  {formatMoney(proj.cashFlowAfterDebt || 0)}
                </td>
                <td style={{ 
                  padding: '8px 12px', 
                  textAlign: 'right', 
                  color: (proj.debtServiceCoverageRatio || 0) >= 1.25 ? T.text.green : T.text.red,
                  fontWeight: 600
                }}>
                  {(proj.debtServiceCoverageRatio || 0).toFixed(2)}x
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: T.bg.header, fontWeight: 700 }}>
              <td style={{ padding: '8px 12px', color: T.text.amber }}>TOTAL</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.primary }}>
                {formatMoney(projections.reduce((sum: number, p: any) => sum + p.grossPotentialRent, 0))}
              </td>
              <td style={{ padding: '8px 12px' }}></td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.primary }}>
                {formatMoney(projections.reduce((sum: number, p: any) => sum + p.effectiveGrossIncome, 0))}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.red }}>
                {formatMoney(projections.reduce((sum: number, p: any) => sum + p.operatingExpenses, 0))}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.green }}>
                {formatMoney(projections.reduce((sum: number, p: any) => sum + p.netOperatingIncome, 0))}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.red }}>
                {formatMoney(projections.reduce((sum: number, p: any) => sum + (p.debtService || 0), 0))}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: T.text.green }}>
                {formatMoney(projections.reduce((sum: number, p: any) => sum + (p.cashFlowAfterDebt || 0), 0))}
              </td>
              <td style={{ padding: '8px 12px' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Key Metrics Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginTop: 20,
      }}>
        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 3,
          padding: 12,
        }}>
          <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 6, fontFamily: T.font.mono }}>
            AVG NOI
          </div>
          <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.green }}>
            {formatMoney(projections.reduce((sum: number, p: any) => sum + p.netOperatingIncome, 0) / projections.length)}
          </div>
        </div>

        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 3,
          padding: 12,
        }}>
          <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 6, fontFamily: T.font.mono }}>
            AVG VACANCY
          </div>
          <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>
            {formatPercent(projections.reduce((sum: number, p: any) => sum + p.vacancyRate, 0) / projections.length)}
          </div>
        </div>

        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 3,
          padding: 12,
        }}>
          <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 6, fontFamily: T.font.mono }}>
            MIN DSCR
          </div>
          <div style={{ 
            fontSize: 16, 
            fontFamily: T.font.mono, 
            fontWeight: 700, 
            color: Math.min(...projections.map((p: any) => p.debtServiceCoverageRatio || 0)) >= 1.25 ? T.text.green : T.text.red
          }}>
            {Math.min(...projections.map((p: any) => p.debtServiceCoverageRatio || 0)).toFixed(2)}x
          </div>
        </div>

        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 3,
          padding: 12,
        }}>
          <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 6, fontFamily: T.font.mono }}>
            TOTAL CASH FLOW
          </div>
          <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.green }}>
            {formatMoney(projections.reduce((sum: number, p: any) => sum + (p.cashFlowAfterDebt || 0), 0))}
          </div>
        </div>
      </div>
    </div>
  );
}
