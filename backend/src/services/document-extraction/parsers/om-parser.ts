/**
 * Offering Memorandum (OM) Parser
 * 
 * Extracts structured data from broker OMs using AI-assisted PDF parsing.
 * Data flows to: broker_claims, ProForma, Strategy, Risk, Events modules.
 */

import Anthropic from '@anthropic-ai/sdk';
// pdf-parse v2.x exports a class; v1.x exports a function — handle both
function requirePdfParse(): (buf: Buffer) => Promise<{ text: string; numpages: number }> {
  const lib = require('pdf-parse');
  if (typeof lib === 'function') return lib;
  if (lib && typeof lib.default === 'function') return lib.default;
  if (lib && typeof lib.PDFParse === 'function') {
    return (buf: Buffer) => {
      const inst = new lib.PDFParse({ data: buf });
      return inst.getText ? inst.getText().then((text: string) => ({ text, numpages: 0 })) : Promise.resolve({ text: '', numpages: 0 });
    };
  }
  throw new Error('pdf-parse: cannot find a callable export');
}
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../../../utils/logger';
import { jediAI } from '../../ai/aiService';
import { query } from '../../../database/connection';
import type { ExtractionResult } from '../types';
import type { AICallContext } from '../../../types/dealContext';
import { ocrPdf, OCR_MIN_TEXT_THRESHOLD } from '../ocr.service';

/**
 * Caller-supplied context that lets the OM parser flow through JediAIService
 * (which then honors the user's per-surface model preference for the
 * `pipeline:om_parsing` surface). When omitted, falls back to a direct
 * Anthropic Sonnet call — used by older callers / tests that don't have a user.
 */
