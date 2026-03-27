import React, { useState, useEffect } from 'react';
import { BT } from '../../theme';
import { useCommentaryStore } from '../../../../stores/commentaryStore';

interface MSASubmarketsTabProps {
  msaId: string;
  msa: any;
  onSelectSubmarket?: (submarketId: string) => void;
}

interface SubmarketRow {
  id: string;
  name: string;
  msa: string;
  jedi: number;
  rent: string;
  rentD: string;
  vac: string;
  props: number;
  units: string;
  dpp: number;
  cpp: string;
  cycle: string;
}

const MOCK_SUBMARKETS: SubmarketRow[] = [
  { id: 'midtown', name: 'Midtown', msa: 'Atlanta, GA', jedi: 88, rent: '$2,056', rentD: '+4.8%', vac: '5.1%', props: 52, units: '14.8K', dpp: 82, cpp: '4.8%', cycle: 'EXPANSION' },
  { id: 'buckhead', name: 'Buckhead', msa: 'Atlanta, GA', jedi: 84, rent: '$1,883', rentD: '+2.1%', vac: '6.2%', props: 38, units: '11.2K', dpp: 78, cpp: '4.5%', cycle: 'EXPANSION' },
  { id: 'sandy-springs', name: 'Sandy Springs', msa: 'Atlanta, GA', jedi: 81, rent: '$1,920', rentD: '+3.4%', vac: '5.8%', props: 44, units: '12.6K', dpp: 74, cpp: '5.2%', cycle: 'EXPANSION' },
  { id: 'ofw', name: 'Old Fourth Ward', msa: 'Atlanta, GA', jedi: 80, rent: '$1,850', rentD: '+3.2%', vac: '6.8%', props: 62, units: '18.4K', dpp: 72, cpp: '', cycle: 'LATE EXP' },
  { id: 'east-atlanta', name: 'East Atlanta', msa: 'Atlanta, GA', jedi: 78, rent: '$1,720', rentD: '+4.1%', vac: '5.6%', props: 28, units: '8.2K', dpp: 80, cpp: '5.6%', cycle: 'EXPANSION' },
  { id: 'decatur', name: 'Decatur', msa: 'Atlanta, GA', jedi: 76, rent: '$1,680', rentD: '+4.2%', vac: '5.4%', props: 32, units: '9.8K', dpp: 84, cpp: '5.2%', cycle: 'EXPANSION' },
  { id: 'downtown', name: 'Downtown', msa: 'Atlanta, GA', jedi: 74, rent: '$1,540', rentD: '+0.4%', vac: '8.5%', props: 52, units: '18.2K', dpp: 38, cpp: '4.4%', cycle: '' },
  { id: 'west-midtown', name: 'West Midtown', msa: 'Atlanta, GA', jedi: 86, rent: '$2,120', rentD: '+5.2%', vac: '4.8%', props: 24, units: '6.4K', dpp: 88, cpp: '4.2%', cycle: 'EXPANSION' },
];

const HISTORY_LABELS = ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'];

