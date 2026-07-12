/**
 * Loan Product Ruleset
 *
 * Defines standard loan products by lender type with provenance strings.
 * These are platform defaults that can be overridden by user/agent input.
 *
 * Products:
 *   - Agency:   5-year term, 30-year amort, 0 IO  (Fannie/Freddie standard multifamily)
 *   - Bank:     5-year term, 25-year amort, 12 IO   (Portfolio lender hold period)
 *   - LifeCo:   10-year term, 30-year amort, 0 IO   (Long-term insurance liability match)
 */

export type LenderType = 'agency' | 'bank' | 'life_co' | 'cmbs' | 'bridge' | 'debt_fund';

export interface LoanProduct {
  name: string;
  termYears: number;
  amortYears: number;
  maxIOYears: number;
  provenance: string;
  lenderType: LenderType;
}

export const LOAN_PRODUCT_RULESET = {
  version: '2026-07-10',
  provenanceTag: 'platform_default',
  products: [
    {
      name: 'Agency Standard Multifamily',
      termYears: 5,
      amortYears: 30,
      maxIOYears: 0,
      provenance: 'Fannie/Freddie standard multifamily product, 5-year balloon with 30-year amortization',
      lenderType: 'agency' as LenderType,
    },
    {
      name: 'Bank Portfolio',
      termYears: 5,
      amortYears: 25,
      maxIOYears: 1,
      provenance: 'Portfolio lender hold period, shorter amort for faster principal recovery',
      lenderType: 'bank' as LenderType,
    },
    {
      name: 'Life Company Long-Term',
      termYears: 10,
      amortYears: 30,
      maxIOYears: 0,
      provenance: 'Long-term match for insurance liability duration',
      lenderType: 'life_co' as LenderType,
    },
    {
      name: 'Bridge',
      termYears: 3,
      amortYears: 30,
      maxIOYears: 3,
      provenance: 'Bridge loan for value-add or lease-up deals, 3-year term with full IO',
      lenderType: 'bridge' as LenderType,
    },
  ] as LoanProduct[],
  fallback: {
    name: 'Agency Standard Multifamily (fallback)',
    termYears: 5,
    amortYears: 30,
    maxIOYears: 0,
    provenance: 'No lender type matched — falling back to agency standard multifamily product',
    lenderType: 'agency' as LenderType,
  } as LoanProduct,
};

export interface DealContext {
  lenderType?: string;
  assetClass?: string;
}

/**
 * Resolve a loan product for the given deal context.
 *
 * @param dealContext — optional lenderType and assetClass from the deal
 * @returns LoanProduct with provenance string describing what default is being used
 */
export function resolveLoanProduct(dealContext: DealContext = {}): LoanProduct {
  const { lenderType } = dealContext;

  if (!lenderType) {
    return {
      ...LOAN_PRODUCT_RULESET.fallback,
      provenance: `${LOAN_PRODUCT_RULESET.fallback.provenance} (no lenderType provided)`,
    };
  }

  const normalized = lenderType.toLowerCase().replace(/[-\s]/g, '_') as LenderType;
  const product = LOAN_PRODUCT_RULESET.products.find(p => p.lenderType === normalized);

  if (product) {
    return {
      ...product,
      provenance: `${product.provenance} (matched lenderType: ${lenderType})`,
    };
  }

  return {
    ...LOAN_PRODUCT_RULESET.fallback,
    provenance: `${LOAN_PRODUCT_RULESET.fallback.provenance} (unmatched lenderType: ${lenderType})`,
  };
}

/**
 * Convert a LoanProduct to months for direct use in ModelAssumptions.
 */
export function productToMonths(product: LoanProduct): {
  termMonths: number;
  amortMonths: number;
  maxIOMonths: number;
  provenance: string;
} {
  return {
    termMonths: product.termYears * 12,
    amortMonths: product.amortYears * 12,
    maxIOMonths: product.maxIOYears * 12,
    provenance: product.provenance,
  };
}
