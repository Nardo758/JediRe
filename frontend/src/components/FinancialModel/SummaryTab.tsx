const T = {
  bg: { panel:"#0F1319",header:"#1A1F2E" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4" },
  border: { subtle:"#1E2538" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface SummaryTabProps {
  output: any;
}

export default function SummaryTab({ output }: SummaryTabProps) {
  if (!output || !output.summaryMetrics) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>No summary data available</div>;
  }

  const { summaryMetrics, sourcesAndUses, disposition } = output;

  const Metric = ({ label, value, format = 'number', good }: any) => {
    const formatted = 
      format === 'percent' ? `${(value * 100).toFixed(1)}%` :
      format === 'money' ? `$${value >= 1_000_000 ? (value/1_000_000).toFixed(2)+'M' : (value/1_000).toFixed(0)+'K'}` :
      format === 'multiple' ? `${value.toFixed(2)}x` :
      format === 'number' ? value.toLocaleString() :
      value;

    const color = 
      good === true ? T.text.green :
      good === false ? T.text.red :
      T.text.primary;

    return (
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 3,
        padding: 12,
      }}>
        <div style={{
          fontSize: 8,
          fontFamily: T.font.mono,
          color: T.text.secondary,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 20,
          fontFamily: T.font.mono,
          fontWeight: 700,
          color,
        }}>
          {formatted}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <Metric 
          label="IRR" 
          value={summaryMetrics.irr} 
          format="percent" 
          good={summaryMetrics.irr > 0.15}
        />
        <Metric 
          label="Equity Multiple" 
          value={summaryMetrics.equityMultiple} 
          format="multiple" 
          good={summaryMetrics.equityMultiple > 2.0}
        />
        <Metric 
          label="Cash-on-Cash (Y1)" 
          value={summaryMetrics.cashOnCashYear1 || summaryMetrics.avgCashOnCash} 
          format="percent"
        />
        <Metric 
          label="Going-In Cap" 
          value={summaryMetrics.goingInCapRate || summaryMetrics.goingInYieldOnCost || 0} 
          format="percent"
        />
        <Metric 
          label="Exit Cap" 
          value={summaryMetrics.exitCapRate} 
          format="percent"
        />
        <Metric 
          label="Min DSCR" 
          value={summaryMetrics.minDSCR} 
          format="multiple"
          good={summaryMetrics.minDSCR >= 1.25}
        />
      </div>

      {/* Sources & Uses */}
      {sourcesAndUses && (
        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 24,
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
            SOURCES & USES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
            {/* Sources */}
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 8, fontFamily: T.font.mono }}>SOURCES</div>
              {Object.entries(sourcesAndUses.sources).map(([key, value]: any) => (
                key !== 'total' && (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: T.font.mono, marginBottom: 4 }}>
                    <span style={{ color: T.text.secondary }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span style={{ color: T.text.primary, fontWeight: 600 }}>${(value/1_000_000).toFixed(2)}M</span>
                  </div>
                )
              ))}
              <div style={{ borderTop: `1px solid ${T.border.subtle}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: T.font.mono, fontWeight: 700 }}>
                <span style={{ color: T.text.amber }}>TOTAL</span>
                <span style={{ color: T.text.amber }}>${(sourcesAndUses.sources.total/1_000_000).toFixed(2)}M</span>
              </div>
            </div>

            {/* Uses */}
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 8, fontFamily: T.font.mono }}>USES</div>
              {Object.entries(sourcesAndUses.uses).map(([key, value]: any) => (
                key !== 'total' && (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: T.font.mono, marginBottom: 4 }}>
                    <span style={{ color: T.text.secondary }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span style={{ color: T.text.primary, fontWeight: 600 }}>${(value/1_000_000).toFixed(2)}M</span>
                  </div>
                )
              ))}
              <div style={{ borderTop: `1px solid ${T.border.subtle}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: T.font.mono, fontWeight: 700 }}>
                <span style={{ color: T.text.amber }}>TOTAL</span>
                <span style={{ color: T.text.amber }}>${(sourcesAndUses.uses.total/1_000_000).toFixed(2)}M</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disposition Summary */}
      {disposition && (
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
            DISPOSITION (EXIT YEAR {disposition.exitYear})
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Exit NOI</div>
                <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>${(disposition.exitNOI/1_000_000).toFixed(2)}M</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Gross Sale Price</div>
                <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>${(disposition.grossSalePrice/1_000_000).toFixed(2)}M</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Net Proceeds</div>
                <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.green }}>${(disposition.netDispositionProceeds/1_000_000).toFixed(2)}M</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Net Profit</div>
                <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: disposition.netProfit > 0 ? T.text.green : T.text.red }}>${(disposition.netProfit/1_000_000).toFixed(2)}M</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
