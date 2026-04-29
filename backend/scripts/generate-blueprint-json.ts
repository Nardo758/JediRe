/**
 * Generate the Pro Forma Blueprint JSON artifact from the canonical TS source.
 *
 * Run via:  cd backend && npx ts-node scripts/generate-blueprint-json.ts
 *
 * The JSON file is committed alongside the TS source so other languages /
 * tools (Opus prompt builder, frontend, monitoring) can consume the blueprint
 * without a TypeScript dependency. The drift test asserts the JSON matches
 * the in-memory blueprint exactly.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROFORMA_BLUEPRINT } from '../src/services/proforma/blueprint/proforma-blueprint';

const out = path.join(__dirname, '..', 'src', 'services', 'proforma', 'blueprint', 'proforma-blueprint.json');
const json = JSON.stringify(PROFORMA_BLUEPRINT, null, 2) + '\n';
fs.writeFileSync(out, json);
console.log(`Wrote ${out} (${json.length} bytes, version ${PROFORMA_BLUEPRINT.version})`);
