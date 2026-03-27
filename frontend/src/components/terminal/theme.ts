/**
 * Bloomberg Terminal Theme
 * Consistent color palette for PropertyTerminal components
 */

export const BT = {
  // Backgrounds
  bg: {
    terminal: '#0A0E17',      // Main background
    panel: '#0F1319',         // Panel/card background
    panelAlt: '#131821',      // Alternate panel
    hover: '#1A1F2E',         // Hover state
    active: '#1E2538',        // Active/selected
    header: '#0C0D10',        // Header bar
    elevated: '#1A1F2E',      // Elevated surface (buttons, cards)
  },
  
  // Borders
  border: {
    subtle: '#1C1E26',        // Subtle borders
    medium: '#1E2538',        // Medium borders
    strong: '#2A3348',        // Strong borders
    highlight: '#F5A623',     // Highlight border (amber)
  },
  
  // Text
  text: {
    primary: '#E8ECF1',       // Primary text
    secondary: '#8B95A5',     // Secondary text
    muted: '#4A5568',         // Muted text
    dim: '#2A3348',           // Very dim text
    
    // Semantic colors
    green: '#00D26A',         // Positive/up
    red: '#FF4757',           // Negative/down
    amber: '#F5A623',         // Warning/highlight
    cyan: '#00BCD4',          // Info/accent
    blue: '#3B82F6',          // Links/actions
    purple: '#A855F7',        // Special
  },
  
  accent: {
    red: '#FF4757',
    amber: '#F5A623',
    blue: '#3B82F6',
    green: '#00D26A',
    cyan: '#00BCD4',
    purple: '#A855F7',
  },

  // Chart colors (for multi-line charts)
  chart: {
    line1: '#00D26A',         // Green
    line2: '#F5A623',         // Amber
    line3: '#00BCD4',         // Cyan
    line4: '#FF4757',         // Red
    line5: '#A855F7',         // Purple
    line6: '#3B82F6',         // Blue
    line7: '#EC4899',         // Pink
    line8: '#84CC16',         // Lime
  },
  
  // Gradients
  gradient: {
    header: 'linear-gradient(135deg, #F5A623 0%, #F59E0B 100%)',
    success: 'linear-gradient(135deg, #00D26A 0%, #10B981 100%)',
    danger: 'linear-gradient(135deg, #FF4757 0%, #EF4444 100%)',
  },
};

// Tab definitions for PropertyTerminal
export const TERMINAL_TABS = [
  { key: 'overview', num: 0, label: 'OVERVIEW', desc: 'Key metrics & scores' },
  { key: 'traffic', num: 1, label: 'TRAFFIC', desc: 'Leasing & digital traffic' },
  { key: 'financials', num: 2, label: 'FINANCIALS', desc: 'Pro forma & projections' },
  { key: 'capital', num: 3, label: 'CAPITAL', desc: 'Debt & equity structure' },
  { key: 'market', num: 4, label: 'MARKET', desc: 'Market intel & sensitivity' },
  { key: 'comps', num: 5, label: 'COMPS', desc: 'Comparables & supply' },
  { key: 'news', num: 6, label: 'NEWS', desc: 'Market news & updates' },
  { key: 'strategy', num: 7, label: 'STRATEGY', desc: 'Investment decision' },
] as const;

export type TabKey = typeof TERMINAL_TABS[number]['key'];

// Formatting utilities
export const fmt = {
  currency: (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  },
  
  currencyFull: (n: number) => `$${n.toLocaleString()}`,
  
  percent: (n: number) => `${(n * 100).toFixed(1)}%`,
  
  percentInt: (n: number) => `${Math.round(n * 100)}%`,
  
  number: (n: number) => n.toLocaleString(),
  
  change: (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  },
  
  date: (d: string | Date) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  
  dateShort: (d: string | Date) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  },
};

// Common styles
export const terminalStyles = {
  // Section label style
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: BT.text.muted,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${BT.border.subtle}`,
  },
  
  // Card style
  card: {
    background: BT.bg.panel,
    border: `1px solid ${BT.border.subtle}`,
    borderRadius: '8px',
    padding: '16px',
  },
  
  // Table header cell
  th: {
    padding: '10px 12px',
    fontSize: '10px',
    fontWeight: 700,
    color: BT.text.amber,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    background: BT.bg.panelAlt,
    borderBottom: `1px solid ${BT.border.medium}`,
  },
  
  // Table data cell
  td: {
    padding: '10px 12px',
    fontSize: '12px',
    color: BT.text.secondary,
    borderBottom: `1px solid ${BT.border.subtle}`,
  },
  
  // Value highlight (positive)
  valuePositive: {
    color: BT.text.green,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
  },
  
  // Value highlight (negative)
  valueNegative: {
    color: BT.text.red,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
  },
  
  // Metric value
  metricValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: BT.text.primary,
    fontFamily: "'JetBrains Mono', monospace",
  },
  
  // Metric label
  metricLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: BT.text.muted,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
};
