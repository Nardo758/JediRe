const T = {
  bg: { panel:"#0F1319",header:"#1A1F2E" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757" },
  border: { subtle:"#1E2538" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface SensitivityTabProps {
  output: any;
  modelType?: string;
}

export default function SensitivityTab({ output, modelType }: SensitivityTabProps) {
  if (!output || !output.sensitivityAnalysis) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>No sensitivity analysis data available</div>;
  }

  const { sensitivityAnalysis } = output;
  const { metric, xAxis, yAxis, grid, baseCase } = sensitivityAnalysis;

  const formatValue = (value: number, isPercent: boolean = false) => {
    if (isPercent) return `${(value * 100).toFixed(1)}%`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(2);
  };

  // Color scale for heat map (red → yellow → green)
  const getColor = (value: number, min: number, max: number) => {
    if (value === baseCase?.value) return T.text.amber; // Highlight base case
    
    const normalized = (value - min) / (max - min);
    
    if (normalized < 0.33) return '#FF4757'; // Red (bad)
    if (normalized < 0.67) return '#FFA500'; // Orange (ok)
    return '#00D26A'; // Green (good)
  };

  const getCellBackground = (value: number, min: number, max: number) => {
    if (value === baseCase?.value) return T.text.amber + '30'; // Highlight base case
    
    const normalized = (value - min) / (max - min);
    
    if (normalized < 0.33) return '#FF475720';
    if (normalized < 0.67) return '#FFA50020';
    return '#00D26A20';
  };

  if (!grid || grid.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>
        Sensitivity analysis not computed
      </div>
    );
  }

  const values = grid.flat();
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return (
    <div>
      {/* Analysis Info */}
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        padding: 16,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, marginBottom: 12 }}>
          SENSITIVITY: {metric?.toUpperCase() || 'IRR'}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 9, fontFamily: T.font.mono }}>
          <div>
            <div style={{ color: T.text.secondary, marginBottom: 3 }}>X-Axis (Horizontal)</div>
            <div style={{ color: T.text.primary, fontWeight: 600 }}>{xAxis?.variable || 'Exit Cap Rate'}</div>
          </div>
          <div>
            <div style={{ color: T.text.secondary, marginBottom: 3 }}>Y-Axis (Vertical)</div>
            <div style={{ color: T.text.primary, fontWeight: 600 }}>{yAxis?.variable || 'Rent Growth'}</div>
          </div>
          <div>
            <div style={{ color: T.text.secondary, marginBottom: 3 }}>Base Case</div>
            <div style={{ color: T.text.amber, fontWeight: 700, fontSize: 11 }}>
              {baseCase ? formatValue(baseCase.value, metric === 'irr') : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity Grid */}
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
          2D SENSITIVITY GRID
        </div>

        <div style={{ padding: 16, overflowX: 'auto' }}>
          <table style={{
            borderCollapse: 'collapse',
            fontFamily: T.font.mono,
            fontSize: 9,
            width: '100%',
          }}>
            <thead>
              <tr>
                <th style={{ 
                  padding: '8px', 
                  textAlign: 'center', 
                  background: T.bg.header,
                  border: `1px solid ${T.border.subtle}`,
                  color: T.text.secondary,
                  fontWeight: 600,
                  minWidth: 120,
                }}>
                  {yAxis?.variable || 'Y'} \ {xAxis?.variable || 'X'}
                </th>
                {xAxis?.values?.map((xVal: number, idx: number) => (
                  <th 
                    key={idx}
                    style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      background: T.bg.header,
                      border: `1px solid ${T.border.subtle}`,
                      color: T.text.amber,
                      fontWeight: 600,
                      minWidth: 80,
                    }}
                  >
                    {formatValue(xVal, xAxis.isPercent)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yAxis?.values?.map((yVal: number, yIdx: number) => (
                <tr key={yIdx}>
                  <td style={{ 
                    padding: '8px', 
                    textAlign: 'center', 
                    background: T.bg.header,
                    border: `1px solid ${T.border.subtle}`,
                    color: T.text.amber,
                    fontWeight: 600,
                  }}>
                    {formatValue(yVal, yAxis.isPercent)}
                  </td>
                  {grid[yIdx]?.map((cellValue: number, xIdx: number) => {
                    const isBaseCase = baseCase && 
                      Math.abs(xAxis.values[xIdx] - baseCase.xValue) < 0.0001 &&
                      Math.abs(yVal - baseCase.yValue) < 0.0001;
                    
                    return (
                      <td 
                        key={xIdx}
                        style={{ 
                          padding: '8px', 
                          textAlign: 'center', 
                          border: `1px solid ${T.border.subtle}`,
                          background: isBaseCase 
                            ? T.text.amber + '40'
                            : getCellBackground(cellValue, minValue, maxValue),
                          color: getColor(cellValue, minValue, maxValue),
                          fontWeight: isBaseCase ? 700 : 600,
                          fontSize: isBaseCase ? 10 : 9,
                        }}
                      >
                        {formatValue(cellValue, metric === 'irr')}
                        {isBaseCase && <span style={{ marginLeft: 4 }}>★</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        padding: 16,
        marginTop: 16,
      }}>
        <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.secondary, marginBottom: 8 }}>
          LEGEND
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 8, fontFamily: T.font.mono }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: '#00D26A20', border: '1px solid #00D26A' }} />
            <span style={{ color: T.text.secondary }}>High Performance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: '#FFA50020', border: '1px solid #FFA500' }} />
            <span style={{ color: T.text.secondary }}>Medium Performance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: '#FF475720', border: '1px solid #FF4757' }} />
            <span style={{ color: T.text.secondary }}>Low Performance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: T.text.amber + '40', border: `1px solid ${T.text.amber}` }} />
            <span style={{ color: T.text.secondary }}>Base Case ★</span>
          </div>
        </div>
      </div>
    </div>
  );
}
