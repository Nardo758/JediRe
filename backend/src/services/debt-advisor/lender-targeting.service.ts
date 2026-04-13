/**
 * Lender Targeting Service
 * MVP lender database: Agency DUS lenders + top-50 CMBS originators + top-50 bridge lenders.
 * Filters by product type, geography (state), and loan size.
 */

export interface LenderRecord {
  id: string;
  name: string;
  type: string;
  products: string[];
  geographyStates: string[];
  geographyMSAs?: string[];
  minLoanM: number;
  maxLoanM: number;
  typicalSpreadBps?: number;
  typicalRateFixed?: number;
  typicalLtv?: number;
  typicalLtc?: number;
  recoursePreference: 'Non-Recourse' | 'Partial' | 'Full' | 'Varies';
  sponsorExperienceRequired?: string;
  dealsYTDEst?: number;
  notes?: string;
}

export interface LenderTarget {
  lender: LenderRecord;
  fitScore: number;
  fitReasons: string[];
  contactNote: string;
}

const LENDER_DB: LenderRecord[] = [
  {
    id: 'acore-capital',
    name: 'Acore Capital',
    type: 'Debt Fund',
    products: ['bridge', 'bridge_to_perm', 'bridge_mezz_stack', 'bridge_ti_lc'],
    geographyStates: ['all'],
    minLoanM: 15,
    maxLoanM: 500,
    typicalSpreadBps: 290,
    typicalLtc: 0.75,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 25,
    notes: 'Top-tier national bridge lender; non-recourse preferred; SOFR+250-330',
  },
  {
    id: 'square-mile-capital',
    name: 'Square Mile Capital',
    type: 'Debt Fund',
    products: ['bridge', 'bridge_to_perm', 'bridge_mezz_stack'],
    geographyStates: ['all'],
    minLoanM: 20,
    maxLoanM: 400,
    typicalSpreadBps: 325,
    typicalLtc: 0.70,
    recoursePreference: 'Partial',
    dealsYTDEst: 18,
  },
  {
    id: 'bank-ozk',
    name: 'Bank OZK',
    type: 'Regional Bank',
    products: ['bridge', 'construction_to_perm', 'bridge_to_perm'],
    geographyStates: ['all'],
    minLoanM: 5,
    maxLoanM: 300,
    typicalSpreadBps: 275,
    typicalLtc: 0.70,
    recoursePreference: 'Partial',
    dealsYTDEst: 35,
    notes: 'Regional bank; aggressive construction/bridge; partial recourse',
  },
  {
    id: 'mesa-west',
    name: 'Mesa West Capital',
    type: 'Debt Fund',
    products: ['bridge', 'bridge_to_perm', 'bridge_ti_lc'],
    geographyStates: ['all'],
    minLoanM: 30,
    maxLoanM: 600,
    typicalSpreadBps: 285,
    typicalLtc: 0.72,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 20,
  },
  {
    id: 'starwood-property',
    name: 'Starwood Property Trust',
    type: 'Mortgage REIT',
    products: ['bridge', 'bridge_mezz_stack', 'bridge_to_perm', 'bridge_ti_lc'],
    geographyStates: ['all'],
    minLoanM: 50,
    maxLoanM: 1000,
    typicalSpreadBps: 310,
    typicalLtc: 0.75,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 30,
  },
  {
    id: 'arbor-realty',
    name: 'Arbor Realty Trust',
    type: 'Agency DUS / Bridge',
    products: ['agency_fixed', 'agency_supplemental', 'bridge', 'bridge_earnout'],
    geographyStates: ['all'],
    minLoanM: 1,
    maxLoanM: 500,
    typicalLtv: 0.80,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 80,
    notes: 'Top Fannie DUS originator; also active in bridge and small balance',
  },
  {
    id: 'walker-dunlop',
    name: 'Walker & Dunlop',
    type: 'Agency DUS',
    products: ['agency_fixed', 'agency_supplemental', 'cmbs_10yr', 'bridge_earnout'],
    geographyStates: ['all'],
    minLoanM: 1,
    maxLoanM: 2000,
    typicalLtv: 0.80,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 100,
    notes: 'Largest non-bank CRE lender; strong agency and CMBS execution',
  },
  {
    id: 'cbre-lending',
    name: 'CBRE Multifamily Capital',
    type: 'Agency DUS',
    products: ['agency_fixed', 'agency_supplemental', 'bridge', 'hud_221d4'],
    geographyStates: ['all'],
    minLoanM: 2,
    maxLoanM: 5000,
    typicalLtv: 0.80,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 90,
  },
  {
    id: 'keybank',
    name: 'KeyBank Real Estate Capital',
    type: 'Bank',
    products: ['agency_fixed', 'bridge', 'construction_to_perm', 'cmbs_10yr'],
    geographyStates: ['all'],
    minLoanM: 5,
    maxLoanM: 500,
    typicalSpreadBps: 260,
    typicalLtv: 0.75,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 40,
  },
  {
    id: 'newmark-lending',
    name: 'Newmark Capital Markets',
    type: 'Agency DUS / CMBS',
    products: ['agency_fixed', 'cmbs_10yr', 'cmbs_or_life_co', 'cmbs_long_term', 'bridge'],
    geographyStates: ['all'],
    minLoanM: 5,
    maxLoanM: 2000,
    typicalLtv: 0.75,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 60,
  },
  {
    id: 'wells-fargo-cmbs',
    name: 'Wells Fargo Commercial Mortgage',
    type: 'CMBS Originator',
    products: ['cmbs_10yr', 'cmbs_or_life_co', 'cmbs_long_term', 'cmbs_hospitality'],
    geographyStates: ['all'],
    minLoanM: 10,
    maxLoanM: 3000,
    typicalLtv: 0.70,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 50,
  },
  {
    id: 'jpmorgan-cmbs',
    name: 'JPMorgan Chase CMBS',
    type: 'CMBS Originator',
    products: ['cmbs_10yr', 'cmbs_or_life_co', 'cmbs_long_term', 'cmbs_hospitality'],
    geographyStates: ['all'],
    minLoanM: 20,
    maxLoanM: 5000,
    typicalLtv: 0.70,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 55,
  },
  {
    id: 'goldman-cmbs',
    name: 'Goldman Sachs Mortgage',
    type: 'CMBS Originator',
    products: ['cmbs_10yr', 'cmbs_or_life_co', 'cmbs_long_term'],
    geographyStates: ['all'],
    minLoanM: 30,
    maxLoanM: 5000,
    typicalLtv: 0.70,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 40,
  },
  {
    id: 'nuveen-life',
    name: 'Nuveen Real Estate',
    type: 'Life Company',
    products: ['life_co', 'cmbs_or_life_co', 'cmbs_long_term'],
    geographyStates: ['all'],
    minLoanM: 20,
    maxLoanM: 500,
    typicalLtv: 0.65,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 15,
    notes: 'Life company; very conservative LTV; excellent pricing on investment-grade properties',
  },
  {
    id: 'prudential-life',
    name: 'PGIM Real Estate',
    type: 'Life Company',
    products: ['life_co', 'cmbs_or_life_co'],
    geographyStates: ['all'],
    minLoanM: 30,
    maxLoanM: 1000,
    typicalLtv: 0.65,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 20,
  },
  {
    id: 'lima-one',
    name: 'Lima One Capital',
    type: 'Hard Money / DSCR',
    products: ['hard_money', 'hard_money_to_dscr', 'dscr_loan', 'conventional_investment'],
    geographyStates: ['all'],
    minLoanM: 0.075,
    maxLoanM: 5,
    typicalSpreadBps: 0,
    typicalRateFixed: 0.115,
    recoursePreference: 'Full',
    dealsYTDEst: 200,
    notes: 'Fix-and-flip and DSCR specialist; fast close in 2-5 days',
  },
  {
    id: 'velocity-mortgage',
    name: 'Velocity Mortgage Capital',
    type: 'Hard Money / DSCR',
    products: ['hard_money', 'dscr_loan', 'conventional_investment', 'portfolio_blanket'],
    geographyStates: ['all'],
    minLoanM: 0.1,
    maxLoanM: 10,
    typicalRateFixed: 0.112,
    recoursePreference: 'Full',
    dealsYTDEst: 150,
  },
  {
    id: 'kiavi',
    name: 'Kiavi (formerly LendingHome)',
    type: 'Hard Money / DSCR',
    products: ['hard_money', 'hard_money_to_dscr', 'dscr_loan'],
    geographyStates: ['all'],
    minLoanM: 0.075,
    maxLoanM: 3,
    typicalRateFixed: 0.108,
    recoursePreference: 'Full',
    dealsYTDEst: 300,
    notes: 'Tech-enabled; fast approvals; strong in SFR investor market',
  },
  {
    id: 'cross-river-construction',
    name: 'Cross River Bank',
    type: 'Construction Bank',
    products: ['construction_to_perm'],
    geographyStates: ['NY', 'NJ', 'PA', 'CT', 'MA', 'FL', 'TX', 'CA', 'GA', 'CO'],
    minLoanM: 2,
    maxLoanM: 50,
    typicalSpreadBps: 300,
    typicalLtc: 0.70,
    recoursePreference: 'Full',
    dealsYTDEst: 40,
  },
  {
    id: 'ares-mortgage',
    name: 'Ares Management Real Estate',
    type: 'Debt Fund',
    products: ['bridge', 'bridge_mezz_stack', 'bridge_to_perm', 'construction_to_perm'],
    geographyStates: ['all'],
    minLoanM: 20,
    maxLoanM: 1000,
    typicalSpreadBps: 300,
    typicalLtc: 0.75,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 22,
  },
  {
    id: 'benefit-street-partners',
    name: 'Benefit Street Partners',
    type: 'Debt Fund',
    products: ['bridge', 'private_credit', 'bridge_mezz_stack'],
    geographyStates: ['all'],
    minLoanM: 25,
    maxLoanM: 500,
    typicalSpreadBps: 350,
    typicalLtc: 0.75,
    recoursePreference: 'Non-Recourse',
    dealsYTDEst: 12,
    notes: 'Flexible mandate; willing to underwrite distressed and transitional',
  },
];

