/**
 * Blueprint Drift Test
 * ====================
 *
 * Asserts the Pro Forma Blueprint stays in sync with:
 *   - The Module Registry (M09 inputs and cycles)
 *   - The frontend deal-type-visibility F-key map
 *
 * Run via: npx jest backend/src/services/proforma/blueprint
 *
 * If you change the blueprint, the registry, or the F-key map, this test must
 * still pass — otherwise Opus will get a stale view of the world.
 */

import {
  PROFORMA_BLUEPRINT,
  M09_INPUTS,
  M09_CYCLES,
  FKEY_MAP,
  PROFORMA_TEMPLATES,
} from '../proforma-blueprint';
import { MODULE_REGISTRY } from '../../../module-wiring/module-registry';

describe('Pro Forma Blueprint drift', () => {
  test('blueprint version is set', () => {
    expect(PROFORMA_BLUEPRINT.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('every module listed as a M09 input exists in MODULE_REGISTRY', () => {
    for (const input of M09_INPUTS) {
      expect(MODULE_REGISTRY[input.moduleId]).toBeDefined();
    }
  });

  test('every M09 cycle partner exists in MODULE_REGISTRY', () => {
    for (const cycle of M09_CYCLES) {
      expect(MODULE_REGISTRY[cycle.partner]).toBeDefined();
    }
  });

  test('M09.receivesFrom is symmetric — every blueprint required input is in the registry', () => {
    const m09 = MODULE_REGISTRY.M09;
    expect(m09).toBeDefined();
    const registryInputs = new Set(m09.receivesFrom.map(d => d.moduleId));

    const blueprintRequired = M09_INPUTS
      .filter(i => i.strength === 'required' && !i.requiredByDealType)
      .map(i => i.moduleId);

    for (const moduleId of blueprintRequired) {
      expect(registryInputs.has(moduleId)).toBe(true);
    }
  });

  test('every module that declares feedsInto: M09 is mirrored in M09.receivesFrom', () => {
    const m09Inputs = new Set(MODULE_REGISTRY.M09.receivesFrom.map(d => d.moduleId));
    for (const [moduleId, mod] of Object.entries(MODULE_REGISTRY)) {
      if (moduleId === 'M09') continue;
      if (mod.feedsInto.includes('M09')) {
        expect(m09Inputs.has(moduleId as any)).toBe(true);
      }
    }
  });

  test('every F-key in the blueprint maps to an existing module (or is reserved)', () => {
    for (const [fkey, entry] of Object.entries(FKEY_MAP)) {
      if (!entry.module) continue; // reserved
      expect(MODULE_REGISTRY[entry.module]).toBeDefined();
    }
  });

  test('templates have at least one required section each', () => {
    for (const [id, tpl] of Object.entries(PROFORMA_TEMPLATES)) {
      expect(tpl.sections.some(s => s.required)).toBe(true);
    }
  });

  test('every template section has at least one field', () => {
    for (const [id, tpl] of Object.entries(PROFORMA_TEMPLATES)) {
      for (const section of tpl.sections) {
        expect(section.fields.length).toBeGreaterThan(0);
      }
    }
  });

  test('exactly one revenue formula is marked default', () => {
    const defaults = Object.values(PROFORMA_BLUEPRINT.revenueFormulas).filter(f => f.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(PROFORMA_BLUEPRINT.defaultRevenueFormula);
  });

  test('OPEX line items are exactly 9 (per spec §7)', () => {
    expect(PROFORMA_BLUEPRINT.opexLineItems).toHaveLength(9);
  });
});
