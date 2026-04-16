/**
 * TrafficTab - Leasing predictions, digital traffic, walk-in forecast
 * Integrates: LeasingTrafficCard, DigitalTrafficCard from analytics/
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Users, Eye, TrendingUp, Calendar, Target, Activity } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { TerminalChart, ChartDataPoint, ChartSeries } from '../TerminalChart';
import { apiClient } from '@/services/api.client';

interface TrafficTabProps {
  dealId: string;
  deal: any;
}

interface LeasingPrediction {
  property_id: string;
  week_ending: string;
  weekly_inquiries: number;
  weekly_tours: number;
  tours_conversion_rate: number;
  net_leases: number;
  closing_ratio: number;
  property_units: number;
  current_occupancy: number;
  baseline_type: string;
  confidence: number;
  confidence_tier: string;
}

interface ForecastWeek {
  week: number;
  inquiries: number;
  tours: number;
  leases: number;
}

export const TrafficTab: React.FC<TrafficTabProps> = ({ dealId, deal }) => {
  const [prediction, setPrediction] = useState<LeasingPrediction | null>(null);
  const [forecast, setForecast] = useState<ForecastWeek[]>([]);
  const [digitalScore, setDigitalScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const propertyId = deal?.properties?.[0]?.id || dealId;

  // Load traffic data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load leasing prediction
        const predRes = await apiClient.get(`/api/v1/leasing-traffic/predict/${propertyId}`);
        if (predRes.data?.prediction) {
          setPrediction(predRes.data.prediction);
        }

        // Load 12-week forecast
        const forecastRes = await apiClient.get(`/api/v1/leasing-traffic/forecast/${propertyId}?weeks=12`);
        if (forecastRes.data?.forecast?.weeks) {
          setForecast(forecastRes.data.forecast.weeks);
        }

        // Load digital score
        const digitalRes = await apiClient.get(`/api/v1/event-tracking/digital-score/${propertyId}`);
        if (digitalRes.data?.score) {
          setDigitalScore(digitalRes.data.score);
        }
      } catch (err) {
        console.error('Failed to load traffic data:', err);
        // Use mock data for demo
        setPrediction({
          property_id: propertyId,
          week_ending: new Date().toISOString(),
          weekly_inquiries: 45,
          weekly_tours: 18,
          tours_conversion_rate: 40,
          net_leases: 3,
          closing_ratio: 16.7,
          property_units: deal?.target_units || 300,
          current_occupancy: 0.94,
          baseline_type: 'market_derived',
          confidence: 0.85,
          confidence_tier: 'high',
        });
        setForecast(Array.from({ length: 12 }, (_, i) => ({
          week: i + 1,
          inquiries: 40 + Math.floor(Math.random() * 15),
          tours: 15 + Math.floor(Math.random() * 8),
          leases: 2 + Math.floor(Math.random() * 3),
        })));
        setDigitalScore(72);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [propertyId, deal]);

  // Chart data for forecast
  const chartData: ChartDataPoint[] = useMemo(() => {
    return forecast.map(w => ({
      date: `Week ${w.week}`,
      inquiries: w.inquiries,
      tours: w.tours,
      leases: w.leases,
    }));
  }, [forecast]);

  const chartSeries: ChartSeries[] = [
    { key: 'inquiries', name: 'Inquiries', color: BT.text.cyan, data: [] },
    { key: 'tours', name: 'Tours', color: BT.text.amber, data: [] },
    { key: 'leases', name: 'Leases', color: BT.text.green, data: [] },
  ];

  // Totals
  const forecastTotals = useMemo(() => {
    return forecast.reduce((acc, w) => ({
      inquiries: acc.inquiries + w.inquiries,
      tours: acc.tours + w.tours,
      leases: acc.leases + w.leases,
    }), { inquiries: 0, tours: 0, leases: 0 });
  }, [forecast]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: 300,
        color: BT.text.muted,
      }}>
        Loading traffic data...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* This Week Section */}
      <div>
        <div style={terminalStyles.sectionLabel}>THIS WEEK'S PREDICTION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {/* Traffic */}
          <div style={terminalStyles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Users size={14} style={{ color: BT.text.cyan }} />
              <span style={terminalStyles.metricLabel}>TRAFFIC</span>
            </div>
            <div style={terminalStyles.metricValue}>{prediction?.weekly_inquiries || 0}</div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>visitors</div>
          </div>

          {/* Tours */}
          <div style={terminalStyles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Eye size={14} style={{ color: BT.text.amber }} />
              <span style={terminalStyles.metricLabel}>TOURS</span>
            </div>
            <div style={terminalStyles.metricValue}>{prediction?.weekly_tours || 0}</div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>
              {prediction?.tours_conversion_rate}% conv
            </div>
          </div>

          {/* Net Leases */}
          <div style={terminalStyles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Target size={14} style={{ color: BT.text.green }} />
              <span style={terminalStyles.metricLabel}>NET LEASES</span>
            </div>
            <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
              {prediction?.net_leases}-{(prediction?.net_leases || 0) + 1}
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>leases</div>
          </div>

          {/* Closing Ratio */}
          <div style={terminalStyles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TrendingUp size={14} style={{ color: BT.text.purple }} />
              <span style={terminalStyles.metricLabel}>CLOSING RATIO</span>
            </div>
            <div style={terminalStyles.metricValue}>{prediction?.closing_ratio}%</div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>tour-to-lease</div>
          </div>

          {/* Digital Score */}
          <div style={{
            ...terminalStyles.card,
            background: `linear-gradient(135deg, ${BT.bg.panelAlt}, ${BT.bg.panel})`,
            borderColor: digitalScore && digitalScore >= 70 ? BT.text.green : BT.text.amber,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Activity size={14} style={{ color: digitalScore && digitalScore >= 70 ? BT.text.green : BT.text.amber }} />
              <span style={terminalStyles.metricLabel}>DIGITAL SCORE</span>
            </div>
            <div style={{
              ...terminalStyles.metricValue,
              color: digitalScore && digitalScore >= 70 ? BT.text.green : digitalScore && digitalScore >= 50 ? BT.text.amber : BT.text.red,
            }}>
              {digitalScore || '--'}
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>
              {digitalScore && digitalScore >= 70 ? 'Hot' : digitalScore && digitalScore >= 50 ? 'Active' : 'Moderate'}
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Badge */}
      {prediction && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: BT.bg.panel,
          borderRadius: 6,
          border: `1px solid ${BT.border.subtle}`,
        }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>
            Baseline: {prediction.baseline_type}
          </span>
          <span style={{ color: BT.border.medium }}>|</span>
          <span style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            background: prediction.confidence_tier === 'high' 
              ? 'rgba(0, 210, 106, 0.15)' 
              : 'rgba(245, 166, 35, 0.15)',
            color: prediction.confidence_tier === 'high' ? BT.text.green : BT.text.amber,
          }}>
            {prediction.confidence_tier.toUpperCase()} CONFIDENCE ({Math.round(prediction.confidence * 100)}%)
          </span>
        </div>
      )}

      {/* 12-Week Forecast Chart */}
      <TerminalChart
        title="12-Week Leasing Forecast"
        data={chartData}
        series={chartSeries}
        height={250}
        timeRanges={['4W', '8W', '12W']}
        defaultRange="12W"
      />

      {/* Forecast Summary */}
      <div>
        <div style={terminalStyles.sectionLabel}>FORECAST SUMMARY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={terminalStyles.card}>
            <div style={terminalStyles.metricLabel}>TOTAL INQUIRIES</div>
            <div style={{ ...terminalStyles.metricValue, fontSize: 20, marginTop: 8 }}>
              {forecastTotals.inquiries}
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>12-week total</div>
          </div>
          <div style={terminalStyles.card}>
            <div style={terminalStyles.metricLabel}>TOTAL TOURS</div>
            <div style={{ ...terminalStyles.metricValue, fontSize: 20, marginTop: 8 }}>
              {forecastTotals.tours}
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>12-week total</div>
          </div>
          <div style={terminalStyles.card}>
            <div style={terminalStyles.metricLabel}>TOTAL LEASES</div>
            <div style={{ ...terminalStyles.metricValue, fontSize: 20, marginTop: 8, color: BT.text.green }}>
              {forecastTotals.leases}
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>12-week total</div>
          </div>
          <div style={terminalStyles.card}>
            <div style={terminalStyles.metricLabel}>ANNUAL PROJECTION</div>
            <div style={{ ...terminalStyles.metricValue, fontSize: 20, marginTop: 8 }}>
              {Math.round(forecastTotals.leases * (52 / 12))}
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted }}>leases/year</div>
          </div>
        </div>
      </div>

      {/* Leasing Funnel Visualization */}
      <div>
        <div style={terminalStyles.sectionLabel}>LEASING FUNNEL</div>
        <div style={{
          ...terminalStyles.card,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Funnel stages */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Inquiries */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: BT.text.muted }}>Inquiries</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.cyan }}>
                  {prediction?.weekly_inquiries || 0}
                </span>
              </div>
              <div style={{
                height: 8,
                background: BT.bg.panelAlt,
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: BT.text.cyan,
                  borderRadius: 4,
                }} />
              </div>
            </div>

            {/* Tours */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: BT.text.muted }}>Tours</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.amber }}>
                  {prediction?.weekly_tours || 0} ({prediction?.tours_conversion_rate}%)
                </span>
              </div>
              <div style={{
                height: 8,
                background: BT.bg.panelAlt,
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${prediction?.tours_conversion_rate || 0}%`,
                  height: '100%',
                  background: BT.text.amber,
                  borderRadius: 4,
                }} />
              </div>
            </div>

            {/* Leases */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: BT.text.muted }}>Leases</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.green }}>
                  {prediction?.net_leases || 0} ({prediction?.closing_ratio}%)
                </span>
              </div>
              <div style={{
                height: 8,
                background: BT.bg.panelAlt,
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${prediction?.closing_ratio || 0}%`,
                  height: '100%',
                  background: BT.text.green,
                  borderRadius: 4,
                }} />
              </div>
            </div>
          </div>

          {/* Conversion arrows */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '0 20px',
            borderLeft: `1px solid ${BT.border.subtle}`,
          }}>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Tour Rate</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.amber }}>
              {prediction?.tours_conversion_rate || 0}%
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 8 }}>Close Rate</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green }}>
              {prediction?.closing_ratio || 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficTab;
