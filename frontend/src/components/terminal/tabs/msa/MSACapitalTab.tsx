/**
 * MSACapitalTab - Transaction volume, cap rate trends, debt markets
 */

import React, { useMemo, useEffect, useState } from 'react';

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'cap_rates', marketId: msaId }
  );
import { DollarSign, Building2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { TerminalSection, DataTable } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SignalCommentary } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

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

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  useEffect(() => {
    apiClient.get('/georgia/capital/summary?state=GA&months=36')
      .then((data: CapitalApiResponse) => { if (data.success) setCapitalData(data); })
      .catch(() => {});
  }, []);

  const volumeData: ChartDataPoint[] = useMemo(() => {
    if (capitalData?.volumeByYear?.length > 0) {
      return capitalData.volumeByYear.map((r: CapitalApiVolumeYear) => ({
        date: r.year,
        volume: r.totalVolume ? Math.round(r.totalVolume / 1_000_000) : 0,
        capRate: r.avgCapRate || null,
      }));
    }
    return [];
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
    return [];
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
    return [];
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
    return [];
  }, [capitalData]);

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
              {msaName} — Capital Markets
            </h2>
            {capitalData?.success && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · GA COUNTY DATA</span>
            )}
          </div>
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
              : '—'}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>From county sales data</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>DEAL COUNT</div>
          <div style={{ ...terminalStyles.metricValue }}>
            {capitalData?.headline?.dealCount ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>Transactions recorded</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            AVG CAP RATE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {capitalData?.headline?.avgCapRate ? `${capitalData.headline.avgCapRate}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>From sale comps</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG $/UNIT</div>
          <div style={{ ...terminalStyles.metricValue }}>
            {capitalData?.headline?.avgPricePerUnit
              ? `$${Math.round(capitalData.headline.avgPricePerUnit / 1000)}K`
              : '—'}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>From sale comps</div>
        </div>
      </div>

      {volumeData.length > 0 ? (
        <TerminalChart
          title="Transaction Volume ($M) & Cap Rate Trend"
          data={volumeData}
          series={[
            { key: 'volume', name: 'Volume ($M)', color: BT.text.green, data: [] },
          ]}
          height={180}
          valueFormatter={(v) => `$${v}M`}
        />
      ) : (
        <div style={{ ...terminalStyles.card, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>Transaction Volume & Cap Rate Trend</div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>No historical transaction data — populate via Georgia county sales ingestion.</div>
        </div>
      )}

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
              {capRateByClass.length === 0 && (
                <tr><td colSpan={5} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted, padding: '16px 0' }}>
                  No cap rate data — requires transaction volume from county sales data.
                </td></tr>
              )}
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
              {buyerActivity.length === 0 && (
                <tr><td colSpan={5} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted, padding: '16px 0' }}>
                  No buyer composition data — requires transaction records from county data.
                </td></tr>
              )}
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

      <TerminalSection title="Debt Market Conditions — Indicative National Benchmarks" icon={<DollarSign size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
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
            {recentDeals.length === 0 && (
              <tr><td colSpan={7} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted, padding: '20px 0' }}>
                No transaction data available — populate via Georgia county sales ingestion.
              </td></tr>
            )}
            {recentDeals.map((deal, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{deal.property}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{deal.units.toLocaleString()}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                  ${deal.price}M
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {deal.ppu != null ? `$${deal.ppu}K` : '—'}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan }}>
                  {deal.cap != null ? `${deal.cap}%` : '—'}
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
