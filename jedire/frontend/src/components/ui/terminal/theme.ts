/**
 * Bloomberg Terminal Theme
 * Dark, data-dense aesthetic for property intelligence
 */

export const TerminalTheme = {
  bg: {
    terminal: "#0A0E17",
    panel: "#0F1319",
    panelAlt: "#131821",
    header: "#1A1F2E",
    hover: "#1E2538",
    active: "#252D40",
    input: "#0D1117",
    topBar: "#050810",
    photo: "#080B12",
  },
  text: {
    primary: "#E8ECF1",
    secondary: "#8B95A5",
    muted: "#4A5568",
    amber: "#F5A623",
    amberBright: "#FFD166",
    green: "#00D26A",
    red: "#FF4757",
    cyan: "#00BCD4",
    orange: "#FF8C42",
    purple: "#A78BFA",
    white: "#FFFFFF",
    blue: "#4A9EFF",
  },
  border: {
    subtle: "#1E2538",
    medium: "#2A3348",
    bright: "#3B4A6B",
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
    display: "'IBM Plex Mono',monospace",
    label: "'IBM Plex Sans',sans-serif",
  },
};

export type TerminalThemeType = typeof TerminalTheme;
