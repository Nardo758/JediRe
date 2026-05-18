/**
 * Snapshot metric parser for CashFlow Agent narrative summaries.
 *
 * New-format proforma_json (v3.x agent runs) carries evidence-backed assumption
 * fields but does NOT include pre-computed result metrics (IRR, NOI, DSCR,
 * cash-on-cash). The agent reliably writes these into the text narrative when
 * a deal has computable returns. When a deal doesn't pencil the agent omits
 * them, so undefined → "—" in the Compare tab is CORRECT for those deals.
 *
 * Supported narrative patterns (all case-insensitive):
 *   IRR: "5-yr IRR 18.1%" | "Projected 5-yr IRR 18.1%" | "5-yr IRR estimated at -7.5%"
 *   NOI: "$1.5M NOI" | "~$2.0M NOI" | "NOI projected ~$2.0M"
 *   CoC: "cash-on-cash 8.2%" | "cash on cash: 8.2%" | "CoC 8.2%"
 *   PP:  "on $50M purchase price" | "$50M assumed basis"
 */

export interface ParsedSummaryMetrics {
  irr?: number;
  noi?: number;
  cashOnCash?: number;
  purchasePrice?: number;
}

const parseMagnitude = (numStr: string, suffix: string): number => {
  const raw = numStr.replace(/,/g, '');
  const n = parseFloat(raw);
  const s = suffix.toUpperCase();
  return n * (s === 'B' ? 1e9 : s === 'M' ? 1e6 : s === 'K' ? 1e3 : 1);
};

export function parseSummaryMetrics(summaryText: string): ParsedSummaryMetrics {
  if (!summaryText) return {};
  const out: ParsedSummaryMetrics = {};

  // ── IRR ────────────────────────────────────────────────────────────────────
  // Patterns: "5-yr IRR 18.1%" | "Projected 5-yr IRR 18.1%" | "5-yr IRR estimated at -7.5%"
  // Requires "5-yr|5 year" prefix to prevent false positives (e.g. "IRR implications").
  const irrMatch = summaryText.match(
    /(?:5-yr|5\s*year)\s+IRR\s+(?:estimated\s+at\s+|of\s+|:\s*)?([-\d.]+)%/i,
  );
  if (irrMatch) out.irr = parseFloat(irrMatch[1]) / 100;

  // ── NOI ────────────────────────────────────────────────────────────────────
  // Patterns: "$1.5M NOI" | "~$1,500,000 NOI" | "NOI projected ~$2.0M" | "stabilized NOI...~$X.XM"
  // Handles: optional ~, comma-separated numbers, K/M/B suffixes.
  const NOI_DOLLAR_FIRST = /\$\s*([\d,]+(?:\.\d+)?)\s*([KMBkmb])?\s+NOI\b/i;
  const NOI_KEYWORD_FIRST = /\bNOI\b[^.]*?~?\$\s*([\d,]+(?:\.\d+)?)\s*([KMBkmb])?(?:\b|$)/i;
  const noiMatch = summaryText.match(NOI_DOLLAR_FIRST) || summaryText.match(NOI_KEYWORD_FIRST);
  if (noiMatch) {
    const suffix = noiMatch[2] ?? '';
    out.noi = parseMagnitude(noiMatch[1], suffix);
  }

  // ── Cash-on-cash ───────────────────────────────────────────────────────────
  // Not yet written by v3.x agent; pattern included for forward-compatibility.
  // Patterns: "cash-on-cash 8.2%" | "cash on cash: 8.2%" | "CoC 8.2%"
  const cocMatch =
    summaryText.match(/cash[\s-]on[\s-]cash\s*(?:of\s*|:\s*)?([-\d.]+)%/i) ||
    summaryText.match(/\bCoC\s*(?:of\s*|:\s*)?([-\d.]+)%/i);
  if (cocMatch) out.cashOnCash = parseFloat(cocMatch[1]) / 100;

  // ── Purchase price ─────────────────────────────────────────────────────────
  // Patterns: "on $50M purchase price" | "$50M assumed basis" | "on $50,000,000 purchase price"
  // Used to derive equity (purchasePrice − loanAmount) for computing cash-on-cash
  // when the agent does not write it explicitly.
  const PP_ON_PHRASE =
    /on\s+\$\s*([\d,]+(?:\.\d+)?)\s*([KMBkmb])?\s+purchase\s+price/i;
  const PP_ASSUMED =
    /\$\s*([\d,]+(?:\.\d+)?)\s*([KMBkmb])?\s+(?:assumed\s+basis|purchase\s+price)/i;
  const ppMatch = summaryText.match(PP_ON_PHRASE) || summaryText.match(PP_ASSUMED);
  if (ppMatch) {
    const suffix = ppMatch[2] ?? '';
    out.purchasePrice = parseMagnitude(ppMatch[1], suffix);
  }

  return out;
}

/**
 * Compute Annual Debt Service (ADS) from standard amortizing mortgage formula.
 *
 * @param loanAmount  Principal in dollars
 * @param interestRate  Annual rate — accepts either decimal (0.065) or percent (6.5);
 *                      values > 1 are treated as percent and divided by 100.
 * @param amortizationYears  Loan term in years (default: 30)
 * @returns Annual debt service in dollars, or undefined if inputs are missing
 */
export function computeAnnualDebtService(
  loanAmount: number | undefined,
  interestRate: number | undefined,
  amortizationYears: number | undefined,
): number | undefined {
  if (loanAmount == null || interestRate == null) return undefined;
  const rate = interestRate > 1 ? interestRate / 100 : interestRate;
  const n = (amortizationYears ?? 30) * 12;
  const r = rate / 12;
  if (r === 0) return (loanAmount / n) * 12;
  return ((loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) * 12;
}
