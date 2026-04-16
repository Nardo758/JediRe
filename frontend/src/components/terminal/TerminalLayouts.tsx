import React from 'react';
import { BT, terminalStyles } from './theme';

interface TerminalSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const TerminalSection: React.FC<TerminalSectionProps> = ({ title, icon, children, style }) => (
  <div style={{ ...terminalStyles.panel, padding: 16, ...style }}>
    <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
      {icon}{title}
    </div>
    {children}
  </div>
);

interface CardSectionProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
  noPadding?: boolean;
}

export const CardSection: React.FC<CardSectionProps> = ({ title, children, style, titleStyle, noPadding }) => (
  <div style={{ ...terminalStyles.card, padding: noPadding ? 0 : 20, overflow: noPadding ? 'hidden' : undefined, ...style }}>
    {title && (
      <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16, ...titleStyle }}>
        {title}
      </h3>
    )}
    {children}
  </div>
);

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  subtextColor?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, subtextColor, icon }) => (
  <div style={{
    ...terminalStyles.panel,
    padding: '12px 16px',
    flex: 1,
    minWidth: 0,
  }}>
    <div style={{ ...terminalStyles.metricLabel, marginBottom: 4 }}>
      {icon}{label}
    </div>
    <div style={{
      fontSize: 20,
      fontWeight: 700,
      color: BT.text.primary,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {value}
    </div>
    {subtext && (
      <div style={{ ...terminalStyles.metricSubtext, color: subtextColor || BT.text.muted }}>
        {subtext}
      </div>
    )}
  </div>
);

interface DataTableProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const DataTable: React.FC<DataTableProps> = ({ children, style }) => (
  <table style={{ ...terminalStyles.dataTable, ...style }}>
    {children}
  </table>
);
