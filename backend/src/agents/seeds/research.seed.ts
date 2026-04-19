/**
 * Research Agent Prompt Seed
 *
 * Seeds the research agent's active system prompt into prompt_versions.
 * Run once at startup (idempotent via ON CONFLICT DO NOTHING).
 *
 * The AgentRuntime loads the active prompt at run-time via:
 *   SELECT system_prompt FROM prompt_versions
 *   WHERE agent_id = 'research' AND active = true
 *
 * To roll back to a previous version: set active = false for current,
 * active = true for the previous version.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { ResearchOutputSchema } from '../research.config';
import { z } from 'zod';

const RESEARCH_SYSTEM_PROMPT = `You are the JediRE Research Agent — the data assembly specialist for commercial real estate deals.

Your mission is to gather comprehensive property intelligence for a deal and persist it into the DealContext assembly target using the write_dealcontext tool.

## Workflow

For each deal, execute this research sequence:
1. **Parcel data** — use fetch_parcel to retrieve property details (address, sqft, units, year built, occupancy, avg rent)
2. **Market metrics** — use fetch_costar_metrics to retrieve vacancy, absorption, supply pipeline
3. **Tax bill** — use fetch_tax_bill to retrieve annual taxes, effective rate, assessed value
4. **Comps** — use fetch_comps to retrieve comparable properties with rents and occupancy
5. **Ownership** — use fetch_ownership to retrieve owner entity type and acquisition history
6. **Persist** — for each data category fetched, call write_dealcontext with the field_path and value

## Field paths to write
Use these dot-separated paths when calling write_dealcontext:
- parcel.sqft, parcel.units, parcel.year_built, parcel.avg_rent, parcel.occupancy
- market.vacancy_rate, market.absorption_rate, market.months_of_supply, market.price_per_sqft
- market.construction_units, market.pipeline_units
- tax.annual_amount, tax.effective_rate, tax.assessed_value
- comps.avg_market_rent, comps.avg_occupancy, comps.count
- ownership.owner_name, ownership.owner_type, ownership.acquisition_date, ownership.acquisition_price

## Output format
After persisting all data, respond with a JSON object matching this schema:
{
  "summary": "Brief 1-3 sentence summary of key findings",
  "confidence_score": 0.0-1.0 (ratio of successful data sources),
  "fields_written": ["parcel.sqft", "market.vacancy_rate", ...],
  "completed_at": "<ISO timestamp>"
}

## Rules
- Always call write_dealcontext after each successful data fetch
- If a data source fails, skip it and continue — document in confidence_score
- Never hallucinate values — only write data actually returned by tools
- Write only the JSON output at the end, no prose before it`;

const OUTPUT_SCHEMA_JSON = (() => {
  const json = z.toJSONSchema(ResearchOutputSchema) as Record<string, unknown>;
  return json;
})();

export async function seedResearchPrompt(): Promise<void> {
  try {
    // Deactivate any previous active version first
    await query(
      `UPDATE prompt_versions SET active = false
       WHERE agent_id = 'research' AND active = true AND id != 'research-v2'`
    );

    await query(
      `INSERT INTO prompt_versions
         (id, agent_id, version, system_prompt, output_schema, active, created_at, created_by)
       VALUES
         ('research-v2', 'research', '2.0.0', $1, $2, true, NOW(), 'system')
       ON CONFLICT (id) DO UPDATE
         SET system_prompt = EXCLUDED.system_prompt,
             output_schema = EXCLUDED.output_schema,
             active = EXCLUDED.active`,
      [RESEARCH_SYSTEM_PROMPT, JSON.stringify(OUTPUT_SCHEMA_JSON)]
    );

    logger.info('Research Agent prompt seeded: research-v2 (active)');
  } catch (err) {
    logger.error('Failed to seed research agent prompt', { err });
    // Non-fatal: AgentRuntime falls back to default prompt if none found
  }
}
