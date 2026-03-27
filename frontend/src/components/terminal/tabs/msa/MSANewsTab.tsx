/**
 * MSANewsTab - Metro market news, alerts, sentiment
 */

import React, { useMemo, useState } from 'react';
import { Newspaper, TrendingUp, Building2, Briefcase, AlertTriangle } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalSection } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';

interface MSANewsTabProps {
  msaId: string;
  msa: MSAData;
}

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  category: 'development' | 'transaction' | 'employment' | 'market';
  impact: 'positive' | 'negative' | 'neutral';
  summary?: string;
}

interface MarketAlert {
  id: string;
  title: string;
  signal: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
}

export const MSANewsTab: React.FC<MSANewsTabProps> = ({ msaId, msa }) => {
  const [expandedNews, setExpandedNews] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const msaName = msa?.name || msaId || 'Atlanta';

  const newsItems: NewsItem[] = useMemo(() => [
    { id: '1', headline: `${msaName} Named Top 5 Market for Multifamily Investment in 2025`, source: 'NMHC', timestamp: '2h ago', category: 'market', impact: 'positive', summary: 'Strong job growth and relative affordability drive institutional capital to the metro.' },
    { id: '2', headline: 'Microsoft Announces 3,000-Job Tech Hub Expansion', source: 'WSJ', timestamp: '1d ago', category: 'employment', impact: 'positive', summary: 'Major tech expansion expected to boost apartment demand in Midtown and Buckhead submarkets.' },
    { id: '3', headline: 'Blackstone Acquires $285M Camden Portfolio', source: 'Commercial Observer', timestamp: '2d ago', category: 'transaction', impact: 'positive', summary: 'Largest multifamily transaction of 2025 signals strong institutional confidence.' },
    { id: '4', headline: 'City Approves 5,000-Unit Mixed-Use Development', source: 'AJC', timestamp: '3d ago', category: 'development', impact: 'neutral', summary: 'New development in West Midtown will deliver units over next 4 years.' },
    { id: '5', headline: `${msaName} Vacancy Rate Hits 5-Year Low`, source: 'CoStar', timestamp: '1w ago', category: 'market', impact: 'positive', summary: 'Strong absorption outpaces new supply, supporting rent growth momentum.' },
    { id: '6', headline: 'Fed Signals Rate Cuts — Multifamily Lending to Loosen', source: 'Bloomberg', timestamp: '1w ago', category: 'market', impact: 'positive', summary: 'Federal Reserve indicates potential 50bps cut, expected to accelerate transaction volume.' },
    { id: '7', headline: 'Greystar Launches $200M Value-Add Fund Targeting Southeast', source: 'Real Capital Analytics', timestamp: '2w ago', category: 'transaction', impact: 'positive', summary: 'New fund targeting B/C class assets in Atlanta, Charlotte, Nashville for renovation.' },
    { id: '8', headline: 'MARTA BeltLine Extension Approved for Westside', source: 'AJC', timestamp: '2w ago', category: 'development', impact: 'positive', summary: 'Transit expansion expected to drive 15-20% rent premium in adjacent submarkets within 3 years.' },
  ], [msaName]);

  const marketAlerts: MarketAlert[] = useMemo(() => [
    { id: 'a1', title: 'Supply wave cresting — 12-month delivery peak in Q2 2026', signal: 'S-02', severity: 'high', timestamp: '4h ago' },
    { id: 'a2', title: 'Rent acceleration turning positive in 6 of 8 submarkets', signal: 'M-02', severity: 'medium', timestamp: '1d ago' },
    { id: 'a3', title: 'Tech sector hiring momentum above 5-year average', signal: 'D-09', severity: 'low', timestamp: '3d ago' },
    { id: 'a4', title: 'Cap rate compression: Class B spread tightening to 175 bps', signal: 'C-04', severity: 'medium', timestamp: '5d ago' },
  ], []);

  const sentimentSummary = useMemo(() => ({
    overall: 'Bullish',
    positive: 6,
    neutral: 1,
    negative: 1,
    topSignal: 'Employment momentum accelerating',
    topRisk: 'Near-term supply delivery concentration',
  }), []);

  const categories = ['all', 'development', 'transaction', 'employment', 'market'];

  const filteredNews = categoryFilter === 'all' ? newsItems : newsItems.filter(n => n.category === categoryFilter);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      development: BT.text.amber,
      transaction: BT.text.green,
      employment: BT.text.cyan,
      market: BT.text.magenta,
    };
    return colors[category] || BT.text.muted;
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'development') return <Building2 size={14} />;
    if (category === 'transaction') return <TrendingUp size={14} />;
    if (category === 'employment') return <Briefcase size={14} />;
    return <Newspaper size={14} />;
  };

  const severityColor = (s: string) =>
    s === 'high' ? BT.accent.red : s === 'medium' ? BT.text.amber : BT.text.cyan;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Market Intelligence
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            News, alerts, sentiment analysis
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>MARKET SENTIMENT</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green, fontSize: 20 }}>
            {sentimentSummary.overall}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>
            {sentimentSummary.positive} positive · {sentimentSummary.neutral} neutral · {sentimentSummary.negative} negative
          </div>
        </div>
        <div style={{ ...terminalStyles.card }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>TOP SIGNAL</div>
          <div style={{ fontSize: 12, color: BT.text.primary, fontWeight: 500 }}>
            {sentimentSummary.topSignal}
          </div>
        </div>
        <div style={{ ...terminalStyles.card }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.accent.red, marginBottom: 8 }}>KEY RISK</div>
          <div style={{ fontSize: 12, color: BT.text.primary, fontWeight: 500 }}>
            {sentimentSummary.topRisk}
          </div>
        </div>
      </div>

      <TerminalSection title="Active Alerts" icon={<AlertTriangle size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {marketAlerts.map((alert) => (
            <div key={alert.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px',
              borderLeft: `3px solid ${severityColor(alert.severity)}`,
              background: BT.bg.elevated,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: severityColor(alert.severity),
                textTransform: 'uppercase',
                minWidth: 32,
              }}>
                {alert.severity}
              </span>
              <span style={{ fontSize: 11, color: BT.text.primary, flex: 1 }}>{alert.title}</span>
              <span style={{ fontSize: 10, color: BT.text.cyan, fontFamily: "'JetBrains Mono'" }}>{alert.signal}</span>
              <span style={{ fontSize: 10, color: BT.text.muted }}>{alert.timestamp}</span>
            </div>
          ))}
        </div>
      </TerminalSection>

      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <Newspaper size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            {msaName} News Feed
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '4px 10px',
                  background: categoryFilter === cat ? BT.accent.blue : BT.bg.elevated,
                  color: categoryFilter === cat ? '#fff' : BT.text.secondary,
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 10,
                  fontWeight: categoryFilter === cat ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredNews.map((item) => (
            <div
              key={item.id}
              onClick={() => setExpandedNews(expandedNews === item.id ? null : item.id)}
              style={{
                padding: 12,
                background: expandedNews === item.id ? BT.bg.cardHover : 'transparent',
                borderRadius: 0,
                border: `1px solid ${BT.border.subtle}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: getCategoryColor(item.category) }}>
                  {getCategoryIcon(item.category)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: BT.text.primary, marginBottom: 4 }}>
                    {item.headline}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: BT.text.dim }}>
                    <span style={{ color: getCategoryColor(item.category), textTransform: 'uppercase', fontWeight: 600 }}>
                      {item.category}
                    </span>
                    <span>•</span>
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.timestamp}</span>
                    <span style={{
                      marginLeft: 'auto',
                      padding: '2px 6px',
                      borderRadius: 0,
                      background: item.impact === 'positive' ? `${BT.text.green}22` : item.impact === 'negative' ? `${BT.text.red}22` : `${BT.text.muted}22`,
                      color: item.impact === 'positive' ? BT.text.green : item.impact === 'negative' ? BT.text.red : BT.text.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {item.impact}
                    </span>
                  </div>
                  {expandedNews === item.id && item.summary && (
                    <div style={{
                      marginTop: 10,
                      padding: 10,
                      background: BT.bg.terminal,
                      borderRadius: 0,
                      fontSize: 12,
                      color: BT.text.secondary,
                      borderLeft: `2px solid ${getCategoryColor(item.category)}`,
                    }}>
                      {item.summary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MSANewsTab;
