import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

const PlaceholderPage: (title: string, accent?: string) => React.FC = (title, accent = BT.cyanL) => () =>
  React.createElement('div', { style: { background: BT.bg.terminal, minHeight: '100%', padding: 24 } },
    React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 16 } }, title),
    React.createElement('div', { style: { background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, fontFamily: 'monospace' } }, 'Loading data…')
  );

export const CompetitiveIntelligencePage = PlaceholderPage('Competitive Intelligence', BT.amber);
export const PerformanceRankingsPage = PlaceholderPage('Performance Rankings', BT.cyanL);
export const AcquisitionIntelPage = PlaceholderPage('Acquisition Intelligence', BT.greenL);
export const CompAnalysisPage = PlaceholderPage('Comp Analysis', BT.amber);
export const OpportunityAlertsPage = PlaceholderPage('Opportunity Alerts', BT.violL);