const SUBMARKET_HISTORY: Record<string, { jedi: number[]; rentGrowth: number[]; occupancy: number[] }> = {
  midtown:        { jedi: [80, 81, 82, 83, 84, 85, 86, 87, 88], rentGrowth: [3.2, 3.5, 3.8, 4.0, 4.1, 4.3, 4.5, 4.6, 4.8], occupancy: [93.8, 94.0, 94.2, 94.4, 94.5, 94.6, 94.7, 94.8, 94.9] },
  buckhead:       { jedi: [78, 79, 79, 80, 81, 82, 82, 83, 84], rentGrowth: [1.8, 1.9, 2.0, 2.0, 2.1, 2.1, 2.1, 2.1, 2.1], occupancy: [92.8, 93.0, 93.1, 93.2, 93.4, 93.5, 93.6, 93.7, 93.8] },
  'sandy-springs': { jedi: [74, 75, 76, 77, 78, 79, 79, 80, 81], rentGrowth: [2.4, 2.6, 2.8, 3.0, 3.1, 3.2, 3.3, 3.3, 3.4], occupancy: [93.2, 93.4, 93.5, 93.7, 93.8, 94.0, 94.1, 94.1, 94.2] },
  ofw:            { jedi: [72, 73, 74, 75, 76, 77, 78, 79, 80], rentGrowth: [2.0, 2.2, 2.4, 2.6, 2.8, 2.9, 3.0, 3.1, 3.2], occupancy: [92.0, 92.2, 92.4, 92.6, 92.8, 93.0, 93.1, 93.1, 93.2] },
  'east-atlanta':  { jedi: [70, 71, 72, 73, 74, 75, 76, 77, 78], rentGrowth: [3.0, 3.2, 3.4, 3.5, 3.6, 3.8, 3.9, 4.0, 4.1], occupancy: [93.4, 93.6, 93.7, 93.8, 94.0, 94.1, 94.2, 94.3, 94.4] },
  decatur:        { jedi: [68, 69, 70, 71, 72, 73, 74, 75, 76], rentGrowth: [2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 3.9, 4.0, 4.2], occupancy: [93.6, 93.8, 93.9, 94.0, 94.2, 94.3, 94.4, 94.5, 94.6] },
  downtown:       { jedi: [70, 71, 71, 72, 72, 73, 73, 74, 74], rentGrowth: [0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 0.4, 0.4, 0.4], occupancy: [90.0, 90.2, 90.4, 90.6, 90.8, 91.0, 91.2, 91.3, 91.5] },
  'west-midtown':  { jedi: [78, 79, 80, 81, 82, 83, 84, 85, 86], rentGrowth: [3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 4.9, 5.0, 5.2], occupancy: [94.2, 94.4, 94.5, 94.6, 94.8, 94.9, 95.0, 95.1, 95.2] },
};

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export const MSASubmarketsTab: React.FC<MSASubmarketsTabProps> = ({ msaId, msa, onSelectSubmarket }) => {
  const [selectedSub, setSelectedSub] = useState<string>('midtown');
  const msaName = msa?.name || msaId || 'Atlanta';

  const { fetchCommentary, getCommentary, isLoading } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  const selectedData = MOCK_SUBMARKETS.find(s => s.id === selectedSub);
  const history = SUBMARKET_HISTORY[selectedSub];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: BT.bg.header,
        border: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: BT.text.primary, ...mono }}>
            SUBMARKET: {selectedData?.name?.toUpperCase() || 'SELECT'} {msaName.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '3px 8px',
            background: `${BT.text.amber}22`,
            color: BT.text.amber,
            fontSize: 11,
            fontWeight: 700,
            ...mono,
          }}>
            JEDI {selectedData?.jedi || '—'}
          </span>
          <span style={{
            padding: '3px 8px',
            background: `${BT.text.green}22`,
            color: BT.text.green,
            fontSize: 11,
            ...mono,
          }}>
            {selectedData?.jedi || '—'}/100
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {history && (
            <div style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              overflow: 'hidden',
              marginBottom: 12,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                <span style={{ fontSize: 11, color: BT.text.amber, fontWeight: 700, ...mono }}>
                  Historical Trends — {selectedData?.name || 'Submarket'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 0 }}>
                <MiniChart label="JEDI Score" data={history.jedi} labels={HISTORY_LABELS} color={BT.text.amber} unit="" />
                <div style={{ width: 1, background: BT.border.subtle }} />
                <MiniChart label="Rent Growth" data={history.rentGrowth} labels={HISTORY_LABELS} color={BT.text.green} unit="%" />
                <div style={{ width: 1, background: BT.border.subtle }} />
                <MiniChart label="Occupancy" data={history.occupancy} labels={HISTORY_LABELS} color={BT.text.cyan} unit="%" />
              </div>
            </div>
          )}

          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              background: BT.bg.header,
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.amber, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
                Submarket Index
              </span>
              <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>{MOCK_SUBMARKETS.length} submarkets across tracked markets</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  {['Submarket', 'MSA', 'JEDI', 'Rent', 'Rent Δ', 'Vac', 'Props', 'Units', 'DPP', 'CPP', 'Cycle'].map((h, i) => (
                    <th key={h} style={{
                      padding: '5px 12px',
                      textAlign: (i <= 1 ? 'left' : 'right') as React.CSSProperties['textAlign'],
                      fontSize: 10,
                      fontWeight: 500,
                      color: BT.text.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      ...mono,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_SUBMARKETS.map((sub, i) => {
                  const isSelected = sub.id === selectedSub;
                  const cycleColor = sub.cycle === 'EXPANSION'
                    ? { text: BT.text.green, bg: `${BT.text.green}18` }
                    : sub.cycle === 'PEAK'
                      ? { text: BT.text.amber, bg: `${BT.text.amber}18` }
                      : sub.cycle
                        ? { text: BT.text.amber, bg: `${BT.text.amber}18` }
                        : { text: BT.text.muted, bg: 'transparent' };

                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSub(sub.id)}
                      style={{
                        borderBottom: i < MOCK_SUBMARKETS.length - 1 ? `1px solid ${BT.border.subtle}44` : 'none',
                        background: isSelected ? `${BT.text.amber}08` : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = BT.bg.hover; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '5px 12px', color: isSelected ? BT.text.amber : BT.text.primary, fontWeight: isSelected ? 700 : 400, ...mono }}>{sub.name}</td>
                      <td style={{ padding: '5px 12px', color: BT.text.muted, ...mono }}>{sub.msa}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.amber, fontWeight: 700, ...mono }}>{sub.jedi}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{sub.rent}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.green, ...mono }}>{sub.rentD}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{sub.vac}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{sub.props}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{sub.units}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.cyan, ...mono }}>{sub.dpp}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{sub.cpp}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                        {sub.cycle ? (
                          <span style={{
                            padding: '1px 6px',
                            fontSize: 9,
                            textTransform: 'uppercase',
                            color: cycleColor.text,
                            background: cycleColor.bg,
                            borderRadius: 2,
                            ...mono,
                          }}>{sub.cycle}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedData && (
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
            }}>
              <button
                onClick={() => onSelectSubmarket?.(selectedData.id)}
                style={{
                  padding: '8px 16px',
                  background: BT.accent.blue,
                  color: '#fff',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  ...mono,
                }}
              >
                View Terminal →
              </button>
              <button style={{
                padding: '8px 16px',
                background: 'transparent',
                color: BT.text.secondary,
                border: `1px solid ${BT.border.subtle}`,
                fontSize: 11,
                cursor: 'pointer',
                ...mono,
              }}>
                View Properties
              </button>
            </div>
          )}
        </div>

        <div style={{
          width: 280,
          flexShrink: 0,
          border: `1px solid ${BT.border.subtle}`,
          borderLeft: `2px solid ${BT.text.amber}66`,
          padding: 16,
          background: BT.bg.panel,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div>
            <div style={{
              fontSize: 10,
              textTransform: 'uppercase',
              color: BT.text.amber,
              letterSpacing: '0.05em',
              marginBottom: 4,
              borderBottom: `1px solid ${BT.text.amber}44`,
              paddingBottom: 4,
              fontWeight: 700,
              ...mono,
            }}>Submarket Narrative</div>
            {loading ? (
              <div style={{ fontSize: 11, color: BT.text.muted }}>Generating analysis...</div>
            ) : commentary?.marketNarrative ? (
              <>
                <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: '0 0 8px 0' }}>
                  {commentary.marketNarrative.summary}
                </p>
                <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: 0 }}>
                  {commentary.marketNarrative.cyclePosition}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: '0 0 8px 0' }}>
                  {selectedData?.name || 'Midtown'} ranks as the top-performing submarket in the {msaName} MSA with a {selectedData?.jedi || 88} strategy score. Class B repositioning offers a 340bps spread to Class A rents.
                </p>
                <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: 0 }}>
                  Near-term supply pressure remains manageable with {selectedData?.vac || '5.1%'} vacancy and strong absorption fundamentals.
                </p>
              </>
            )}
          </div>

          <div>
            <div style={{
              fontSize: 10,
              textTransform: 'uppercase',
              color: BT.text.amber,
              letterSpacing: '0.05em',
              marginBottom: 4,
              borderBottom: `1px solid ${BT.text.amber}44`,
              paddingBottom: 4,
              fontWeight: 700,
              ...mono,
            }}>Investment Thesis</div>
            {commentary?.investmentThesis ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {commentary.investmentThesis.points.map((pt: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                      <span style={{ color: pt.color === 'green' ? BT.text.green : pt.color === 'amber' ? BT.text.amber : BT.text.red }}>
                        {pt.icon || (pt.color === 'green' ? '✓' : pt.color === 'amber' ? '⚠' : '✗')}
                      </span>
                      <span style={{ color: BT.text.secondary }}>{pt.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 8,
                  padding: '4px 8px',
                  background: `${BT.text.amber}15`,
                  border: `1px solid ${BT.text.amber}44`,
                  color: BT.text.amber,
                  fontSize: 11,
                  textAlign: 'center',
                  fontWeight: 700,
                  ...mono,
                }}>
                  {commentary.investmentThesis.recommendation}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: BT.text.green }}>✓</span>
                    <span style={{ color: BT.text.secondary }}>Population growth exceeds national avg</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: BT.text.green }}>✓</span>
                    <span style={{ color: BT.text.secondary }}>Employment diversification reducing risk</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: BT.text.amber }}>⚠</span>
                    <span style={{ color: BT.text.secondary }}>Supply deliveries may pressure occupancy</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: BT.text.red }}>✗</span>
                    <span style={{ color: BT.text.secondary }}>Insurance costs escalating in Cobb County</span>
                  </div>
                </div>
                <div style={{
                  marginTop: 8,
                  padding: '4px 8px',
                  background: `${BT.text.amber}15`,
                  border: `1px solid ${BT.text.amber}44`,
                  color: BT.text.amber,
                  fontSize: 11,
                  textAlign: 'center',
                  fontWeight: 700,
                  ...mono,
                }}>
                  SELECTIVE BUY
                </div>
              </>
            )}
          </div>

          <div style={{
            padding: '8px 10px',
            background: `${BT.text.green}15`,
            border: `1px solid ${BT.text.green}44`,
            borderRadius: 4,
          }}>
            <div style={{ fontSize: 10, color: BT.text.green, textTransform: 'uppercase', marginBottom: 2, ...mono }}>Top Opportunity</div>
            <div style={{ fontSize: 11, color: BT.text.primary }}>Class B repositioning — 340bps spread</div>
          </div>

          {commentary?.peerContext && (
            <div>
              <div style={{
                fontSize: 10,
                textTransform: 'uppercase',
                color: BT.text.amber,
                letterSpacing: '0.05em',
                marginBottom: 4,
                borderBottom: `1px solid ${BT.text.amber}44`,
                paddingBottom: 4,
                fontWeight: 700,
                ...mono,
              }}>Peer Context</div>
              <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: 0 }}>
                {commentary.peerContext.summary}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function MiniChart({ label, data, labels, color, unit }: { label: string; data: number[]; labels: string[]; color: string; unit: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = range * 0.15;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  const w = 260;
  const h = 120;
  const leftPad = 36;
  const rightPad = 6;
  const topPad = 6;
  const botPad = 20;
  const plotW = w - leftPad - rightPad;
  const plotH = h - topPad - botPad;

  const gridLines = 3;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => yMin + (yRange * i) / gridLines);

  const points = data.map((v, i) => {
    const x = leftPad + (i / (data.length - 1)) * plotW;
    const y = topPad + plotH - ((v - yMin) / yRange) * plotH;
    return `${x},${y}`;
  }).join(' ');

  const fillPath = `${leftPad},${topPad + plotH} ${points} ${leftPad + plotW},${topPad + plotH}`;
  const lastVal = data[data.length - 1];
  const lastX = leftPad + plotW;
  const lastY = topPad + plotH - ((lastVal - yMin) / yRange) * plotH;

  return (
    <div style={{ flex: 1, padding: '8px 4px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: BT.text.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'JetBrains Mono',monospace" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>
          {lastVal}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block', height: 100 }} preserveAspectRatio="xMinYMid meet">
        {yTicks.map((tick, i) => {
          const y = topPad + plotH - ((tick - yMin) / yRange) * plotH;
          return (
            <g key={i}>
              <line x1={leftPad} y1={y} x2={w - rightPad} y2={y} stroke={BT.border.subtle} strokeWidth="0.5" />
              <text x={leftPad - 3} y={y + 3} textAnchor="end" fill={BT.text.muted} fontSize="7" fontFamily="monospace">
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}
        {[0, Math.floor(labels.length / 2), labels.length - 1].map(i => {
          const x = leftPad + (i / (labels.length - 1)) * plotW;
          return (
            <text key={i} x={x} y={h - 3} textAnchor="middle" fill={BT.text.muted} fontSize="7" fontFamily="monospace">{labels[i]}</text>
          );
        })}
        <polyline fill={`${color}10`} stroke="none" points={fillPath} />
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
    </div>
  );
}

export default MSASubmarketsTab;
