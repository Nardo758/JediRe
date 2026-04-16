export { BT as T, BT as DARK } from '../components/deal/bloomberg-ui';

export type TerminalTheme = typeof import('../components/deal/bloomberg-ui').BT;

export const LIGHT = {
  bg: {
    terminal: '#F0F4F8',
    panel:    '#FFFFFF',
    panelAlt: '#F8FAFC',
    header:   '#E8ECF1',
    hover:    '#EFF6FF',
    active:   '#DBEAFE',
    input:    '#F1F5F9',
    topBar:   '#1A1F2E',
  },
  text: {
    primary:     '#1E293B',
    secondary:   '#475569',
    muted:       '#94A3B8',
    white:       '#FFFFFF',
    amber:       '#D97706',
    amberBright: '#B45309',
    green:       '#059669',
    red:         '#DC2626',
    cyan:        '#0891B2',
    orange:      '#EA580C',
    purple:      '#7C3AED',
    teal:        '#00A67E',
  },
  border: {
    subtle: '#E2E8F0',
    medium: '#CBD5E1',
    bright: '#94A3B8',
  },
  met: {
    physTraffic:  '#3b82f6',
    digTraffic:   '#d97706',
    compTraffic:  '#9333ea',
    financial:    '#16a34a',
    occupancy:    '#0d9488',
    economic:     '#db2777',
    supply:       '#ea580c',
    quality:      '#7c3aed',
  },
  font: {
    mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    display: "'IBM Plex Mono', monospace",
    label:   "'IBM Plex Sans', sans-serif",
  },
  fontSize: {
    xs:   '8px',
    sm:   '9px',
    md:   '10px',
    base: '11px',
    lg:   '12px',
    xl:   '14px',
    xxl:  '20px',
    hero: '32px',
  },
  gradient: {
    tealCyan: 'linear-gradient(135deg, #00E5A0, #00B4D8)',
  },
} as const;
