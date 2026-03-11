const T = {
  bg: { panel:"#0F1319",header:"#1A1F2E" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4" },
  border: { subtle:"#1E2538" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface WaterfallTabProps {
  output: any;
  modelType?: string;
}

export default function WaterfallTab({ output, modelType }: WaterfallTabProps) {
  if (!output || !output.returnWaterfall) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>No waterfall data available</div>;
  }

  const { returnWaterfall } = output;
  const { tiers } = returnWaterfall;

  const formatMoney = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const tierColors = [
    '#00D26A', // Green - First tier (pref return)
    '#00BCD4', // Cyan - Second tier (catch-up)
    '#F5A623', // Amber - Third tier (profit split)
    '#9B59B6', // Purple - Final tier
  ];

  return (
    <div>
      {/* Waterfall Summary */}
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        padding: 16,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, marginBottom: 12 }}>
          DISTRIBUTION SUMMARY
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>Total Distributions</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.green }}>
              {formatMoney(returnWaterfall.totalDistributions || 0)}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>LP Share</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>
              {formatMoney(returnWaterfall.lpTotal || 0)}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>GP Share</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>
              {formatMoney(returnWaterfall.gpTotal || 0)}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 8, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>LP IRR</div>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.green }}>
              {formatPercent(returnWaterfall.lpIRR || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Waterfall Tiers */}
      {tiers && tiers.length > 0 && (
        <div style={{
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 20,
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
            WATERFALL STRUCTURE
          </div>

          <div style={{ padding: 16 }}>
            {tiers.map((tier: any, idx: number) => (
              <div 
                key={idx}
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: '#00000020',
                  borderLeft: `4px solid ${tierColors[idx % tierColors.length]}`,
                  borderRadius: 3,
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: tierColors[idx % tierColors.length] }}>
                    TIER {idx + 1}: {tier.name || tier.description}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.amber, fontWeight: 600 }}>
                    {formatMoney(tier.amount)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 8, fontFamily: T.font.mono }}>
                  <div>
                    <span style={{ color: T.text.secondary }}>Hurdle:</span>{' '}
                    <span style={{ color: T.text.primary, fontWeight: 600 }}>
                      {tier.hurdleRate ? formatPercent(tier.hurdleRate) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: T.text.secondary }}>LP Share:</span>{' '}
                    <span style={{ color: T.text.primary, fontWeight: 600 }}>
                      {tier.lpSplit ? formatPercent(tier.lpSplit) : formatMoney(tier.lpAmount || 0)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: T.text.secondary }}>GP Share:</span>{' '}
                    <span style={{ color: T.text.primary, fontWeight: 600 }}>
                      {tier.gpSplit ? formatPercent(tier.gpSplit) : formatMoney(tier.gpAmount || 0)}
                    </span>
                  </div>
                </div>

                {tier.description && (
                  <div style={{ 
                    marginTop: 8, 
                    fontSize: 8, 
                    color: T.text.muted, 
                    fontFamily: T.font.mono,
                    fontStyle: 'italic'
                  }}>
                    {tier.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Waterfall Chart */}
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
          DISTRIBUTION BREAKDOWN
        </div>

        <div style={{ padding: 16 }}>
          {/* LP Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 6, fontFamily: T.font.mono }}>
              LIMITED PARTNER (LP)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                flex: 1, 
                height: 32, 
                background: `linear-gradient(90deg, ${T.text.green}, ${T.text.cyan})`,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontFamily: T.font.mono,
                fontWeight: 700,
                color: '#000',
              }}>
                {formatMoney(returnWaterfall.lpTotal || 0)}
              </div>
              <div style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary, minWidth: 60 }}>
                {formatPercent((returnWaterfall.lpTotal || 0) / (returnWaterfall.totalDistributions || 1))}
              </div>
            </div>
          </div>

          {/* GP Bar */}
          <div>
            <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 6, fontFamily: T.font.mono }}>
              GENERAL PARTNER (GP)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                flex: (returnWaterfall.gpTotal || 0) / (returnWaterfall.lpTotal || 1),
                height: 32, 
                background: `linear-gradient(90deg, ${T.text.amber}, #FFA500)`,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontFamily: T.font.mono,
                fontWeight: 700,
                color: '#000',
              }}>
                {formatMoney(returnWaterfall.gpTotal || 0)}
              </div>
              <div style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary, minWidth: 60 }}>
                {formatPercent((returnWaterfall.gpTotal || 0) / (returnWaterfall.totalDistributions || 1))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
