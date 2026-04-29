import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { PropertyScoringService } from './propertyScoring.service';
import {
  buildOpusBlueprintSlice,
  buildOpusBlueprintRules,
  defaultTemplateForDealType,
  pickTemplateForStrategy,
  PROFORMA_BLUEPRINT,
  type ProFormaTemplateId,
} from './proforma/blueprint';
import { validateProformaPayload } from './proforma/blueprint/payload-validator';
import {
  buildCustomTabSchemaForPrompt,
  CUSTOM_TAB_FIELD_CATALOG,
  CUSTOM_TAB_MAX_BLOCKS,
  CUSTOM_TAB_MAX_TITLE_LEN,
  CustomTabPayload,
} from './proforma/blueprint/custom-tab-schema';
import {
  CustomTabValidationResult,
  formatValidationIssuesForChat,
  validateCustomTabPayload,
} from './proforma/blueprint/custom-tab-validator';

/**
 * Re-derive the template the platform expects for a deal context, mirroring
 * the logic in `buildSystemPrompt`. Used by `streamChat` to pin Opus's payload
 * template to the active deal — payloads with any other template are rejected.
 */
function resolveExpectedTemplateId(
  ctx?: { dealType?: 'existing' | 'development' | 'redevelopment'; strategy?: string | null }
): ProFormaTemplateId {
  if (ctx?.strategy) return pickTemplateForStrategy(ctx.strategy);
  if (ctx?.dealType) return defaultTemplateForDealType(ctx.dealType);
  return 'acquisition_stabilized';
}

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

/** Row shape for a deal_custom_tabs row — mirrors the runtime DDL 1:1. */
export interface CustomTabRow {
  id: number;
  deal_id: string;
  user_id: string;
  tab_id: string;
  title: string;
  description: string | null;
  payload: CustomTabPayload;
  generation_prompt: string | null;
  model_version: string | null;
  conversation_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface OpusConversation {
  id: number;
  deal_id: string;
  user_id: string | null;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface OpusMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  created_at: Date;
}

export interface ProformaVersion {
  id: number;
  deal_id: string;
  conversation_id: number | null;
  version_name: string;
  version_number: number;
  proforma_data: any;
  assumptions: any;
  comparable_sources: any[];
  created_at: Date;
  updated_at: Date;
}

export class OpusService {
  private pool: Pool;
  private scoring: PropertyScoringService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.scoring = new PropertyScoringService(pool);
  }

  async createConversation(dealId: string, userId?: string, title?: string): Promise<OpusConversation> {
    const result = await this.pool.query(
      `INSERT INTO opus_conversations (deal_id, user_id, title) VALUES ($1, $2, $3) RETURNING *`,
      [dealId, userId || null, title || 'New Pro Forma Session']
    );
    return result.rows[0];
  }

  async getConversations(dealId: string): Promise<OpusConversation[]> {
    const result = await this.pool.query(
      `SELECT * FROM opus_conversations WHERE deal_id = $1 ORDER BY updated_at DESC`,
      [dealId]
    );
    return result.rows;
  }

  async getConversation(id: number): Promise<OpusConversation | null> {
    const result = await this.pool.query(`SELECT * FROM opus_conversations WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async deleteConversation(id: number): Promise<void> {
    await this.pool.query(`DELETE FROM opus_conversations WHERE id = $1`, [id]);
  }

  async getMessages(conversationId: number): Promise<OpusMessage[]> {
    const result = await this.pool.query(
      `SELECT * FROM opus_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );
    return result.rows;
  }

  async saveMessage(conversationId: number, role: string, content: string, metadata: any = {}): Promise<OpusMessage> {
    const result = await this.pool.query(
      `INSERT INTO opus_messages (conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, role, content, JSON.stringify(metadata)]
    );
    await this.pool.query(
      `UPDATE opus_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    );
    return result.rows[0];
  }

  async saveProformaVersion(
    dealId: string,
    conversationId: number | null,
    versionName: string,
    proformaData: any,
    assumptions: any = {},
    comparableSources: any[] = []
  ): Promise<ProformaVersion> {
    const countResult = await this.pool.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_num FROM opus_proforma_versions WHERE deal_id = $1`,
      [dealId]
    );
    const versionNumber = countResult.rows[0].next_num;

    const result = await this.pool.query(
      `INSERT INTO opus_proforma_versions (deal_id, conversation_id, version_name, version_number, proforma_data, assumptions, comparable_sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [dealId, conversationId, versionName, versionNumber, JSON.stringify(proformaData), JSON.stringify(assumptions), JSON.stringify(comparableSources)]
    );
    return result.rows[0];
  }

