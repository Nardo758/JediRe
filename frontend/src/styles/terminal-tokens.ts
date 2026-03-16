export const T = {
  bg: {
    terminal: '#0A0E17',
    panel:    '#0F1319',
    panelAlt: '#131821',
    header:   '#1A1F2E',
    hover:    '#1E2538',
    active:   '#252D40',
    input:    '#0D1117',
    topBar:   '#050810',
  },
  text: {
    primary:     '#E8ECF1',
    secondary:   '#8B95A5',
    muted:       '#4A5568',
    amber:       '#F5A623',
    amberBright: '#FFD166',
    green:       '#00D26A',
    red:         '#FF4757',
    cyan:        '#00BCD4',
    orange:      '#FF8C42',
    purple:      '#A78BFA',
    white:       '#FFFFFF',
  },
  border: {
    subtle: '#1E2538',
    medium: '#2A3348',
    bright: '#3B4A6B',
  },
  gradient: {
    tealCyan: 'linear-gradient(135deg, #00E5A0, #00B4D8)',
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
} as const;

export type TerminalTheme = typeof T;

export const DARK = T;

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
    amber:       '#D97706',
    amberBright: '#B45309',
    green:       '#059669',
    red:         '#DC2626',
    cyan:        '#0891B2',
    orange:      '#EA580C',
    purple:      '#7C3AED',
    white:       '#FFFFFF',
  },
  border: {
    subtle: '#E2E8F0',
    medium: '#CBD5E1',
    bright: '#94A3B8',
  },
  gradient: {
    tealCyan: 'linear-gradient(135deg, #00E5A0, #00B4D8)',
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
} as const;
