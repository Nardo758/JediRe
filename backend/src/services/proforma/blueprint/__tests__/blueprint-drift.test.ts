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
  OPEX_LINE_ITEMS,
  BLUEPRINT_TO_ENGINE_OPEX_MAP,
} from '../proforma-blueprint';
import { FINANCIAL_ENGINE_OPEX_KEYS } from '../../../financial-model-engine.service';
import {
  MODULE_REGISTRY,
  type ModuleId,
  type ModuleDefinition,
} from '../../../module-wiring/module-registry';
import * as fs from 'fs';
import * as path from 'path';
import { validateProformaPayload } from '../payload-validator';

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
    const m09Inputs = new Set<ModuleId>(MODULE_REGISTRY.M09.receivesFrom.map(d => d.moduleId));
    const entries = Object.entries(MODULE_REGISTRY) as Array<[ModuleId, ModuleDefinition]>;
    for (const [moduleId, mod] of entries) {
      if (moduleId === 'M09') continue;
      if (mod.feedsInto.includes('M09')) {
        expect(m09Inputs.has(moduleId)).toBe(true);
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

  test('generated JSON artifact matches in-memory blueprint exactly', () => {
    const jsonPath = path.join(__dirname, '..', 'proforma-blueprint.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    // Compare via canonical JSON string round-trip so key order doesn't matter.
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(PROFORMA_BLUEPRINT)));
  });
});

describe('Blueprint ↔ Financial-Model Engine drift (OPEX schema)', () => {
  test('every blueprint OPEX line maps to ≥1 engine key', () => {
    const blueprintKeys = OPEX_LINE_ITEMS.map(l => l.key);
    for (const k of blueprintKeys) {
      const mapped = BLUEPRINT_TO_ENGINE_OPEX_MAP[k];
      expect(Array.isArray(mapped)).toBe(true);
      expect(mapped.length).toBeGreaterThan(0);
    }
  });

  test('every mapped engine key exists in FINANCIAL_ENGINE_OPEX_KEYS', () => {
    const engineKeySet = new Set<string>(FINANCIAL_ENGINE_OPEX_KEYS);
    for (const [bpKey, engineKeys] of Object.entries(BLUEPRINT_TO_ENGINE_OPEX_MAP)) {
      for (const ek of engineKeys) {
        expect(engineKeySet.has(ek)).toBe(true);
      }
    }
  });

  test('every engine OPEX key is claimed by exactly one blueprint line', () => {
    const claimedBy: Record<string, string[]> = {};
    for (const [bpKey, engineKeys] of Object.entries(BLUEPRINT_TO_ENGINE_OPEX_MAP)) {
      for (const ek of engineKeys) {
        claimedBy[ek] = claimedBy[ek] ? [...claimedBy[ek], bpKey] : [bpKey];
      }
    }
    const unclaimed = FINANCIAL_ENGINE_OPEX_KEYS.filter(k => !claimedBy[k]);
    expect(unclaimed).toEqual([]);
    for (const [ek, owners] of Object.entries(claimedBy)) {
      expect(owners.length).toBe(1);
    }
  });
});

describe('Pro Forma Payload Validator — schema enforcement', () => {
  test('rejects payload referencing UNKNOWN section ids', () => {
    const result = validateProformaPayload({
      template: 'acquisition_stabilized',
      horizon: 60,
      periodicity: 'annual',
      sections: [{ id: 'fake_section_xyz', fields: {} }],
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some(i => i.severity === 'error' && i.message.includes('Unknown section id'))
    ).toBe(true);
  });

  test('rejects payload referencing UNKNOWN field keys inside a known section', () => {
    const tpl = PROFORMA_TEMPLATES.acquisition_stabilized;
    const firstSection = tpl.sections[0];
    const validFields: Record<string, unknown> = {};
    for (const f of firstSection.fields) {
      validFields[f] = { value: 1, source: 'platform', origin: 'platform_default', confidence: 0.9, asOf: '2026-01-01' };
    }
    validFields.fake_field_xyz = { value: 999, source: 'platform', origin: 'opus_inferred', confidence: 0.5, asOf: '2026-01-01' };
    const result = validateProformaPayload({
      template: 'acquisition_stabilized',
      horizon: 60,
      periodicity: 'annual',
      sections: [{ id: firstSection.id, fields: validFields }],
    });
    expect(
      result.issues.some(i => i.severity === 'error' && i.message.includes('Unknown field'))
    ).toBe(true);
  });

  test('rejects payload using an UNKNOWN revenue formula', () => {
    const result = validateProformaPayload({
      template: 'acquisition_stabilized',
      horizon: 60,
      periodicity: 'annual',
      revenueFormula: 'totally_made_up',
      sections: [],
    });
    expect(
      result.issues.some(i => i.severity === 'error' && i.message.includes('Unknown revenue formula'))
    ).toBe(true);
  });
});
