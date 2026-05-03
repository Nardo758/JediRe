/**
 * InlineAssumptionBlock — token references
 *
 * Maps spec logical tokens to BT (bloomberg-ui) values.
 * No new tokens introduced — all fallbacks documented below.
 */
import { BT } from '../deal/bloomberg-ui';

export const T = {
  // ── Colors ──────────────────────────────────────────────────────────────
  accent: {
    positive: BT.text.green,         // #00D26A  ▲ drift up
    negative: BT.text.red,           // #FF4757  ▼ drift down
    agent:    BT.accent.agent,        // #00E5A0  agent-sourced
    user:     BT.accent.user,         // #F5A623  user override
    subject:  '#2DD4BF',             // teal — subject-history tier
  },
  text: {
    primary:   BT.text.primary,       // #E8ECF1
    secondary: BT.text.secondary,     // #A0ABBE
    muted:     BT.text.muted,         // #6B7A8D
    amber:     BT.text.amber,         // #F5A623  material collision
    red:       BT.text.red,           // #FF4757  severe collision
    green:     BT.text.green,         // #00D26A  HIGH confidence
    cyan:      BT.text.cyan,          // #00BCD4  editable cell
  },
  bg: {
    panel:      BT.bg.panel,          // #0F1319
    panelAlt:   BT.bg.panelAlt,       // #131821  (spec: bg.layer2)
    header:     BT.bg.header,         // #1A1F2E
    input:      BT.bg.input,          // #0D1117
    hover:      BT.bg.hover,          // #1E2538
    active:     BT.bg.active,         // #252D40
    // spec: bg.warning_subtle → amber at 8% opacity
    warnSubtle: `${BT.text.amber}08`,
    // spec: bg.severe_subtle → red at 6% opacity
    severeSubtle: `${BT.text.red}06`,
  },
  border: {
    subtle: BT.border.subtle,         // #1E2538
    medium: BT.border.medium,         // #2A3348
    bright: BT.border.bright,         // #3B4A6B
    warn:   `${BT.text.amber}60`,     // material collision
    severe: `${BT.text.red}80`,       // severe collision
  },
  font: {
    mono:  BT.font.mono,              // JetBrains Mono (numeric values 11px)
    label: BT.font.label,             // IBM Plex Sans (labels 10px)
  },
  fontSize: {
    label:   '10px',                  // IBM Plex Sans labels
    value:   '11px',                  // JetBrains Mono numeric values (tabular-nums)
    badge:   '7px',
    detail:  '8px',
    section: '9px',
  },
} as const;
