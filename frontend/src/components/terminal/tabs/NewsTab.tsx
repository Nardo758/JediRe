/**
 * NewsTab - Market news, rate changes, and economic indicators
 * Bloomberg-style news terminal with real-time market data
 */

import React, { useState, useMemo } from 'react';

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'market_dashboard', dealId }
  );
import { 
  Newspaper, TrendingUp, TrendingDown, Clock, AlertTriangle,
  Building2, DollarSign, Percent, Activity, Globe, Bell
} from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { ContextIndicator } from '../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

interface NewsTabProps {
  dealId: string;
  deal: any;
}

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  category: 'macro' | 'local' | 'rates' | 'transactions' | 'regulatory';
  impact: 'positive' | 'negative' | 'neutral';
  summary?: string;
  url?: string;
}

interface RateData {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
  timestamp: string;
}

interface EconomicIndicator {
  name: string;
  value: string;
  previousValue: string;
  change: string;
  trend: 'up' | 'down' | 'flat';
  nextRelease?: string;
}

export const NewsTab: React.FC<NewsTabProps> = ({ dealId, deal }) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedNews, setExpandedNews] = useState<string | null>(null);

  // Market rates data
  const rates: RateData[] = useMemo(() => [
    { name: 'Fed Funds Rate', value: 4.25, change: 0, changePercent: 0, direction: 'flat', timestamp: '2026-03-15' },
    { name: '10Y Treasury', value: 4.18, change: 0.02, changePercent: 0.48, direction: 'up', timestamp: 'Live' },
    { name: 'SOFR', value: 4.31, change: -0.01, changePercent: -0.23, direction: 'down', timestamp: 'Live' },
    { name: '30Y Fixed Mortgage', value: 6.87, change: 0.05, changePercent: 0.73, direction: 'up', timestamp: '2026-03-26' },
    { name: 'Prime Rate', value: 7.50, change: 0, changePercent: 0, direction: 'flat', timestamp: '2026-03-15' },
    { name: 'CMBS BBB Spread', value: 285, change: -5, changePercent: -1.72, direction: 'down', timestamp: 'Live' },
  ], []);

  // Economic indicators
  const indicators: EconomicIndicator[] = useMemo(() => [
    { name: 'CPI (YoY)', value: '2.8%', previousValue: '3.1%', change: '-0.3%', trend: 'down', nextRelease: 'Apr 10' },
    { name: 'Unemployment', value: '4.1%', previousValue: '4.0%', change: '+0.1%', trend: 'up', nextRelease: 'Apr 5' },
    { name: 'GDP Growth (Q4)', value: '2.3%', previousValue: '2.1%', change: '+0.2%', trend: 'up', nextRelease: 'Apr 25' },
    { name: 'Job Openings', value: '8.8M', previousValue: '9.1M', change: '-3.3%', trend: 'down' },
    { name: 'Housing Starts', value: '1.46M', previousValue: '1.42M', change: '+2.8%', trend: 'up' },
    { name: 'Building Permits', value: '1.52M', previousValue: '1.49M', change: '+2.0%', trend: 'up' },
  ], []);

  // Mock news items
  const newsItems: NewsItem[] = useMemo(() => [
    {
      id: '1',
      headline: 'Fed Signals Potential Rate Cut in June as Inflation Cools',
      source: 'Reuters',
      timestamp: '2h ago',
      category: 'rates',
      impact: 'positive',
      summary: 'Federal Reserve officials indicated openness to a rate cut in June if inflation continues to moderate, citing progress toward the 2% target.',
    },
    {
      id: '2',
      headline: 'Atlanta Multifamily Vacancy Hits 3-Year Low at 6.2%',
      source: 'CoStar',
      timestamp: '4h ago',
      category: 'local',
      impact: 'positive',
      summary: 'Strong job growth and limited new supply pushed Atlanta apartment vacancy to its lowest level since 2023, supporting rent growth.',
    },
    {
      id: '3',
      headline: 'Blackstone Acquires 12-Property Atlanta Portfolio for $890M',
      source: 'Commercial Observer',
      timestamp: '6h ago',
      category: 'transactions',
      impact: 'positive',
      summary: 'Major institutional investment signals confidence in Atlanta multifamily market. Cap rates estimated at 4.8-5.2%.',
    },
    {
      id: '4',
      headline: 'Georgia Legislature Passes Rent Control Preemption Bill',
      source: 'AJC',
      timestamp: '1d ago',
      category: 'regulatory',
      impact: 'positive',
      summary: 'New legislation prevents local jurisdictions from implementing rent control measures, providing certainty for investors.',
    },
    {
      id: '5',
      headline: 'Construction Costs Rise 4.2% YoY, Slower Than Expected',
      source: 'ENR',
      timestamp: '1d ago',
      category: 'macro',
      impact: 'neutral',
      summary: 'Construction cost inflation continues to moderate, though labor shortages persist in Southeast markets.',
    },
    {
      id: '6',
      headline: 'Amazon Announces 2,500 New Jobs at Atlanta Tech Hub',
      source: 'WSJ',
      timestamp: '2d ago',
      category: 'local',
      impact: 'positive',
      summary: 'Expansion of Midtown tech campus expected to drive apartment demand in Buckhead and surrounding submarkets.',
    },
    {
      id: '7',
      headline: 'CMBS Delinquencies Tick Up to 4.8% Nationally',
      source: 'Trepp',
      timestamp: '2d ago',
      category: 'rates',
      impact: 'negative',
      summary: 'Office sector continues to drag overall delinquency rates higher, though multifamily remains stable at 1.2%.',
    },
    {
      id: '8',
      headline: 'Fannie Mae Lowers 2026 Multifamily Origination Forecast',
      source: 'MBA',
      timestamp: '3d ago',
      category: 'macro',
      impact: 'negative',
      summary: 'Agency lender reduces volume expectations citing higher rates and slower transaction activity.',
    },
  ], []);

  // Filter news
  const filteredNews = useMemo(() => {
    if (activeFilter === 'all') return newsItems;
    return newsItems.filter(n => n.category === activeFilter);
  }, [newsItems, activeFilter]);

  // Category filters
  const filters = [
    { key: 'all', label: 'All News', icon: Newspaper },
    { key: 'rates', label: 'Rates', icon: Percent },
    { key: 'local', label: 'Local Market', icon: MapPin },
    { key: 'transactions', label: 'Transactions', icon: Building2 },
    { key: 'macro', label: 'Economic', icon: Globe },
    { key: 'regulatory', label: 'Regulatory', icon: AlertTriangle },
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      rates: BT.text.cyan,
      local: BT.text.amber,
      transactions: BT.text.green,
      macro: BT.text.blue,
      regulatory: BT.text.magenta,
    };
    return colors[category] || BT.text.muted;
  };

  const getImpactIcon = (impact: string) => {
    if (impact === 'positive') return <TrendingUp size={14} color={BT.text.green} />;
    if (impact === 'negative') return <TrendingDown size={14} color={BT.text.red} />;
    return <Activity size={14} color={BT.text.muted} />;
  };

  const MapPin = ({ size, color }: { size: number; color: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Market Rates Ticker */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          color: BT.text.amber,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <DollarSign size={14} />
          Market Rates
          <span style={{ 
            marginLeft: 'auto', 
            color: BT.text.dim, 
            fontWeight: 400,
            fontSize: 10,
          }}>
            <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Live / Delayed
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {rates.map((rate) => (
            <div key={rate.name} style={{
              background: BT.bg.cardHover,
              borderRadius: 6,
              padding: '10px 12px',
              border: `1px solid ${BT.border.subtle}`,
            }}>
              <div style={{ 
                fontSize: 10, 
                color: BT.text.muted, 
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}>
                {rate.name}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'baseline', 
                gap: 8,
              }}>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  color: BT.text.primary,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {rate.name.includes('Spread') ? rate.value : `${rate.value}%`}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: rate.direction === 'up' ? BT.text.green : 
                         rate.direction === 'down' ? BT.text.red : BT.text.muted,
                }}>
                  {rate.direction === 'up' ? '▲' : rate.direction === 'down' ? '▼' : '—'}
                  {rate.change !== 0 && ` ${rate.change > 0 ? '+' : ''}${rate.name.includes('Spread') ? rate.change : rate.change.toFixed(2)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Economic Indicators */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          color: BT.text.cyan,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Activity size={14} />
          Economic Indicators
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {indicators.map((ind) => (
            <div key={ind.name} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              background: BT.bg.cardHover,
              borderRadius: 4,
              border: `1px solid ${BT.border.subtle}`,
            }}>
              <div>
                <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 2 }}>
                  {ind.name}
                </div>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: BT.text.primary,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {ind.value}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: ind.trend === 'up' ? BT.text.green : 
                         ind.trend === 'down' ? BT.text.red : BT.text.muted,
                }}>
                  {ind.change}
                </div>
                {ind.nextRelease && (
                  <div style={{ fontSize: 9, color: BT.text.dim }}>
                    Next: {ind.nextRelease}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* News Feed */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
        flex: 1,
      }}>
        {/* Filter Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <Newspaper size={14} color={BT.text.amber} />
          <span style={{ 
            color: BT.text.amber,
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: 8,
          }}>
            News Feed
          </span>
          
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: activeFilter === filter.key ? BT.bg.highlight : 'transparent',
                border: `1px solid ${activeFilter === filter.key ? BT.text.amber : BT.border.subtle}`,
                borderRadius: 4,
                color: activeFilter === filter.key ? BT.text.amber : BT.text.muted,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <filter.icon size={12} />
              {filter.label}
            </button>
          ))}
        </div>

        {/* News Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredNews.map((item) => (
            <div
              key={item.id}
              onClick={() => setExpandedNews(expandedNews === item.id ? null : item.id)}
              style={{
                padding: 12,
                background: expandedNews === item.id ? BT.bg.cardHover : 'transparent',
                borderRadius: 6,
                border: `1px solid ${BT.border.subtle}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {getImpactIcon(item.impact)}
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 13, 
                    fontWeight: 500, 
                    color: BT.text.primary,
                    marginBottom: 4,
                    lineHeight: 1.4,
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
                      letterSpacing: '0.03em',
                    }}>
                      {item.category}
                    </span>
                    <span>•</span>
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.timestamp}</span>
                  </div>
                  
                  {/* Expanded summary */}
                  {expandedNews === item.id && item.summary && (
                    <div style={{
                      marginTop: 10,
                      padding: 10,
                      background: BT.bg.terminal,
                      borderRadius: 4,
                      fontSize: 12,
                      color: BT.text.secondary,
                      lineHeight: 1.5,
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

      {/* Market Impact Summary */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
        background: `linear-gradient(135deg, ${BT.bg.card} 0%, rgba(245, 158, 11, 0.05) 100%)`,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 12,
          color: BT.text.amber,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Bell size={14} />
          Market Impact Assessment
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Rate Environment</div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: BT.text.green,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <TrendingDown size={14} />
              Improving
            </div>
            <div style={{ fontSize: 10, color: BT.text.dim, marginTop: 2 }}>
              Fed signals June cut likely
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Local Demand</div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: BT.text.green,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <TrendingUp size={14} />
              Strong
            </div>
            <div style={{ fontSize: 10, color: BT.text.dim, marginTop: 2 }}>
              Tech job growth accelerating
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Transaction Activity</div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: BT.text.amber,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Activity size={14} />
              Moderate
            </div>
            <div style={{ fontSize: 10, color: BT.text.dim, marginTop: 2 }}>
              Institutional buyers active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsTab;
