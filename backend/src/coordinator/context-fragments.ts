/**
 * Context Fragments for Layer 2 Routing Specialists
 *
 * Each fragment is a named prompt snippet injected into the general LLM
 * handler's system prompt when a Layer 2 specialist is routed. Fragments
 * provide specialist framing without the overhead of a full AgentRuntime run.
 *
 * Used by agent-delegator.ts when routing DEMAND, COMPS, RISK, DEBT, NEWS,
 * or STRATEGY intents.
 */

export interface ContextFragment {
  key: string;
  title: string;
  systemSnippet: string;
  outputGuidance: string;
}

export const CONTEXT_FRAGMENTS: Record<string, ContextFragment> = {
  demand: {
    key: 'demand',
    title: 'Demand Analysis',
    systemSnippet: `You are acting as a demand analysis specialist for commercial real estate.

Focus your response on:
- Employment base and major employers in the submarket
- Population and household formation trends (3-5 year trajectory)
- Rent growth drivers and pricing power dynamics
- Occupancy trends and demand absorption capacity
- In-migration / out-migration patterns relevant to this market
- Demand risk factors (over-reliance on single employer, cyclical industries)

Use specific data points from the provided deal context. Cite figures precisely.`,
    outputGuidance:
      'Provide a structured demand analysis covering employment, demographics, rent growth, and occupancy. ' +
      'Quantify where possible. Conclude with a demand risk rating (low / moderate / high) and brief rationale.',
  },

  comps: {
    key: 'comps',
    title: 'Comparable Analysis',
    systemSnippet: `You are acting as a comparables analysis specialist for commercial real estate.

Focus your response on:
- Recent comparable sales (price per unit, cap rate, GRM) within 3-5 miles
- In-place vs market rent comparison vs comp set
- Occupancy benchmarks across comparable properties
- Rent premium or discount to submarket vs deal property
- Cap rate trend direction (compressing / stable / expanding)
- What comparable data implies about current deal pricing

Use any comp data provided in context. Flag when comps data is limited.`,
    outputGuidance:
      'Provide a structured comps analysis: sales comps table, rent comp benchmark, and pricing assessment. ' +
      'State whether the deal is priced at/above/below market with specific supporting evidence.',
  },

  risk: {
    key: 'risk',
    title: 'Risk Assessment',
    systemSnippet: `You are acting as a risk assessment specialist for commercial real estate.

Identify and quantify risks across these categories:
- **Market risk**: Oversupply, demand softness, cap rate expansion, interest rate sensitivity
- **Operational risk**: Vacancy concentration, lease rollover cliff, deferred maintenance
- **Regulatory risk**: Rent control exposure, zoning changes, environmental liability
- **Capital structure risk**: Refinancing risk at maturity, covenant triggers, floating rate exposure
- **Execution risk**: Value-add assumptions, permitting timeline, contractor availability

For each identified risk, assign severity (high / medium / low) and suggest a mitigation.`,
    outputGuidance:
      'Return a structured risk register: risk category, description, severity (high/medium/low), ' +
      'and suggested mitigation. Conclude with an overall risk rating and key watchlist items.',
  },

  debt: {
    key: 'debt',
    title: 'Debt & Financing Analysis',
    systemSnippet: `You are acting as a debt and financing specialist for commercial real estate.

Focus your response on:
- Current market debt terms for this property type and location (LTV, rate, DSCR requirements)
- Agency financing eligibility (Fannie Mae, Freddie Mac, FHA) vs bridge vs CMBS
- Construction/bridge loan structure if value-add or development scenario
- Refinancing timeline and rate risk under current interest rate environment
- Preferred equity and mezzanine debt options if senior leverage falls short
- Key lender underwriting criteria for this asset class

Base your analysis on the deal's financial parameters (purchase price, NOI, cap rate) from context.`,
    outputGuidance:
      'Provide a financing recommendation: optimal debt structure, estimated terms, lender category, ' +
      'and refinancing considerations. Quantify DSCR and LTV under proposed structure.',
  },

  news: {
    key: 'news',
    title: 'Market News & Sentiment',
    systemSnippet: `You are acting as a market news and sentiment analyst for commercial real estate.

Focus your response on:
- Recent headlines affecting this property type or submarket
- Major employer announcements (expansions, relocations, layoffs) in the MSA
- Regulatory changes (zoning reform, rent control, tax policy) in the jurisdiction
- Capital markets sentiment (transaction volume, bid-ask spread trends)
- Infrastructure investments or economic development catalysts
- Any distress signals (rising defaults, special servicing trends) in the sector

Where news data is provided in context, cite it directly. Flag when news coverage is limited.`,
    outputGuidance:
      'Summarize relevant market news in 3-5 bullet points with a brief sentiment assessment ' +
      '(bullish / neutral / bearish). Note any material near-term catalysts (positive or negative).',
  },

  strategy: {
    key: 'strategy',
    title: 'Investment Strategy',
    systemSnippet: `You are acting as an investment strategy specialist for commercial real estate.

Evaluate these strategy options against the deal's fundamentals:
- **Core/Core-Plus**: Stabilized, low-risk, income-focused (target 6-8% cash yield)
- **Value-Add**: Operational improvement, repositioning (target 15-20% IRR)
- **Opportunistic**: Major redevelopment or distressed (target 20%+ IRR)
- **Development**: Ground-up construction (target 25%+ IRR)
- **BRRRR/Refinance**: Buy, rehab, rent, refinance, repeat

For the recommended strategy, provide:
- Entry rationale and required capital improvement thesis
- Key milestones and timeline
- Exit strategy and target buyer profile
- Downside scenario and stop-loss conditions`,
    outputGuidance:
      'Recommend a primary investment strategy with supporting rationale. Include: ' +
      'target return profile, key execution risks, timeline to stabilization/exit, and alternative strategy if primary thesis fails.',
  },
};

