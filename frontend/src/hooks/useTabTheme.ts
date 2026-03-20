import { useTheme } from '../contexts/ThemeContext';

const DARK_T = {
  bg:          '#0A0E17',
  panel:       '#0F1319',
  dimBg:       '#0D1220',
  border:      '#1C2333',
  borderLight: '#242D3E',
  amber:       '#F5A623',
  green:       '#00D26A',
  red:         '#FF4757',
  cyan:        '#00BCD4',
  violet:      '#9B5DE5',
  pink:        '#EC4899',
  teal:        '#00D4AA',
  text:        '#E0E4EE',
  secondary:   '#8892A4',
  muted:       '#4A5568',
  topBar:      '#050810',
};

const LIGHT_T = {
  bg:          '#F0F4F8',
  panel:       '#FFFFFF',
  dimBg:       '#F1F5F9',
  border:      '#E2E8F0',
  borderLight: '#CBD5E1',
  amber:       '#D97706',
  green:       '#059669',
  red:         '#DC2626',
  cyan:        '#0891B2',
  violet:      '#7C3AED',
  pink:        '#DB2777',
  teal:        '#0D9488',
  text:        '#1E293B',
  secondary:   '#475569',
  muted:       '#94A3B8',
  topBar:      '#1A1F2E',
};

export type TabTheme = typeof DARK_T;

export function useTabTheme(): TabTheme {
  const { isDark } = useTheme();
  return isDark ? DARK_T : LIGHT_T;
}

export { DARK_T, LIGHT_T };
