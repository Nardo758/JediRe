/**
 * SubmarketNewsTab - Local market news, development announcements
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Building2, Briefcase, Clock } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';

interface SubmarketNewsTabProps {
  submarketId: string;
  submarket: SubmarketData;
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

export const SubmarketNewsTab: React.FC<SubmarketNewsTabProps> = ({ submarketId, submarket }) => {
  const { fetchCommentary, getCommentary } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  useEffect(() => { fetchCommentary('submarket', submarketId, submarket.name); }, [submarketId, submarket.name]);
  const [expandedNews, setExpandedNews] = useState<string | null>(null);

  const newsItems: NewsItem[] = useMemo(() => [
    {
      id: '1',
      headline: `Amazon Leases 150K SF Office at Phipps Tower`,
      source: 'Atlanta Business Chronicle',
      timestamp: '2h ago',
      category: 'employment',
      impact: 'positive',
      summary: 'Major tech expansion expected to bring 800 new jobs to Buckhead, supporting multifamily demand.',
    },
    {
      id: '2',
      headline: `Wood Partners Breaks Ground on 400-Unit Tower at Buckhead Station`,
      source: 'Multi-Housing News',
      timestamp: '1d ago',
      category: 'development',
      impact: 'neutral',
      summary: 'Class A development targeting Q3 2026 delivery. Adds to supply pipeline.',
    },
    {
      id: '3',
      headline: `Blackstone Acquires Metropolitan at Phipps for $85M`,
      source: 'Commercial Observer',
      timestamp: '3d ago',
      category: 'transaction',
      impact: 'positive',
      summary: 'Institutional investment at 4.8% cap rate signals confidence in Buckhead fundamentals.',
    },
    {
      id: '4',
      headline: `${submarket.name} Vacancy Hits 3-Year Low`,
      source: 'CoStar',
      timestamp: '1w ago',
      category: 'market',
      impact: 'positive',
      summary: 'Strong absorption outpacing new supply. Rent growth accelerating.',
    },
    {
      id: '5',
      headline: `New Rezoning Proposal Could Allow 2,000 Additional Units`,
      source: 'AJC',
      timestamp: '2w ago',
      category: 'development',
      impact: 'neutral',
      summary: 'City council reviewing mixed-use zoning changes for Buckhead Village area.',
    },
  ], [submarket.name]);

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
      {/* News Feed */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Newspaper size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {submarket.name} Market News
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {newsItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setExpandedNews(expandedNews === item.id ? null : item.id)}
              style={{
                padding: 12,
                background: expandedNews === item.id ? BT.bg.cardHover : 'transparent',
                borderRadius: 6,
                border: `1px solid ${BT.border.subtle}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: getCategoryColor(item.category) }}>
                  {getCategoryIcon(item.category)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 13, 
                    fontWeight: 500, 
                    color: BT.text.primary,
                    marginBottom: 4,
                  }}>
                    {item.headline}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    fontSize: 10,
                    color: BT.text.dim,
                  }}>
                    <span style={{ 
                      color: getCategoryColor(item.category),
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>
                      {item.category}
                    </span>
                    <span>•</span>
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.timestamp}</span>
                    <span style={{
                      marginLeft: 'auto',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: item.impact === 'positive' ? `${BT.text.green}22` :
                                 item.impact === 'negative' ? `${BT.text.red}22` : `${BT.text.muted}22`,
                      color: item.impact === 'positive' ? BT.text.green :
                             item.impact === 'negative' ? BT.text.red : BT.text.muted,
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
                      borderRadius: 4,
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

      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.risk && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="risk" commentary={commentary.signalCommentary.risk} />
            </div>
          )}
          {commentary.signalCommentary?.demand && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.demand} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketNewsTab;
