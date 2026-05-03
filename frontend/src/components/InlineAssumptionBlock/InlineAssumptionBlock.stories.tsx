/**
 * Storybook stories for InlineAssumptionBlock
 *
 * Three stories:
 *  1. WithSubjectHistory  — full 3-col mode (S2 tier, material + severe collision)
 *  2. WithoutSubjectHistory — true 2-col mode (no rent roll uploaded)
 *  3. EdgeCases — null peer, S1-only dynamics, severe collision, active user override,
 *                 range-guard rejection, and collapsed-with-⚠-badge
 */
import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { InlineAssumptionBlock } from './InlineAssumptionBlock';
import type { AssumptionFieldDef } from './types';

// ─── Shared field fixtures ─────────────────────────────────────────────────

const OCCUPANCY_FIELDS_WITH_SUBJECT: AssumptionFieldDef[] = [
  {
    fieldId: 'physical_occupancy',
    label: 'Physical Occupancy',
    format: 'pct',
    precision: 0.5,
    min: 0, max: 1,
    peerValue: 0.935,
    subjectValue: 0.918,
    effectiveValue: 0.924,
    blendWeight: 0.62,
    source: 'subject_history:s2',
    confidence: 'HIGH',
  },
  {
    fieldId: 'renewal_rate',
    label: 'Renewal Rate',
    format: 'pct',
    precision: 0.5,
    min: 0, max: 1,
    peerValue: 0.54,
    subjectValue: 0.49,
    effectiveValue: 0.516,
    blendWeight: 0.52,
    source: 'subject_history:s2',
    confidence: 'MED',
    narrative: 'Subject renewal rate 0.49 is within normal range vs peer 0.54 (0.3σ).',
  },
  {
    fieldId: 'signing_velocity',
    label: 'Signing Velocity (mo)',
    format: 'num',
    precision: 0.1,
    min: 0,
    peerValue: 7.2,
    subjectValue: 5.8,
    effectiveValue: 6.37,
    blendWeight: 0.72,
    source: 'subject_history:s2',
    confidence: 'HIGH',
    // 1.8σ deviation → material collision
  },
  {
    fieldId: 'days_vacant',
    label: 'Days Vacant (median)',
    format: 'days',
    precision: 1,
    min: 0,
    peerValue: 28,
    subjectValue: 42,
    effectiveValue: 37.1,
    blendWeight: 0.55,
    source: 'subject_history:s2',
    confidence: 'MED',
    // 3.1σ → severe collision
    narrative: 'Subject days-vacant 42d is severely elevated vs peer median 28d. Leasing velocity may be impaired.',
  },
  {
    fieldId: 'loss_to_lease',
    label: 'Loss-to-Lease',
    format: 'pct',
    precision: 0.1,
    min: 0, max: 0.5,
    peerValue: 0.038,
    subjectValue: 0.052,
    effectiveValue: 0.047,
    blendWeight: 0.6,
    source: 'subject_history:s1',
    confidence: 'HIGH',
  },
];

const OCCUPANCY_FIELDS_NO_SUBJECT: AssumptionFieldDef[] = OCCUPANCY_FIELDS_WITH_SUBJECT.map(f => ({
  ...f,
  subjectValue: null,
  effectiveValue: f.peerValue,
  blendWeight: null,
  source: 'tier3:platform',
  confidence: 'LOW' as const,
}));

// ─── Meta ───────────────────────────────────────────────────────────────────