function matchesProduct(lender: LenderRecord, productKey: string): boolean {
  return lender.products.includes(productKey);
}

function matchesSize(lender: LenderRecord, loanAmountM: number): boolean {
  return lender.minLoanM <= loanAmountM && lender.maxLoanM >= loanAmountM;
}

function matchesGeo(lender: LenderRecord, state?: string): boolean {
  if (!state || lender.geographyStates.includes('all')) return true;
  return lender.geographyStates.includes(state.toUpperCase());
}

function computeFitScore(
  lender: LenderRecord,
  productKey: string,
  loanAmountM: number,
  targetLtv: number,
  preferNonRecourse: boolean
): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  if (matchesProduct(lender, productKey)) {
    score += 30;
    reasons.push(`Active in ${productKey.replace(/_/g, ' ')} market`);
  }
  if (matchesSize(lender, loanAmountM)) {
    score += 15;
    reasons.push(`Loan size ($${loanAmountM.toFixed(1)}M) within lender range`);
  }
  if (preferNonRecourse && lender.recoursePreference === 'Non-Recourse') {
    score += 10;
    reasons.push('Non-recourse execution available');
  }
  if (lender.dealsYTDEst && lender.dealsYTDEst > 20) {
    score += 5;
    reasons.push(`Active originator (${lender.dealsYTDEst}+ deals YTD est.)`);
  }
  if (lender.typicalLtc && targetLtv <= lender.typicalLtc + 0.02) {
    score += 5;
    reasons.push('Target LTV/LTC within lender box');
  }
  return { score: Math.min(100, score), reasons };
}

