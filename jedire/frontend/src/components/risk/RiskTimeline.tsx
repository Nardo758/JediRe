/**
 * Risk Timeline Component
 * Shows risk score changes over time with event markers
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from 'recharts';

interface RiskTimelineProps {
  tradeAreaId: string;
  tradeAreaName?: string;
}

interface RiskScorePoint {
  tradeAreaId: string;
  categoryName: string;
  riskScore: number;
  baseScore: number;
  escalationAdjustment: number;
  deEscalationAdjustment: number;
  riskLevel: string;
  calculatedAt: string;
}

const RiskTimeline: React.FC<RiskTimelineProps> = ({ tradeAreaId, tradeAreaName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [historyData, setHistoryData] = useState<RiskScorePoint[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [tradeAreaId, selectedCategory]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { limit: 100 };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      const { data } = await axios.get(
        `/api/v1/risk/history/${tradeAreaId}`,
        { params }
      );

      setHistoryData(data.data || []);
      processChartData(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load risk history');
      console.error('Error fetching risk history:', err);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (history: RiskScorePoint[]) => {
    // Group by date and category
    const dataByDate = new Map<string, any>();

    history.forEach((point) => {
      const date = new Date(point.calculatedAt).toLocaleDateString();
      
      if (!dataByDate.has(date)) {
        dataByDate.set(date, {
          date,
          timestamp: new Date(point.calculatedAt).getTime(),
        });
      }

      const dateData = dataByDate.get(date);
      dateData[point.categoryName] = point.riskScore;
      dateData[`${point.categoryName}_base`] = point.baseScore;
      dateData[`${point.categoryName}_level`] = point.riskLevel;
    });

    // Convert to array and sort by date
    const chartArray = Array.from(dataByDate.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    setChartData(chartArray);
  };

  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case 'low':
        return '#4caf50';
      case 'moderate':
        return '#ff9800';
      case 'high':
        return '#f44336';
      case 'critical':
        return '#b71c1c';
      default:
        return '#9e9e9e';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'supply':
        return '#2196f3';
      case 'demand':
        return '#f44336';
      case 'regulatory':
        return '#9c27b0';
      case 'market':
        return '#ff9800';
      case 'execution':
        return '#4caf50';
      case 'climate':
        return '#00bcd4';
      default:
        return '#9e9e9e';
    }
  };

  if (loading && chartData.length === 0) {
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
          Risk Timeline: {tradeAreaName || 'Trade Area'}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            label="Category"
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <MenuItem value="all">All Categories</MenuItem>
            <MenuItem value="supply">Supply Risk</MenuItem>
            <MenuItem value="demand">Demand Risk</MenuItem>
            <MenuItem value="regulatory">Regulatory Risk</MenuItem>
            <MenuItem value="market">Market Risk</MenuItem>
            <MenuItem value="execution">Execution Risk</MenuItem>
            <MenuItem value="climate">Climate Risk</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Card>
        <CardContent>
          {chartData.length === 0 ? (
            <Alert severity="info">No risk history data available</Alert>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    label={{ value: 'Risk Score (0-100)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #ccc',
                      borderRadius: 4,
                    }}
                    formatter={(value: any, name: string) => {
                      if (typeof value === 'number') {
                        return [value.toFixed(1), name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />

                  {/* Reference lines for risk thresholds */}
                  <ReferenceLine y={40} stroke="#4caf50" strokeDasharray="3 3" label="Low" />
                  <ReferenceLine y={60} stroke="#ff9800" strokeDasharray="3 3" label="Moderate" />
                  <ReferenceLine y={80} stroke="#f44336" strokeDasharray="3 3" label="High" />

                  {/* Lines for each category */}
                  {selectedCategory === 'all' ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="supply"
                        stroke={getCategoryColor('supply')}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Supply Risk"
                      />
                      <Line
                        type="monotone"
                        dataKey="demand"
                        stroke={getCategoryColor('demand')}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Demand Risk"
                      />
                      <Line
                        type="monotone"
                        dataKey="regulatory"
                        stroke={getCategoryColor('regulatory')}
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        name="Regulatory Risk (Phase 3)"
                      />
                      <Line
                        type="monotone"
                        dataKey="market"
                        stroke={getCategoryColor('market')}
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        name="Market Risk (Phase 3)"
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey={selectedCategory}
                        stroke={getCategoryColor(selectedCategory)}
                        strokeWidth={3}
                        dot={{ r: 5 }}
                        name="Risk Score"
                      />
                      <Line
                        type="monotone"
                        dataKey={`${selectedCategory}_base`}
                        stroke="#9e9e9e"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        name="Base Score"
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>

              {/* Summary Stats */}
              <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {selectedCategory !== 'all' && historyData.length > 0 && (
                  <>
                    <Box sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Current Score
                      </Typography>
                      <Typography variant="h6">
                        {historyData[0]?.riskScore.toFixed(1)}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Risk Level
                      </Typography>
                      <Chip
                        label={historyData[0]?.riskLevel.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: getRiskLevelColor(historyData[0]?.riskLevel),
                          color: 'white',
                        }}
                      />
                    </Box>
                    <Box sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        30-Day Change
                      </Typography>
                      <Typography variant="h6" color={
                        historyData[0]?.riskScore > historyData[historyData.length - 1]?.riskScore
                          ? 'error'
                          : 'success.main'
                      }>
                        {historyData.length > 1
                          ? (historyData[0]?.riskScore - historyData[historyData.length - 1]?.riskScore).toFixed(1)
                          : '0.0'}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Active Escalations
                      </Typography>
                      <Typography variant="h6">
                        {historyData[0]?.escalationAdjustment > 0
                          ? `+${historyData[0]?.escalationAdjustment.toFixed(1)}`
                          : '0.0'}
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend for Phase 3 Categories */}
      {selectedCategory === 'all' && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" variant="outlined">
            <Typography variant="body2">
              <strong>Phase 2:</strong> Supply Risk and Demand Risk are fully implemented with live data.
              <br />
              <strong>Phase 3:</strong> Regulatory, Market, Execution, and Climate Risk will be implemented in future phases (currently showing baseline 50.0 scores).
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default RiskTimeline;
