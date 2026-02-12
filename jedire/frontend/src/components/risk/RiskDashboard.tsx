/**
 * Risk Dashboard Component
 * Phase 2, Component 3: Risk Scoring System UI
 * 
 * Features:
 * - Risk heatmap by trade area
 * - 6-category risk breakdown (2 implemented, 4 placeholders)
 * - Composite risk score visualization
 * - Recent risk events timeline
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
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface CompositeRiskProfile {
  tradeAreaId: string;
  tradeAreaName?: string;
  supplyRisk: number;
  demandRisk: number;
  regulatoryRisk: number;
  marketRisk: number;
  executionRisk: number;
  climateRisk: number;
  compositeScore: number;
  highestCategory: string;
  highestCategoryScore: number;
  secondHighestCategory: string;
  secondHighestCategoryScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  calculatedAt: string;
}

interface RiskEvent {
  id: string;
  tradeAreaName: string;
  categoryName: string;
  categoryDisplayName: string;
  eventType: string;
  headline: string;
  description: string;
  eventDate: string;
  riskImpactType: 'escalation' | 'de_escalation' | 'neutral';
  riskScoreChange: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  isActive: boolean;
}

interface RiskDashboardProps {
  dealId?: string;
  tradeAreaIds?: string[];
}

const RiskDashboard: React.FC<RiskDashboardProps> = ({ dealId, tradeAreaIds }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskProfiles, setRiskProfiles] = useState<CompositeRiskProfile[]>([]);
  const [recentEvents, setRecentEvents] = useState<RiskEvent[]>([]);

  useEffect(() => {
    fetchRiskData();
  }, [dealId, tradeAreaIds]);

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (dealId) {
        // Fetch risk data for deal
        const { data } = await axios.get(`/api/v1/risk/deal/${dealId}`);
        setRiskProfiles(data.data.tradeAreaRisks || []);
      } else if (tradeAreaIds && tradeAreaIds.length > 0) {
        // Fetch risk data for specific trade areas
        const profiles = await Promise.all(
          tradeAreaIds.map(async (id) => {
            const { data } = await axios.get(`/api/v1/risk/trade-area/${id}`);
            return data.data.composite;
          })
        );
        setRiskProfiles(profiles);
      }

      // Fetch recent events
      const { data: eventsData } = await axios.get('/api/v1/risk/events', {
        params: { limit: 20, active: 'true' },
      });
      setRecentEvents(eventsData.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load risk data');
      console.error('Error fetching risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case 'low':
        return '#4caf50'; // Green
      case 'moderate':
        return '#ff9800'; // Orange
      case 'high':
        return '#f44336'; // Red
      case 'critical':
        return '#b71c1c'; // Dark Red
      default:
        return '#9e9e9e'; // Grey
    }
  };

  const getRiskScoreColor = (score: number): string => {
    if (score < 40) return '#4caf50'; // Low risk
    if (score < 60) return '#ff9800'; // Moderate risk
    if (score < 80) return '#f44336'; // High risk
    return '#b71c1c'; // Critical risk
  };

  const formatCategoryName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' ');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Risk Dashboard
      </Typography>

      {/* Composite Risk Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {riskProfiles.map((profile) => (
          <Grid item xs={12} md={6} lg={4} key={profile.tradeAreaId}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {profile.tradeAreaName || 'Trade Area'}
                </Typography>

                {/* Composite Score */}
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="textSecondary">
                      Composite Risk Score
                    </Typography>
                    <Chip
                      label={profile.riskLevel.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: getRiskLevelColor(profile.riskLevel),
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                  </Box>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="h3" color={getRiskScoreColor(profile.compositeScore)}>
                      {profile.compositeScore.toFixed(1)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={profile.compositeScore}
                      sx={{
                        flexGrow: 1,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getRiskScoreColor(profile.compositeScore),
                        },
                      }}
                    />
                  </Box>
                </Box>

                {/* Risk Category Breakdown */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Categories
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Tooltip title="Implemented: Pipeline analysis & absorption">
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Supply Risk
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {profile.supplyRisk.toFixed(1)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={profile.supplyRisk}
                              sx={{
                                flexGrow: 1,
                                height: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getRiskScoreColor(profile.supplyRisk),
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip title="Implemented: Employer concentration">
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Demand Risk
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {profile.demandRisk.toFixed(1)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={profile.demandRisk}
                              sx={{
                                flexGrow: 1,
                                height: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getRiskScoreColor(profile.demandRisk),
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip title="Placeholder: Phase 3">
                        <Box sx={{ opacity: 0.5 }}>
                          <Typography variant="caption" color="textSecondary">
                            Regulatory Risk
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {profile.regulatoryRisk.toFixed(1)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={profile.regulatoryRisk}
                              sx={{
                                flexGrow: 1,
                                height: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: '#9e9e9e',
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip title="Placeholder: Phase 3">
                        <Box sx={{ opacity: 0.5 }}>
                          <Typography variant="caption" color="textSecondary">
                            Market Risk
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {profile.marketRisk.toFixed(1)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={profile.marketRisk}
                              sx={{
                                flexGrow: 1,
                                height: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: '#9e9e9e',
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip title="Placeholder: Phase 3">
                        <Box sx={{ opacity: 0.5 }}>
                          <Typography variant="caption" color="textSecondary">
                            Execution Risk
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {profile.executionRisk.toFixed(1)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={profile.executionRisk}
                              sx={{
                                flexGrow: 1,
                                height: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: '#9e9e9e',
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip title="Placeholder: Phase 3">
                        <Box sx={{ opacity: 0.5 }}>
                          <Typography variant="caption" color="textSecondary">
                            Climate Risk
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {profile.climateRisk.toFixed(1)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={profile.climateRisk}
                              sx={{
                                flexGrow: 1,
                                height: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: '#9e9e9e',
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Box>

                {/* Highest Risks */}
                <Box sx={{ mt: 2, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    Top Risk Drivers
                  </Typography>
                  <Typography variant="body2">
                    1. {formatCategoryName(profile.highestCategory)}: {profile.highestCategoryScore.toFixed(1)}
                  </Typography>
                  <Typography variant="body2">
                    2. {formatCategoryName(profile.secondHighestCategory)}: {profile.secondHighestCategoryScore.toFixed(1)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Risk Events */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Risk Events
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Trade Area</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Impact</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      {new Date(event.eventDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{event.tradeAreaName}</TableCell>
                    <TableCell>
                      <Chip label={event.categoryDisplayName} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={event.description || event.headline}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {event.headline}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {event.riskImpactType === 'escalation' ? (
                          <TrendingUpIcon fontSize="small" color="error" />
                        ) : event.riskImpactType === 'de_escalation' ? (
                          <TrendingDownIcon fontSize="small" color="success" />
                        ) : (
                          <InfoIcon fontSize="small" color="info" />
                        )}
                        <Typography
                          variant="body2"
                          color={event.riskScoreChange > 0 ? 'error' : 'success'}
                          fontWeight="bold"
                        >
                          {event.riskScoreChange > 0 ? '+' : ''}
                          {event.riskScoreChange.toFixed(1)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={event.severity}
                        size="small"
                        sx={{
                          backgroundColor: getRiskLevelColor(event.severity),
                          color: 'white',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={event.isActive ? 'Active' : 'Resolved'}
                        size="small"
                        color={event.isActive ? 'warning' : 'default'}
                        variant={event.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Box sx={{ mt: 3 }}>
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="body2">
            <strong>Composite Risk Formula:</strong> (Highest Category × 0.40) + (Second Highest × 0.25) + (Avg of Remaining × 0.35)
            <br />
            This ensures a single severe risk isn't diluted by low scores in other categories.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default RiskDashboard;
