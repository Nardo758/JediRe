/**
 * MSANewsTab - Metro market news, alerts, sentiment
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Newspaper, TrendingUp, Building2, Briefcase, AlertTriangle, Activity, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalSection } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SignalCommentary } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

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

/* ─── M35 Structured Events Collapsible Subsection ─── */
const M35_EVENTS_PREVIEW = [
  { emoji: '📣', name: 'Amazon HQ2 Tampa', scope: 'Submarket', timing: 'T+8mo', status: 'FIRED', statusColor: '#10B981', metric: 'Rent Growth +1.4pp', metricColor: '#10B981', tracking: 'AHEAD', trackColor: '#10B981' },
  { emoji: '🚆', name: 'BRT Phase 2 Extension', scope: 'Submarket', timing: 'T-4mo', status: 'PENDING', statusColor: '#D97706', metric: 'Cap Rate -25bps', metricColor: '#10B981', tracking: 'ON TARGET', trackColor: '#A0ABBE' },
  { emoji: '📜', name: 'FL Insurance Rate Cap', scope: 'State', timing: 'T+2mo', status: 'FIRED', statusColor: '#10B981', metric: 'OpEx -4.2%', metricColor: '#EF4444', tracking: 'AHEAD', trackColor: '#10B981' },
];

const M35EventsSubsection: React.FC<{ msaName: string }> = ({ msaName }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'market_dashboard', marketId: msaId }
  );

  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginTop: 16 }}>
      {/* Header bar — always visible */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: '#131929', cursor: 'pointer',
          border: '1px solid #1E2538', borderLeft: '3px solid #0891B2',
          borderRadius: expanded ? '4px 4px 0 0' : 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity style={{ width: 14, height: 14, color: '#0891B2' }} />
          <span style={{ color: '#0891B2', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            M35 Structured Events
          </span>
          {expanded
            ? <ChevronDown style={{ width: 14, height: 14, color: '#0891B2' }} />
            : <ChevronRight style={{ width: 14, height: 14, color: '#0891B2' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, fontFamily: 'monospace', color: '#6B7A8D' }}>
          <span><span style={{ color: '#E2E8F0' }}>5</span> active | <span style={{ color: '#E2E8F0' }}>2</span> transformative | Last classified: 3 min ago</span>
          <button
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'none', border: 'none', color: '#0891B2', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Open Full Event Module <ArrowRight style={{ width: 10, height: 10 }} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ background: '#0B0E1A', border: '1px solid #1E2538', borderTop: 'none', borderLeft: '3px solid #0891B2', borderRadius: '0 0 4px 4px', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Event density strip */}
          <div style={{ width: '100%', height: 64, background: '#131929', border: '1px solid #1E2538', position: 'relative', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', padding: '0 12px' }}>
            <div style={{ position: 'absolute', top: 6, width: '100%', left: 0, paddingRight: 32, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7A8D', fontFamily: 'monospace' }}>
              {['T-18mo', 'T-12mo', 'T-6mo', 'TODAY', 'T+6mo', 'T+12mo'].map((l) => (
                <span key={l} style={l === 'TODAY' ? { color: '#0891B2' } : {}}>{l}</span>
              ))}
            </div>
            <div style={{ position: 'absolute', top: '10%', left: '12%', width: 2, height: '50%', background: '#0891B2', borderRadius: 1 }}></div>
            <div style={{ position: 'absolute', top: '25%', left: '30%', width: 2, height: '35%', background: '#6B7A8D', borderRadius: 1 }}></div>
            <div style={{ position: 'absolute', top: '15%', left: '75%', width: 4, height: '55%', background: '#0891B2', borderRadius: 1 }}></div>
            <div style={{ position: 'absolute', top: '30%', left: '85%', width: 2, height: '30%', background: '#6B7A8D', borderRadius: 1 }}></div>
            <div style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: 1, borderLeft: '1px dashed #0891B2', opacity: 0.5 }}></div>
          </div>

          {/* Event cards — 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {M35_EVENTS_PREVIEW.map((ev) => (
              <div
                key={ev.name}
                style={{ background: '#131929', border: '1px solid #1E2538', borderLeft: '3px solid #0891B2', borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: 6, background: '#0B0E1A', borderRadius: 4, fontSize: 14 }}>{ev.emoji}</div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#E2E8F0' }}>{ev.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ padding: '1px 6px', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', background: '#0B0E1A', color: '#6B7A8D', border: '1px solid #1E2538', borderRadius: 2 }}>{ev.scope}</span>
                    <span style={{ padding: '1px 6px', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', background: `${ev.statusColor}1A`, color: ev.statusColor, border: `1px solid ${ev.statusColor}33`, borderRadius: 2 }}>{ev.status}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0891B2' }}></div>
                    <span style={{ fontFamily: 'monospace', color: '#0891B2' }}>{ev.timing}</span>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', background: 'rgba(226,232,240,0.1)', color: '#E2E8F0', padding: '2px 6px', borderRadius: 2 }}>87% CONF</span>
                </div>
                <div style={{ fontSize: 12, color: '#A0ABBE', display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #1E2538', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Primary metric:</span>
                    <span style={{ fontFamily: 'monospace', color: ev.metricColor }}>{ev.metric}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tracking:</span>
                    <span style={{ fontFamily: 'monospace', color: ev.trackColor }}>{ev.tracking}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#0891B2', fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  VIEW FULL IMPACT <ArrowRight style={{ width: 10, height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const MSANewsTab: React.FC<MSANewsTabProps> = ({ msaId, msa }) => {
  const [expandedNews, setExpandedNews] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  useEffect(() => {
    apiClient.get('/georgia/news?limit=25')
      .then((data: { success: boolean; count: number; items: NewsItem[] }) => {
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          setNewsItems(data.items);
        }
      })
      .catch(() => {});
  }, []);

  const marketAlerts: MarketAlert[] = useMemo(() => {
    const highImpact = newsItems.filter(n => n.impact === 'negative' || n.impact === 'positive');
    return highImpact.slice(0, 4).map((n, i) => ({
      id: `derived-${i}`,
      title: n.headline,
      signal: n.category === 'development' ? 'S-02' : n.category === 'transaction' ? 'C-04' : n.category === 'employment' ? 'D-09' : 'M-02',
      severity: n.impact === 'negative' ? 'high' as const : 'medium' as const,
      timestamp: n.timestamp || 'recent',
    }));
  }, [newsItems]);

  const sentimentSummary = useMemo(() => {
    const pos = newsItems.filter(n => n.impact === 'positive').length;
    const neg = newsItems.filter(n => n.impact === 'negative').length;
    const neu = newsItems.filter(n => n.impact === 'neutral').length;
    const total = pos + neg + neu;
    const topPositive = newsItems.find(n => n.impact === 'positive');
    const topNegative = newsItems.find(n => n.impact === 'negative');
    return {
      overall: total === 0 ? 'Insufficient data' : pos > neg ? 'Bullish' : neg > pos ? 'Bearish' : 'Neutral',
      positive: pos,
      neutral: neu,
      negative: neg,
      topSignal: topPositive?.headline || (total === 0 ? 'No signal data' : null),
      topRisk: topNegative?.headline || (total === 0 ? 'No risk data' : null),
    };
  }, [newsItems]);

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
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ ...terminalStyles.sectionTitle }}>
              {msaName} — Market Intelligence
            </h2>
            {newsItems.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · NEWS ALERTS DB</span>
            )}
          </div>
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
          {marketAlerts.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 11, color: BT.text.muted }}>
              No active alerts — alerts are derived from high-impact news items.
            </div>
          )}
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
          {filteredNews.length === 0 && (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
              No market news available for this MSA
            </div>
          )}
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

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating news analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.news_impact && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="risk" commentary={commentary.signalCommentary.news_impact} />
            </div>
          )}
          {commentary.signalCommentary?.demand && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.demand} />
            </div>
          )}
        </div>
      )}

      {/* M35 Structured Events Collapsible Subsection */}
      <M35EventsSubsection msaName={msaName} />
    </div>
  );
};

export default MSANewsTab;
