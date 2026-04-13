/**
 * Debt Context Modifier Service
 *
 * Applies practical underwriting context modifiers to the raw debt plan BEFORE
 * it is surfaced to the user. Modifiers are based on deal-level factors that
 * lenders weigh independently of strategy type:
 *
 *  1. Deal size thresholds  — adjusts eligible lender categories by loan size
 *  2. Geography exclusions  — filters lenders and products for restricted states
 *  3. Asset age             — adds reserves, haircuts, PCA requirements
 *  4. Sponsor experience    — recourse requirements for first-time sponsors
 *  5. Sponsor liquidity     — credit restrictions when liquidity is thin
 *
 * Returns a ContextModifierOutput that the formulator applies to the raw plan.
 */
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

export interface DealUnderwritingContext {
  loanAmountEstimate: number;
  state: string;
  yearBuilt: number | null;
  sponsorDealCount: number;
  sponsorLiquidityRatio: number | null;
  purchasePrice: number;
}

export interface ContextModification {
  productExclusions: string[];
  lenderTypeExclusions: string[];
  recourseRequired: boolean;
  addPcaReserveNote: boolean;
  addAssetAgeHaircut: boolean;
  ltvHaircutPct: number;
  narrativeNotes: string[];
  geographyWarning: string | null;
  sizeWarning: string | null;
}

const RESTRICTED_STATE_PRODUCTS: Record<string, string[]> = {
  TX: ['agency_fixed'],
  NY: [],
  CA: [],
  IL: [],
};

const AGENCY_EXCLUDED_STATES: string[] = ['ND', 'SD', 'WY', 'MT'];
const CMBS_RESTRICTED_STATES: string[] = [];

const SIZE_TIERS = {
  MICRO: 2_000_000,
  SMALL: 5_000_000,
  MID: 25_000_000,
  LARGE: 75_000_000,
};

async function fetchSponsorDealCount(pool: Pool, dealId: string): Promise<number> {
  try {
    const row = await pool.query(
      `SELECT d.user_id FROM deals d WHERE d.id = $1 LIMIT 1`,
      [dealId]
    );
    if (!row.rows.length) return 0;
    const userId = row.rows[0].user_id;
    const countRow = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM deals WHERE user_id = $1 AND status NOT IN ('archived', 'deleted')`,
      [userId]
    );
    return countRow.rows[0]?.cnt || 0;
  } catch {
    return 0;
  }
}

async function fetchDealUnderwritingContext(
  pool: Pool,
  dealId: string,
  purchasePrice: number,
  state: string,
  loanAmountEstimate: number
): Promise<DealUnderwritingContext> {
  let yearBuilt: number | null = null;
  let sponsorLiquidityRatio: number | null = null;

  try {
    const ddRow = await pool.query(
      `SELECT deal_data, property_data FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );
    if (ddRow.rows.length) {
      const dd = ddRow.rows[0].deal_data || {};
      const pd = ddRow.rows[0].property_data || {};
      yearBuilt = dd.year_built ?? pd.year_built ?? pd.yearBuilt ?? null;
      const equityContribution = dd.equity_contribution ?? dd.sponsorEquity ?? null;
      if (equityContribution != null && purchasePrice > 0) {
        const equityPct = equityContribution / purchasePrice;
        const closingCostBuffer = 0.03;
        sponsorLiquidityRatio = Math.max(0, equityPct - closingCostBuffer);
      }
    }
  } catch (err: any) {
    logger.warn('[DebtContextModifier] Could not fetch deal underwriting context', { dealId, error: err.message });
  }

  const sponsorDealCount = await fetchSponsorDealCount(pool, dealId);

  return {
    loanAmountEstimate,
    state,
    yearBuilt: yearBuilt ? parseInt(String(yearBuilt)) : null,
    sponsorDealCount,
    sponsorLiquidityRatio,
    purchasePrice,
  };
}

function computeSizeModifications(ctx: DealUnderwritingContext, notes: string[]): Partial<ContextModification> {
  const loan = ctx.loanAmountEstimate;
  const exclusions: string[] = [];
  let sizeWarning: string | null = null;

  if (loan < SIZE_TIERS.MICRO) {
    exclusions.push('agency_fixed', 'cmbs_10yr', 'cmbs_long_term', 'life_co', 'cmbs_hospitality');
    sizeWarning = `Loan < $2M — agency, CMBS, and life company products require minimum loan sizes. Community bank or portfolio lender path required.`;
    notes.push('Sub-$2M loan: exclude agency/CMBS/life co; community bank and hard money lenders viable.');
  } else if (loan < SIZE_TIERS.SMALL) {
    exclusions.push('life_co', 'cmbs_10yr', 'cmbs_long_term');
    sizeWarning = `Loan $2-5M — life company and CMBS require $5M+ minimums. Regional bank or agency pathway for qualifying assets.`;
    notes.push('$2-5M loan: life co and CMBS excluded; agency available for qualifying MF/healthcare assets.');
  } else if (loan < SIZE_TIERS.MID) {
    notes.push('$5-25M loan: full product matrix available; agency, CMBS, bank, and debt fund all active in this range.');
  } else if (loan < SIZE_TIERS.LARGE) {
    notes.push('$25-75M loan: institutional lender market. Agency DUS, CMBS, life companies, and debt funds all competing aggressively.');
  } else {
    exclusions.push('portfolio_bank', 'bank_portfolio', 'hard_money', 'dscr_loan');
    notes.push(`$75M+ loan: super-institutional range. Syndication, club deal, or single lender with correspondent market. Hard money and community bank excluded.`);
  }

  return { lenderTypeExclusions: exclusions, sizeWarning };
}

