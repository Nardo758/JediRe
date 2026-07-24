import { describe, it, expect } from 'vitest';
import { YEAR1_FIELD_MAP, PLAUSIBILITY_BOUNDS } from '../../src/services/deterministic/agent-overlay-writer';
import { RESOLVED_YEAR1_KEYS } from '../../src/services/assumption-store-builder';

/**
 * W1-7 Overlay Allowlist Guard
 *
 * Ensures that every fieldKey mapped to a year1 JSONB key by the agent overlay
 * writer also has a resolution path in buildAssumptionsFromStore.
 *
 * If a field gets patched into deal_assumptions.year1 but is never read back
 * during assumption rebuild, the overlay is silently dropped — a data-loss bug.
 *
 * Also checks that every field in PLAUSIBILITY_BOUNDS (fields the writer
 * explicitly validates) either has a year1 survival path or is documented as
 * a known pending gap.
 */
describe('W1-7: overlay allowlist guard', () => {
  it('every YEAR1_FIELD_MAP value has a resolution path in buildAssumptionsFromStore', () => {
    const mappedYear1Keys = new Set(Object.values(YEAR1_FIELD_MAP));
    const orphans: string[] = [];

    for (const year1Key of mappedYear1Keys) {
      if (!RESOLVED_YEAR1_KEYS.has(year1Key)) {
        orphans.push(year1Key);
      }
    }

    expect(orphans).toEqual([]);
  });

  it('no duplicate year1 mappings (one writer fieldKey → one year1 key)', () => {
    const values = Object.values(YEAR1_FIELD_MAP);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it('every plausibility-bound fieldKey either has year1 survival or is a documented pending gap', () => {
    // Fields that are validated by the overlay writer but intentionally do NOT
    // have a year1 LayeredValue representation (overlay-only provenance).
    const OVERLAY_ONLY_FIELDS = new Set<string>([
      'cap_rate',        // read-only display, never written by agent
      'exit_year',       // disposition timing, not stored as year1 LV
      'expense_growth',  // TODO: wire when per-year opex derivation lands
      'renovation_budget', // CapEx line-item, not a year1 scalar
    ]);

    const orphans: string[] = [];

    for (const fieldKey of Object.keys(PLAUSIBILITY_BOUNDS)) {
      if (OVERLAY_ONLY_FIELDS.has(fieldKey)) continue;

      const year1Key = YEAR1_FIELD_MAP[fieldKey];
      if (!year1Key || !RESOLVED_YEAR1_KEYS.has(year1Key)) {
        orphans.push(fieldKey);
      }
    }

    // rent_growth is the known pending gap from TICKET_RENT_GROWTH_ALLOWLIST_GAP.
    // When it is wired (II.13-aware scalar → array re-derivation), this assertion
    // will pass and rent_growth can be removed from the expected orphans list.
    expect(orphans).toEqual([
      'rent_growth', // pending: requires II.13 scalar→array re-derivation
    ]);
  });
});