export interface OMParseContext {
  userId: string;
  dealId?: string;
  /**
   * Optional progress callback so the dataLibrary pipeline can flip the file's
   * `parsing_stage` to 'ocr' the moment the OCR fallback engages — without
   * having to peek at the PDF text layer ahead of time.
   */
  onStageChange?: (stage: 'ocr' | 'analyzing') => Promise<void>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OMPropertyData {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  yearBuilt: number | null;
  yearRenovated: number | null;
  units: number | null;
  netRentableSF: number | null;
  avgUnitSF: number | null;
  stories: number | null;
  buildings: number | null;
  parkingSpaces: number | null;
  parkingRatio: number | null;
  amenities: string[];
  propertyType: 'garden' | 'mid-rise' | 'high-rise' | 'townhome' | null;
}

export interface OMReplacementCost {
  landValue: number | null;
  hardCostPSF: number | null;
  hardCostTotal: number | null;
  softCostPct: number | null;
  softCostTotal: number | null;
  totalReplacementCost: number | null;
  replacementCostPerUnit: number | null;
  source: 'broker_estimate' | 'marshall_swift' | 'inferred' | null;
  pageNumber: number | null;
}

export interface OMBrokerProforma {
  stabilizedVacancy: number | null;
  lossToLease: number | null;
  concessionsPct: number | null;
  badDebtPct: number | null;
  rentGrowthY1: number | null;
  rentGrowthY2: number | null;
  rentGrowthY3: number | null;
  rentGrowthY4: number | null;
  rentGrowthY5: number | null;
  opexGrowth: number | null;
  managementFeePct: number | null;
  replacementReservesPerUnit: number | null;
  exitCapRate: number | null;
  holdPeriodYears: number | null;
  goingInCapRate: number | null;
  targetIRR: number | null;
  stabilizedNOI: number | null;
  yearOneNOI: number | null;
}

export interface OMCapitalPlan {
  interiorRenovationPerUnit: number | null;
  exteriorCapex: number | null;
  deferredMaintenance: number | null;
  totalCapexBudget: number | null;
  renovationTimeline: string | null;
  unitsPerMonth: number | null;
  rentPremiumPostReno: number | null;
  valueAddStrategy: string | null;
  scopeDescription: string | null;
}

export interface OMDebtAssumptions {
  assumedLTV: number | null;
  interestRateRange: string | null;
  loanTerm: string | null;
  interestOnlyMonths: number | null;
  rateCapCost: number | null;
  prepaymentTerms: string | null;
  assumableLoan: boolean | null;
  existingDebt: number | null;
}

export interface OMRentComp {
  name: string;
  units: number | null;
  yearBuilt: number | null;
  avgRent: number | null;
  occupancy: number | null;
  distance: string | null;
  pageNumber: number | null;
}

export interface OMSaleComp {
  name: string;
  units: number | null;
  salePrice: number | null;
  pricePerUnit: number | null;
  capRate: number | null;
  saleDate: string | null;
  pageNumber: number | null;
}

export interface OMMarketComps {
  rentComps: OMRentComp[];
  saleComps: OMSaleComp[];
  submarketAvgRent: number | null;
  submarketOccupancy: number | null;
  submarketRentGrowth: number | null;
  submarketName: string | null;
}

export interface OMRiskFactors {
  leaseExpirationConcentration: string | null;
  tenantConcentration: string | null;
  section8Pct: number | null;
  studentHousingPct: number | null;
  corporateHousingPct: number | null;
  pendingLitigation: string | null;
  taxAppealStatus: string | null;
  currentTaxAssessment: number | null;
  environmentalStatus: string | null;
  zoningCode: string | null;
  zoningConstraints: string | null;
  insuranceClaims: string | null;
  floodZone: string | null;
  deferredMaintenanceNotes: string | null;
}

export interface OMKeyEvents {
  taxAppealPending: boolean;
  taxAppealAmount: number | null;
  insuranceClaimPending: boolean;
  insuranceClaimAmount: number | null;
  renovationPlanned: boolean;
  renovationStartDate: string | null;
  renovationEndDate: string | null;
  leaseUpInProgress: boolean;
  stabilizationDate: string | null;
  assumableLoanMaturity: string | null;
}

export interface OMMetadata {
  broker: string | null;
  brokerContact: string | null;
  listingDate: string | null;
  callForOffersDate: string | null;
  askingPrice: number | null;
  guidancePricePerUnit: number | null;
  guidanceCapRate: number | null;
  confidenceScore: number;
  extractedAt: string;
  pdfPageCount: number;
  textLength: number;
}

export interface OMExtraction {
  property: OMPropertyData;
  replacementCost: OMReplacementCost;
  brokerProforma: OMBrokerProforma;
  capitalPlan: OMCapitalPlan;
  debtAssumptions: OMDebtAssumptions;
  marketComps: OMMarketComps;
  riskFactors: OMRiskFactors;
  keyEvents: OMKeyEvents;
  investmentHighlights: string[];
  investmentThesis: string | null;
  metadata: OMMetadata;
}

// ─── Extraction Prompt ────────────────────────────────────────────────────────

const OM_EXTRACTION_PROMPT = `You are an expert real estate analyst extracting structured data from an Offering Memorandum (OM).

Extract ALL available information into the JSON schema below. Use null for fields not found in the document.
For percentages, use decimals (5% = 0.05). For currency, use raw numbers without formatting.

Important extraction rules:
1. Property type: "garden" (1-3 stories), "mid-rise" (4-6 stories), "high-rise" (7+ stories), "townhome"
2. Replacement cost: Look for construction cost analysis, replacement value, or calculate from hard costs
3. Broker assumptions: Found in pro forma projections, financial assumptions, or investment summary
4. Capital plan: Look for value-add strategy, renovation scope, CapEx budget
5. Risk factors: Found in risk factors section, due diligence notes, or throughout document
6. Key events: Tax appeals, insurance claims, renovation timelines, lease-up status

Return ONLY valid JSON matching this schema:

{
  "property": {
    "name": "string or null",
    "address": "string or null",
    "city": "string or null", 
    "state": "2-letter code or null",
    "zip": "string or null",
    "county": "string or null",
    "yearBuilt": "number or null",
    "yearRenovated": "number or null",
    "units": "number or null",
    "netRentableSF": "number or null",
    "avgUnitSF": "number or null",
    "stories": "number or null",
    "buildings": "number or null",
    "parkingSpaces": "number or null",
    "parkingRatio": "number or null",
    "amenities": ["array of strings"],
    "propertyType": "garden|mid-rise|high-rise|townhome or null"
  },
  "replacementCost": {
    "landValue": "number or null",
    "hardCostPSF": "number or null",
    "hardCostTotal": "number or null",
    "softCostPct": "decimal or null (0.25 = 25%)",
    "softCostTotal": "number or null",
    "totalReplacementCost": "number or null",
    "replacementCostPerUnit": "number or null",
    "source": "broker_estimate|marshall_swift|inferred or null",
    "pageNumber": "1-indexed PDF page where the replacement-cost figures appear, or null"
  },
  "brokerProforma": {
    "stabilizedVacancy": "decimal (0.05 = 5%)",
    "lossToLease": "decimal or null",
    "concessionsPct": "decimal or null",
    "badDebtPct": "decimal or null",
    "rentGrowthY1": "decimal or null",
    "rentGrowthY2": "decimal or null",
    "rentGrowthY3": "decimal or null",
    "rentGrowthY4": "decimal or null",
    "rentGrowthY5": "decimal or null",
    "opexGrowth": "decimal or null",
    "managementFeePct": "decimal or null",
    "replacementReservesPerUnit": "number or null",
    "exitCapRate": "decimal or null",
    "holdPeriodYears": "number or null",
    "goingInCapRate": "decimal or null",
    "targetIRR": "decimal or null",
    "stabilizedNOI": "number or null",
    "yearOneNOI": "number or null"
  },
  "capitalPlan": {
    "interiorRenovationPerUnit": "number or null",
    "exteriorCapex": "number or null",
    "deferredMaintenance": "number or null",
    "totalCapexBudget": "number or null",
    "renovationTimeline": "string description or null",
    "unitsPerMonth": "number or null",
    "rentPremiumPostReno": "number (monthly rent increase) or null",
    "valueAddStrategy": "string description or null",
    "scopeDescription": "string or null"
  },
  "debtAssumptions": {
    "assumedLTV": "decimal or null",
    "interestRateRange": "string like 'mid-5s' or null",
    "loanTerm": "string like '5+5' or null",
    "interestOnlyMonths": "number or null",
    "rateCapCost": "number or null",
    "prepaymentTerms": "string or null",
    "assumableLoan": "boolean or null",
    "existingDebt": "number or null"
  },
  "marketComps": {
    "rentComps": [
      {
        "name": "string",
        "units": "number or null",
        "yearBuilt": "number or null",
        "avgRent": "number or null",
        "occupancy": "decimal or null",
        "distance": "string or null",
        "pageNumber": "1-indexed PDF page where this rent comp appears, or null"
      }
    ],
    "saleComps": [
      {
        "name": "string",
        "units": "number or null",
        "salePrice": "number or null",
        "pricePerUnit": "number or null",
        "capRate": "decimal or null",
        "saleDate": "string or null",
        "pageNumber": "1-indexed PDF page where this sale comp appears, or null"
      }
    ],
    "submarketAvgRent": "number or null",
    "submarketOccupancy": "decimal or null",
    "submarketRentGrowth": "decimal or null",
    "submarketName": "string or null"
  },
  "riskFactors": {
    "leaseExpirationConcentration": "string description or null",
    "tenantConcentration": "string or null",
    "section8Pct": "decimal or null",
    "studentHousingPct": "decimal or null",
    "corporateHousingPct": "decimal or null",
    "pendingLitigation": "string or null",
    "taxAppealStatus": "string or null",
    "currentTaxAssessment": "number or null",
    "environmentalStatus": "string or null",
    "zoningCode": "string or null",
    "zoningConstraints": "string or null",
    "insuranceClaims": "string or null",
    "floodZone": "string or null",
    "deferredMaintenanceNotes": "string or null"
  },
  "keyEvents": {
    "taxAppealPending": "boolean",
    "taxAppealAmount": "number or null",
    "insuranceClaimPending": "boolean",
    "insuranceClaimAmount": "number or null",
    "renovationPlanned": "boolean",
    "renovationStartDate": "string or null",
    "renovationEndDate": "string or null",
    "leaseUpInProgress": "boolean",
    "stabilizationDate": "string or null",
    "assumableLoanMaturity": "string or null"
  },
  "investmentHighlights": ["array of key selling points"],
  "investmentThesis": "1-2 sentence summary of the investment opportunity",
  "metadata": {
    "broker": "brokerage firm name or null",
    "brokerContact": "agent name or null",
    "listingDate": "string or null",
    "callForOffersDate": "string or null",
    "askingPrice": "number or null",
    "guidancePricePerUnit": "number or null",
    "guidanceCapRate": "decimal or null"
  }
}`;

// ─── PDF Text Extraction ──────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    const parseFn = requirePdfParse();
    const data = await parseFn(buffer);
    return {
      text: data.text,
      pages: data.numpages,
    };
  } catch (err) {
    logger.error('PDF parse error:', err);
    throw new Error(`Failed to parse PDF: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

// ─── AI Extraction ────────────────────────────────────────────────────────────

async function extractWithAI(
  text: string,
  filename: string,
  ctx?: OMParseContext
): Promise<OMExtraction> {
  // Truncate text if too long (Claude context limit; DeepSeek is similar)
  const maxChars = 180000; // ~45k tokens
  const truncatedText = text.length > maxChars
    ? text.slice(0, maxChars) + '\n\n[TRUNCATED - Document continues...]'
    : text;
  const userMessage = `${OM_EXTRACTION_PROMPT}\n\n---\n\nDocument: ${filename}\n\n${truncatedText}`;

  let responseText: string;

  if (ctx?.userId) {
    // Route through JediAIService so per-user / per-surface model preferences
    // (pipeline:om_parsing) take effect — and so usage hits the credit ledger
    // and Stripe meter just like agent calls.
    let stripeCustomerId = '';
    try {
      const r = await query(
        `SELECT stripe_customer_id FROM user_credit_balances WHERE user_id = $1`,
        [ctx.userId]
      );
      stripeCustomerId = r.rows[0]?.stripe_customer_id ?? '';
    } catch (err) {
      logger.warn('[OM Parser] failed to look up stripe_customer_id', { err });
    }

    const callContext: AICallContext = {
      userId: ctx.userId,
      stripeCustomerId,
      dealId: ctx.dealId,
      operationType: 'om_parsing',
      // agentId is required by AICallContext but ignored when routingSurface is set
      agentId: 'research',
      surface: 'autonomous',
      routingSurface: { type: 'pipeline', id: 'om_parsing' },
    };

    const message = await jediAI.generate(
      callContext,
      'You are a real estate document extraction engine. Always respond with valid JSON only.',
      [{ role: 'user', content: userMessage }],
      { maxTokens: 8000, temperature: 0 }
    );

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }
    responseText = block.text;
  } else {
    // Legacy path: no user context (e.g. CLI / tests). Direct Anthropic call,
    // bypasses metering. Kept so existing callers don't break.
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: userMessage }],
    });
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }
    responseText = content.text;
  }

  // Parse JSON (handle markdown code blocks)
  let jsonStr = responseText;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    return normalizeExtraction(parsed, text.length);
  } catch (err) {
    logger.error('Failed to parse AI response as JSON:', jsonStr.slice(0, 500));
    throw new Error('AI returned invalid JSON');
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeExtraction(raw: any, textLength: number): OMExtraction {
  const now = new Date().toISOString();
  
  // Calculate confidence based on how many fields were extracted
  let fieldsFound = 0;
  let totalFields = 0;
  
  const countFields = (obj: any, depth = 0): void => {
    if (depth > 3) return;
    for (const key of Object.keys(obj || {})) {
      const val = obj[key];
      if (val === null || val === undefined) {
        totalFields++;
      } else if (Array.isArray(val)) {
        totalFields++;
        if (val.length > 0) fieldsFound++;
      } else if (typeof val === 'object') {
        countFields(val, depth + 1);
      } else {
        totalFields++;
        fieldsFound++;
      }
    }
  };
  countFields(raw);
  
  const confidenceScore = totalFields > 0 ? Math.round((fieldsFound / totalFields) * 100) / 100 : 0;
  
  return {
    property: {
      name: raw.property?.name ?? null,
      address: raw.property?.address ?? null,
      city: raw.property?.city ?? null,
      state: raw.property?.state ?? null,
      zip: raw.property?.zip ?? null,
      county: raw.property?.county ?? null,
      yearBuilt: raw.property?.yearBuilt ?? null,
      yearRenovated: raw.property?.yearRenovated ?? null,
      units: raw.property?.units ?? null,
      netRentableSF: raw.property?.netRentableSF ?? null,
      avgUnitSF: raw.property?.avgUnitSF ?? null,
      stories: raw.property?.stories ?? null,
      buildings: raw.property?.buildings ?? null,
      parkingSpaces: raw.property?.parkingSpaces ?? null,
      parkingRatio: raw.property?.parkingRatio ?? null,
      amenities: raw.property?.amenities ?? [],
      propertyType: raw.property?.propertyType ?? null,
    },
    replacementCost: {
      landValue: raw.replacementCost?.landValue ?? null,
      hardCostPSF: raw.replacementCost?.hardCostPSF ?? null,
      hardCostTotal: raw.replacementCost?.hardCostTotal ?? null,
      softCostPct: raw.replacementCost?.softCostPct ?? null,
      softCostTotal: raw.replacementCost?.softCostTotal ?? null,
      totalReplacementCost: raw.replacementCost?.totalReplacementCost ?? null,
      replacementCostPerUnit: raw.replacementCost?.replacementCostPerUnit ?? null,
      source: raw.replacementCost?.source ?? null,
      pageNumber: typeof raw.replacementCost?.pageNumber === 'number'
        ? raw.replacementCost.pageNumber
        : null,
    },
    brokerProforma: {
      stabilizedVacancy: raw.brokerProforma?.stabilizedVacancy ?? null,
      lossToLease: raw.brokerProforma?.lossToLease ?? null,
      concessionsPct: raw.brokerProforma?.concessionsPct ?? null,
      badDebtPct: raw.brokerProforma?.badDebtPct ?? null,
      rentGrowthY1: raw.brokerProforma?.rentGrowthY1 ?? null,
      rentGrowthY2: raw.brokerProforma?.rentGrowthY2 ?? null,
      rentGrowthY3: raw.brokerProforma?.rentGrowthY3 ?? null,
      rentGrowthY4: raw.brokerProforma?.rentGrowthY4 ?? null,
      rentGrowthY5: raw.brokerProforma?.rentGrowthY5 ?? null,
      opexGrowth: raw.brokerProforma?.opexGrowth ?? null,
      managementFeePct: raw.brokerProforma?.managementFeePct ?? null,
      replacementReservesPerUnit: raw.brokerProforma?.replacementReservesPerUnit ?? null,
      exitCapRate: raw.brokerProforma?.exitCapRate ?? null,
      holdPeriodYears: raw.brokerProforma?.holdPeriodYears ?? null,
      goingInCapRate: raw.brokerProforma?.goingInCapRate ?? null,
      targetIRR: raw.brokerProforma?.targetIRR ?? null,
      stabilizedNOI: raw.brokerProforma?.stabilizedNOI ?? null,
      yearOneNOI: raw.brokerProforma?.yearOneNOI ?? null,
    },
    capitalPlan: {
      interiorRenovationPerUnit: raw.capitalPlan?.interiorRenovationPerUnit ?? null,
      exteriorCapex: raw.capitalPlan?.exteriorCapex ?? null,
      deferredMaintenance: raw.capitalPlan?.deferredMaintenance ?? null,
      totalCapexBudget: raw.capitalPlan?.totalCapexBudget ?? null,
      renovationTimeline: raw.capitalPlan?.renovationTimeline ?? null,
      unitsPerMonth: raw.capitalPlan?.unitsPerMonth ?? null,
      rentPremiumPostReno: raw.capitalPlan?.rentPremiumPostReno ?? null,
      valueAddStrategy: raw.capitalPlan?.valueAddStrategy ?? null,
      scopeDescription: raw.capitalPlan?.scopeDescription ?? null,
    },
    debtAssumptions: {
      assumedLTV: raw.debtAssumptions?.assumedLTV ?? null,
      interestRateRange: raw.debtAssumptions?.interestRateRange ?? null,
      loanTerm: raw.debtAssumptions?.loanTerm ?? null,
      interestOnlyMonths: raw.debtAssumptions?.interestOnlyMonths ?? null,
      rateCapCost: raw.debtAssumptions?.rateCapCost ?? null,
      prepaymentTerms: raw.debtAssumptions?.prepaymentTerms ?? null,
      assumableLoan: raw.debtAssumptions?.assumableLoan ?? null,
      existingDebt: raw.debtAssumptions?.existingDebt ?? null,
    },
    marketComps: {
      rentComps: ((raw.marketComps?.rentComps ?? []) as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((c): OMRentComp => ({
          name: typeof c.name === 'string' ? c.name : '',
          units: typeof c.units === 'number' ? c.units : null,
          yearBuilt: typeof c.yearBuilt === 'number' ? c.yearBuilt : null,
          avgRent: typeof c.avgRent === 'number' ? c.avgRent : null,
          occupancy: typeof c.occupancy === 'number' ? c.occupancy : null,
          distance: typeof c.distance === 'string' ? c.distance : null,
          pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : null,
        })),
      saleComps: ((raw.marketComps?.saleComps ?? []) as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((c): OMSaleComp => ({
          name: typeof c.name === 'string' ? c.name : '',
          units: typeof c.units === 'number' ? c.units : null,
          salePrice: typeof c.salePrice === 'number' ? c.salePrice : null,
          pricePerUnit: typeof c.pricePerUnit === 'number' ? c.pricePerUnit : null,
          capRate: typeof c.capRate === 'number' ? c.capRate : null,
          saleDate: typeof c.saleDate === 'string' ? c.saleDate : null,
          pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : null,
        })),
      submarketAvgRent: raw.marketComps?.submarketAvgRent ?? null,
      submarketOccupancy: raw.marketComps?.submarketOccupancy ?? null,
      submarketRentGrowth: raw.marketComps?.submarketRentGrowth ?? null,
      submarketName: raw.marketComps?.submarketName ?? null,
    },
    riskFactors: {
      leaseExpirationConcentration: raw.riskFactors?.leaseExpirationConcentration ?? null,
      tenantConcentration: raw.riskFactors?.tenantConcentration ?? null,
      section8Pct: raw.riskFactors?.section8Pct ?? null,
      studentHousingPct: raw.riskFactors?.studentHousingPct ?? null,
      corporateHousingPct: raw.riskFactors?.corporateHousingPct ?? null,
      pendingLitigation: raw.riskFactors?.pendingLitigation ?? null,
      taxAppealStatus: raw.riskFactors?.taxAppealStatus ?? null,
      currentTaxAssessment: raw.riskFactors?.currentTaxAssessment ?? null,
      environmentalStatus: raw.riskFactors?.environmentalStatus ?? null,
      zoningCode: raw.riskFactors?.zoningCode ?? null,
      zoningConstraints: raw.riskFactors?.zoningConstraints ?? null,
      insuranceClaims: raw.riskFactors?.insuranceClaims ?? null,
      floodZone: raw.riskFactors?.floodZone ?? null,
      deferredMaintenanceNotes: raw.riskFactors?.deferredMaintenanceNotes ?? null,
    },
    keyEvents: {
      taxAppealPending: raw.keyEvents?.taxAppealPending ?? false,
      taxAppealAmount: raw.keyEvents?.taxAppealAmount ?? null,
      insuranceClaimPending: raw.keyEvents?.insuranceClaimPending ?? false,
      insuranceClaimAmount: raw.keyEvents?.insuranceClaimAmount ?? null,
      renovationPlanned: raw.keyEvents?.renovationPlanned ?? false,
      renovationStartDate: raw.keyEvents?.renovationStartDate ?? null,
      renovationEndDate: raw.keyEvents?.renovationEndDate ?? null,
      leaseUpInProgress: raw.keyEvents?.leaseUpInProgress ?? false,
      stabilizationDate: raw.keyEvents?.stabilizationDate ?? null,
      assumableLoanMaturity: raw.keyEvents?.assumableLoanMaturity ?? null,
    },
    investmentHighlights: raw.investmentHighlights ?? [],
    investmentThesis: raw.investmentThesis ?? null,
    metadata: {
      broker: raw.metadata?.broker ?? null,
      brokerContact: raw.metadata?.brokerContact ?? null,
      listingDate: raw.metadata?.listingDate ?? null,
      callForOffersDate: raw.metadata?.callForOffersDate ?? null,
      askingPrice: raw.metadata?.askingPrice ?? null,
      guidancePricePerUnit: raw.metadata?.guidancePricePerUnit ?? null,
      guidanceCapRate: raw.metadata?.guidanceCapRate ?? null,
      confidenceScore,
      extractedAt: now,
      pdfPageCount: 0, // Will be set by caller
      textLength,
    },
  };
}

// ─── Main Parser Function ─────────────────────────────────────────────────────

/**
 * Result envelope for parseOM. Adds an explicit `meta.usedOcr` flag so
 * downstream pipeline code can distinguish OCR-fallback failures from
 * regular text-layer parse failures without parsing warning strings.
 */
export type OMParseResult = ExtractionResult & {
  data: OMExtraction | null;
  meta: { usedOcr: boolean; ocrError?: string };
};

export async function parseOM(
  buffer: Buffer,
  filename: string,
  ctx?: OMParseContext
): Promise<OMParseResult> {
  const warnings: string[] = [];
  let usedOcr = false;
  let ocrError: string | undefined;

  try {
    // Extract text from the PDF's embedded text layer first.
    let { text, pages } = await extractPdfText(buffer);

    // Scanned/image-only OMs return ~empty text from pdf-parse. When the text
    // layer is below threshold, fall back to OCR (pdftoppm + tesseract.js).
    if (!text || text.trim().length < OCR_MIN_TEXT_THRESHOLD) {
      const tmpPath = path.join(os.tmpdir(), `om-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
      try {
        fs.writeFileSync(tmpPath, buffer);
        logger.info(`[OM Parser] text layer empty (${text?.trim().length ?? 0} chars) — running OCR fallback`, { filename });
        usedOcr = true;
        // Notify the pipeline so the operator sees parsing_stage='ocr' while
        // tesseract is running (multi-second on long scanned PDFs).
        if (ctx?.onStageChange) {
          try { await ctx.onStageChange('ocr'); }
          catch (cbErr) { logger.warn('[OM Parser] onStageChange(ocr) callback failed', { cbErr }); }
        }
        try {
          const ocr = await ocrPdf(tmpPath);
          text = ocr.text;
          if (!pages || pages === 0) pages = ocr.pageCount;
          warnings.push(`OCR fallback used (${ocr.pageCount} pages, ${ocr.durationMs}ms)`);
        } catch (ocrErr) {
          ocrError = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
          logger.warn('[OM Parser] OCR fallback failed', { filename, error: ocrError });
          return {
            documentType: 'OM',
            success: false,
            error: `OCR fallback failed: ${ocrError}`,
            data: null,
            summary: {},
            warnings,
            meta: { usedOcr: true, ocrError },
          };
        }
      } finally {
        try { fs.unlinkSync(tmpPath); } catch { /* tmp cleanup is best-effort */ }
      }
    }

    if (!text || text.length < 500) {
      return {
        documentType: 'OM',
        success: false,
        error: usedOcr
          ? 'OCR returned insufficient text — document may be unreadable'
          : 'PDF appears to be empty or unparseable',
        data: null,
        summary: {},
        warnings,
        meta: { usedOcr, ocrError },
      };
    }

    if (text.length < 2000) {
      warnings.push('Document is unusually short — may be incomplete');
    }

    // Stage transition: text in hand, AI extraction next.
    // Lets the Data Library UI show "Analyzing" while the LLM call runs
    // (typically the longest synchronous step after OCR).
    if (ctx?.onStageChange) {
      try { await ctx.onStageChange('analyzing'); }
      catch (cbErr) { logger.warn('[OM Parser] onStageChange(analyzing) callback failed', { cbErr }); }
    }

    // Extract with AI
    const extraction = await extractWithAI(text, filename, ctx);
    extraction.metadata.pdfPageCount = pages;
    
    // Validate critical fields
    if (!extraction.property.units && !extraction.property.name) {
      warnings.push('Could not extract property name or unit count — verify document is an OM');
    }
    
    if (!extraction.brokerProforma.stabilizedVacancy && !extraction.brokerProforma.exitCapRate) {
      warnings.push('No broker pro forma assumptions found');
    }
    
    // Build summary for capsule
    const summary = {
      propertyName: extraction.property.name,
      units: extraction.property.units,
      yearBuilt: extraction.property.yearBuilt,
      propertyType: extraction.property.propertyType,
      askingPrice: extraction.metadata.askingPrice,
      guidancePricePerUnit: extraction.metadata.guidancePricePerUnit,
      goingInCapRate: extraction.brokerProforma.goingInCapRate,
      exitCapRate: extraction.brokerProforma.exitCapRate,
      stabilizedVacancy: extraction.brokerProforma.stabilizedVacancy,
      replacementCostPerUnit: extraction.replacementCost.replacementCostPerUnit,
      totalCapexBudget: extraction.capitalPlan.totalCapexBudget,
      rentPremiumPostReno: extraction.capitalPlan.rentPremiumPostReno,
      broker: extraction.metadata.broker,
      confidenceScore: extraction.metadata.confidenceScore,
      rentCompCount: extraction.marketComps.rentComps.length,
      saleCompCount: extraction.marketComps.saleComps.length,
      hasValueAddStrategy: !!extraction.capitalPlan.valueAddStrategy,
      hasReplacementCost: !!extraction.replacementCost.totalReplacementCost,
      keyEventsCount: [
        extraction.keyEvents.taxAppealPending,
        extraction.keyEvents.insuranceClaimPending,
        extraction.keyEvents.renovationPlanned,
        extraction.keyEvents.leaseUpInProgress,
      ].filter(Boolean).length,
    };
    
    logger.info(`[OM Parser] Extracted ${filename}: ${extraction.property.units} units, confidence ${extraction.metadata.confidenceScore}`);
    
    return {
      documentType: 'OM',
      success: true,
      data: extraction,
      summary,
      warnings,
      meta: { usedOcr, ocrError },
    };
  } catch (err) {
    logger.error('[OM Parser] Error:', err);
    return {
      documentType: 'OM',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null,
      summary: {},
      warnings,
      meta: { usedOcr, ocrError },
    };
  }
}

// ─── Sync wrapper for archive ingestion ───────────────────────────────────────

export async function parseOMAsync(
  buffer: Buffer,
  filename: string,
  ctx?: OMParseContext
): Promise<ExtractionResult & { data: OMExtraction | null }> {
  return parseOM(buffer, filename, ctx);
}