function computeGeographyModifications(ctx: DealUnderwritingContext, notes: string[]): Partial<ContextModification> {
  const st = (ctx.state || '').toUpperCase();
  const exclusions: string[] = [];
  let geoWarning: string | null = null;

  if (AGENCY_EXCLUDED_STATES.includes(st)) {
    exclusions.push('agency_fixed', 'agency_supplemental', 'hud_221d4');
    geoWarning = `Agency lending is limited in ${st}. CMBS, life company, or bank alternative required.`;
    notes.push(`Geography: agency exclusion in ${st} — redirect to CMBS or portfolio bank.`);
  }

  if (CMBS_RESTRICTED_STATES.includes(st)) {
    exclusions.push('cmbs_10yr', 'cmbs_long_term');
    geoWarning = (geoWarning ?? '') + ` CMBS restricted in ${st}.`;
    notes.push(`Geography: CMBS restrictions in ${st}.`);
  }

  const restrictedProducts = RESTRICTED_STATE_PRODUCTS[st];
  if (restrictedProducts?.length) {
    exclusions.push(...restrictedProducts);
    notes.push(`Geography: State-specific product restrictions in ${st}: ${restrictedProducts.join(', ')}.`);
  }

  return { productExclusions: exclusions, geographyWarning: geoWarning };
}

function computeAssetAgeModifications(ctx: DealUnderwritingContext, notes: string[]): Partial<ContextModification> {
  const yb = ctx.yearBuilt;
  if (!yb) return {};

  const age = new Date().getFullYear() - yb;

  if (age >= 45) {
    notes.push(`Asset age ${age}yrs (built ${yb}): lenders require PCA/engineering report, significant replacement reserve underwriting, and potential environmental phase I. Structural/MEP deferred cap-ex must be modeled in sources & uses.`);
    return { addPcaReserveNote: true, addAssetAgeHaircut: true, ltvHaircutPct: 0.025 };
  }

  if (age >= 30) {
    notes.push(`Asset age ${age}yrs (built ${yb}): PCA typical at this vintage; reserve underwriting may include 5-10% deferred maintenance haircut on appraised value.`);
    return { addPcaReserveNote: true, addAssetAgeHaircut: false, ltvHaircutPct: 0.01 };
  }

  return {};
}

function computeSponsorModifications(ctx: DealUnderwritingContext, notes: string[]): Partial<ContextModification> {
  const mods: Partial<ContextModification> = {};

  if (ctx.sponsorDealCount <= 1) {
    mods.recourseRequired = true;
    notes.push(`Sponsor experience: first-time or limited track record (${ctx.sponsorDealCount} deal(s)). Most lenders will require full personal recourse guaranty. Non-recourse products (agency, CMBS) may be restricted pending net worth/liquidity verification.`);
  } else if (ctx.sponsorDealCount <= 3) {
    notes.push(`Sponsor experience: emerging track record (${ctx.sponsorDealCount} deal(s)). Non-recourse products available but lender may request additional guarantor or co-GP. Provide track record package proactively.`);
  }

  if (ctx.sponsorLiquidityRatio != null && ctx.sponsorLiquidityRatio < 0.10) {
    mods.recourseRequired = true;
    notes.push(`Sponsor liquidity: thin liquidity (est. ${(ctx.sponsorLiquidityRatio * 100).toFixed(0)}% equity post-close). Lenders typically require minimum 10% of loan in post-close liquidity. Consider bringing in LP or arranging equity bridge.`);
  }

  return mods;
}

export interface ContextModifierOutput {
  modifications: ContextModification;
  underwritingContext: DealUnderwritingContext;
}

export async function applyDebtContextModifier(
  pool: Pool,
  dealId: string,
  purchasePrice: number,
  state: string,
  loanAmountEstimate: number
): Promise<ContextModifierOutput> {
  const ctx = await fetchDealUnderwritingContext(pool, dealId, purchasePrice, state, loanAmountEstimate);

  const narrativeNotes: string[] = [];
  const sizeMods = computeSizeModifications(ctx, narrativeNotes);
  const geoMods = computeGeographyModifications(ctx, narrativeNotes);
  const ageMods = computeAssetAgeModifications(ctx, narrativeNotes);
  const sponsorMods = computeSponsorModifications(ctx, narrativeNotes);

  const modifications: ContextModification = {
    productExclusions: [
      ...(sizeMods.lenderTypeExclusions || []),
      ...(geoMods.productExclusions || []),
    ],
    lenderTypeExclusions: [],
    recourseRequired: sponsorMods.recourseRequired ?? false,
    addPcaReserveNote: ageMods.addPcaReserveNote ?? false,
    addAssetAgeHaircut: ageMods.addAssetAgeHaircut ?? false,
    ltvHaircutPct: ageMods.ltvHaircutPct ?? 0,
    narrativeNotes,
    geographyWarning: geoMods.geographyWarning ?? null,
    sizeWarning: sizeMods.sizeWarning ?? null,
  };

  return { modifications, underwritingContext: ctx };
}
