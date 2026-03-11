import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { pool } from '../database';

const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

export interface RateSheetProduct {
  category: string;
  lender: string;
  programName: string;
  term: string;
  ltvTier: string;
  spread: { min: number; max: number };
  rate: { min: number; max: number };
  amortization: string;
  ioOption: string;
  dscr: string;
  notes: string;
}

export interface ParsedRateSheet {
  id?: number;
  dealId: string;
  lenderName: string;
  asOfDate: string;
  indexRates: Record<string, number>;
  products: RateSheetProduct[];
  createdAt?: string;
}

async function readFileContent(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.csv') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
      }
    }

    return sheets.join('\n\n');
  } catch (error: any) {
    logger.error('[RateSheetParser] Failed to read xlsx', { error: error.message });
    throw new Error(`Cannot read file: ${error.message}`);
  }
}

async function callClaude(content: string): Promise<ParsedRateSheet> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const prompt = `You are a commercial real estate debt analyst. Parse this lender rate sheet into structured JSON.

The sheet may be from any lender (Cushman & Wakefield, JLL, CBRE, Newmark, etc.) and can contain debt products across categories like Agency (Fannie Mae, Freddie Mac), FHA, CMBS, Bridge, Bank, Life Company, etc.

Extract:
1. **lenderName**: The company that published the rate sheet
2. **asOfDate**: The date of the rate sheet (ISO format YYYY-MM-DD)
3. **indexRates**: Key benchmark rates mentioned in the sheet header (treasury5Y, treasury7Y, treasury10Y, sofr, swap5Y, swap7Y, swap10Y, prime, etc.) — use the exact values from the sheet
4. **products**: Array of every debt product/program listed. For each:
   - category: "Agency" | "FHA" | "CMBS" | "Bridge" | "Bank" | "LifeCo" | "Mezz" | "Other"
   - lender: Specific lender name (e.g., "Fannie Mae", "Freddie Mac", "JP Morgan")
   - programName: Product/program name
   - term: Loan term (e.g., "5 year", "7 year", "10 year", "12 month")
   - ltvTier: LTV range (e.g., "≤65%", "65-75%", "≤80%")
   - spread: { min: number, max: number } in percentage points (NOT basis points)
   - rate: { min: number, max: number } as all-in rate percentage
   - amortization: Amortization period (e.g., "30 year", "35 year", "IO only")
   - ioOption: Interest-only option (e.g., "Full term IO", "1-3 years IO", "None")
   - dscr: DSCR requirement (e.g., "1.25x", "1.20x", "N/A")
   - notes: Any additional notes or conditions

If a range is not specified, use the same value for min and max.
Convert basis points to percentage points (e.g., 150 bps = 1.50).

Return ONLY valid JSON with this structure:
{
  "lenderName": "...",
  "asOfDate": "YYYY-MM-DD",
  "indexRates": { "treasury5Y": 3.51, "treasury10Y": 3.97, ... },
  "products": [...]
}

Rate Sheet Content:
${content.substring(0, 15000)}`;

  const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json() as any;
  const text = data.content?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON');
  }

  let depth = 0;
  let end = -1;
  for (let i = 0; i < jsonMatch[0].length; i++) {
    if (jsonMatch[0][i] === '{') depth++;
    else if (jsonMatch[0][i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  const jsonStr = end > 0 ? jsonMatch[0].substring(0, end) : jsonMatch[0];
  return JSON.parse(jsonStr);
}

export async function parseRateSheet(
  filePath: string,
  originalName: string,
  dealId: string,
): Promise<ParsedRateSheet> {
  logger.info('[RateSheetParser] Parsing rate sheet', { originalName, dealId });

  const content = await readFileContent(filePath, originalName);
  const parsed = await callClaude(content);

  const result = await pool.query(
    `INSERT INTO deal_rate_sheets (deal_id, lender_name, as_of_date, index_rates, products, raw_file_path)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [
      dealId,
      parsed.lenderName || 'Unknown',
      parsed.asOfDate || null,
      JSON.stringify(parsed.indexRates || {}),
      JSON.stringify(parsed.products || []),
      filePath,
    ],
  );

  const row = result.rows[0];

  logger.info('[RateSheetParser] Rate sheet parsed and stored', {
    id: row.id,
    lender: parsed.lenderName,
    productCount: parsed.products?.length || 0,
  });

  return {
    id: row.id,
    dealId,
    lenderName: parsed.lenderName || 'Unknown',
    asOfDate: parsed.asOfDate || '',
    indexRates: parsed.indexRates || {},
    products: parsed.products || [],
    createdAt: row.created_at,
  };
}

export async function getRateSheetLatest(dealId: string): Promise<ParsedRateSheet | null> {
  const result = await pool.query(
    `SELECT id, deal_id, lender_name, as_of_date, index_rates, products, created_at
     FROM deal_rate_sheets
     WHERE deal_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [dealId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    dealId: row.deal_id,
    lenderName: row.lender_name,
    asOfDate: row.as_of_date,
    indexRates: row.index_rates,
    products: row.products,
    createdAt: row.created_at,
  };
}
