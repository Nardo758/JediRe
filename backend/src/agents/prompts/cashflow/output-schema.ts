/**
 * CashFlow Agent — Structured Output Schema
 *
 * Every proforma field is an UnderwritingOutputField with full evidence chain.
 * archive_percentile (0-100) indicates where the assumption lands in the
 * platform archive distribution — only present when archive has >= 5 samples.
 */

export const CASHFLOW_OUTPUT_SCHEMA = {
  type: 'object',
  description: 'CashFlow Agent underwriting output with evidence chain per field.',
  properties: {
    proforma_fields: {
      type: 'object',
      description: 'Map of field_path → UnderwritingOutputField',
      additionalProperties: {
        type: 'object',
        properties: {
          value: {
            oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
            description: 'Final underwritten value for this assumption',
          },
          source: {
            type: 'string',
            description: 'LayeredValueSource — e.g. tier1:t12, tier2:owned_asset, tier3:platform',
          },
          archive_percentile: {
            oneOf: [{ type: 'number', minimum: 0, maximum: 100 }, { type: 'null' }],
            description:
              'Where this assumption falls in the platform archive distribution (0=P10, 50=P50, 100=P90). ' +
              'Null when archive has < 5 samples for this bucket.',
          },
          evidence: {
            type: 'object',
            properties: {
              field_path: { type: 'string' },
              primary_tier: { type: 'integer', enum: [1, 2, 3, 4] },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              reasoning: { type: 'string', description: 'Plain-English explanation' },
              data_points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tier: { type: 'integer', enum: [1, 2, 3, 4] },
                    source: { type: 'string' },
                    label: { type: 'string' },
                    value: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] },
                    weight: { type: 'number', minimum: 0, maximum: 1 },
                    notes: { type: 'string' },
                  },
                  required: ['tier', 'source', 'label', 'value', 'weight'],
                },
              },
              alternatives: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    label: { type: 'string' },
                    value: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] },
                    delta_pct: { oneOf: [{ type: 'number' }, { type: 'null' }] },
                    reason_rejected: { type: 'string' },
                  },
                  required: ['source', 'label', 'value', 'reason_rejected'],
                },
              },
              collision: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      field_path: { type: 'string' },
                      agent_value: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] },
                      broker_value: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] },
                      delta_pct: { oneOf: [{ type: 'number' }, { type: 'null' }] },
                      magnitude: { type: 'string', enum: ['minor', 'material', 'severe'] },
                      direction: { type: 'string', enum: ['agent_higher', 'agent_lower', 'equal'] },
                      narrative: { type: 'string' },
                    },
                    required: ['field_path', 'agent_value', 'broker_value', 'delta_pct', 'magnitude', 'direction', 'narrative'],
                  },
                  { type: 'null' },
                ],
              },
            },
            required: ['field_path', 'primary_tier', 'confidence', 'reasoning', 'data_points', 'alternatives'],
          },
        },
        required: ['value', 'source', 'evidence'],
      },
    },
    collision_summary: {
      type: 'object',
      properties: {
        minor_count: { type: 'integer' },
        material_count: { type: 'integer' },
        severe_count: { type: 'integer' },
      },
      required: ['minor_count', 'material_count', 'severe_count'],
    },
    confidence_distribution: {
      type: 'object',
      properties: {
        high: { type: 'integer' },
        medium: { type: 'integer' },
        low: { type: 'integer' },
      },
      required: ['high', 'medium', 'low'],
    },
    tier_distribution: {
      type: 'object',
      properties: {
        tier1: { type: 'integer' },
        tier2: { type: 'integer' },
        tier3: { type: 'integer' },
        tier4: { type: 'integer' },
      },
      required: ['tier1', 'tier2', 'tier3', 'tier4'],
    },
    stabilization_year: {
      oneOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
      description:
        'First hold-period year where projected vacancy ≤ the stabilization threshold (1 − stabilization_target_pct, default 5%) ' +
        'AND every subsequent hold-period year also stays at or below the threshold (sustained stabilization). ' +
        'Year 1 means the asset is already stabilized at acquisition. ' +
        'Null when no hold-period year meets the sustained threshold — the deal never stabilizes within the hold.',
    },
    lifecycle_profile_used: {
      oneOf: [
        { type: 'string', enum: ['STABILIZED', 'VALUE_ADD', 'DISTRESSED', 'DEVELOPMENT'] },
        { type: 'null' },
      ],
      description:
        'The lifecycle profile that governed pre-stabilization formula branching in this run. ' +
        'Always set when Block 7 branching executes: STABILIZED | VALUE_ADD | DISTRESSED | DEVELOPMENT. ' +
        'Echoes effective_lifecycle_profile from deal assumptions (override > detected). ' +
        'Null only when effective_lifecycle_profile is completely absent from deal assumptions.',
    },
    invariant_check: {
      type: 'object',
      description:
        'Formula consistency invariant check result (Block 7e). ' +
        'Verifies that the pre-stabilization formula and the at-stabilization formula agree at the boundary year. ' +
        'Always present — status is SKIPPED when stabilization_year is null or 1 (no pre-stab phase).',
      properties: {
        status: {
          type: 'string',
          enum: ['PASSED', 'FAILED', 'SKIPPED'],
          description: 'PASSED when |pre_stab_noi - stab_noi| / stab_noi < 5%; FAILED when >= 5%; SKIPPED when no pre-stab phase.',
        },
        pre_stab_noi: {
          oneOf: [{ type: 'number' }, { type: 'null' }],
          description: 'Annual NOI at stabilization_year computed via the pre-stabilization formula path.',
        },
        stab_noi: {
          oneOf: [{ type: 'number' }, { type: 'null' }],
          description: 'Annual NOI at stabilization_year computed via the canonical at-stabilization formula.',
        },
        delta_pct: {
          oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }],
          description: 'Relative gap: |pre_stab_noi - stab_noi| / stab_noi as a decimal (e.g. 0.031 = 3.1%). Null when stab_noi is zero/negative or status is SKIPPED.',
        },
        reason: {
          type: 'string',
          description: 'Plain-English explanation of the check result.',
        },
      },
      required: ['status', 'pre_stab_noi', 'stab_noi', 'delta_pct', 'reason'],
    },
    summary: { type: 'string', description: '3-5 sentence synthesis of key findings' },
    completed_at: { type: 'string', format: 'date-time' },
    cashflow: {
      type: 'object',
      description: 'Cashflow agent computed outputs beyond individual proforma fields.',
      properties: {
        stabilization_year: {
          oneOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
          description:
            'First hold-period year where vacancy % reaches the stabilization threshold ' +
            '(1 - stabilization_target_pct) AND all subsequent hold-period years also remain ' +
            'at or below the threshold. 1 = already stabilized at acquisition. ' +
            'null = deal never reaches sustained stabilization within the hold period.',
        },
      },
      required: ['stabilization_year'],
    },
  },
  required: [
    'proforma_fields',
    'stabilization_year',
    'lifecycle_profile_used',
    'collision_summary',
    'confidence_distribution',
    'tier_distribution',
    'summary',
    'completed_at',
  ],
};