  async getProformaVersions(dealId: string): Promise<ProformaVersion[]> {
    const result = await this.pool.query(
      `SELECT * FROM opus_proforma_versions WHERE deal_id = $1 ORDER BY version_number DESC`,
      [dealId]
    );
    return result.rows;
  }

  async getProformaVersion(id: number): Promise<ProformaVersion | null> {
    const result = await this.pool.query(`SELECT * FROM opus_proforma_versions WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async deleteProformaVersion(id: number): Promise<void> {
    await this.pool.query(`DELETE FROM opus_proforma_versions WHERE id = $1`, [id]);
  }

  async gatherDealContext(dealId: string): Promise<string> {
    const sections: string[] = [];

    try {
      const dealResult = await this.pool.query(
        `SELECT * FROM deals WHERE id = $1 OR id::text = $1 LIMIT 1`,
        [dealId]
      );
      if (dealResult.rows.length > 0) {
        const deal = dealResult.rows[0];
        sections.push(`## Deal Overview\n- Name: ${deal.name}\n- Address: ${deal.address || 'N/A'}\n- City: ${deal.city || 'N/A'}\n- State: ${deal.state || 'N/A'}\n- Property Type: ${deal.property_type || 'Multifamily'}\n- Units: ${deal.units || 'TBD'}\n- Status: ${deal.status || 'Pipeline'}`);
      }
    } catch (e) { /* deal table may not exist or have different structure */ }

    try {
      const rentComps = await this.pool.query(
        `SELECT property_name, neighborhood, total_units, stories, year_built, occupancy_pct,
                avg_sf, rent_per_sf, studio_rent, one_bed_rent, two_bed_rent, three_bed_rent,
                concessions, ad_level
         FROM rent_comps ORDER BY property_name LIMIT 20`
      );
      if (rentComps.rows.length > 0) {
        let table = '## Rent Comps (West Palm Beach Market)\n| Property | Units | Stories | Year | Occ% | $/SF | Studio | 1BR | 2BR | 3BR |\n|---|---|---|---|---|---|---|---|---|---|\n';
        for (const r of rentComps.rows) {
          table += `| ${r.property_name} | ${r.total_units} | ${r.stories} | ${r.year_built} | ${r.occupancy_pct}% | $${r.rent_per_sf} | $${r.studio_rent || '-'} | $${r.one_bed_rent || '-'} | $${r.two_bed_rent || '-'} | $${r.three_bed_rent || '-'} |\n`;
        }
        sections.push(table);
      }
    } catch (e) { /* rent_comps may not exist */ }

    try {
      const capRates = await this.scoring.getCapRateEstimates();
      if (capRates.length > 0) {
        let table = '## Cap Rate Estimates by Neighborhood\n| Neighborhood | Properties | Avg $/Unit | Implied Cap Rate |\n|---|---|---|---|\n';
        for (const c of capRates.slice(0, 15)) {
          table += `| ${c.neighborhoodCode} | ${c.propertyCount} | $${c.avgAssessedPerUnit?.toLocaleString() || '-'} | ${c.impliedCapRate}% |\n`;
        }
        sections.push(table);
      }
    } catch (e) {}

    try {
      const designInputs = await this.scoring.getDesignInputs();
      sections.push(`## Market Density Benchmarks\n- Avg Density: ${designInputs.benchmarks.avgDensity.toFixed(1)} units/acre\n- Top Quartile: ${designInputs.benchmarks.topQuartileDensity.toFixed(1)} units/acre\n- Avg Stories: ${designInputs.benchmarks.avgStories}\n- Avg SF/Unit: ${designInputs.benchmarks.avgSfPerUnit}\n\n## Optimal Unit Mix\n- Studio: ${designInputs.optimalUnitMix.studio}%\n- 1-Bed: ${designInputs.optimalUnitMix.oneBed}%\n- 2-Bed: ${designInputs.optimalUnitMix.twoBed}%\n- 3-Bed: ${designInputs.optimalUnitMix.threeBed}%`);
    } catch (e) {}

    try {
      const supplyIntel = await this.scoring.getSupplyIntelligence();
      sections.push(`## Supply Intelligence\n- Total Properties: ${supplyIntel.summary.totalProperties}\n- Total Units: ${supplyIntel.summary.totalUnits}\n- New Supply (2015+): ${supplyIntel.summary.newSupplyUnits} (${supplyIntel.summary.newSupplyPct}% of market)`);
    } catch (e) {}

