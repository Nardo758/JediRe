import React, { useEffect } from 'react';

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'submarket_deep_dive', submarketId: submarketId }
  );
import { BT } from '../../theme';
import type { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import {
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';
  MarketNarrative,
  InvestmentThesis,
  RiskOpportunity,
  PeerContext,
  SupplyNarrative,
  StrategyScoreBadge,
} from '../../commentary';

interface SubmarketCommentaryTabProps {
  submarketId: string;
  submarket: SubmarketData | null;
  onSelectSubmarket?: (submarketId: string) => void;
  onPropertySelect?: (propertyId: string) => void;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

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
  highlight?: boolean;
}

const MOCK_SUBMARKETS: SubmarketRow[] = [
  { id: 'midtown', name: 'Midtown', msa: 'Atlanta, GA', jedi: 88, rent: '$2,056', rentD: '+4.8%', vac: '5.1%', props: 52, units: '14.8K', dpp: 82, cpp: '4.8%', cycle: 'EXPANSION', highlight: true },
  { id: 'buckhead', name: 'Buckhead', msa: 'Atlanta, GA', jedi: 84, rent: '$1,883', rentD: '+2.1%', vac: '6.2%', props: 38, units: '11.2K', dpp: 78, cpp: '4.5%', cycle: 'EXPANSION' },
  { id: 'sandy-springs', name: 'Sandy Springs', msa: 'Atlanta, GA', jedi: 81, rent: '$1,920', rentD: '+3.4%', vac: '5.8%', props: 44, units: '12.6K', dpp: 74, cpp: '5.2%', cycle: 'EXPANSION' },
  { id: 'downtown-tampa', name: 'Downtown Tampa', msa: 'Tampa, FL', jedi: 80, rent: '$1,850', rentD: '+3.2%', vac: '6.8%', props: 62, units: '18.4K', dpp: 72, cpp: '', cycle: 'LATE EXP' },
  { id: 'ybor-city', name: 'Ybor City', msa: 'Tampa, FL', jedi: 78, rent: '$1,720', rentD: '+4.1%', vac: '5.6%', props: 28, units: '8.2K', dpp: 80, cpp: '5.6%', cycle: 'EXPANSION' },
  { id: 'south-beach', name: 'South Beach', msa: 'Miami, FL', jedi: 76, rent: '$2,890', rentD: '+0.8%', vac: '9.2%', props: 45, units: '15.4K', dpp: 42, cpp: '4.6%', cycle: 'PEAK' },
  { id: 'brickell', name: 'Brickell', msa: 'Miami, FL', jedi: 74, rent: '$3,120', rentD: '+0.4%', vac: '8.5%', props: 52, units: '18.2K', dpp: 38, cpp: '4.4%', cycle: '' },
  { id: 'downtown-raleigh', name: 'Downtown Raleigh', msa: 'Raleigh, NC', jedi: 86, rent: '$1,680', rentD: '+4.2%', vac: '5.4%', props: 32, units: '9.8K', dpp: 84, cpp: '5.2%', cycle: 'EXPANSION' },
];

const COL_HEADERS = ['Submarket', 'MSA', 'JEDI', 'Rent', 'Rent Δ', 'Vac', 'Props', 'Units', 'DPP', 'CPP', 'Cycle'];

export const SubmarketCommentaryTab: React.FC<SubmarketCommentaryTabProps> = ({
  submarketId,
  submarket,
  onSelectSubmarket,
}) => {
  const subName = submarket?.name || submarketId.charAt(0).toUpperCase() + submarketId.slice(1);
  const msaName = submarket?.msaName || 'Atlanta, GA';

  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);

  useEffect(() => {
    fetchCommentary('submarket', submarketId, subName);
  }, [submarketId, subName]);

  if (loading) {
    return (
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: 16, textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: BT.text.muted }}>Generating commentary...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
        <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
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
            <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>
              {MOCK_SUBMARKETS.length} submarkets across tracked markets
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                {COL_HEADERS.map((h, i) => (
                  <th key={h} style={{
                    padding: '5px 12px',
                    textAlign: i <= 1 ? 'left' : 'right' as any,
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
              {MOCK_SUBMARKETS.map((row, i) => {
                const cycleColor = row.cycle === 'EXPANSION'
                  ? { color: BT.text.green, bg: `${BT.text.green}18` }
                  : row.cycle === 'PEAK'
                    ? { color: BT.text.amber, bg: `${BT.text.amber}18` }
                    : row.cycle
                      ? { color: BT.text.amber, bg: `${BT.text.amber}18` }
                      : { color: BT.text.muted, bg: 'transparent' };

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectSubmarket?.(row.id)}
                    style={{
                      borderBottom: i < MOCK_SUBMARKETS.length - 1 ? `1px solid ${BT.border.subtle}44` : 'none',
                      background: row.highlight ? `${BT.text.amber}08` : 'transparent',
                      cursor: onSelectSubmarket ? 'pointer' : 'default',
                    }}
                  >
                    <td style={{
                      padding: '5px 12px',
                      color: row.highlight ? BT.text.amber : BT.text.primary,
                      fontWeight: row.highlight ? 700 : 400,
                      ...mono,
                    }}>{row.name}</td>
                    <td style={{ padding: '5px 12px', color: BT.text.muted, ...mono }}>{row.msa}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.amber, fontWeight: 700, ...mono }}>{row.jedi}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{row.rent}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.green, ...mono }}>{row.rentD}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{row.vac}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{row.props}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{row.units}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.cyan, ...mono }}>{row.dpp}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.primary, ...mono }}>{row.cpp}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                      {row.cycle && (
                        <span style={{
                          padding: '1px 6px',
                          fontSize: 9,
                          fontWeight: 700,
                          color: cycleColor.color,
                          background: cycleColor.bg,
                          borderRadius: 2,
                          textTransform: 'uppercase',
                          ...mono,
                        }}>{row.cycle}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        width: 280,
        flexShrink: 0,
        borderLeft: `2px solid ${BT.text.amber}66`,
        paddingLeft: 16,
      }}>
        {commentary ? (
          <>
            <MarketNarrative narrative={commentary.marketNarrative} compact />
            <InvestmentThesis
              recommendation={commentary.investmentThesis.recommendation}
              points={commentary.investmentThesis.points}
              compact
            />
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: BT.text.amber,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: `1px solid ${BT.text.amber}44`,
                paddingBottom: 4,
                marginBottom: 8,
                ...mono,
              }}>
                Strategy Score
              </div>
              <StrategyScoreBadge
                score={commentary.jediScore}
                delta={commentary.arbitrageDelta}
                size="lg"
              />
              <div style={{ fontSize: 10, color: BT.text.muted, ...mono, marginTop: 4 }}>
                {commentary.recommendedStrategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            </div>
            <RiskOpportunity
              risks={commentary.riskOpportunity.risks}
              opportunities={commentary.riskOpportunity.opportunities}
              compact
            />
            <PeerContext
              summary={commentary.peerContext.summary}
              peerRank={commentary.peerContext.peerRank}
              peerTotal={commentary.peerContext.peerTotal}
              topPeers={commentary.peerContext.topPeers}
              currentScore={commentary.jediScore}
              compact
            />
            <SupplyNarrative narrative={commentary.supplyNarrative} compact />
          </>
        ) : (
          <>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: BT.text.amber,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              borderBottom: `1px solid ${BT.text.amber}44`,
              paddingBottom: 4,
              marginBottom: 8,
              ...mono,
            }}>
              Submarket Narrative
            </div>
            <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: '0 0 12px 0' }}>
              {subName} ranks as the top-performing submarket in the {msaName} MSA.
              Class B repositioning offers a 340bps spread to Class A rents, making it
              the primary opportunity within the Core Plus Value-Add strategy.
            </p>

            <div style={{
              padding: '8px 10px',
              background: `${BT.text.green}14`,
              border: `1px solid ${BT.text.green}44`,
              borderRadius: 3,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, color: BT.text.green, textTransform: 'uppercase', marginBottom: 2, fontWeight: 700, ...mono }}>
                Top Opportunity
              </div>
              <div style={{ fontSize: 11, color: BT.text.primary }}>
                Class B repositioning — 340bps spread to Class A
              </div>
            </div>

            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: BT.text.amber,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              borderBottom: `1px solid ${BT.text.amber}44`,
              paddingBottom: 4,
              marginBottom: 8,
              ...mono,
            }}>
              Market Signals
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'Avg Rent', value: submarket?.avgRent ? `$${submarket.avgRent.toLocaleString()}` : '$1,820', color: BT.text.primary },
                { label: 'Rent Growth', value: `+${submarket?.rentGrowth || 5.2}%`, color: BT.text.green },
                { label: 'Occupancy', value: `${submarket?.occupancy || 96.1}%`, color: BT.text.green },
                { label: 'Pipeline', value: `${(submarket?.pipelineUnits || 2100).toLocaleString()} units`, color: BT.text.primary },
                { label: 'Absorption', value: `${submarket?.absorptionRate || 94}%`, color: BT.text.green },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, ...mono }}>
                  <span style={{ color: BT.text.muted }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubmarketCommentaryTab;