/**
 * Optional deal context injected into fragment prompts to make them
 * more specific to the active property.
 */
export interface FragmentDealContext {
  address?: string;
  city?: string;
  stateCode?: string;
  propertyType?: string;
  marketStats?: {
    vacancyRate?: number;
    avgRent?: number;
    rentGrowthYoY?: number;
    absorptionRate?: number;
  };
}

/**
 * Get a context fragment by key. Returns null if not found.
 */
export function getContextFragment(fragmentKey: string): ContextFragment | null {
  return CONTEXT_FRAGMENTS[fragmentKey] ?? null;
}

/**
 * Build a system prompt injection string for a given fragment key.
 * Combines the fragment title + systemSnippet for insertion into the general LLM handler.
 * When dealCtx is provided, appends a concise property-specific context block so
 * the specialist grounds its analysis in the active deal's data points.
 */
export function buildFragmentPrompt(fragmentKey: string, dealCtx?: FragmentDealContext): string {
  const fragment = getContextFragment(fragmentKey);
  if (!fragment) return '';

  let prompt = `\n\n## ${fragment.title} Focus\n\n${fragment.systemSnippet}\n\n**Output guidance**: ${fragment.outputGuidance}`;

  if (dealCtx) {
    const lines: string[] = [];
    if (dealCtx.address) lines.push(`Property: ${dealCtx.address}`);
    if (dealCtx.city && dealCtx.stateCode) lines.push(`Market: ${dealCtx.city}, ${dealCtx.stateCode}`);
    else if (dealCtx.city) lines.push(`Market: ${dealCtx.city}`);
    if (dealCtx.propertyType) lines.push(`Asset type: ${dealCtx.propertyType}`);
    if (dealCtx.marketStats) {
      const s = dealCtx.marketStats;
      if (s.vacancyRate !== undefined) lines.push(`Vacancy: ${s.vacancyRate}%`);
      if (s.avgRent !== undefined) lines.push(`Avg rent: $${s.avgRent.toLocaleString()}/mo`);
      if (s.rentGrowthYoY !== undefined) lines.push(`Rent growth YoY: ${s.rentGrowthYoY}%`);
      if (s.absorptionRate !== undefined) lines.push(`Absorption: ${s.absorptionRate} units/mo`);
    }
    if (lines.length > 0) {
      prompt += `\n\n**Active deal context**:\n${lines.map(l => `- ${l}`).join('\n')}`;
    }
  }

  return prompt;
}
