/**
 * SubmarketCapitalTab - Debt market activity, recent transactions
 */

import React, { useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, Building2, Calendar } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface SubmarketCapitalTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

interface Transaction {
  id: string;
  property: string;
  units: number;
  salePrice: number;
  pricePerUnit: number;
  capRate: number;
  buyer: string;
  seller: string;
  date: string;
}

export const SubmarketCapitalTab: React.FC<SubmarketCapitalTabProps> = ({ submarketId, submarket }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'cap_rates', submarketId: submarketId }
  );

  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);
  useEffect(() => { fetchCommentary('submarket', submarketId, submarket.name); }, [submarketId, submarket.name]);
  const transactions: Transaction[] = useMemo(() => [
    { id: '1', property: 'The Metropolitan at Phipps', units: 320, salePrice: 85000000, pricePerUnit: 265625, capRate: 4.8, buyer: 'Blackstone', seller: 'AvalonBay', date: '2025-02' },
    { id: '2', property: 'Alexan Buckhead', units: 290, salePrice: 62000000, pricePerUnit: 213793, capRate: 5.5, buyer: 'Greystar', seller: 'Trammell Crow', date: '2024-11' },
    { id: '3', property: 'Camden Paces', units: 385, salePrice: 78500000, pricePerUnit: 203896, capRate: 5.2, buyer: 'Starwood', seller: 'Camden', date: '2024-08' },
    { id: '4', property: 'Windsor Buckhead', units: 275, salePrice: 52000000, pricePerUnit: 189091, capRate: 5.6, buyer: 'Invesco', seller: 'Windsor Communities', date: '2024-05' },
  ], []);

  const summary = useMemo(() => ({
    totalVolume: transactions.reduce((sum, t) => sum + t.salePrice, 0),
    avgCapRate: transactions.reduce((sum, t) => sum + t.capRate, 0) / transactions.length,
    avgPPU: transactions.reduce((sum, t) => sum + t.pricePerUnit, 0) / transactions.length,
    dealCount: transactions.length,
  }), [transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            TRANSACTION VOL (TTM)
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            ${(summary.totalVolume / 1000000).toFixed(0)}M
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>DEAL COUNT</div>
          <div style={{ ...terminalStyles.metricValue }}>{summary.dealCount}</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            AVG CAP RATE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {summary.avgCapRate.toFixed(1)}%
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG $/UNIT</div>
          <div style={{ ...terminalStyles.metricValue }}>
            ${(summary.avgPPU / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Recent Transactions
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Property</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Price</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>$/Unit</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Cap</th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Buyer</th>
              <th style={{ ...terminalStyles.th, textAlign: 'center' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, fontWeight: 600, color: BT.text.primary }}>
                  {tx.property}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{tx.units}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: BT.text.green, fontWeight: 600 }}>
                  ${(tx.salePrice / 1000000).toFixed(1)}M
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                  ${(tx.pricePerUnit / 1000).toFixed(0)}K
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>
                  {tx.capRate}%
                </td>
                <td style={{ ...terminalStyles.td, color: BT.text.secondary }}>{tx.buyer}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'center', color: BT.text.muted }}>{tx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debt Market */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <DollarSign size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Debt Market Conditions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ padding: 12, background: BT.bg.cardHover, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>Agency (Fannie/Freddie)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green }}>5.8-6.2%</div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>65-80% LTV</div>
          </div>
          <div style={{ padding: 12, background: BT.bg.cardHover, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>CMBS</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.amber }}>6.5-7.2%</div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>60-75% LTV</div>
          </div>
          <div style={{ padding: 12, background: BT.bg.cardHover, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>Bridge/Mezzanine</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.red }}>8.5-10%</div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>70-85% LTC</div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating capital analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.capital_sentiment && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="position" commentary={commentary.signalCommentary.capital_sentiment} />
            </div>
          )}
          {commentary.signalCommentary?.risk && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="risk" commentary={commentary.signalCommentary.risk} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketCapitalTab;
