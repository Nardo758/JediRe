/**
 * Scenario Comparison Component
 * Phase 3, Component 2: Evidence-Based Scenario Generation
 * 
 * Features:
 * - Side-by-side Bull/Base/Bear/Stress comparison
 * - Color-coded metrics (green = good, red = bad)
 * - Key assumptions display
 * - Click to expand full event details
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  TrendingUp as BullIcon,
  TrendingDown as BearIcon,
  Remove as BaseIcon,
  Warning as StressIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface ScenarioData {
  scenarioType: string;
  scenarioName: string;
  irrPct: number;
  cocYear5: number;
  npv: number;
  cashFlowYear5: number;
  assumptions: {
    rentGrowthPct: number;
    vacancyPct: number;
    exitCapPct: number;
  };
  eventCount: number;
  keyAssumptions: string;
  eventSummary: string;
  riskSummary: string;
}

interface ScenarioComparison {
  dealId: string;
  dealName: string;
  scenarios: {
    bull?: ScenarioData;
    base?: ScenarioData;
    bear?: ScenarioData;
    stress?: ScenarioData;
  };
  ranges: {
    irrMin: number;
    irrMax: number;
    irrSpread: number;
    npvMin: number;
    npvMax: number;
  };
}

interface ScenarioComparisonProps {
  dealId: string;
  onScenarioClick?: (scenarioType: string) => void;
}

const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({ dealId, onScenarioClick }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioData | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchComparison();
  }, [dealId]);

  const fetchComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/v1/scenarios/${dealId}/comparison`);
      setComparison(data.data);
    } catch (err: any) {
      // If no scenarios exist, offer to generate them
      if (err.response?.status === 404 || err.response?.data?.error?.includes('not found')) {
        setError('no_scenarios');
      } else {
        setError(err.message || 'Failed to load scenario comparison');
      }
      console.error('Error fetching scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateScenarios = async () => {
    try {
      setLoading(true);
      setError(null);

      await axios.post(`/api/v1/scenarios/generate/${dealId}`);
      
      // Refresh comparison
      await fetchComparison();
    } catch (err: any) {
      setError(err.message || 'Failed to generate scenarios');
      console.error('Error generating scenarios:', err);
      setLoading(false);
    }
  };

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'bull':
        return <BullIcon sx={{ color: '#4caf50', fontSize: 28 }} />;
      case 'base':
        return <BaseIcon sx={{ color: '#2196f3', fontSize: 28 }} />;
      case 'bear':
        return <BearIcon sx={{ color: '#ff9800', fontSize: 28 }} />;
      case 'stress':
        return <StressIcon sx={{ color: '#f44336', fontSize: 28 }} />;
      default:
        return null;
    }
  };

  const getScenarioColor = (type: string): string => {
    switch (type) {
      case 'bull':
        return '#4caf50';
      case 'base':
        return '#2196f3';
      case 'bear':
        return '#ff9800';
      case 'stress':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const formatMetricColor = (
    value: number,
    metricType: 'irr' | 'coc' | 'npv',
    ranges: ScenarioComparison['ranges']
  ): string => {
    if (metricType === 'irr') {
      const threshold = (ranges.irrMax + ranges.irrMin) / 2;
      return value >= threshold ? '#4caf50' : value >= ranges.irrMin + ranges.irrSpread * 0.25 ? '#ff9800' : '#f44336';
    }
    
    if (metricType === 'coc') {
      return value >= 2.0 ? '#4caf50' : value >= 1.5 ? '#ff9800' : '#f44336';
    }
    
    if (metricType === 'npv') {
      return value >= 0 ? '#4caf50' : '#f44336';
    }
    
    return '#9e9e9e';
  };

  const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const handleScenarioClick = (scenario: ScenarioData) => {
    setSelectedScenario(scenario);
    setDetailsOpen(true);
    if (onScenarioClick) {
      onScenarioClick(scenario.scenarioType);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error === 'no_scenarios') {
    return (
      <Card>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            No scenarios generated yet. Click below to generate Bull/Base/Bear/Stress scenarios based on market intelligence.
          </Alert>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={generateScenarios}
            fullWidth
          >
            Generate Scenarios
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={fetchComparison}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  if (!comparison) {
    return null;
  }

  const scenarios = ['bull', 'base', 'bear', 'stress']
    .map(type => comparison.scenarios[type as keyof typeof comparison.scenarios])
    .filter(s => s !== undefined) as ScenarioData[];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Scenario Analysis: {comparison.dealName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Evidence-based scenarios generated from market intelligence and news events
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={generateScenarios}
          size="small"
        >
          Regenerate
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                IRR Range
              </Typography>
              <Typography variant="h4">
                {comparison.ranges.irrMin.toFixed(1)}% - {comparison.ranges.irrMax.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Spread: {comparison.ranges.irrSpread.toFixed(1)} percentage points
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                NPV Range
              </Typography>
              <Typography variant="h4">
                {formatCurrency(comparison.ranges.npvMin)} - {formatCurrency(comparison.ranges.npvMax)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Difference: {formatCurrency(comparison.ranges.npvMax - comparison.ranges.npvMin)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Comparison Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Metric</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center" 
                  sx={{ 
                    fontWeight: 'bold',
                    borderLeft: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f9f9f9' }
                  }}
                  onClick={() => handleScenarioClick(scenario)}
                >
                  <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                    {getScenarioIcon(scenario.scenarioType)}
                    <Typography variant="body2" sx={{ color: getScenarioColor(scenario.scenarioType) }}>
                      {scenario.scenarioType.toUpperCase()}
                    </Typography>
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* IRR */}
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>IRR</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ 
                    backgroundColor: `${formatMetricColor(scenario.irrPct, 'irr', comparison.ranges)}22`,
                    borderLeft: '1px solid #e0e0e0',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                  }}
                >
                  {scenario.irrPct.toFixed(1)}%
                </TableCell>
              ))}
            </TableRow>

            {/* CoC Year 5 */}
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Cash-on-Cash (Year 5)</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ 
                    backgroundColor: `${formatMetricColor(scenario.cocYear5, 'coc', comparison.ranges)}22`,
                    borderLeft: '1px solid #e0e0e0',
                    fontWeight: 'bold',
                  }}
                >
                  {scenario.cocYear5.toFixed(2)}x
                </TableCell>
              ))}
            </TableRow>

            {/* NPV */}
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Net Present Value</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ 
                    backgroundColor: `${formatMetricColor(scenario.npv, 'npv', comparison.ranges)}22`,
                    borderLeft: '1px solid #e0e0e0',
                    fontWeight: 'bold',
                  }}
                >
                  {formatCurrency(scenario.npv)}
                </TableCell>
              ))}
            </TableRow>

            {/* Cash Flow Year 5 */}
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Cash Flow (Year 5)</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ borderLeft: '1px solid #e0e0e0' }}
                >
                  {formatCurrency(scenario.cashFlowYear5)}
                </TableCell>
              ))}
            </TableRow>

            {/* Divider */}
            <TableRow>
              <TableCell colSpan={5} sx={{ backgroundColor: '#f5f5f5', py: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">Assumptions</Typography>
              </TableCell>
            </TableRow>

            {/* Rent Growth */}
            <TableRow>
              <TableCell>Rent Growth</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ borderLeft: '1px solid #e0e0e0' }}
                >
                  {formatPercent(scenario.assumptions.rentGrowthPct)}
                </TableCell>
              ))}
            </TableRow>

            {/* Vacancy */}
            <TableRow>
              <TableCell>Vacancy Rate</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ borderLeft: '1px solid #e0e0e0' }}
                >
                  {formatPercent(scenario.assumptions.vacancyPct)}
                </TableCell>
              ))}
            </TableRow>

            {/* Exit Cap */}
            <TableRow>
              <TableCell>Exit Cap Rate</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ borderLeft: '1px solid #e0e0e0' }}
                >
                  {formatPercent(scenario.assumptions.exitCapPct)}
                </TableCell>
              ))}
            </TableRow>

            {/* Event Count */}
            <TableRow>
              <TableCell>Events Included</TableCell>
              {scenarios.map(scenario => (
                <TableCell 
                  key={scenario.scenarioType} 
                  align="center"
                  sx={{ borderLeft: '1px solid #e0e0e0' }}
                >
                  <Chip 
                    label={scenario.eventCount} 
                    size="small" 
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Scenario Details Dialog */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedScenario && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={1}>
                {getScenarioIcon(selectedScenario.scenarioType)}
                <Typography variant="h6">
                  {selectedScenario.scenarioName}
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Key Assumptions
                </Typography>
                <Typography variant="body2">
                  {selectedScenario.keyAssumptions}
                </Typography>
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Events Summary
                </Typography>
                <Typography variant="body2">
                  {selectedScenario.eventSummary}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Risk Summary
                </Typography>
                <Typography variant="body2">
                  {selectedScenario.riskSummary}
                </Typography>
              </Box>

              <Box mt={3}>
                <Alert severity="info" icon={<InfoIcon />}>
                  This scenario is based on {selectedScenario.eventCount} market events and intelligence signals.
                  Click "View Details" to see the full event list and assumptions.
                </Alert>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
              <Button 
                variant="contained" 
                onClick={() => {
                  // Navigate to full scenario details page
                  window.location.href = `/scenarios/${dealId}/${selectedScenario.scenarioType}`;
                }}
              >
                View Full Details
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ScenarioComparison;
