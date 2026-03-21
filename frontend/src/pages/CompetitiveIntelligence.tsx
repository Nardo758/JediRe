import React from 'react';

const stub = (title: string) => () => (
  <div style={{ padding: 32, background: '#0F1319', color: '#E8ECF1', fontFamily: "'JetBrains Mono',monospace", minHeight: '100vh' }}>
    <div style={{ fontSize: 9, color: '#4A5568', letterSpacing: '0.12em', marginBottom: 12 }}>INTELLIGENCE</div>
    <div style={{ fontSize: 18, color: '#00BCD4', fontWeight: 700, marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 11, color: '#8B95A5' }}>This section is loading...</div>
  </div>
);

export const CompetitiveIntelligencePage = stub('Competitive Intelligence');
export const PerformanceRankingsPage = stub('Performance Rankings');
export const AcquisitionIntelPage = stub('Acquisition Intelligence');
export const CompAnalysisPage = stub('Comp Analysis');
export const OpportunityAlertsPage = stub('Opportunity Alerts');
export const CompetitiveIntelligence = stub('Competitive Intelligence');

export default CompetitiveIntelligencePage;
