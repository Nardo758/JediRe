/**
 * Verify the OM Upload → Agent Pipeline
 *
 * Run on Replit after pulling latest code:
 *   cd backend && npx tsx ../scripts/verify-hub-pipeline.ts
 *
 * Checks:
 *   1. DocumentsSection has 'Offering Memorandum' in CATEGORIES
 *   2. Acquisitions agent has document_uploaded trigger for offering_memorandum
 *   3. Acquisitions agent has write_underwriting in allowedSkills
 *   4. event-dispatcher exports getTriggeredAgents and eventDispatcher
 *   5. auto-extract-on-upload imports eventDispatcher
 *   6. agent-orchestrator has substring-matching checkConditions
 *   7. write_underwriting tool exists
 *   8. Context-awareness routes have POST /query
 *   9. agent-status routes exist
 *   10. NeuralNetworkHubWidget component exists
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const passes: string[] = [];
const fails: string[] = [];
const warnings: string[] = [];

function check(label: string, condition: boolean, notes?: string) {
  if (condition) {
    passes.push(`✅ ${label}`);
  } else {
    fails.push(`❌ ${label}`);
    if (notes) warnings.push(`   └─ ${notes}`);
  }
}

function fileContent(f: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, f), 'utf-8');
  } catch {
    return '';
  }
}

console.log(`\n🔍 Verifying OM Upload → Agent Pipeline\n`);
console.log(`   Repo root: ${ROOT}\n`);

// ── FRONTEND ──

const docSection = fileContent('frontend/src/components/deal/sections/DocumentsSection.tsx');
check(
  'DocumentsSection has "Offering Memorandum" in CATEGORIES',
  docSection.includes("'Offering Memorandum'"),
  'Add "Offering Memorandum" to the CATEGORIES array (line ~27)'
);
check(
  'DocumentsSection has "T12" in CATEGORIES',
  docSection.includes("'T12'"),
);
check(
  'DocumentsSection has "Rent Roll" in CATEGORIES',
  docSection.includes("'Rent Roll'"),
);

// ── AGENT PERSONAS ──

const personas = fileContent('backend/src/services/agents/agent-personas.ts');
check(
  'Acquisitions agent triggered on offering_memorandum upload',
  personas.includes("category: 'offering_memorandum'") && personas.includes("document_uploaded"),
  'Add trigger event to acquisitions agent (line ~470)'
);
check(
  'Acquisitions agent has write_underwriting skill',
  personas.includes("'write_underwriting'"),
  'Add write_underwriting to allowedSkills array'
);
check(
  'Acquisitions agent prompt references KG + Data Library cross-ref',
  personas.includes('fetch_comps') && personas.includes('fetch_data_library_comps') && personas.includes('fetch_data_matrix'),
  'Update systemPrompt to include cross-reference instructions'
);

// ── EVENT DISPATCHER ──

const dispatcher = fileContent('backend/src/services/agents/event-dispatcher.ts');
check(
  'event-dispatcher exports getTriggeredAgents',
  dispatcher.includes('export function getTriggeredAgents'),
);
check(
  'event-dispatcher exports eventDispatcher',
  dispatcher.includes('export const eventDispatcher'),
);
check(
  'event-dispatcher has onDocumentUploaded method',
  dispatcher.includes('async onDocumentUploaded'),
);
check(
  'EVENT_AGENT_MAP includes document_uploaded',
  dispatcher.includes("'document_uploaded'"),
);

// ── AUTO-EXTRACT ON UPLOAD ──

const autoExtract = fileContent('backend/src/services/document-extraction/auto-extract-on-upload.ts');
check(
  'auto-extract-on-upload imports eventDispatcher',
  autoExtract.includes("import { eventDispatcher }"),
  'Add import for eventDispatcher'
);
check(
  'auto-extract-on-upload fires onDocumentUploaded after extraction',
  autoExtract.includes('eventDispatcher.onDocumentUploaded'),
  'Add eventDispatcher.onDocumentUploaded() call after successful extraction'
);

// ── AGENT ORCHESTRATOR ──

const orchestrator = fileContent('backend/src/services/agents/agent-orchestrator.ts');
check(
  'agent-orchestrator has substring checkConditions',
  orchestrator.includes('normalizedData.includes(normalizedCondition)'),
  'Update checkConditions to use normalized substring matching'
);

// ── WRITE UNDERWRITING TOOL ──

const writeUnderwriting = fileContent('backend/src/agents/tools/write_underwriting.ts');
check(
  'write_underwriting tool exists',
  writeUnderwriting.includes("name: 'write_underwriting'") && writeUnderwriting.includes("evidence_rows"),
);

// ── ROUTES ──

const contextRoutes = fileContent('backend/src/api/rest/context-awareness.routes.ts');
check(
  'context-awareness routes have POST /query',
  contextRoutes.includes("router.post('/query'"),
  'Add POST /query endpoint to context-awareness.routes.ts'
);

const agentStatusRoutes = fileContent('backend/src/api/rest/agent-status.routes.ts');
check(
  'agent-status routes exist',
  agentStatusRoutes.length > 50,
  'Create backend/src/api/rest/agent-status.routes.ts'
);

// ── FRONTEND WIDGET ──

const widgetExists = fs.existsSync(path.join(ROOT, 'frontend/src/components/dashboard/NeuralNetworkHubWidget.tsx'))
  || fs.existsSync(path.join(ROOT, 'frontend/src/components/dashboard/NeuralNetworkHub.tsx'));
check(
  'NeuralNetworkHub widget component exists',
  widgetExists,
  'Create the widget component (NeuralNetworkHubWidget.tsx or NeuralNetworkHub.tsx)'
);

const terminalPage = fileContent('frontend/src/pages/TerminalPage.tsx');
check(
  'TerminalPage imports NeuralNetworkHub',
  terminalPage.includes('NeuralNetworkHub'),
  'Add import for NeuralNetworkHub(Widget)'
);
check(
  'neural-hub registered in widget catalog',
  terminalPage.includes('neural-hub'),
  'Add {id:"neural-hub"...} to widget catalog'
);

// ── MIGRATIONS ──

const migDir = 'backend/src/database/migrations';
const migFiles = fs.existsSync(path.join(ROOT, migDir))
  ? fs.readdirSync(path.join(ROOT, migDir)).filter(f => f.includes('neural'))
  : [];
check(
  `Neural hub migrations exist (${migFiles.length} found)`,
  migFiles.length > 0,
  `Expected migrations like: 20260426_neural_hub_agent_workflow_runs.sql`
);

// ── SUMMARY ──

console.log(`\n${'═'.repeat(60)}`);
console.log(`   RESULTS\n`);
for (const p of passes) console.log(`   ${p}`);
for (const f of fails) console.log(`   ${f}`);
for (const w of warnings) console.log(`   ${w}`);

console.log(`\n   ${passes.length} passed · ${fails.length} failed · ${warnings.length} action items`);
console.log(`\n${'═'.repeat(60)}`);

if (fails.length > 0) {
  console.log(`\n   🚨 ${fails.length} issues need fixing before the pipeline will work end-to-end.`);
  console.log(`   Run through the action items above and re-run this script.`);
  process.exit(1);
} else {
  console.log(`\n   ✅ Pipeline is fully wired! Upload an OM with "Offering Memorandum"`);
  console.log(`      category and the Acquisitions agent should fire automatically.`);
}
