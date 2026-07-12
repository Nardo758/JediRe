/**
 * loan-quote.types.ts
 * Component 1: Loan quotes store types and interfaces.
 *
 * Org-scoped privacy (Lane B): uploaded quotes live at the org level, not
 * deal-scoped and not platform-global. They are a firm-level asset reusable
 * across the pipeline. Two users in the same org share quotes; cross-org
 * access is prohibited.
 *
 * Depends on: DebtContext (B6), LoanProduct (B3), RecommendedTerms (B4/B5).
 */

// ============================================================================
// Core Loan Quote
// ============================================================================

/**
 * Rate type determines which forward-curve role applies:
 * - 'fixed'   → Role 1: one lookup at origination, then locked (term_index)
 * - 'floating'→ Role 2: per-period projection across the whole hold (SOFR path)
 */
export type RateType = 'fixed' | 'floating';

/**
 * Index basis determines which curve the pricing resolver reads:
 * - 'SOFR'           → SOFR term structure (for ARM / floating quotes)
 * - 'treasury_5yr'   → 5-year Treasury CMT
 * - 'treasury_7yr'   → 7-year Treasury CMT
 * - 'treasury_10yr'  → 10-year Treasury CMT
 * - 'treasury_30yr'  → 30-year Treasury CMT
 */
export type IndexBasis =
  | 'SOFR'
  | 'treasury_5yr'
  | 'treasury_7yr'
  | 'treasury_10yr'
  | 'treasury_30yr';

/**
 * A single loan quote parsed from a rate sheet, email, or manual entry.
 * Lives at org scope (orgId) — reusable across any deal in the org.
 */
export interface LoanQuote {
  /** Unique identifier for the quote row. */
  id: string;

  /** Org scope — Lane B privacy boundary. Quotes never cross orgs. */
  orgId: string;

  /** Lender name, e.g. 'NewPoint'. */
  lender: string;

  /** Program, e.g. 'Fannie DUS', 'Freddie Mac', 'FHA-Ginnie', 'bank', 'life-co'. */
  program: string;

  /** Date the quote was issued (ISO 8601). */
  quoteDate: string;

  /** Quote expiration date (ISO 8601). Rates are perishable. */
  expires: string;

  /** Which market index this quote prices off. */
  indexBasis: IndexBasis;

  /** Fixed or floating rate structure. */
  rateType: RateType;

  /** The spread matrix: leverage tier × term → spread range. */
  spreadMatrix: SpreadMatrix;

  /** Adjustment stack (green, MAH, size premium, tier/LTV bonus, etc.). */
  adjustments: Adjustment[];

  /** Prepayment structure per term (YM, defeasance, step-down). */
  prepayStructure: PrepayStructure;

  /** Provenance: this is a broker claim, never a verified market rate. */
  brokerClaims: BrokerClaimsProvenance;

  /** Optional free-text notes. */
  notes?: string;

  /** Creation timestamp. */
  createdAt: string;

  /** Last update timestamp. */
  updatedAt: string;
}

// ============================================================================
// Spread Matrix
// ============================================================================

/**
 * A leverage tier descriptor, e.g. 'Tier-1', 'Tier-2', 'Tier-3'.
 * Typically maps to LTV / DSCR thresholds (e.g. 55%/1.55x, 65%/1.35x, 75%/1.25x).
 */
export type LeverageTier = string;

/**
 * Loan term in years, e.g. 5, 7, 10, 30.
 */
export type TermYears = number;

/**
 * Spread range (min, max) in basis points or decimal — the sheet quotes a
 * range pending final underwriting. The resolver may use midpoint, conservative
 * high, or surface the range (open question #1 in spec).
 */
export interface SpreadRange {
  /** Minimum spread quoted (decimal, e.g. 0.0126 for 126 bps). */
  min: number;

  /** Maximum spread quoted (decimal, e.g. 0.0136 for 136 bps). */
  max: number;
}

