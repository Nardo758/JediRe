/**
 * Market Risk Panel Component
 * Phase 3, Component 1: Market Risk Visualization
 * 
 * Features:
 * - Interest rate sensitivity analysis
 * - Cap rate expansion modeling
 * - DSCR stress testing
 * - Liquidity and transaction volume tracking
 * - Recession indicators
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Stack,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

interface MarketIndicators {
  current10YrTreasury: number;
  currentCapRate: number;
  capRateExpansionBps: number;
  currentDSCR: number;
  stressedDSCR: number;
  dscrBuffer: number;
  transactionVolumeIndex: number;
  daysOnMarketAvg: number;
  recessionProbability: number;
  yieldCurveSpread: number;
  unemploymentRate: number;
}

interface InterestRateScenario {
  name: string;
  rateChangeBps: number;
  capRateImpactBps: number;
  valueImpactPct: number;
  dscrImpact: number;
  probability: number;
  riskContribution: number;
}

interface MarketRiskData {
  baseScore: number;
  finalScore: number;
  hasData: boolean;
  asOfDate: string;
  indicators: MarketIndicators;
  scenarios: InterestRateScenario[];
}

interface MarketRiskPanelProps {
  tradeAreaId: string;
}

const MarketRiskPanel: React.FC<MarketRiskPanelProps> = ({ tradeAreaId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketRisk, setMarketRisk] = useState<MarketRiskData | null>(null);

  useEffect(() => {
    fetchMarketRisk();
  }, [tradeAreaId]);

  const fetchMarketRisk = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/v1/risk/trade-area/${tradeAreaId}/market`);
      setMarketRisk(data.data.marketRisk);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load market risk data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'success';
    if (score < 60) return 'warning';
    return 'error';
  };

  const getVolumeColor = (index: number) => {
    if (index >= 100) return 'success';
    if (index >= 80) return 'warning';
    return 'error';
  };

  const getDSCRColor = (dscr: number) => {
    if (dscr >= 1.40) return 'success';
    if (dscr >= 1.25) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!marketRisk || !marketRisk.hasData) {
    return <Alert severity="info">No market risk data available</Alert>;
  }

  const indicators = marketRisk.indicators;

  return (
    <Box>
      {/* Risk Score Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Market Risk Score
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h3" color={getRiskColor(marketRisk.finalScore)}>
                  {marketRisk.finalScore.toFixed(1)}
                </Typography>
                <Chip
                  label={marketRisk.finalScore < 40 ? 'Low' : marketRisk.finalScore < 60 ? 'Moderate' : 'High'}
                  color={getRiskColor(marketRisk.finalScore) as any}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={marketRisk.finalScore}
                color={getRiskColor(marketRisk.finalScore) as any}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                10-Year Treasury
              </Typography>
              <Typography variant="h3">{indicators.current10YrTreasury.toFixed(2)}%</Typography>
              <Typography variant="caption" color="text.secondary">
                As of {new Date(marketRisk.asOfDate).toLocaleDateString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Current DSCR
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h3" color={getDSCRColor(indicators.currentDSCR)}>
                  {indicators.currentDSCR.toFixed(2)}x
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Buffer: {indicators.dscrBuffer.toFixed(2)}x
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Recession Probability
              </Typography>
              <Typography variant="h3" color="error">
                {indicators.recessionProbability.toFixed(0)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Next 12 months
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Interest Rate & Cap Rate */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <ShowChartIcon />
            Interest Rate Sensitivity
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Current Cap Rate
                </Typography>
                <Typography variant="h4">{indicators.currentCapRate.toFixed(2)}%</Typography>
                <Typography variant="caption" color="text.secondary">
                  Based on current market conditions
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Expected Cap Rate Expansion
                </Typography>
                <Typography variant="h4" color="warning">
                  +{indicators.capRateExpansionBps} bps
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  If rates rise +100 bps
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            <strong>Cap Rate Sensitivity:</strong> For every 100 basis points increase in interest rates,
            cap rates are expected to expand by approximately {indicators.capRateExpansionBps} basis points.
          </Typography>
        </CardContent>
      </Card>

      {/* DSCR Stress Test */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            DSCR Stress Test
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Current DSCR
                </Typography>
                <Typography variant="h4" color="success">
                  {indicators.currentDSCR.toFixed(2)}x
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current rate environment
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Stressed DSCR (+200 bps)
                </Typography>
                <Typography variant="h4" color={getDSCRColor(indicators.stressedDSCR)}>
                  {indicators.stressedDSCR.toFixed(2)}x
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Under stress scenario
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  DSCR Buffer
                </Typography>
                <Typography variant="h4" color={getDSCRColor(1.25 + indicators.dscrBuffer)}>
                  {indicators.dscrBuffer.toFixed(2)}x
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  To covenant breach (1.25x)
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Alert severity={indicators.dscrBuffer < 0.15 ? 'error' : 'info'} sx={{ mt: 2 }}>
            {indicators.dscrBuffer < 0.15
              ? 'WARNING: Limited buffer to covenant breach. High refinancing risk.'
              : 'DSCR buffer provides adequate cushion against rate increases.'}
          </Alert>
        </CardContent>
      </Card>

      {/* Interest Rate Scenarios */}
      {marketRisk.scenarios.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Interest Rate Scenarios
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Scenario</TableCell>
                    <TableCell align="right">Rate Change</TableCell>
                    <TableCell align="right">Cap Rate Impact</TableCell>
                    <TableCell align="right">Value Impact</TableCell>
                    <TableCell align="right">DSCR</TableCell>
                    <TableCell align="center">Probability</TableCell>
                    <TableCell align="right">Risk Impact</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marketRisk.scenarios.map((scenario, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {scenario.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {scenario.rateChangeBps > 0 ? '+' : ''}{scenario.rateChangeBps} bps
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={scenario.capRateImpactBps > 0 ? 'error' : 'success'}
                        >
                          {scenario.capRateImpactBps > 0 ? '+' : ''}{scenario.capRateImpactBps} bps
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={scenario.valueImpactPct < 0 ? 'error' : 'success'}
                          fontWeight="bold"
                        >
                          {scenario.valueImpactPct.toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={getDSCRColor(scenario.dscrImpact)}>
                          {scenario.dscrImpact.toFixed(2)}x
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${scenario.probability.toFixed(0)}%`}
                          size="small"
                          color={scenario.probability > 50 ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={scenario.riskContribution > 0 ? 'error' : 'text.secondary'}
                        >
                          {scenario.riskContribution > 0 ? '+' : ''}{scenario.riskContribution.toFixed(1)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Market Liquidity */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Market Liquidity & Transaction Volume
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Transaction Volume Index
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h4" color={getVolumeColor(indicators.transactionVolumeIndex)}>
                    {indicators.transactionVolumeIndex}
                  </Typography>
                  <Chip
                    label={indicators.transactionVolumeIndex >= 100 ? 'Healthy' : indicators.transactionVolumeIndex >= 80 ? 'Moderate' : 'Illiquid'}
                    color={getVolumeColor(indicators.transactionVolumeIndex) as any}
                    size="small"
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, indicators.transactionVolumeIndex)}
                  color={getVolumeColor(indicators.transactionVolumeIndex) as any}
                  sx={{ mt: 2 }}
                />
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  100 = Baseline | Current: {indicators.transactionVolumeIndex} (
                  {indicators.transactionVolumeIndex >= 100 ? 'Above' : 'Below'} baseline)
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Days on Market (Avg)
                </Typography>
                <Typography variant="h4">{indicators.daysOnMarketAvg} days</Typography>
                <Typography variant="caption" color="text.secondary">
                  Baseline: 90 days
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recession Indicators */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recession Indicators
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Yield Curve Spread
                </Typography>
                <Typography variant="h4" color={indicators.yieldCurveSpread < 0 ? 'error' : 'success'}>
                  {indicators.yieldCurveSpread > 0 ? '+' : ''}{indicators.yieldCurveSpread.toFixed(2)} bps
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  10-year minus 2-year
                </Typography>
                {indicators.yieldCurveSpread < 0 && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    Inverted yield curve signals potential recession
                  </Alert>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Unemployment Rate
                </Typography>
                <Typography variant="h4">{indicators.unemploymentRate.toFixed(1)}%</Typography>
                <Typography variant="caption" color="text.secondary">
                  Current level
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Recession Probability
                </Typography>
                <Typography variant="h4" color="error">
                  {indicators.recessionProbability.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Next 12 months
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MarketRiskPanel;
