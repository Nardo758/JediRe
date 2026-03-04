import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { PropertyScoringService } from './propertyScoring.service';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

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

  buildSystemPrompt(dealContext: string, comparableData: string): string {
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

## Pro Forma JSON Format
When generating a model, output it in this format:
\`\`\`proforma
{
  "name": "Base Case",
  "holdPeriod": 5,
  "acquisition": {
    "purchasePrice": 0,
    "pricePerUnit": 0,
    "closingCosts": 0,
    "renovationBudget": 0,
    "totalBasis": 0
  },
  "financing": {
    "loanAmount": 0,
    "ltv": 0.65,
    "interestRate": 0.055,
    "termYears": 5,
    "amortizationYears": 30,
    "annualDebtService": 0
  },
  "operations": {
    "grossRent": 0,
    "vacancy": 0.05,
    "otherIncome": 0,
    "effectiveGrossIncome": 0,
    "operatingExpenses": 0,
    "expenseRatio": 0,
    "noi": 0
  },
  "returns": {
    "cashOnCash": 0,
    "irr": 0,
    "equityMultiple": 0,
    "dscr": 0,
    "capRateEntry": 0,
    "capRateExit": 0
  },
  "yearlyProjection": [
    { "year": 1, "revenue": 0, "expenses": 0, "noi": 0, "debtService": 0, "cashFlow": 0 }
  ]
}
\`\`\`

${dealContext}

${comparableData}`;
  }

  async streamChat(
    conversationId: number,
    userMessage: string,
    dealId: string,
    onChunk: (chunk: string) => void,
    onDone: (fullResponse: string) => void
  ): Promise<void> {
    await this.saveMessage(conversationId, 'user', userMessage);

    const [dealContext, comparableData] = await Promise.all([
      this.gatherDealContext(dealId),
      this.gatherComparableData(dealId),
    ]);

    const systemPrompt = this.buildSystemPrompt(dealContext, comparableData);

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
        model: 'claude-sonnet-4-6',
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
        await this.saveProformaVersion(
          dealId,
          conversationId,
          proformaData.name || `Model v${Date.now()}`,
          proformaData,
          { source: 'opus_generated', timestamp: new Date().toISOString() },
          []
        );
      } catch (e) {
        console.error('Failed to parse proforma from Opus response:', e);
      }
    }

    onDone(fullResponse);
  }
}
