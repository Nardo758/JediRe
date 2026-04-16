import React from 'react';

const stub = (name: string): React.FC<any> => () => (
  <div style={{ padding: 8, background: '#1E2538', color: '#00BCD4', fontFamily: 'monospace', fontSize: 10 }}>
    {name}
  </div>
);

export const CyclePhaseBadge = stub('CyclePhaseBadge');
export const DivergenceChip = stub('DivergenceChip');
export const RateEnvironmentStrip = stub('RateEnvironmentStrip');
export const MiniCycleRing = stub('MiniCycleRing');
export const TimingVerdict = stub('TimingVerdict');
export const PatternMatchCard = stub('PatternMatchCard');
export const PhaseStrategyBadge = stub('PhaseStrategyBadge');
export const MacroRiskGauge = stub('MacroRiskGauge');
export const CycleCompass = stub('CycleCompass');
export const ValueForecastBand = stub('ValueForecastBand');
export const ExitWindowGauge = stub('ExitWindowGauge');
export const PredictedJEDIScore = stub('PredictedJEDIScore');
export const WidgetContainer = stub('WidgetContainer');
export const MetricWidget = stub('MetricWidget');
export const ChartWidget = stub('ChartWidget');