/**
 * The spread matrix: (leverageTier × term) → spreadRange.
 * Example: Fannie Tier-3 (65%/1.35x) 7yr → { min: 0.0126, max: 0.0136 }.
 */
export interface SpreadMatrix {
  /** Program this matrix belongs to (same as LoanQuote.program). */
  program: string;

  /** Grid entries: tier → term → spread range. */
  grid: Record<LeverageTier, Record<TermYears, SpreadRange>>;
}

// ============================================================================
// Adjustment Stack
// ============================================================================

/**
 * A single adjustment (green, MAH, size premium, tier/LTV bonus, etc.).
 * Each carries provenance so the resolver can build a full provenance chain.
 */
export interface Adjustment {
  /** Human-readable name, e.g. 'Green building', 'MAH', 'Size premium >$6MM'. */
  name: string;

  /** Adjustment in basis points (positive = premium, negative = discount). */
  bps: number;

  /** Provenance: where this adjustment came from (sheet row, manual entry, etc.). */
  provenance: string;
}

// ============================================================================
// Prepayment Structure
// ============================================================================

/**
 * Prepayment type: yield maintenance, defeasance, or step-down.
 * Matters for exit-payoff math (debt-event Phase 3).
 */
export type PrepayType = 'yield_maintenance' | 'defeasance' | 'step_down';

/**
 * Prepayment structure per term.
 */
export interface PrepayStructure {
  type: PrepayType;

  /**
   * Term-specific prepay terms.
   * - yield_maintenance: { formula: string, lockoutMonths?: number }
   * - defeasance: { lockoutMonths: number, defeasanceWindowMonths?: number }
   * - step_down: { schedule: Array<{ year: number; penaltyPct: number }> }
   */
  terms: Record<string, unknown>;
}

// ============================================================================
// Broker Claims Provenance
// ============================================================================

/**
 * A quoted spread is a CLAIM ("NewPoint quoted X on date"), never a verified
 * market rate. Routes to broker_claims-class provenance exactly like an OM's
 * projected NOI. This is already-built boundary discipline; apply it.
 */
export interface BrokerClaimsProvenance {
  /** Source of the claim: 'rate_sheet_upload', 'email_extraction', 'manual_entry'. */
  source: string;

  /** Date the claim was captured (ISO 8601). */
  date: string;

  /**
   * Confidence in the extraction / entry (0–1).
   * - 1.0 = manual entry by verified user
   * - 0.9 = email auto-extraction with lender match
   * - 0.7 = OCR table extraction verified by user
   * - 0.5 = raw OCR extraction unverified
   */
  confidence: number;

  /** Original document ID (if from upload/email), or user ID (if manual). */
  sourceId?: string;

  /** Free-text context, e.g. email subject line, sheet page number. */
  context?: string;
}

// ============================================================================
// Loan Quote Store (org-scoped CRUD)
// ============================================================================

/**
 * Org-scoped CRUD operations for loan quotes.
 * All operations are filtered by orgId — Lane B privacy boundary.
 */
export interface LoanQuoteStore {
  /** Create a new quote. Returns the created quote with generated id. */
  create(quote: Omit<LoanQuote, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoanQuote>;

  /** Read a single quote by id (org-scoped: must match the quote's orgId). */
  read(id: string, orgId: string): Promise<LoanQuote | null>;

  /** List all quotes for an org, optionally filtered by lender or program. */
  list(orgId: string, filters?: { lender?: string; program?: string }): Promise<LoanQuote[]>;

  /** Update a quote. Returns the updated quote. */
  update(id: string, orgId: string, patch: Partial<Omit<LoanQuote, 'id' | 'orgId' | 'createdAt'>>): Promise<LoanQuote>;

  /** Delete a quote (org-scoped). Returns true if deleted. */
  delete(id: string, orgId: string): Promise<boolean>;

  /** Find quotes that have expired (expires < now) for an org. */
  findStale(orgId: string): Promise<LoanQuote[]>;
}