    return sections.join('\n\n');
  }

  async gatherComparableData(dealId: string): Promise<string> {
    let dealCity = '';
    let dealType = '';
    let dealUnits = 0;

    try {
      const dealResult = await this.pool.query(
        `SELECT city, property_type, units FROM deals WHERE id = $1 OR id::text = $1 LIMIT 1`,
        [dealId]
      );
      if (dealResult.rows.length > 0) {
        dealCity = dealResult.rows[0].city || '';
        dealType = dealResult.rows[0].property_type || '';
        dealUnits = dealResult.rows[0].units || 0;
      }
    } catch (e) {}

    const conditions: string[] = ['parsing_status = $1'];
    const params: any[] = ['complete'];
    let paramIdx = 2;

    if (dealCity) {
      conditions.push(`city ILIKE $${paramIdx}`);
      params.push(`%${dealCity}%`);
      paramIdx++;
    }
    if (dealType) {
      conditions.push(`property_type ILIKE $${paramIdx}`);
      params.push(`%${dealType}%`);
      paramIdx++;
    }

    try {
      const result = await this.pool.query(
        `SELECT file_name, city, zip_code, property_type, property_height, year_built, unit_count, source_type, parsed_data
         FROM data_library_files
         WHERE ${conditions.join(' OR ')}
         ORDER BY uploaded_at DESC LIMIT 10`,
        params
      );

      if (result.rows.length > 0) {
        let context = '## Comparable Data from Data Library\n';
        for (const f of result.rows) {
          context += `\n### ${f.file_name} (${f.source_type})\n`;
          context += `- City: ${f.city || 'N/A'}, Zip: ${f.zip_code || 'N/A'}\n`;
          context += `- Type: ${f.property_type || 'N/A'}, Height: ${f.property_height || 'N/A'}\n`;
          context += `- Units: ${f.unit_count || 'N/A'}, Year Built: ${f.year_built || 'N/A'}\n`;
          if (f.parsed_data && Object.keys(f.parsed_data).length > 0) {
            context += `- Parsed Data: ${JSON.stringify(f.parsed_data).substring(0, 2000)}\n`;
          }
        }
        return context;
      }
    } catch (e) {}

    return '';
  }

  /**
   * Build Opus system prompt.
   *
   * Per F9 Pro Forma Architecture spec (docs/architecture/f9-proforma-spec.md),
   * we inject a compact slice of the canonical blueprint so Opus reasons over a
   * pinned schema (templates, sections, rent terms, OPEX line items, revenue
   * formulas, provenance rules) rather than inventing them.
   *
   * Optional context (deal type / strategy) lets us send only the active
   * template's section list, keeping the slice small.
   */
  buildSystemPrompt(
    dealContext: string,
    comparableData: string,
    opts?: { dealType?: 'existing' | 'development' | 'redevelopment'; strategy?: string | null }
  ): string {
    let templateId: ProFormaTemplateId = 'acquisition_stabilized';
    if (opts?.strategy) templateId = pickTemplateForStrategy(opts.strategy);
    else if (opts?.dealType) templateId = defaultTemplateForDealType(opts.dealType);

    const blueprintSlice = buildOpusBlueprintSlice({ templateId, dealType: opts?.dealType });
    const blueprintRules = buildOpusBlueprintRules();

    return `You are Opus, JEDI RE's AI-powered pro forma model builder. You are an expert real estate financial analyst specializing in multifamily investment analysis.

## Your Capabilities
- Build complete pro forma financial models from property data
- Calculate IRR, cash-on-cash return, equity multiple, NOI, DSCR
- Generate multiple scenarios (Conservative, Base, Aggressive)
- Use real market data to inform assumptions (rent comps, cap rates, density benchmarks)
- Explain your reasoning and assumptions transparently

## Rules
1. Always use the real market data provided below — never make up numbers
2. When building a pro forma, output it as a structured JSON block wrapped in \`\`\`proforma tags so the UI can render it as a table
3. Show your math and explain key assumptions
4. When the user asks to adjust assumptions, recalculate everything and show the updated model
5. Flag risks and sensitivities proactively
6. If comparable data from the Data Library is available, prioritize those actuals over market averages

## Pro Forma Capsule Blueprint (v${PROFORMA_BLUEPRINT.version})
The following blueprint is the SINGLE SOURCE OF TRUTH for the F9 Pro Forma. Your output JSON MUST conform to it. Never invent fields, modules, formulas, or template IDs that don't appear here.

\`\`\`json
${blueprintSlice}
\`\`\`

${blueprintRules}

## Pro Forma JSON Format (template-aware)
Emit the model inside a \`\`\`proforma fence using this shape (the \`sections[]\` and field keys MUST come from \`activeTemplate\` above):

\`\`\`proforma
{
  "template": "<one of activeTemplate.id>",
  "horizon": <months from activeTemplate.horizonMonths>,
  "periodicity": "<from activeTemplate.periodicity>",
  "revenueFormula": "<one of revenueFormulas[].id; default mark_to_market>",
  "sections": [
    {
      "id": "<from activeTemplate.sections[].id>",
      "title": "<from activeTemplate.sections[].title>",
      "fields": {
        "<fieldKey>": {
          "value": <number|string|null>,
          "source": "user|platform|broker",
          "origin": "om_extracted|t12_extracted|rent_roll|comp_set|market_agent|tax_intel|cap_structure|risk_engine|platform_default|opus_inferred|derived|placeholder",
          "confidence": 0.0,
          "qualityFlag": "green|yellow|red|unknown",
          "asOf": "<ISO-8601>",
          "rationale": "<short explanation>"
        }
      }
    }
  ]
}
\`\`\`

## Custom Tab Capability (Task #451)
You can also create a new F9 sub-tab on demand when the user asks something like
"add a tab comparing my Y5 NOI to broker projection" or "make a sensitivity tab
that varies just exit cap rate". Emit it INSIDE a \`\`\`customtab fence using
the strict declarative schema below — never free-form HTML, never a section
that mutates assumptions.

\`\`\`customtab
${JSON.stringify(buildCustomTabSchemaForPrompt(), null, 2)}
\`\`\`

Custom tab JSON shape:
\`\`\`customtab
{
  "tabId": "<lowercase-slug-unique-per-deal>",
  "title": "<short label, ≤ ${CUSTOM_TAB_MAX_TITLE_LEN} chars>",
  "description": "<optional one-liner>",
  "blocks": [
    { "type": "markdown", "text": "Free text. Inline values use {{ref}} placeholders." },
    { "type": "kpi_tile", "label": "Y1 NOI", "ref": "results.summary.noi", "format": "currency" },
    { "type": "table", "caption": "Broker vs Platform — P&L line items",
      "rowSourceRef": "f9.proforma.year1", "columns": [
        { "header": "Line",     "ref": "f9.proforma.year1[*].label" },
        { "header": "Broker",   "ref": "f9.proforma.year1[*].broker",   "format": "currency" },
        { "header": "Platform", "ref": "f9.proforma.year1[*].platform", "format": "currency" },
        { "header": "Resolved", "ref": "f9.proforma.year1[*].resolved", "format": "currency" }
      ]
    },
    { "type": "ratio_bar", "label": "Loan-to-Value",
      "numeratorRef": "assumptions.ltv", "denominatorRef": "assumptions.purchasePrice",
      "format": "percent", "benchmark": 0.7 },
    { "type": "line_chart", "seriesRef": "projections",
      "xLabel": "Year", "yLabel": "NOI", "format": "currency" }
  ]
}
\`\`\`

Custom tab rules (MUST follow):
- Maximum ${CUSTOM_TAB_MAX_BLOCKS} blocks per tab.
- Every \`ref\`, \`numeratorRef\`, \`denominatorRef\`, \`seriesRef\`, \`rowSourceRef\`,
  and \`{{placeholder}}\` MUST resolve to a pattern in \`fieldCatalog\` above. The
  server will reject and quarantine any payload that references unknown paths.
- Custom tabs are READ-ONLY views — do not use them to change assumptions.
  Assumption mutations still flow through the existing \`update_assumptions\`
  action.

${dealContext}

${comparableData}`;
  }

  /**
   * Validate any pro forma payload (e.g. extracted from an Opus response) against
   * the active template. Returns a structured result; non-throwing.
   * Re-exported from the blueprint payload validator so callers don't reach in.
   */
  validateProformaPayload = validateProformaPayload;

  /**
   * Persist a payload Opus emitted that FAILED blueprint validation. We never
   * insert it into `opus_proforma_versions` (that table holds accepted, valid
   * versions only). Instead we write it to `opus_proforma_rejected_payloads`
   * (auto-created on first use) so the deal team can audit what was attempted.
   */
  private async quarantineRejectedProforma(
    dealId: string,
    conversationId: number | null,
    proformaData: any,
    validation: ReturnType<typeof validateProformaPayload>,
    expectedTemplate: ProFormaTemplateId | null
  ): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS opus_proforma_rejected_payloads (
          id SERIAL PRIMARY KEY,
          deal_id TEXT NOT NULL,
          conversation_id INTEGER,
          expected_template TEXT,
          payload_template TEXT,
          payload JSONB NOT NULL,
          issues JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.pool.query(
        `INSERT INTO opus_proforma_rejected_payloads
           (deal_id, conversation_id, expected_template, payload_template, payload, issues)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          dealId,
          conversationId,
          expectedTemplate,
          validation.templateId,
          JSON.stringify(proformaData),
          JSON.stringify(validation.issues),
        ]
      );
    } catch (err) {
      console.error('[Opus] Failed to quarantine rejected pro forma payload:', err);
    }
  }

  async streamChat(
    conversationId: number,
    userMessage: string,
    dealId: string,
    onChunk: (chunk: string) => void,
    onDone: (fullResponse: string) => void
  ): Promise<void> {
    await this.saveMessage(conversationId, 'user', userMessage);

    const [dealContext, comparableData, dealMeta] = await Promise.all([
      this.gatherDealContext(dealId),
      this.gatherComparableData(dealId),
      this.resolveDealTemplateContext(dealId),
    ]);

    const systemPrompt = this.buildSystemPrompt(dealContext, comparableData, dealMeta);

    const history = await this.getMessages(conversationId);
    const chatMessages = history
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    let fullResponse = '';

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        system: systemPrompt,
        messages: chatMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          if (text) {
            fullResponse += text;
            onChunk(text);
          }
        }
      }
    } catch (err: any) {
      console.error('Opus stream error:', err);
      const errorMsg = 'I encountered an issue processing your request. Please try again.';
      fullResponse = errorMsg;
      onChunk(errorMsg);
    }

    await this.saveMessage(conversationId, 'assistant', fullResponse);

    const proformaMatch = fullResponse.match(/```proforma\n([\s\S]*?)```/);
    if (proformaMatch) {
      try {
        const proformaData = JSON.parse(proformaMatch[1]);

        // Resolve the template the platform expects for THIS deal so we can
        // pin Opus's payload to it (spec §1: template selection is bound to
        // the active deal, not chosen freely by the model).
        const expectedTemplate = resolveExpectedTemplateId(dealMeta);

        // Spec §11: validate the payload against the active template. The
        // validator REJECTS unknown sections / fields / formulas / templates
        // and any mismatch with the expected active template.
        const validation = validateProformaPayload(proformaData, {
          expectedTemplate,
        });

        if (!validation.ok) {
          // Hard gate: a payload that fails blueprint validation MUST NOT be
          // persisted as an accepted pro forma version. Quarantine it via the
          // dedicated rejected-payloads table so the model + the deal team
          // can review what was attempted, then surface a clear error to the
          // assistant transcript.
          console.error(
            '[Opus] Pro forma payload REJECTED by blueprint validator; quarantining instead of saving.',
            {
              dealId,
              expectedTemplate,
              templateId: validation.templateId,
              issueCount: validation.issues.length,
              errorCount: validation.issues.filter(i => i.severity === 'error').length,
            }
          );
          await this.quarantineRejectedProforma(
            dealId,
            conversationId,
            proformaData,
            validation,
            expectedTemplate
          );
          await this.saveMessage(
            conversationId,
            'system',
            `[blueprint-validator] Pro forma payload rejected. ` +
              `Expected template: ${expectedTemplate ?? 'none'}. ` +
              `Errors: ${validation.issues
                .filter(i => i.severity === 'error')
                .slice(0, 5)
                .map(i => `${i.path}: ${i.message}`)
                .join(' | ')}`
          );
        } else {
          const validationMeta = {
            source: 'opus_generated',
            timestamp: new Date().toISOString(),
            validation: {
              ok: validation.ok,
              expectedTemplate,
              templateId: validation.templateId,
              validSections: validation.validSections,
              invalidSections: validation.invalidSections,
              issues: validation.issues,
            },
          };
          await this.saveProformaVersion(
            dealId,
            conversationId,
            proformaData.name || `Model v${Date.now()}`,
            proformaData,
            validationMeta,
            []
          );
        }
      } catch (e) {
        console.error('Failed to parse proforma from Opus response:', e);
      }
    }

    // ── Custom tab fence parsing (Task #451) ─────────────────────────────
    // Detect ALL ```customtab fences in the streamed response, validate
    // each, and persist the valid ones via createCustomTab. Rejections
    // surface as a `[customtab-validator]` system message — same pattern
    // as the proforma quarantine above.
    const customTabFences = [...fullResponse.matchAll(/```customtab\n([\s\S]*?)```/g)];
    if (customTabFences.length > 0) {
      // Try to derive a stable userId for the tab. opus_conversations.user_id
      // is optional; when absent we fall back to a deterministic per-deal
      // identifier so the (deal, user, tab_id) uniqueness key still works.
      const conversation = await this.getConversation(conversationId);
      const userId = conversation?.user_id || `deal:${dealId}`;
      const customTabResults: any[] = [];
      for (const match of customTabFences) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(match[1]);
        } catch (e: any) {
          await this.saveMessage(conversationId, 'system',
            `[customtab-validator] Failed to parse customtab JSON: ${e?.message ?? 'syntax error'}`);
          continue;
        }
        const result = await this.createCustomTab({
          dealId,
          userId,
          payload: parsed,
          generationPrompt: userMessage,
          modelVersion: 'claude-sonnet-4-5',
          conversationId,
        });
        if (!result.saved) {
          const summary = formatValidationIssuesForChat(result.validation);
          await this.saveMessage(conversationId, 'system',
            `[customtab-validator] Custom tab rejected.\n${summary}`);
          customTabResults.push({ ok: false, issues: result.validation.issues });
        } else {
          customTabResults.push({
            ok: true,
            tabId: result.row?.tab_id,
            title: result.row?.title,
            id: result.row?.id,
          });
        }
      }
      // Stash results on the assistant message metadata so the frontend
      // dispatcher can react (append the new tab, switch to it, etc.).
      try {
        // Postgres UPDATE doesn't support ORDER BY/LIMIT directly — must
        // pin the row via subquery on the primary key.
        await this.pool.query(
          `UPDATE opus_messages
              SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
            WHERE id = (
              SELECT id FROM opus_messages
               WHERE conversation_id = $2 AND role = 'assistant'
               ORDER BY id DESC
               LIMIT 1
            )`,
          [JSON.stringify({ customTabs: customTabResults }), conversationId],
        );
      } catch (e) {
        // metadata enrichment is best-effort — don't block the chat reply
        console.warn('[Opus] failed to attach customTabs to message metadata:', (e as any)?.message);
      }
    }

    onDone(fullResponse);
  }

  // Custom Tabs (Task #451). DDL follows the peer
  // `opus_proforma_rejected_payloads` runtime-ensure pattern in this same
  // file — see ensureCustomTabsTable below.

  private customTabsTableEnsured = false;

  private async ensureCustomTabsTable(): Promise<void> {
    if (this.customTabsTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS deal_custom_tabs (
        id SERIAL PRIMARY KEY,
        deal_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tab_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        payload JSONB NOT NULL,
        generation_prompt TEXT,
        model_version TEXT,
        conversation_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (deal_id, user_id, tab_id)
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS deal_custom_tabs_deal_user_idx
        ON deal_custom_tabs (deal_id, user_id, updated_at DESC)
    `);
    this.customTabsTableEnsured = true;
  }

  /** List all custom tabs for a (deal, user). */
  async listCustomTabs(dealId: string, userId: string): Promise<CustomTabRow[]> {
    await this.ensureCustomTabsTable();
    const result = await this.pool.query<CustomTabRow>(
      `SELECT id, deal_id, user_id, tab_id, title, description, payload,
              generation_prompt, model_version, conversation_id,
              created_at, updated_at
         FROM deal_custom_tabs
        WHERE deal_id = $1 AND user_id = $2
        ORDER BY updated_at DESC`,
      [dealId, userId],
    );
    return result.rows;
  }

  /** Fetch a single custom tab by (deal, user, tab_id). */
  async getCustomTab(
    dealId: string,
    userId: string,
    tabId: string,
  ): Promise<CustomTabRow | null> {
    await this.ensureCustomTabsTable();
    const result = await this.pool.query<CustomTabRow>(
      `SELECT id, deal_id, user_id, tab_id, title, description, payload,
              generation_prompt, model_version, conversation_id,
              created_at, updated_at
         FROM deal_custom_tabs
        WHERE deal_id = $1 AND user_id = $2 AND tab_id = $3`,
      [dealId, userId, tabId],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Validate + persist a custom tab payload. Upserts on (deal_id, user_id,
   * tab_id). Throws a structured error on validation failure that the route
   * layer can surface as 422 — never silently swallows.
   */
  async createCustomTab(args: {
    dealId: string;
    userId: string;
    payload: unknown;
    generationPrompt?: string | null;
    modelVersion?: string | null;
    conversationId?: number | null;
  }): Promise<{
    saved: boolean;
    validation: CustomTabValidationResult;
    row: Awaited<ReturnType<OpusService['getCustomTab']>>;
  }> {
    const validation = validateCustomTabPayload(args.payload);
    if (!validation.ok) {
      console.error('[Opus] Custom tab payload REJECTED by validator', {
        dealId: args.dealId,
        userId: args.userId,
        errorCount: validation.issues.filter(i => i.severity === 'error').length,
        unknownFields: validation.unknownFields,
      });
      return { saved: false, validation, row: null };
    }
    const payload = args.payload as CustomTabPayload;
    await this.ensureCustomTabsTable();
    await this.pool.query(
      `INSERT INTO deal_custom_tabs
         (deal_id, user_id, tab_id, title, description, payload,
          generation_prompt, model_version, conversation_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (deal_id, user_id, tab_id) DO UPDATE SET
         title             = EXCLUDED.title,
         description       = EXCLUDED.description,
         payload           = EXCLUDED.payload,
         generation_prompt = COALESCE(EXCLUDED.generation_prompt, deal_custom_tabs.generation_prompt),
         model_version     = COALESCE(EXCLUDED.model_version, deal_custom_tabs.model_version),
         conversation_id   = COALESCE(EXCLUDED.conversation_id, deal_custom_tabs.conversation_id),
         updated_at        = CURRENT_TIMESTAMP`,
      [
        args.dealId,
        args.userId,
        payload.tabId,
        payload.title,
        payload.description ?? null,
        JSON.stringify(payload),
        args.generationPrompt ?? payload.generationPrompt ?? null,
        args.modelVersion ?? payload.modelVersion ?? null,
        args.conversationId ?? null,
      ],
    );
    const row = await this.getCustomTab(args.dealId, args.userId, payload.tabId);
    return { saved: true, validation, row };
  }

  /** Rename only — payload stays the same. */
  async renameCustomTab(
    dealId: string,
    userId: string,
    tabId: string,
    newTitle: string,
  ): Promise<boolean> {
    if (!newTitle || newTitle.length > CUSTOM_TAB_MAX_TITLE_LEN) return false;
    await this.ensureCustomTabsTable();
    const existing = await this.getCustomTab(dealId, userId, tabId);
    if (!existing) return false;
    const nextPayload: CustomTabPayload = { ...existing.payload, title: newTitle };
    await this.pool.query(
      `UPDATE deal_custom_tabs
         SET title = $4, payload = $5, updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $1 AND user_id = $2 AND tab_id = $3`,
      [dealId, userId, tabId, newTitle, JSON.stringify(nextPayload)],
    );
    return true;
  }

  /** Replace the payload (re-validated). Used by `refresh` once Opus regens. */
  async replaceCustomTab(args: {
    dealId: string;
    userId: string;
    tabId: string;
    payload: unknown;
    modelVersion?: string | null;
    conversationId?: number | null;
  }): Promise<{
    saved: boolean;
    validation: CustomTabValidationResult;
    row: Awaited<ReturnType<OpusService['getCustomTab']>>;
  }> {
    const validation = validateCustomTabPayload(args.payload);
    if (!validation.ok) {
      console.error('[Opus] Custom tab REPLACE rejected by validator', {
        dealId: args.dealId, userId: args.userId, tabId: args.tabId,
      });
      return { saved: false, validation, row: null };
    }
    const payload = args.payload as CustomTabPayload;
    if (payload.tabId !== args.tabId) {
      return {
        saved: false,
        validation: {
          ...validation,
          ok: false,
          issues: [
            ...validation.issues,
            {
              severity: 'error',
              path: '$.tabId',
              message: `payload.tabId "${payload.tabId}" does not match URL tabId "${args.tabId}"`,
            },
          ],
        },
        row: null,
      };
    }
    return this.createCustomTab({
      dealId: args.dealId,
      userId: args.userId,
      payload,
      modelVersion: args.modelVersion,
      conversationId: args.conversationId,
    });
  }

  async deleteCustomTab(dealId: string, userId: string, tabId: string): Promise<boolean> {
    await this.ensureCustomTabsTable();
    const result = await this.pool.query(
      `DELETE FROM deal_custom_tabs
         WHERE deal_id = $1 AND user_id = $2 AND tab_id = $3`,
      [dealId, userId, tabId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Re-run the original generation prompt for an existing custom tab and
   * upsert the resulting payload. Returns the new row and any validation
   * issues encountered.
   */
  async refreshCustomTab(args: {
    dealId: string;
    userId: string;
    tabId: string;
    conversationId?: number | null;
  }): Promise<{
    refreshed: boolean;
    validation: CustomTabValidationResult | null;
    row: Awaited<ReturnType<OpusService['getCustomTab']>>;
    error?: string;
  }> {
    const existing = await this.getCustomTab(args.dealId, args.userId, args.tabId);
    if (!existing) return { refreshed: false, validation: null, row: null, error: 'tab not found' };
    if (!existing.generation_prompt) {
      return { refreshed: false, validation: null, row: existing, error: 'no generation prompt stored — recreate the tab via Opus' };
    }
    const conversationId = args.conversationId ?? existing.conversation_id ?? null;
    const generated = await this.generateCustomTabPayloadFromPrompt({
      dealId: args.dealId,
      userId: args.userId,
      prompt: existing.generation_prompt,
      tabIdHint: args.tabId,
    });
    if (!generated.payload) {
      return { refreshed: false, validation: generated.validation, row: existing, error: generated.error ?? 'generation failed' };
    }
    const result = await this.replaceCustomTab({
      dealId: args.dealId,
      userId: args.userId,
      tabId: args.tabId,
      payload: { ...generated.payload, tabId: args.tabId },
      modelVersion: generated.modelVersion,
      conversationId: conversationId,
    });
    return { refreshed: result.saved, validation: result.validation, row: result.row, error: result.saved ? undefined : 'validation failed on regenerated payload' };
  }

  /**
   * Ask Opus for a custom-tab payload from a natural-language prompt.
   * Used by both the refresh flow and the new "manual generate" route.
   */
  async generateCustomTabPayloadFromPrompt(args: {
    dealId: string;
    userId: string;
    prompt: string;
    tabIdHint?: string;
  }): Promise<{
    payload: CustomTabPayload | null;
    validation: CustomTabValidationResult | null;
    modelVersion: string;
    rawText: string;
    error?: string;
  }> {
    const [dealContext, comparableData, dealMeta] = await Promise.all([
      this.gatherDealContext(args.dealId),
      this.gatherComparableData(args.dealId),
      this.resolveDealTemplateContext(args.dealId),
    ]);
    const systemPrompt = this.buildSystemPrompt(dealContext, comparableData, dealMeta);
    const userPrompt = args.tabIdHint
      ? `${args.prompt}\n\n(Reuse tabId="${args.tabIdHint}" so this regenerates the same tab.)`
      : args.prompt;

    let rawText = '';
    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          rawText += event.delta.text;
        }
      }
    } catch (err: any) {
      return { payload: null, validation: null, modelVersion: 'claude-sonnet-4-5', rawText: '', error: err?.message ?? 'opus stream failed' };
    }

    const fenceMatch = rawText.match(/```customtab\n([\s\S]*?)```/);
    if (!fenceMatch) {
      return { payload: null, validation: null, modelVersion: 'claude-sonnet-4-5', rawText, error: 'Opus did not emit a ```customtab fence' };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fenceMatch[1]);
    } catch (e: any) {
      return { payload: null, validation: null, modelVersion: 'claude-sonnet-4-5', rawText, error: 'Failed to parse customtab JSON: ' + e?.message };
    }
    const validation = validateCustomTabPayload(parsed);
    if (!validation.ok) {
      return { payload: null, validation, modelVersion: 'claude-sonnet-4-5', rawText, error: 'Validation failed' };
    }
    return { payload: parsed as CustomTabPayload, validation, modelVersion: 'claude-sonnet-4-5' };
  }

  /** Re-exported for callers that want validation without persistence. */
  validateCustomTabPayload = validateCustomTabPayload;

  /**
   * Resolve deal-type + winning strategy so buildSystemPrompt can pick the
   * right template. Best-effort: returns undefined keys if we can't determine
   * them, in which case Opus falls back to the acquisition_stabilized default.
   */
  private async resolveDealTemplateContext(
    dealId: string
  ): Promise<{ dealType?: 'existing' | 'development' | 'redevelopment'; strategy?: string | null }> {
    try {
      const result = await this.pool.query(
        `SELECT property_type, deal_type FROM deals WHERE id = $1 LIMIT 1`,
        [dealId]
      );
      if (!result.rows[0]) return {};
      const raw = (result.rows[0].deal_type || result.rows[0].property_type || '').toString().toLowerCase();
      let dealType: 'existing' | 'development' | 'redevelopment' | undefined;
      if (raw.includes('develop') || raw.includes('construction') || raw.includes('ground')) {
        dealType = 'development';
      } else if (raw.includes('redev') || raw.includes('value-add') || raw.includes('reposition')) {
        dealType = 'redevelopment';
      } else if (raw) {
        dealType = 'existing';
      }
      return { dealType };
    } catch {
      return {};
    }
  }
}
