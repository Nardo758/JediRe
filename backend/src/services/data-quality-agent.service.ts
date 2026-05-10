/**
 * Data Quality Agent — Phase 1 (Task #691)
 *
 * Audits each document extraction against its source, compares field-by-field
 * to the extracted output and current Pro Forma column values, and writes
 * structured findings to `data_quality_alerts`.
 *
 * The agent runs asynchronously (fire-and-forget) and never blocks extraction
 * or rendering. It is triggered:
 *   1. After each parser invocation completes (per-extraction trigger)
 *   2. After ensureDealAssumptionsSeeded completes (per-reseed trigger)
 *
 * Caching: findings are skipped when neither the document hash nor the parser
 * version has changed since the last run for this (dealId, documentType).
 */

import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
// Phase 2 (Task #698): field-level write-time helpers replace the coarse
// deals.updated_at proxy used in Phase 1 for WRITE_RACE vs STALE_SEED
// timestamp classification. Import is wired here; call sites are marked with
// "Phase 2 TODO" comments. Task #696 activates the full classification logic.
import { fetchFieldWriteTimes, classifyTimestampDelta, computeDeltaSeconds } from './extraction-events.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DqaClassification =
  | 'PARSER_MISS'
  | 'PARSER_INCORRECT'
  | 'RANGE_ANOMALY'
  | 'INCONSISTENCY'
  | 'SEED_PLUMBING'
  | 'CROSS_DOC_VARIANCE'
  | 'LOW_CONFIDENCE_EXTRACTION';

export type DqaSeverity = 'critical' | 'warning' | 'info';
export type DqaStatus   = 'open' | 'dismissed' | 'acknowledged' | 'fixed';

export interface DqaSourceEvidence {
  page:    number | null;
  section: string | null;
  snippet: string | null;
}

export interface DqaFinding {
  classification:     DqaClassification;
  proforma_column:    string;
  proforma_row:       string;
  source_evidence:    DqaSourceEvidence;
  reasoning:          string;
  extracted_value:    string | number | null;
  expected_value:     string | number | null;
  confidence:         number;
  recommended_action: string;
}