const meta: Meta<typeof InlineAssumptionBlock> = {
  title: 'Components/InlineAssumptionBlock',
  component: InlineAssumptionBlock,
  parameters: {
    backgrounds: { default: 'dark', values: [{ name: 'dark', value: '#0A0E17' }] },
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ background: '#0A0E17', padding: 16, minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof InlineAssumptionBlock>;

// ─── Story 1: With subject history (S2, material + severe collision) ─────────

export const WithSubjectHistory: Story = {
  name: 'With Subject History — S2 (3-col mode)',
  args: {
    blockId: 'occupancy_leasing',
    blockLabel: 'Occupancy & Leasing',
    dealId: 'deal-demo',
    fields: OCCUPANCY_FIELDS_WITH_SUBJECT,
    hasSubjectHistory: true,
    subjectTier: 'S2',
    subjectSnapshotCount: 3,
    defaultExpanded: true,
    onOverride: (fieldId, value) => console.log('OVERRIDE', fieldId, value),
    onRevert: (fieldId) => console.log('REVERT', fieldId),
  },
};

// ─── Story 2: Without subject history (true 2-col mode) ──────────────────────

export const WithoutSubjectHistory: Story = {
  name: 'Without Subject History — 2-col mode',
  args: {
    blockId: 'occupancy_no_subj',
    blockLabel: 'Occupancy & Leasing',
    dealId: 'deal-demo',
    fields: OCCUPANCY_FIELDS_NO_SUBJECT,
    hasSubjectHistory: false,
    defaultExpanded: true,
    onOverride: (fieldId, value) => console.log('OVERRIDE', fieldId, value),
    onRevert: (fieldId) => console.log('REVERT', fieldId),
  },
};

// ─── Story 3: Edge cases ──────────────────────────────────────────────────────
// Covers: null peer, S1-only, severe collision, active override, range-guard,
//         and collapsed-with-⚠-badge (defaultExpanded: false).

const EDGE_FIELDS: AssumptionFieldDef[] = [
  {
    fieldId: 'occ_no_peer',
    label: 'Occupancy (no peer data)',
    format: 'pct',
    precision: 0.5,
    min: 0, max: 1,
    peerValue: null,
    subjectValue: 0.92,
    effectiveValue: 0.92,
    blendWeight: null,
    source: 'subject_history:s1',
    confidence: 'LOW',
  },
  {
    fieldId: 'signing_vel_s1',
    label: 'Signing Velocity (S1 only)',
    format: 'num',
    precision: 0.1,
    min: 0,
    peerValue: 7.5,
    subjectValue: null,
    effectiveValue: 7.5,
    blendWeight: null,
    source: 'tier3:platform',
    confidence: 'MED',
  },
  {
    fieldId: 'severe_collision',
    label: 'Days Vacant (severe)',
    format: 'days',
    precision: 1,
    min: 0,
    peerValue: 20,
    subjectValue: 65,
    effectiveValue: 47.5,
    blendWeight: 0.5,
    source: 'subject_history:s2',
    confidence: 'LOW',
    narrative: 'Days vacant 65d is severely elevated (3.8σ) vs peer median 20d. Property may face structural leasing challenges.',
  },
  {
    fieldId: 'with_override',
    label: 'Renewal Rate (overridden)',
    format: 'pct',
    precision: 0.5,
    min: 0, max: 1,
    peerValue: 0.55,
    subjectValue: 0.48,
    effectiveValue: 0.51,
    blendWeight: 0.62,
    source: 'subject_history:s2',
    confidence: 'HIGH',
    overrideValue: 0.58,
  },
  {
    fieldId: 'range_guard',
    label: 'Occupancy (range guard — try entering >1.0)',
    format: 'pct',
    precision: 0.5,
    min: 0, max: 1,
    peerValue: 0.94,
    subjectValue: 0.96,
    effectiveValue: 0.95,
    blendWeight: 0.7,
    source: 'subject_history:s2',
    confidence: 'HIGH',
  },
  {
    fieldId: 'concession_pct',
    label: 'Concession % of Rent',
    format: 'pct',
    precision: 0.1,
    min: 0, max: 0.5,
    peerValue: 0.095,
    subjectValue: 0.118,
    effectiveValue: 0.109,
    blendWeight: 0.55,
    source: 'subject_history:s2',
    confidence: 'MED',
  },
];

export const EdgeCases: Story = {
  name: 'Edge Cases — null peer, S1, severe, override, range-guard, collapsed ⚠',
  args: {
    blockId: 'edge_cases',
    blockLabel: 'Edge Case Demo',
    dealId: 'deal-demo',
    fields: EDGE_FIELDS,
    hasSubjectHistory: true,
    subjectTier: 'S1',
    subjectSnapshotCount: 1,
    defaultExpanded: false, // collapsed → ⚠ badge visible in header
    onOverride: (fieldId, value) => console.log('OVERRIDE', fieldId, value),
    onRevert: (fieldId) => console.log('REVERT', fieldId),
  },
};
