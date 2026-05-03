/**
 * Risk Breakdown Component
 * Detailed breakdown of risk categories with drill-down capability
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import {
  Factory as FactoryIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface RiskBreakdownProps {
  tradeAreaId: string;
  tradeAreaName?: string;
}

interface SupplyRiskData {
  pipelineUnits: number;
  existingUnits: number;
  absorptionRate: number;
  monthsToAbsorb: number;
  absorptionFactor: number;
  baseScore: number;
  finalScore: number;
  escalations: any[];
  deEscalations: any[];
}

interface DemandRiskData {
  topEmployerPct: number;
  employerConcentrationIndex: number;
  dependencyFactor: number;
  baseScore: number;
  finalScore: number;
  escalations: any[];
  deEscalations: any[];
}

const RiskBreakdown: React.FC<RiskBreakdownProps> = ({ tradeAreaId, tradeAreaName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [supplyRisk, setSupplyRisk] = useState<SupplyRiskData | null>(null);
  const [demandRisk, setDemandRisk] = useState<DemandRiskData | null>(null);
  const [pipelineProjects, setPipelineProjects] = useState<any[]>([]);
  const [employers, setEmployers] = useState<any[]>([]);

  useEffect(() => {
    fetchRiskDetails();
  }, [tradeAreaId]);

  const fetchRiskDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch supply risk
      const { data: supplyData } = await axios.get(
        `/api/v1/risk/trade-area/${tradeAreaId}/supply`
      );
      setSupplyRisk(supplyData.data.supplyRisk);
      setPipelineProjects(supplyData.data.pipelineProjects || []);

      // Fetch demand risk
      const { data: demandData } = await axios.get(
        `/api/v1/risk/trade-area/${tradeAreaId}/demand`
      );
      setDemandRisk(demandData.data.demandRisk);
      setEmployers(demandData.data.employers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load risk details');
      console.error('Error fetching risk details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      await axios.post(`/api/v1/risk/calculate/${tradeAreaId}`);
      await fetchRiskDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to recalculate risk');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score < 40) return '#4caf50';
    if (score < 60) return '#ff9800';
    if (score < 80) return '#f44336';
    return '#b71c1c';
  };

  if (loading && !supplyRisk && !demandRisk) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">
          Risk Breakdown: {tradeAreaName || 'Trade Area'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRecalculate}
          disabled={loading}
        >
          Recalculate
        </Button>
      </Box>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Supply Risk" icon={<FactoryIcon />} iconPosition="start" />
        <Tab label="Demand Risk" icon={<BusinessIcon />} iconPosition="start" />
      </Tabs>

      {/* Supply Risk Tab */}
      {activeTab === 0 && supplyRisk && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Supply Risk Score
                </Typography>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Typography variant="h2" color={getRiskColor(supplyRisk.finalScore)}>
                    {supplyRisk.finalScore.toFixed(1)}
                  </Typography>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Base Score: {supplyRisk.baseScore.toFixed(1)}
                    </Typography>
                    {supplyRisk.escalations.length > 0 && (
                      <Typography variant="body2" color="error">
                        Escalations: +{supplyRisk.escalations.reduce((s, e) => s + e.scoreImpact, 0).toFixed(1)}
                      </Typography>
                    )}
                    {supplyRisk.deEscalations.length > 0 && (
                      <Typography variant="body2" color="success.main">
                        De-escalations: {supplyRisk.deEscalations.reduce((s, e) => s + e.scoreImpact, 0).toFixed(1)}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Market Metrics
                </Typography>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Pipeline Units:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {supplyRisk.pipelineUnits.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Existing Units:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {supplyRisk.existingUnits.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Absorption Rate:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {supplyRisk.absorptionRate.toFixed(1)} units/mo
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Months to Absorb:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {supplyRisk.monthsToAbsorb.toFixed(1)} months
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Absorption Factor:</Typography>
                    <Chip
                      label={`${supplyRisk.absorptionFactor}x`}
                      size="small"
                      color={supplyRisk.absorptionFactor <= 1 ? 'success' : 'warning'}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pipeline Projects ({pipelineProjects.length})
                </Typography>
                <List dense>
                  {pipelineProjects.slice(0, 10).map((project) => (
                    <ListItem key={project.id}>
                      <ListItemText
                        primary={project.project_name || 'Unnamed Project'}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {project.total_units} units · {project.project_status}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Probability: {(project.probability * 100).toFixed(0)}% 
                              {project.expected_delivery_date && 
                                ` · Delivery: ${new Date(project.expected_delivery_date).toLocaleDateString()}`
                              }
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={`+${project.risk_contribution.toFixed(1)}`}
                        size="small"
                        color="error"
                      />
                    </ListItem>
                  ))}
                  {pipelineProjects.length === 0 && (
                    <ListItem>
                      <ListItemText secondary="No pipeline projects tracked" />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {supplyRisk.escalations.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Active Escalations
                  </Typography>
                  <List>
                    {supplyRisk.escalations.map((esc, idx) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={esc.triggerDescription}
                          secondary={`Applied: ${new Date(esc.appliedAt).toLocaleDateString()}`}
                        />
                        <Chip
                          label={esc.severity}
                          size="small"
                          color="error"
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="body2" color="error" fontWeight="bold">
                          +{esc.scoreImpact.toFixed(1)}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Demand Risk Tab */}
      {activeTab === 1 && demandRisk && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Demand Risk Score
                </Typography>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Typography variant="h2" color={getRiskColor(demandRisk.finalScore)}>
                    {demandRisk.finalScore.toFixed(1)}
                  </Typography>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Base Score: {demandRisk.baseScore.toFixed(1)}
                    </Typography>
                    {demandRisk.escalations.length > 0 && (
                      <Typography variant="body2" color="error">
                        Escalations: +{demandRisk.escalations.reduce((s, e) => s + e.scoreImpact, 0).toFixed(1)}
                      </Typography>
                    )}
                    {demandRisk.deEscalations.length > 0 && (
                      <Typography variant="body2" color="success.main">
                        De-escalations: {demandRisk.deEscalations.reduce((s, e) => s + e.scoreImpact, 0).toFixed(1)}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Concentration Metrics
                </Typography>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Top Employer %:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {demandRisk.topEmployerPct.toFixed(1)}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Concentration Index:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {demandRisk.employerConcentrationIndex.toFixed(1)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Dependency Factor:</Typography>
                    <Chip
                      label={`${demandRisk.dependencyFactor}x`}
                      size="small"
                      color={demandRisk.dependencyFactor <= 1 ? 'success' : 'warning'}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Employers ({employers.length})
                </Typography>
                <List dense>
                  {employers.slice(0, 10).map((employer) => (
                    <ListItem key={employer.id}>
                      <ListItemText
                        primary={employer.employer_name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {employer.employee_count?.toLocaleString()} employees · {employer.industry}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Concentration: {employer.concentration_pct?.toFixed(1)}%
                              {employer.relocation_history && ' · Has relocation history'}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={`${employer.concentration_pct?.toFixed(1)}%`}
                        size="small"
                        color={employer.concentration_pct > 20 ? 'warning' : 'default'}
                      />
                    </ListItem>
                  ))}
                  {employers.length === 0 && (
                    <ListItem>
                      <ListItemText secondary="No employer data available" />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {demandRisk.escalations.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Active Escalations
                  </Typography>
                  <List>
                    {demandRisk.escalations.map((esc, idx) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={esc.triggerDescription}
                          secondary={`Applied: ${new Date(esc.appliedAt).toLocaleDateString()}`}
                        />
                        <Chip
                          label={esc.severity}
                          size="small"
                          color="error"
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="body2" color="error" fontWeight="bold">
                          +{esc.scoreImpact.toFixed(1)}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default RiskBreakdown;
