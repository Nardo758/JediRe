/**
 * MSANewsTab - Metro market news
 */

import React, { useMemo, useState } from 'react';
import { Newspaper, TrendingUp, Building2, Briefcase } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
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

export const MSANewsTab: React.FC<MSANewsTabProps> = ({ msaId, msa }) => {
  const [expandedNews, setExpandedNews] = useState<string | null>(null);

  const newsItems: NewsItem[] = useMemo(() => [
    { id: '1', headline: `${msa.name} Named Top 5 Market for Multifamily Investment in 2025`, source: 'NMHC', timestamp: '2h ago', category: 'market', impact: 'positive', summary: 'Strong job growth and relative affordability drive institutional capital to the metro.' },
    { id: '2', headline: 'Microsoft Announces 3,000-Job Tech Hub Expansion', source: 'WSJ', timestamp: '1d ago', category: 'employment', impact: 'positive', summary: 'Major tech expansion expected to boost apartment demand in Midtown and Buckhead submarkets.' },
    { id: '3', headline: 'Blackstone Acquires $285M Camden Portfolio', source: 'Commercial Observer', timestamp: '2d ago', category: 'transaction', impact: 'positive', summary: 'Largest multifamily transaction of 2025 signals strong institutional confidence.' },
    { id: '4', headline: 'City Approves 5,000-Unit Mixed-Use Development', source: 'AJC', timestamp: '3d ago', category: 'development', impact: 'neutral', summary: 'New development in West Midtown will deliver units over next 4 years.' },
    { id: '5', headline: `${msa.name} Vacancy Rate Hits 5-Year Low`, source: 'CoStar', timestamp: '1w ago', category: 'market', impact: 'positive', summary: 'Strong absorption outpaces new supply, supporting rent growth momentum.' },
  ], [msa.name]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Newspaper size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {msa.name} Market News
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {newsItems.map((item) => (
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
