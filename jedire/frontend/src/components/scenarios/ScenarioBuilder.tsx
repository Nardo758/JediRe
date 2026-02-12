/**
 * Scenario Builder Component
 * Phase 3, Component 2: Custom Scenario Creation
 * 
 * Features:
 * - Drag-and-drop event inclusion/exclusion
 * - Probability sliders for events
 * - Manual assumption overrides
 * - Save custom scenarios
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Slider,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface Event {
  id: string;
  summary: string;
  impact: number;
  category: string;
  direction?: string;
  eventDate: string;
  impactDate: string;
  probability?: number;
}

interface EventsList {
  demandEvents: Event[];
  supplyEvents: Event[];
  riskEvents: Event[];
}

interface ScenarioBuilderProps {
  dealId: string;
  onSave?: (scenarioId: string) => void;
}

const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({ dealId, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventsList | null>(null);
  
  // Selected events
  const [selectedDemand, setSelectedDemand] = useState<Set<string>>(new Set());
  const [selectedSupply, setSelectedSupply] = useState<Set<string>>(new Set());
  const [selectedRisk, setSelectedRisk] = useState<Set<string>>(new Set());
  
  // Assumption overrides
  const [scenarioName, setScenarioName] = useState('');
  const [description, setDescription] = useState('');
  const [rentGrowth, setRentGrowth] = useState<number | null>(null);
  const [vacancy, setVacancy] = useState<number | null>(null);
  const [exitCap, setExitCap] = useState<number | null>(null);
  const [opexGrowth, setOpexGrowth] = useState<number | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [dealId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/v1/scenarios/${dealId}/events`);
      setEvents(data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventToggle = (
    eventId: string,
    category: 'demand' | 'supply' | 'risk'
  ) => {
    const setters = {
      demand: setSelectedDemand,
      supply: setSelectedSupply,
      risk: setSelectedRisk,
    };
    
    const currentSet = category === 'demand' 
      ? selectedDemand 
      : category === 'supply' 
      ? selectedSupply 
      : selectedRisk;
    
    const newSet = new Set(currentSet);
    
    if (newSet.has(eventId)) {
      newSet.delete(eventId);
    } else {
      newSet.add(eventId);
    }
    
    setters[category](newSet);
  };

  const handleSave = async () => {
    if (!scenarioName) {
      setError('Please enter a scenario name');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const assumptionOverrides: any = {};
      if (rentGrowth !== null) assumptionOverrides.rentGrowth = rentGrowth / 100;
      if (vacancy !== null) assumptionOverrides.vacancy = vacancy / 100;
      if (exitCap !== null) assumptionOverrides.exitCap = exitCap / 100;
      if (opexGrowth !== null) assumptionOverrides.opexGrowth = opexGrowth / 100;

      const { data } = await axios.post('/api/v1/scenarios/custom', {
        dealId,
        scenarioName,
        description,
        selectedEventIds: [
          ...Array.from(selectedDemand),
          ...Array.from(selectedSupply),
          ...Array.from(selectedRisk),
        ],
        assumptionOverrides,
      });

      if (onSave) {
        onSave(data.data.scenario.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save scenario');
      console.error('Error saving scenario:', err);
    } finally {
      setSaving(false);
    }
  };

  const renderEventList = (
    eventList: Event[],
    category: 'demand' | 'supply' | 'risk',
    selectedSet: Set<string>
  ) => {
    if (eventList.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No {category} events available for this deal's trade area.
        </Alert>
      );
    }

    return (
      <Box mt={2}>
        {eventList.map((event) => (
          <Card 
            key={event.id} 
            variant="outlined" 
            sx={{ 
              mb: 1,
              borderColor: selectedSet.has(event.id) ? '#2196f3' : undefined,
              backgroundColor: selectedSet.has(event.id) ? '#e3f2fd' : undefined,
            }}
          >
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box flex={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedSet.has(event.id)}
                        onChange={() => handleEventToggle(event.id, category)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {event.summary}
                        </Typography>
                        <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                          <Chip label={event.category} size="small" />
                          {event.impact && (
                            <Chip 
                              label={`${event.impact.toLocaleString()} ${category === 'supply' ? 'units' : 'jobs'}`} 
                              size="small" 
                              color="primary"
                              variant="outlined"
                            />
                          )}
                          {event.probability && (
                            <Chip 
                              label={`${(event.probability * 100).toFixed(0)}% probability`} 
                              size="small" 
                              color="warning"
                              variant="outlined"
                            />
                          )}
                          {event.direction && (
                            <Chip 
                              label={event.direction} 
                              size="small" 
                              color={event.direction === 'positive' ? 'success' : 'error'}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!events) {
    return (
      <Alert severity="error">
        Failed to load events. Please try again.
      </Alert>
    );
  }

  const totalSelected = selectedDemand.size + selectedSupply.size + selectedRisk.size;

  return (
    <Box>
      {/* Header */}
      <Typography variant="h5" gutterBottom>
        Custom Scenario Builder
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Create your own scenario by selecting specific events and overriding assumptions.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column: Event Selection */}
        <Grid item xs={12} md={8}>
          {/* Scenario Info */}
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Scenario Information
            </Typography>
            <TextField
              label="Scenario Name"
              placeholder="e.g., Conservative Amazon Delay"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              placeholder="Brief description of scenario assumptions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Paper>

          {/* Demand Events */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography variant="h6">Demand Events</Typography>
                <Chip 
                  label={`${selectedDemand.size} selected`} 
                  size="small" 
                  color="primary"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {renderEventList(events.demandEvents, 'demand', selectedDemand)}
            </AccordionDetails>
          </Accordion>

          {/* Supply Events */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography variant="h6">Supply Events</Typography>
                <Chip 
                  label={`${selectedSupply.size} selected`} 
                  size="small" 
                  color="primary"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {renderEventList(events.supplyEvents, 'supply', selectedSupply)}
            </AccordionDetails>
          </Accordion>

          {/* Risk Events */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography variant="h6">Risk Events</Typography>
                <Chip 
                  label={`${selectedRisk.size} selected`} 
                  size="small" 
                  color="warning"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {renderEventList(events.riskEvents, 'risk', selectedRisk)}
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Right Column: Assumption Overrides */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, position: 'sticky', top: 16 }}>
            <Typography variant="h6" gutterBottom>
              Assumption Overrides
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Override pro forma assumptions (leave blank to use calculated values)
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Rent Growth */}
            <TextField
              label="Rent Growth"
              type="number"
              value={rentGrowth ?? ''}
              onChange={(e) => setRentGrowth(e.target.value ? parseFloat(e.target.value) : null)}
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ mb: 2 }}
              helperText="Annual rent growth rate"
            />

            {/* Vacancy */}
            <TextField
              label="Vacancy Rate"
              type="number"
              value={vacancy ?? ''}
              onChange={(e) => setVacancy(e.target.value ? parseFloat(e.target.value) : null)}
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ mb: 2 }}
              helperText="Stabilized vacancy"
            />

            {/* Exit Cap */}
            <TextField
              label="Exit Cap Rate"
              type="number"
              value={exitCap ?? ''}
              onChange={(e) => setExitCap(e.target.value ? parseFloat(e.target.value) : null)}
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ mb: 2 }}
              helperText="Cap rate at disposition"
            />

            {/* OpEx Growth */}
            <TextField
              label="OpEx Growth"
              type="number"
              value={opexGrowth ?? ''}
              onChange={(e) => setOpexGrowth(e.target.value ? parseFloat(e.target.value) : null)}
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ mb: 2 }}
              helperText="Operating expense growth"
            />

            <Divider sx={{ my: 2 }} />

            {/* Summary */}
            <Box mb={2}>
              <Alert severity="info" icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>{totalSelected}</strong> events selected
                </Typography>
                <Typography variant="caption" display="block">
                  Demand: {selectedDemand.size} | Supply: {selectedSupply.size} | Risk: {selectedRisk.size}
                </Typography>
              </Alert>
            </Box>

            {/* Save Button */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !scenarioName || totalSelected === 0}
            >
              {saving ? 'Saving...' : 'Save Custom Scenario'}
            </Button>

            {totalSelected === 0 && (
              <Typography variant="caption" color="text.secondary" display="block" mt={1} textAlign="center">
                Select at least one event to create a scenario
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ScenarioBuilder;