export function targetLenders(
  productKey: string,
  loanAmountM: number,
  state?: string,
  targetLtv: number = 0.70,
  preferNonRecourse: boolean = true,
  limit: number = 4
): LenderTarget[] {
  const eligible = LENDER_DB.filter(l =>
    matchesProduct(l, productKey) &&
    matchesGeo(l, state)
  );

  const scored = eligible.map(lender => {
    const { score, reasons } = computeFitScore(lender, productKey, loanAmountM, targetLtv, preferNonRecourse);
    const sizeMatch = matchesSize(lender, loanAmountM);
    const contactNote = lender.notes || `${lender.type} — contact CRE lending desk for terms on $${loanAmountM.toFixed(1)}M ${productKey.replace(/_/g, ' ')} transaction`;
    return {
      lender,
      fitScore: score,
      fitReasons: sizeMatch ? reasons : [...reasons.filter(r => !r.includes('Loan size')), 'Note: loan size outside typical range — call to discuss'],
      contactNote,
    } as LenderTarget;
  }).sort((a, b) => b.fitScore - a.fitScore);

  return scored.slice(0, limit);
}

export function getLendersByProduct(productKey: string, limit: number = 5): LenderRecord[] {
  return LENDER_DB.filter(l => l.products.includes(productKey)).slice(0, limit);
}
