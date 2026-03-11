/**
 * Regulatory Risk Panel Component
 * Phase 3, Component 1: Regulatory Risk Visualization
 * 
 * Features:
 * - Active regulatory events with stage tracking
 * - Legislation probability weighting
 * - Zoning changes (upzone/downzone)
 * - Tax policy impacts
 * - Timeline visualization
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
  Tooltip,
  LinearProgress,
  Stack,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

interface RegulatoryEvent {
  id: string;
  name: string;
  type: string;
  stage: string;
  stageProbability: number;
  impact: number;
  severity: string;
  effectiveDate: string;
}

interface ZoningChange {
  id: string;
  address: string;
  current_zoning: string;
  proposed_zoning: string;
  zoning_change_type: string;
  impact_type: string;
  risk_score_impact: number;
  status: string;
  hearing_date: string;
}

interface TaxPolicyChange {
  id: string;
  tax_type: string;
  jurisdiction_name: string;
  previous_rate: number;
  new_rate: number;
  rate_change_pct: number;
  estimated_annual_cost_impact: number;
  effective_date: string;
  description: string;
}

interface RegulatoryRiskData {
  baseScore: number;
  finalScore: number;
  activeEvents: number;
  totalRiskImpact: number;
  events: RegulatoryEvent[];
}

interface RegulatoryRiskPanelProps {
  tradeAreaId: string;
}

const RegulatoryRiskPanel: React.FC<RegulatoryRiskPanelProps> = ({ tradeAreaId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regulatoryRisk, setRegulatoryRisk] = useState<RegulatoryRiskData | null>(null);
  const [zoningChanges, setZoningChanges] = useState<ZoningChange[]>([]);
  const [taxPolicyChanges, setTaxPolicyChanges] = useState<TaxPolicyChange[]>([]);

  useEffect(() => {
    fetchRegulatoryRisk();
  }, [tradeAreaId]);

  const fetchRegulatoryRisk = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/v1/risk/trade-area/${tradeAreaId}/regulatory`);
      setRegulatoryRisk(data.data.regulatoryRisk);
      setZoningChanges(data.data.zoningChanges || []);
      setTaxPolicyChanges(data.data.taxPolicyChanges || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load regulatory risk data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'success';
    if (score < 60) return 'warning';
    return 'error';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'info';
      case 'moderate': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'proposed': return 'default';
      case 'committee': return 'info';
      case 'vote_pending': return 'warning';
      case 'enacted': return 'error';
      case 'rejected': return 'success';
      default: return 'default';
    }
  };

  const formatLegislationType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

  if (!regulatoryRisk) {
    return <Alert severity="info">No regulatory risk data available</Alert>;
  }

  return (
    <Box>
      {/* Risk Score Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Regulatory Risk Score
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h3" color={getRiskColor(regulatoryRisk.finalScore)}>
                  {regulatoryRisk.finalScore.toFixed(1)}
                </Typography>
                <Chip
                  label={regulatoryRisk.finalScore < 40 ? 'Low' : regulatoryRisk.finalScore < 60 ? 'Moderate' : 'High'}
                  color={getRiskColor(regulatoryRisk.finalScore) as any}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={regulatoryRisk.finalScore}
                color={getRiskColor(regulatoryRisk.finalScore) as any}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Active Events
              </Typography>
              <Typography variant="h3">{regulatoryRisk.activeEvents}</Typography>
              <Typography variant="caption" color="text.secondary">
                Legislative items tracking
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total Risk Impact
              </Typography>
              <Typography variant="h3" color="error">
                +{regulatoryRisk.totalRiskImpact.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Weighted by probability
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Base Score
              </Typography>
              <Typography variant="h3">{regulatoryRisk.baseScore.toFixed(1)}</Typography>
              <Typography variant="caption" color="text.secondary">
                50 + active adjustments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Regulatory Events */}
      {regulatoryRisk.events.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <GavelIcon />
              Active Regulatory Events
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Legislation</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell align="center">Probability</TableCell>
                    <TableCell align="right">Impact</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Effective Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regulatoryRisk.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Tooltip title={event.name}>
                          <Typography variant="body2" noWrap maxWidth={200}>
                            {event.name}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={formatLegislationType(event.type)} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.stage.replace(/_/g, ' ')}
                          color={getStageColor(event.stage) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="bold">
                          {event.stageProbability}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error" fontWeight="bold">
                          +{event.impact.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.severity}
                          color={getSeverityColor(event.severity) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {event.effectiveDate ? new Date(event.effectiveDate).toLocaleDateString() : 'TBD'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Zoning Changes */}
      {zoningChanges.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <TrendingUpIcon />
              Zoning Changes
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Address</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell>Proposed</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Impact</TableCell>
                    <TableCell align="right">Risk Score Impact</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {zoningChanges.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell>{change.address}</TableCell>
                      <TableCell><Chip label={change.current_zoning} size="small" /></TableCell>
                      <TableCell><Chip label={change.proposed_zoning} size="small" /></TableCell>
                      <TableCell>
                        <Chip
                          label={change.zoning_change_type}
                          color={change.zoning_change_type === 'upzone' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={change.impact_type}
                          color={change.impact_type === 'opportunity' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={change.risk_score_impact > 0 ? 'error' : 'success'}
                          fontWeight="bold"
                        >
                          {change.risk_score_impact > 0 ? '+' : ''}{change.risk_score_impact.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={change.status} size="small" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tax Policy Changes */}
      {taxPolicyChanges.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <AccountBalanceIcon />
              Tax Policy Changes
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Jurisdiction</TableCell>
                    <TableCell align="right">Previous Rate</TableCell>
                    <TableCell align="right">New Rate</TableCell>
                    <TableCell align="right">Change</TableCell>
                    <TableCell align="right">Annual Impact</TableCell>
                    <TableCell>Effective Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {taxPolicyChanges.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell>
                        <Chip label={formatLegislationType(change.tax_type)} size="small" />
                      </TableCell>
                      <TableCell>{change.jurisdiction_name}</TableCell>
                      <TableCell align="right">{(change.previous_rate * 100).toFixed(2)}%</TableCell>
                      <TableCell align="right">{(change.new_rate * 100).toFixed(2)}%</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error" fontWeight="bold">
                          +{change.rate_change_pct.toFixed(2)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error">
                          ${change.estimated_annual_cost_impact.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {new Date(change.effective_date).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Stage Probability Legend */}
      <Card sx={{ mt: 3, bgcolor: 'background.default' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Legislative Stage Probability Weighting
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip label="Proposed: 25%" size="small" />
            <Chip label="Committee: 50%" size="small" color="info" />
            <Chip label="Vote Pending: 75%" size="small" color="warning" />
            <Chip label="Enacted: 100%" size="small" color="error" />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Risk impact is weighted by probability of passage. Early-stage proposals have lower weight than enacted legislation.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegulatoryRiskPanel;
