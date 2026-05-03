/**
 * Execution Risk Panel Component
 * Phase 3, Component 1: Execution Risk Visualization
 * 
 * Features:
 * - Cost contingency adequacy
 * - Construction cost inflation tracking
 * - Labor market conditions
 * - Material supply metrics
 * - Historical overrun rates
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
  LinearProgress,
} from '@mui/material';
import {
  Construction as ConstructionIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

interface ExecutionFactors {
  projectType: string;
  estimatedCost: number;
  contingencyPct: number;
  costInflationYoY: number;
  laborAvailability: string;
  contractorAvailability: string;
  wageInflationYoY: number;
  skilledLaborShortage: boolean;
  materialLeadTimesAvg: number;
  materialPriceVolatility: string;
  tariffExposure: boolean;
  contractorFailureRate: number;
  historicalCostOverrunPct: number;
  historicalScheduleOverrunDays: number;
}

interface ExecutionRiskData {
  baseScore: number;
  finalScore: number;
  hasData: boolean;
  asOfDate: string;
  factors: ExecutionFactors;
  costTrends: any[];
}

interface ExecutionRiskPanelProps {
  tradeAreaId: string;
}

const ExecutionRiskPanel: React.FC<ExecutionRiskPanelProps> = ({ tradeAreaId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionRisk, setExecutionRisk] = useState<ExecutionRiskData | null>(null);

  useEffect(() => {
    fetchExecutionRisk();
  }, [tradeAreaId]);

  const fetchExecutionRisk = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/v1/risk/trade-area/${tradeAreaId}/execution`);
      setExecutionRisk(data.data.executionRisk);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load execution risk data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'success';
    if (score < 60) return 'warning';
    return 'error';
  };

  const getContingencyColor = (pct: number) => {
    if (pct >= 10) return 'success';
    if (pct >= 8) return 'warning';
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

  if (!executionRisk || !executionRisk.hasData) {
    return <Alert severity="info">No execution risk data available</Alert>;
  }

  const factors = executionRisk.factors;

  return (
    <Box>
      {/* Risk Score Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Execution Risk Score
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h3" color={getRiskColor(executionRisk.finalScore)}>
                  {executionRisk.finalScore.toFixed(1)}
                </Typography>
                <Chip
                  label={executionRisk.finalScore < 40 ? 'Low' : executionRisk.finalScore < 60 ? 'Moderate' : 'High'}
                  color={getRiskColor(executionRisk.finalScore) as any}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={executionRisk.finalScore}
                color={getRiskColor(executionRisk.finalScore) as any}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Contingency Budget
              </Typography>
              <Typography variant="h3" color={getContingencyColor(factors.contingencyPct)}>
                {factors.contingencyPct.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {factors.contingencyPct >= 10 ? 'Adequate' : factors.contingencyPct >= 8 ? 'Moderate' : 'Low'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Cost Inflation YoY
              </Typography>
              <Typography variant="h3" color="error">
                +{factors.costInflationYoY.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Construction costs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Historical Overrun
              </Typography>
              <Typography variant="h3" color="warning">
                {factors.historicalCostOverrunPct.toFixed(0)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Avg cost overrun
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cost Contingency */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <ConstructionIcon />
            Cost Contingency Analysis
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Project Type</Typography>
              <Typography variant="h6">{factors.projectType?.replace(/_/g, ' ').toUpperCase()}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Estimated Cost</Typography>
              <Typography variant="h6">${factors.estimatedCost?.toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Contingency Budget</Typography>
              <Typography variant="h6" color={getContingencyColor(factors.contingencyPct)}>
                {factors.contingencyPct}% (${(factors.estimatedCost * factors.contingencyPct / 100).toLocaleString()})
              </Typography>
            </Grid>
          </Grid>

          <Alert severity={factors.contingencyPct < 8 ? 'error' : 'info'} sx={{ mt: 2 }}>
            {factors.contingencyPct < 8
              ? 'WARNING: Low contingency budget. High risk of cost overruns given current market conditions.'
              : 'Contingency budget provides adequate cushion for unexpected costs.'}
          </Alert>
        </CardContent>
      </Card>

      {/* Labor Market */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Labor Market Conditions</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Labor Availability</Typography>
              <Chip label={factors.laborAvailability} color={factors.laborAvailability === 'tight' ? 'error' : 'success'} />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Contractor Availability</Typography>
              <Chip label={factors.contractorAvailability} color={factors.contractorAvailability === 'scarce' ? 'error' : 'success'} />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Wage Inflation YoY</Typography>
              <Typography variant="h6" color="error">+{factors.wageInflationYoY}%</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Skilled Labor Shortage</Typography>
              <Chip label={factors.skilledLaborShortage ? 'Yes' : 'No'} color={factors.skilledLaborShortage ? 'error' : 'success'} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Material Supply */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Material Supply & Pricing</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Avg Lead Times</Typography>
              <Typography variant="h6">{factors.materialLeadTimesAvg} days</Typography>
              <Typography variant="caption" color="text.secondary">Baseline: 30 days</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Price Volatility</Typography>
              <Chip label={factors.materialPriceVolatility} color={factors.materialPriceVolatility === 'high' ? 'error' : 'warning'} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Tariff Exposure</Typography>
              <Chip label={factors.tariffExposure ? 'Yes (Steel/Aluminum)' : 'No'} color={factors.tariffExposure ? 'error' : 'success'} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Historical Performance */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Historical Overrun Rates</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Cost Overrun (Avg)</Typography>
              <Typography variant="h4" color="warning">{factors.historicalCostOverrunPct}%</Typography>
              <Typography variant="caption" color="text.secondary">By jurisdiction & type</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Schedule Delay (Avg)</Typography>
              <Typography variant="h4" color="warning">{factors.historicalScheduleOverrunDays} days</Typography>
              <Typography variant="caption" color="text.secondary">By jurisdiction & type</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Contractor Failure Rate</Typography>
              <Typography variant="h4" color="error">{factors.contractorFailureRate}%</Typography>
              <Typography variant="caption" color="text.secondary">Recent failures in area</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExecutionRiskPanel;
