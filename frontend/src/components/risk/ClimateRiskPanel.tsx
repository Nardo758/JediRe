/**
 * Climate/Physical Risk Panel Component
 * Phase 3, Component 1: Climate Risk Visualization
 * 
 * Features:
 * - FEMA flood zone assessment
 * - Wildfire risk evaluation
 * - Hurricane exposure
 * - Insurance availability and costs
 * - Historical natural disaster events
 * - 30-year climate projection
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Water as WaterIcon,
  Whatshot as WhatshotIcon,
  Air as AirIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

interface FloodRisk {
  femaZone: string;
  zoneDescription: string;
  baseFloodElevation: number;
  propertyElevation: number;
  elevationBuffer: number;
  riskLevel: string;
  eventCount10Yr: number;
}

interface WildfireRisk {
  hazardZone: string;
  wuiClassification: string;
  distanceToFireMiles: number;
  riskLevel: string;
}

interface HurricaneRisk {
  zone: number;
  windDesignSpeed: number;
  stormSurgeRisk: string;
}

interface Insurance {
  availability: string;
  carrierWithdrawals: boolean;
  premiumTrend: string;
  estimatedAnnualPremium: number;
}

interface DisasterEvent {
  type: string;
  name: string;
  date: string;
  severity: string;
  estimatedDamage: number;
  propertiesAffected: number;
}

interface ClimateRiskData {
  baseScore: number;
  finalScore: number;
  hasData: boolean;
  assessmentDate: string;
  floodRisk: FloodRisk;
  wildfireRisk: WildfireRisk;
  hurricaneRisk: HurricaneRisk;
  insurance: Insurance;
  disasterHistory: DisasterEvent[];
}

interface ClimateRiskPanelProps {
  tradeAreaId: string;
}

const ClimateRiskPanel: React.FC<ClimateRiskPanelProps> = ({ tradeAreaId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [climateRisk, setClimateRisk] = useState<ClimateRiskData | null>(null);

  useEffect(() => {
    fetchClimateRisk();
  }, [tradeAreaId]);

  const fetchClimateRisk = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/v1/risk/trade-area/${tradeAreaId}/climate`);
      setClimateRisk(data.data.climateRisk);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load climate risk data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'success';
    if (score < 60) return 'warning';
    return 'error';
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'minimal':
      case 'low': return 'success';
      case 'moderate': return 'warning';
      case 'high':
      case 'extreme': return 'error';
      default: return 'default';
    }
  };

  const getFEMAZoneColor = (zone: string) => {
    if (zone === 'X' || zone === 'C' || zone === 'B') return 'success';
    if (zone === 'D') return 'warning';
    return 'error'; // A, AE, V, VE
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

  if (!climateRisk || !climateRisk.hasData) {
    return <Alert severity="info">No climate risk data available</Alert>;
  }

  return (
    <Box>
      {/* Risk Score Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Climate Risk Score
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h3" color={getRiskColor(climateRisk.finalScore)}>
                  {climateRisk.finalScore.toFixed(1)}
                </Typography>
                <Chip
                  label={climateRisk.finalScore < 40 ? 'Low' : climateRisk.finalScore < 60 ? 'Moderate' : 'High'}
                  color={getRiskColor(climateRisk.finalScore) as any}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={climateRisk.finalScore}
                color={getRiskColor(climateRisk.finalScore) as any}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                FEMA Flood Zone
              </Typography>
              <Chip
                label={`Zone ${climateRisk.floodRisk.femaZone}`}
                color={getFEMAZoneColor(climateRisk.floodRisk.femaZone) as any}
                sx={{ fontSize: '1.5rem', height: 40 }}
              />
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {climateRisk.floodRisk.riskLevel} risk
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Wildfire Hazard
              </Typography>
              <Chip
                label={climateRisk.wildfireRisk.hazardZone}
                color={getRiskLevelColor(climateRisk.wildfireRisk.riskLevel) as any}
                sx={{ fontSize: '1.2rem', height: 36 }}
              />
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {climateRisk.wildfireRisk.distanceToFireMiles.toFixed(0)} mi to fire perimeter
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Annual Premium
              </Typography>
              <Typography variant="h4" color={climateRisk.insurance.estimatedAnnualPremium > 30000 ? 'error' : 'text.primary'}>
                ${climateRisk.insurance.estimatedAnnualPremium.toLocaleString()}
              </Typography>
              <Chip
                label={climateRisk.insurance.premiumTrend.replace(/_/g, ' ')}
                color={climateRisk.insurance.premiumTrend === 'stable' ? 'success' : 'warning'}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Flood Risk */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <WaterIcon />
            Flood Risk Assessment
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">FEMA Zone</Typography>
              <Chip label={`Zone ${climateRisk.floodRisk.femaZone}`} color={getFEMAZoneColor(climateRisk.floodRisk.femaZone) as any} />
              <Typography variant="caption" display="block" mt={1}>
                {climateRisk.floodRisk.zoneDescription}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Elevation Buffer</Typography>
              <Typography variant="h6" color={climateRisk.floodRisk.elevationBuffer > 10 ? 'success' : 'warning'}>
                {climateRisk.floodRisk.elevationBuffer.toFixed(1)} ft
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Property elevation: {climateRisk.floodRisk.propertyElevation.toFixed(1)} ft
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Flood Events (10yr)</Typography>
              <Typography variant="h6" color={climateRisk.floodRisk.eventCount10Yr > 0 ? 'error' : 'success'}>
                {climateRisk.floodRisk.eventCount10Yr} events
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Risk level: {climateRisk.floodRisk.riskLevel}
              </Typography>
            </Grid>
          </Grid>

          {climateRisk.floodRisk.femaZone !== 'X' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Property is in FEMA flood zone {climateRisk.floodRisk.femaZone}. Flood insurance required for financing.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Wildfire Risk */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <WhatshotIcon />
            Wildfire Risk Assessment
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Hazard Zone</Typography>
              <Chip label={climateRisk.wildfireRisk.hazardZone} color={getRiskLevelColor(climateRisk.wildfireRisk.riskLevel) as any} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">WUI Classification</Typography>
              <Typography variant="h6">{climateRisk.wildfireRisk.wuiClassification}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Distance to Fire</Typography>
              <Typography variant="h6">
                {climateRisk.wildfireRisk.distanceToFireMiles.toFixed(1)} miles
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Hurricane/Wind Risk */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <AirIcon />
            Hurricane & Wind Risk
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Hurricane Zone</Typography>
              <Typography variant="h6">Zone {climateRisk.hurricaneRisk.zone}</Typography>
              <Typography variant="caption" color="text.secondary">Saffir-Simpson scale</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Wind Design Speed</Typography>
              <Typography variant="h6">{climateRisk.hurricaneRisk.windDesignSpeed} mph</Typography>
              <Typography variant="caption" color="text.secondary">Building code requirement</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Storm Surge Risk</Typography>
              <Chip label={climateRisk.hurricaneRisk.stormSurgeRisk} color={getRiskLevelColor(climateRisk.hurricaneRisk.stormSurgeRisk) as any} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Insurance */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <ShieldIcon />
            Insurance Market
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Availability</Typography>
              <Chip
                label={climateRisk.insurance.availability.replace(/_/g, ' ')}
                color={climateRisk.insurance.availability === 'readily_available' ? 'success' : 'warning'}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Carrier Withdrawals</Typography>
              <Chip
                label={climateRisk.insurance.carrierWithdrawals ? 'Yes' : 'No'}
                color={climateRisk.insurance.carrierWithdrawals ? 'error' : 'success'}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Premium Trend</Typography>
              <Chip
                label={climateRisk.insurance.premiumTrend.replace(/_/g, ' ')}
                color={climateRisk.insurance.premiumTrend === 'stable' ? 'success' : 'warning'}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Annual Premium</Typography>
              <Typography variant="h6">
                ${climateRisk.insurance.estimatedAnnualPremium.toLocaleString()}
              </Typography>
            </Grid>
          </Grid>

          {climateRisk.insurance.carrierWithdrawals && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Insurance carriers have withdrawn from this market. Coverage may be difficult or expensive to obtain.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Historical Disaster Events */}
      {climateRisk.disasterHistory.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Historical Natural Disaster Events
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell align="right">Estimated Damage</TableCell>
                    <TableCell align="right">Properties Affected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {climateRisk.disasterHistory.map((event, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip label={event.type.replace(/_/g, ' ')} size="small" />
                      </TableCell>
                      <TableCell>{event.name}</TableCell>
                      <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={event.severity}
                          color={getRiskLevelColor(event.severity) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        ${(event.estimatedDamage / 1000000).toFixed(1)}M
                      </TableCell>
                      <TableCell align="right">
                        {event.propertiesAffected.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ClimateRiskPanel;