interface AgentRunResult {
  findings:        DqaFinding[];
  fromCache:       boolean;
  parserVersion:   string;
  documentHash:    string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PARSER_VERSION = '1.0.0';
const MIN_CONFIDENCE = 0.6;

const SEVERITY_MAP: Record<DqaClassification, DqaSeverity> = {
  PARSER_MISS:               'warning',
  PARSER_INCORRECT:          'critical',
  RANGE_ANOMALY:             'warning',
  INCONSISTENCY:             'warning',
  SEED_PLUMBING:             'warning',
  CROSS_DOC_VARIANCE:        'info',
  LOW_CONFIDENCE_EXTRACTION: 'info',
};

// Proforma rows audited per document type.
// Only rows where the document type is the primary or sole source.
const AUDIT_ROWS_BY_DOCTYPE: Record<string, string[]> = {
  OM: [
    'gpr', 'vacancy_pct', 'real_estate_tax', 'contract_services',
    'payroll', 'insurance', 'management_fee_pct', 'noi',
  ],
  T12: [
    'gpr', 'vacancy_pct', 'real_estate_tax', 'contract_services',
    'payroll', 'repairs_maintenance', 'turnover', 'marketing',
    'utilities', 'insurance', 'management_fee_pct', 'noi',
  ],
  RENT_ROLL: [
    'gpr', 'vacancy_pct', 'other_income_total',
  ],
  TAX_BILL: [
    'real_estate_tax',
  ],
};

// Proforma column that a document type populates
const COLUMN_BY_DOCTYPE: Record<string, string> = {
  OM:        'broker',
  T12:       't12',
  RENT_ROLL: 'rent_roll',
  TAX_BILL:  'tax_bill',
};

// ── Cache helpers ─────────────────────────────────────────────────────────────

function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

async function getCachedFindings(
  pool: Pool,
  dealId: string,
  documentType: string,
  documentHash: string,
  parserVersion: string
): Promise<DqaFinding[] | null> {
  const res = await pool.query(
    `SELECT agent_finding
       FROM data_quality_alerts
      WHERE deal_id = $1
        AND document_type = $2
        AND status = 'open'
        AND agent_finding->>'document_hash' = $3
        AND agent_finding->>'parser_version' = $4
      LIMIT 50`,
    [dealId, documentType, documentHash, parserVersion]
  );
  if (res.rows.length === 0) return null;
  return res.rows.map((r: { agent_finding: DqaFinding & { document_hash?: string; parser_version?: string } }) => r.agent_finding as DqaFinding);
}

// ── Claude prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a real estate underwriting data quality auditor. You compare extracted financial values from offering documents to expected values in a Pro Forma.

Your job:
1. For each proforma row listed, check whether the extracted value (from the document) matches what the parser recorded.
2. Flag discrepancies as specific finding classifications.
3. NEVER flag EXTRACTION_OK or NOT_IN_DOC findings — only surface genuine problems.

Classification rules:
- PARSER_MISS: The document clearly contains a value for this row but the extracted value is null/zero.
- PARSER_INCORRECT: The extracted value differs from the source document value by >5%.
- RANGE_ANOMALY: The extracted value is technically present but implausible (e.g. NOI/unit > $30,000/year or < $500/year for multifamily).
- INCONSISTENCY: Internal contradiction within the same document (e.g. stated NOI ≠ Revenue − Expenses).
- SEED_PLUMBING: A value was extracted and stored but did not propagate to the Pro Forma year1 slot.
- CROSS_DOC_VARIANCE: Value differs materially from another uploaded document's data for the same field.
- LOW_CONFIDENCE_EXTRACTION: Extracted value present but the document text is ambiguous or unclear.

Confidence: rate 0–1 how certain you are this is a genuine problem (not a document omission).
Only include findings with confidence >= ${MIN_CONFIDENCE}.

Output ONLY findings via the report_findings tool. Do not output any text.`;
}

function buildUserPrompt(
  documentType: string,
  proformaRows: Array<{ row: string; column: string; extractedValue: unknown; year1SlotValue: unknown; label: string }>,
  documentExcerpt: string,
  seedGaps: Array<{ field: string; slot: string }> | null
): string {
  const rowsTable = proformaRows.map(r =>
    `  ${r.row} (${r.label}): extracted=${JSON.stringify(r.extractedValue)}, year1_slot=${JSON.stringify(r.year1SlotValue)}`
  ).join('\n');

  const gapsNote = seedGaps && seedGaps.length > 0
    ? `\nSeed plumbing gaps detected (source uploaded but year1 slot is null):\n${seedGaps.map(g => `  ${g.field}.${g.slot}`).join('\n')}`
    : '';

  return `Document type: ${documentType}

Proforma rows to audit (extracted value vs year1 slot):
${rowsTable}
${gapsNote}

Relevant document excerpt (operating statement section):
---
${documentExcerpt.slice(0, 8000)}
---

Audit all rows above and report any findings.`;
}

// ── Claude call ───────────────────────────────────────────────────────────────

async function callAgent(
  documentType: string,
  proformaRows: Array<{ row: string; column: string; extractedValue: unknown; year1SlotValue: unknown; label: string }>,
  documentExcerpt: string,
  seedGaps: Array<{ field: string; slot: string }> | null
): Promise<DqaFinding[]> {
  const reportTool = {
    name: 'report_findings',
    description: 'Report data quality findings for the audited proforma rows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['classification', 'proforma_column', 'proforma_row', 'source_evidence', 'reasoning', 'extracted_value', 'expected_value', 'confidence', 'recommended_action'],
            properties: {
              classification:     { type: 'string', enum: ['PARSER_MISS', 'PARSER_INCORRECT', 'RANGE_ANOMALY', 'INCONSISTENCY', 'SEED_PLUMBING', 'CROSS_DOC_VARIANCE', 'LOW_CONFIDENCE_EXTRACTION'] },
              proforma_column:    { type: 'string' },
              proforma_row:       { type: 'string' },
              source_evidence:    {
                type: 'object',
                properties: { page: { type: ['number', 'null'] }, section: { type: ['string', 'null'] }, snippet: { type: ['string', 'null'] } },
              },
              reasoning:          { type: 'string' },
              extracted_value:    { type: ['string', 'number', 'null'] },
              expected_value:     { type: ['string', 'number', 'null'] },
              confidence:         { type: 'number', minimum: 0, maximum: 1 },
              recommended_action: { type: 'string' },
            },
          },
        },
      },
      required: ['findings'],
    },
  };

  const messages = [
    {
      role: 'user' as const,
      content: buildUserPrompt(documentType, proformaRows, documentExcerpt, seedGaps),
    },
  ];

  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages,
    tools: [reportTool as Anthropic.Tool],
    tool_choice: { type: 'any' },
  });

  const toolUse = response.content.find(
    (c) => c.type === 'tool_use' && (c as unknown as { name: string }).name === 'report_findings'
  );
  if (!toolUse || toolUse.type !== 'tool_use') return [];

  const input = (toolUse as unknown as { input: { findings?: DqaFinding[] } }).input;
  const findings = input?.findings ?? [];

  return findings
    .filter((f: DqaFinding) => f.confidence >= MIN_CONFIDENCE)
    .filter((f: DqaFinding) => ['PARSER_MISS', 'PARSER_INCORRECT', 'RANGE_ANOMALY', 'INCONSISTENCY', 'SEED_PLUMBING', 'CROSS_DOC_VARIANCE', 'LOW_CONFIDENCE_EXTRACTION'].includes(f.classification));
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function supersedeExistingFindings(
  pool: Pool,
  dealId: string,
  documentType: string,
  proformaColumn: string,
  proformaRow: string,
  newFindingId: string
): Promise<void> {
  await pool.query(
    `UPDATE data_quality_alerts
        SET status       = 'open',
            superseded_by = $5,
            updated_at   = NOW()
      WHERE deal_id        = $1
        AND document_type  = $2
        AND proforma_column = $3
        AND proforma_row   = $4
        AND status         = 'open'
        AND id             != $5::uuid`,
    [dealId, documentType, proformaColumn, proformaRow, newFindingId]
  );
}

async function writeFindings(
  pool: Pool,
  dealId: string,
  documentType: string,
  findings: DqaFinding[],
  documentHash: string,
  parserVersion: string
): Promise<void> {
  for (const f of findings) {
    const severity = SEVERITY_MAP[f.classification] ?? 'warning';
    const agentFinding = {
      ...f,
      document_hash: documentHash,
      parser_version: parserVersion,
    };

    const insertRes = await pool.query(
      `INSERT INTO data_quality_alerts
         (deal_id, document_type, proforma_column, proforma_row,
          classification, severity, agent_finding, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'open', NOW(), NOW())
       RETURNING id`,
      [dealId, documentType, f.proforma_column, f.proforma_row, f.classification, severity, JSON.stringify(agentFinding)]
    );

    const newId = insertRes.rows[0]?.id as string;
    if (newId) {
      await supersedeExistingFindings(pool, dealId, documentType, f.proforma_column, f.proforma_row, newId);
    }
  }
}

// ── Proforma row data fetcher ─────────────────────────────────────────────────

async function fetchProformaRowData(
  pool: Pool,
  dealId: string,
  documentType: string
): Promise<Array<{ row: string; column: string; extractedValue: unknown; year1SlotValue: unknown; label: string }>> {
  const column = COLUMN_BY_DOCTYPE[documentType] ?? 'broker';
  const rows   = AUDIT_ROWS_BY_DOCTYPE[documentType] ?? [];

  const dealRes = await pool.query(
    `SELECT d.deal_data, da.year1
       FROM deals d
       LEFT JOIN deal_assumptions da ON da.deal_id = d.id
      WHERE d.id = $1`,
    [dealId]
  );
  if (dealRes.rows.length === 0) return [];

  const dealData = dealRes.rows[0].deal_data as Record<string, unknown> | null ?? {};
  const year1    = dealRes.rows[0].year1    as Record<string, unknown> | null ?? {};

  const capsuleKey = `extraction_${documentType.toLowerCase().replace('_', '')}`;
  const capsule    = dealData[capsuleKey] as Record<string, unknown> | null ?? {};
  const brokerClaims = (documentType === 'OM' ? (dealData.broker_claims as Record<string, unknown> | null ?? {}) : {}) as Record<string, unknown>;
  const proforma   = (brokerClaims?.proforma as Record<string, unknown> | null) ?? {};

  const LABEL_MAP: Record<string, string> = {
    gpr:                'Gross Potential Rent',
    vacancy_pct:        'Vacancy %',
    real_estate_tax:    'Real Estate Tax',
    contract_services:  'Contract Services',
    payroll:            'Payroll',
    repairs_maintenance: 'Repairs & Maintenance',
    turnover:           'Turnover',
    marketing:          'Marketing',
    utilities:          'Utilities',
    insurance:          'Insurance',
    management_fee_pct: 'Management Fee %',
    noi:                'Net Operating Income',
    other_income_total: 'Other Income',
  };

  const CAPSULE_KEY_MAP: Record<string, string> = {
    gpr:                'gpr',
    vacancy_pct:        'vacancy_pct',
    real_estate_tax:    'real_estate_tax',
    contract_services:  'contract_services',
    payroll:            'payroll',
    repairs_maintenance: 'repairs_maintenance',
    turnover:           'turnover',
    marketing:          'marketing',
    utilities:          'utilities',
    insurance:          'insurance',
    noi:                'noi',
    other_income_total: 'other_income_total',
  };

  const PROFORMA_KEY_MAP: Record<string, string> = {
    gpr:               'stabilizedGpr',
    real_estate_tax:   'realEstateTaxesAnnual',
    contract_services: 'contractServicesAnnual',
    payroll:           'payrollAnnual',
    insurance:         'insuranceAnnual',
    noi:               'yearOneNOI',
  };

  return rows.map(row => {
    let extractedValue: unknown = null;
    if (documentType === 'OM') {
      extractedValue = proforma[PROFORMA_KEY_MAP[row] ?? row] ?? null;
    } else {
      extractedValue = capsule[CAPSULE_KEY_MAP[row] ?? row] ?? null;
    }

    const year1Row = year1[row] as Record<string, unknown> | null;
    const year1SlotValue = year1Row?.[column] ?? null;

    return {
      row,
      column,
      extractedValue,
      year1SlotValue,
      label: LABEL_MAP[row] ?? row,
    };
  });
}

// ── Document excerpt extractor ────────────────────────────────────────────────

function extractDocumentExcerpt(filePath: string): string {
  if (!filePath || !fs.existsSync(filePath)) return '[document not available]';
  try {
    const buf = fs.readFileSync(filePath);
    if (filePath.endsWith('.pdf')) {
      return '[PDF — text extraction not available in excerpt mode; Claude will analyze from structured data]';
    }
    return buf.toString('utf8').slice(0, 8000);
  } catch {
    return '[document read error]';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RunDataQualityAgentOpts {
  dealId:       string;
  documentType: string;
  filePath?:    string;
  seedGaps?:    Array<{ field: string; slot: string }> | null;
}

/**
 * Run the Data Quality Agent for a single document extraction.
 * Fire-and-forget safe — errors are caught and logged.
 */
export async function runDataQualityAgent(
  pool: Pool,
  opts: RunDataQualityAgentOpts
): Promise<AgentRunResult | null> {
  const { dealId, documentType, filePath, seedGaps } = opts;

  const auditRows = AUDIT_ROWS_BY_DOCTYPE[documentType];
  if (!auditRows || auditRows.length === 0) return null;

  try {
    const documentHash  = filePath && fs.existsSync(filePath)
      ? hashBuffer(fs.readFileSync(filePath))
      : 'no-file';

    const cached = await getCachedFindings(pool, dealId, documentType, documentHash, PARSER_VERSION);
    if (cached !== null) {
      return { findings: cached, fromCache: true, parserVersion: PARSER_VERSION, documentHash };
    }

    const proformaRows   = await fetchProformaRowData(pool, dealId, documentType);
    const documentExcerpt = extractDocumentExcerpt(filePath ?? '');

    const findings = await callAgent(documentType, proformaRows, documentExcerpt, seedGaps ?? null);

    await writeFindings(pool, dealId, documentType, findings, documentHash, PARSER_VERSION);

    console.log(JSON.stringify({
      event:          'dqa.complete',
      deal_id:        dealId,
      document_type:  documentType,
      findings_count: findings.length,
      from_cache:     false,
      parser_version: PARSER_VERSION,
      timestamp:      new Date().toISOString(),
    }));

    return { findings, fromCache: false, parserVersion: PARSER_VERSION, documentHash };
  } catch (err) {
    console.error('[DataQualityAgent] error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Trigger the agent after a reseed, using the seed observability log's gap list
 * to focus on SEED_PLUMBING findings.
 *
 * Phase 1 timestamp proxy (Task #696): uses deals.updated_at as a coarse proxy
 * for "when source data was last written." This fires on any deal edit, not
 * specifically on extraction writes, so it can misclassify STALE_SEED as WRITE_RACE
 * when an unrelated edit (e.g. deal rename) happens after seeding.
 *
 * Phase 2 TODO (Task #698 — active after Task #696 ships):
 *   Replace the deals.updated_at proxy with per-field extraction event timestamps:
 *
 *   const fieldNames = relevantGaps.map(g => g.field);
 *   const writeTimes = await fetchFieldWriteTimes(pool, dealId, documentType, fieldNames);
 *   const seedWrittenAt = ... (deal_assumptions.updated_at for this deal);
 *
 *   Then annotate each gap with:
 *     sourceWriteTime: writeTimes[g.field]?.toISOString() ?? null,
 *     seedWriteTime:   seedWrittenAt?.toISOString() ?? null,
 *     deltaSeconds:    computeDeltaSeconds(writeTimes[g.field] ?? null, seedWrittenAt ?? null),
 *     classification:  classifyTimestampDelta(writeTimes[g.field] ?? null, seedWrittenAt ?? null),
 *
 *   Pass the annotated gaps to runDataQualityAgent so buildUserPrompt() can include
 *   timing context for Claude's WRITE_RACE vs STALE_SEED decision.
 *
 *   Imports (fetchFieldWriteTimes, classifyTimestampDelta, computeDeltaSeconds)
 *   are already imported from extraction-events.service.ts at the top of this file.
 *   extraction_events rows are populated by emitOmProformaEvents() in routeOM()
 *   (data-router.ts) from Task #698.
 */
export async function runDataQualityAgentAfterReseed(
  pool: Pool,
  dealId: string,
  seedGaps: Array<{ field: string; slot: string }>
): Promise<void> {
  if (seedGaps.length === 0) return;

  const uploadedTypes = await detectUploadedDocumentTypes(pool, dealId);
  for (const documentType of uploadedTypes) {
    const relevantGaps = seedGaps.filter(g => {
      const col = COLUMN_BY_DOCTYPE[documentType];
      return col && g.slot === col;
    });
    if (relevantGaps.length === 0) continue;
    setImmediate(() => {
      runDataQualityAgent(pool, { dealId, documentType, seedGaps: relevantGaps }).catch(() => {});
    });
  }
}

async function detectUploadedDocumentTypes(pool: Pool, dealId: string): Promise<string[]> {
  const res = await pool.query(
    `SELECT deal_data FROM deals WHERE id = $1`,
    [dealId]
  );
  if (res.rows.length === 0) return [];
  const dd = res.rows[0].deal_data as Record<string, unknown> | null ?? {};
  const types: string[] = [];
  if (dd.extraction_om)        types.push('OM');
  if (dd.extraction_t12)       types.push('T12');
  if (dd.extraction_rent_roll) types.push('RENT_ROLL');
  if (dd.extraction_tax_bill)  types.push('TAX_BILL');
  return types;
}
