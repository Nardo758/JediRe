/**
 * MSACapitalTab - Transaction volume, cap rate trends, debt markets
 */

import React, { useMemo, useEffect, useState } from 'react';
import { DollarSign, Building2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { TerminalSection, DataTable } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SignalCommentary } from '../../commentary';

interface CapitalApiDeal {
  property: string;
  units: number;
  price: number;
  ppu: number | null;
  cap: number | null;
  buyer: string;
  date: string;
  assetClass?: string;
}

interface CapitalApiCapRate { class: string; current: number | null; dealCount: number; }
interface CapitalApiVolumeYear { year: string; dealCount: number; totalVolume: number; avgPpu: number | null; avgCapRate: number | null; }
interface CapitalApiBuyerActivity { type: string; dealCount: number; pctVolume: number; avgSize: string; }
interface CapitalApiHeadline { dealCount: number; totalVolume: number; avgCapRate: number | null; avgPricePerUnit: number | null; }

interface CapitalApiResponse {
  success: boolean;
  headline: CapitalApiHeadline;
  recentDeals: CapitalApiDeal[];
  capRateByClass: CapitalApiCapRate[];
  buyerActivity: CapitalApiBuyerActivity[];
  volumeByYear: CapitalApiVolumeYear[];
}

interface MSACapitalTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSACapitalTab: React.FC<MSACapitalTabProps> = ({ msaId, msa }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);

  const [capitalData, setCapitalData] = useState<CapitalApiResponse | null>(null);
  const [capitalLoading, setCapitalLoading] = useState(true);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  useEffect(() => {
    setCapitalLoading(true);
    apiClient.get('/georgia/capital/summary?state=GA&months=36')
      .then((data: any) => { if (data.success) setCapitalData(data); })
      .catch(() => {})
      .finally(() => setCapitalLoading(false));
  }, []);

  const volumeData: ChartDataPoint[] = useMemo(() => {
    if (capitalData?.volumeByYear?.length > 0) {
      return capitalData.volumeByYear.map((r: CapitalApiVolumeYear) => ({
        date: r.year,
        volume: r.totalVolume ? Math.round(r.totalVolume / 1_000_000) : 0,
        capRate: r.avgCapRate || null,
      }));
    }
    return [
      { date: 'Q1 24', volume: 850, capRate: 5.4 },
      { date: 'Q2 24', volume: 1100, capRate: 5.3 },
      { date: 'Q3 24', volume: 980, capRate: 5.2 },
      { date: 'Q4 24', volume: 1270, capRate: 5.2 },
      { date: 'Q1 25', volume: 920, capRate: 5.3 },
    ];
  }, [capitalData]);

  const recentDeals = useMemo(() => {
    if (capitalData?.recentDeals?.length > 0) {
      return capitalData.recentDeals.map((d: CapitalApiDeal) => ({
        property: d.property,
        units: d.units,
        price: d.price ? Math.round(d.price / 1_000_000) : 0,
        ppu: d.ppu ? Math.round(d.ppu / 1000) : null,
        cap: d.cap,
        buyer: d.buyer,
        date: d.date,
      }));
    }
    return [
      { property: 'Camden Paces Portfolio', units: 1240, price: 285, ppu: 230, cap: 4.8, buyer: 'Blackstone', date: 'Mar 25' },
      { property: 'Greystar Midtown Collection', units: 890, price: 198, ppu: 222, cap: 5.0, buyer: 'Invesco', date: 'Feb 25' },
      { property: 'The Metropolitan at Phipps', units: 320, price: 85, ppu: 266, cap: 4.8, buyer: 'Blackstone', date: 'Feb 25' },
      { property: 'Alexan Buckhead', units: 290, price: 62, ppu: 214, cap: 5.5, buyer: 'Greystar', date: 'Nov 24' },
    ];
  }, [capitalData]);

  const capRateByClass = useMemo(() => {
    if (capitalData?.capRateByClass?.length > 0) {
      return capitalData.capRateByClass.map((r: CapitalApiCapRate) => ({
        class: r.class,
        current: r.current,
        prior: null,
        change: null,
        spread: null,
      }));
    }
    return [
      { class: 'A', current: 4.6, prior: 4.8, change: -20, spread: 125 },
      { class: 'B+', current: 5.1, prior: 5.4, change: -30, spread: 175 },
      { class: 'B', current: 5.5, prior: 5.8, change: -30, spread: 215 },
      { class: 'B-', current: 5.9, prior: 6.2, change: -30, spread: 255 },
      { class: 'C', current: 6.4, prior: 6.6, change: -20, spread: 305 },
    ];
  }, [capitalData]);

  const debtMarketData = useMemo(() => [
    { lender: 'Agency (Freddie)', rate: '5.85%', ltv: '75%', term: '10yr', spread: '+165', status: 'Active' },
    { lender: 'Agency (Fannie)', rate: '5.90%', ltv: '75%', term: '10yr', spread: '+170', status: 'Active' },
    { lender: 'CMBS', rate: '6.25%', ltv: '70%', term: '10yr', spread: '+205', status: 'Selective' },
    { lender: 'Life Co', rate: '5.70%', ltv: '65%', term: '7yr', spread: '+145', status: 'Active' },
    { lender: 'Bank', rate: '6.50%', ltv: '65%', term: '5yr', spread: '+225', status: 'Tight' },
    { lender: 'Bridge', rate: '7.25%', ltv: '80%', term: '3yr', spread: '+300', status: 'Active' },
  ], []);

  const buyerActivity = useMemo(() => {
    if (capitalData?.buyerActivity?.length > 0) {
      return capitalData.buyerActivity.map((b: CapitalApiBuyerActivity) => ({
        type: b.type,
        pctVolume: b.pctVolume,
        dealCount: b.dealCount,
        avgSize: b.avgSize,
        trend: 'flat',
      }));
    }
    return [
      { type: 'Private Equity', pctVolume: 34, dealCount: 43, avgSize: '$62M', trend: 'up' },
      { type: 'REIT', pctVolume: 22, dealCount: 28, avgSize: '$85M', trend: 'up' },
      { type: 'Institution', pctVolume: 18, dealCount: 12, avgSize: '$142M', trend: 'flat' },
      { type: 'Family Office', pctVolume: 14, dealCount: 26, avgSize: '$38M', trend: 'down' },
      { type: 'Syndicator', pctVolume: 8, dealCount: 14, avgSize: '$22M', trend: 'down' },
      { type: 'Developer', pctVolume: 4, dealCount: 4, avgSize: '$48M', trend: 'flat' },
    ];
  }, [capitalData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Capital Markets
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            Transaction volume, cap rates, debt markets
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            YTD VOLUME
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            {capitalData?.headline?.totalVolume
              ? `$${(capitalData.headline.totalVolume / 1_000_000_000).toFixed(1)}B`
              : `$${(msa.transactionVolume / 1000000000).toFixed(1)}B`}
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+12% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>DEAL COUNT</div>
          <div style={{ ...terminalStyles.metricValue }}>
            {capitalData?.headline?.dealCount ?? 127}
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+8% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            AVG CAP RATE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {capitalData?.headline?.avgCapRate ? `${capitalData.headline.avgCapRate}%` : `${msa.avgCapRate}%`}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>-20 bps vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG $/UNIT</div>
          <div style={{ ...terminalStyles.metricValue }}>
            {capitalData?.headline?.avgPricePerUnit
              ? `$${Math.round(capitalData.headline.avgPricePerUnit / 1000)}K`
              : '$228K'}
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+5% vs LY</div>
        </div>
      </div>

      <TerminalChart
        title="Transaction Volume ($M) & Cap Rate Trend"
        data={volumeData}
        series={[
          { key: 'volume', name: 'Volume ($M)', color: BT.text.green, data: [] },
        ]}
        height={180}
        valueFormatter={(v) => `$${v}M`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TerminalSection title="Cap Rate by Class">
          <DataTable>
            <thead>
              <tr>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Class</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Current</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Prior Yr</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Chg (bps)</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {capRateByClass.map((row) => (
                <tr key={row.class} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>{row.class}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: BT.text.cyan }}>
                    {row.current.toFixed(1)}%
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.muted }}>
                    {row.prior != null ? `${row.prior.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green }}>
                    {row.change != null ? row.change : '—'}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.amber }}>
                    {row.spread != null ? `+${row.spread}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TerminalSection>

        <TerminalSection title="Buyer Composition">
          <DataTable>
            <thead>
              <tr>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Type</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>% Vol</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Deals</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Avg Size</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {buyerActivity.map((row) => (
                <tr key={row.type} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.type}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <div style={{ width: 40, height: 6, background: BT.bg.elevated, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${row.pctVolume * 2.5}%`, background: BT.accent.blue }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono'" }}>{row.pctVolume}%</span>
                    </div>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{row.dealCount}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green }}>{row.avgSize}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      color: row.trend === 'up' ? BT.text.green : row.trend === 'down' ? BT.accent.red : BT.text.muted,
                      fontWeight: 600,
                    }}>
                      {row.trend === 'up' ? '▲' : row.trend === 'down' ? '▼' : '▬'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TerminalSection>
      </div>

      <TerminalSection title="Debt Market Conditions" icon={<DollarSign size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Lender Type</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Rate</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Max LTV</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Term</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Spread</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Availability</th>
            </tr>
          </thead>
          <tbody>
            {debtMarketData.map((row) => (
              <tr key={row.lender} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.lender}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: BT.text.cyan }}>
                  {row.rate}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{row.ltv}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>{row.term}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.amber }}>{row.spread}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    background: row.status === 'Active' ? `${BT.text.green}22` : row.status === 'Tight' ? `${BT.accent.red}22` : `${BT.text.amber}22`,
                    color: row.status === 'Active' ? BT.text.green : row.status === 'Tight' ? BT.accent.red : BT.text.amber,
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TerminalSection>

      <TerminalSection title="Notable Recent Transactions" icon={<Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Property</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Price</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>$/Unit</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Cap</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Buyer</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentDeals.map((deal, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{deal.property}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{deal.units.toLocaleString()}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                  ${deal.price}M
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  ${deal.ppu}K
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan }}>
                  {deal.cap}%
                </td>
                <td style={{ ...terminalStyles.tableCell, color: BT.text.secondary }}>{deal.buyer}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.muted }}>{deal.date}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TerminalSection>

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

export default MSACapitalTab;
