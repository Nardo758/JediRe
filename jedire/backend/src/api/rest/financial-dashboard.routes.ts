import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { financialModelEngine } from '../../services/financial-model-engine.service';
import axios from 'axios';

const router = Router();

const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

interface ModuleStatus {
  id: string;
  name: string;
  status: 'live' | 'mock' | 'none';
  lastUpdated: string | null;
}

router.get('/:dealId/summary', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const dealResult = await pool.query(
      `SELECT id, name, address, state, project_type, budget, target_units,
              status, deal_data, created_at, updated_at
       FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const dealRow = dealResult.rows[0];
    const dealData = typeof dealRow.deal_data === 'string' ? JSON.parse(dealRow.deal_data) : (dealRow.deal_data || {});
    const deal = {
      ...dealRow,
      city: dealData.city || '',
      property_type: dealRow.project_type || dealData.property_type || '',
      target_irr: dealData.target_irr || null,
      target_equity_multiple: dealData.target_equity_multiple || null,
    };

    const [strategyResult, modelResult, marketResult, trafficResult] = await Promise.all([
      pool.query(
        `SELECT id, strategy_slug, assumptions, roi_metrics, risk_score, recommended,
                created_at, updated_at
         FROM strategy_analyses WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      ).catch(() => ({ rows: [] })),

      pool.query(
        `SELECT id, model_type, assumptions, results, status, created_at, updated_at
         FROM deal_financial_models WHERE deal_id = $1 AND status = 'complete'
         ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      ).catch(() => ({ rows: [] })),

      pool.query(
        `SELECT id, city, state, avg_occupancy, avg_rent_1br, avg_rent_2br,
                rent_growth_90d, concession_rate, snapshot_date
         FROM apartment_market_snapshots ORDER BY snapshot_date DESC LIMIT 1`
      ).catch(() => ({ rows: [] })),

      pool.query(
        `SELECT id, deal_id, total_units, year1_summary, occupancy_trajectory,
                effective_rent_trajectory, projection_date
         FROM traffic_projections WHERE deal_id = $1
         ORDER BY projection_date DESC LIMIT 1`,
        [dealId]
      ).catch(() => ({ rows: [] })),
    ]);

    const strategyRow = strategyResult.rows[0] || null;
    const strategyAssumptions = strategyRow ? (typeof strategyRow.assumptions === 'string' ? JSON.parse(strategyRow.assumptions) : strategyRow.assumptions) : {};
    const strategy = strategyRow ? {
      ...strategyRow,
      strategy_type: strategyRow.strategy_slug,
      hold_period: strategyAssumptions.hold_period || strategyAssumptions.holdPeriod || null,
      capex_budget: strategyAssumptions.capex_budget || strategyAssumptions.capexBudget || null,
      exit_cap_rate: strategyAssumptions.exit_cap_rate || strategyAssumptions.exitCapRate || null,
      target_irr: strategyAssumptions.target_irr || strategyAssumptions.targetIrr || null,
      confidence_score: strategyRow.risk_score || null,
    } : null;

    const latestModel = modelResult.rows[0] || null;
    const marketRow = marketResult.rows[0] || null;
    const marketSnapshot = marketRow ? {
      ...marketRow,
      avg_rent: marketRow.avg_rent_2br ? parseFloat(marketRow.avg_rent_2br) : (marketRow.avg_rent_1br ? parseFloat(marketRow.avg_rent_1br) * 1.15 : null),
      occupancy_rate: marketRow.avg_occupancy ? parseFloat(marketRow.avg_occupancy) : null,
      rent_growth: marketRow.rent_growth_90d ? parseFloat(marketRow.rent_growth_90d) : null,
      vacancy_rate: marketRow.avg_occupancy ? (1 - parseFloat(marketRow.avg_occupancy)) : null,
    } : null;
    const trafficData = trafficResult.rows[0] || null;

    const capitalOptions: any[] = [];
    if (latestModel) {
      const modelResults = typeof latestModel.results === 'string' ? JSON.parse(latestModel.results) : (latestModel.results || {});
      const modelAssumptions = typeof latestModel.assumptions === 'string' ? JSON.parse(latestModel.assumptions) : (latestModel.assumptions || {});
      const financing = modelAssumptions.financing || {};
      if (financing.loanAmount || financing.loan_amount) {
        capitalOptions.push({
          id: 'primary',
          loan_type: financing.loanType || financing.loan_type || 'Agency',
          loan_amount: financing.loanAmount || financing.loan_amount || 0,
          interest_rate: financing.interestRate || financing.interest_rate || 0.055,
          term_years: financing.term || financing.term_years || 7,
          amortization_years: financing.amortization || financing.amortization_years || 30,
          io_period_months: financing.ioPeriod || financing.io_period_months || 24,
          ltv: financing.ltv || 0.65,
          created_at: latestModel.created_at,
        });
      }
    }

    const modules: ModuleStatus[] = [
      {
        id: 'M08',
        name: 'Strategy',
        status: strategy ? 'live' : 'none',
        lastUpdated: strategy?.updated_at || strategy?.created_at || null,
      },
      {
        id: 'M07',
        name: 'Traffic',
        status: trafficData ? 'live' : 'none',
        lastUpdated: trafficData?.created_at || null,
      },
      {
        id: 'M09',
        name: 'Pro Forma',
        status: latestModel ? 'live' : 'none',
        lastUpdated: latestModel?.updated_at || latestModel?.created_at || null,
      },
      {
        id: 'M10',
        name: 'Debt',
        status: capitalOptions.length > 0 ? 'live' : 'none',
        lastUpdated: capitalOptions[0]?.created_at || null,
      },
    ];

    const liveCount = modules.filter(m => m.status === 'live').length;

    const model = latestModel ? {
      assumptions: typeof latestModel.assumptions === 'string'
        ? JSON.parse(latestModel.assumptions)
        : latestModel.assumptions,
      results: typeof latestModel.results === 'string'
        ? JSON.parse(latestModel.results)
        : latestModel.results,
      status: latestModel.status,
      createdAt: latestModel.created_at,
    } : null;

    return res.json({
      success: true,
      data: {
        deal,
        strategy,
        model,
        marketContext: marketSnapshot,
        trafficData,
        capitalOptions,
        modules,
        moduleSummary: {
          total: modules.length,
          live: liveCount,
          label: `${liveCount}/${modules.length} modules feeding the model`,
        },
      },
    });
  } catch (error: any) {
    console.error('Financial dashboard summary error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to load financial dashboard summary' });
  }
});

router.post('/:dealId/auto-assumptions', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const dealResult = await pool.query(
      `SELECT id, name, address, state, project_type, budget, target_units, deal_data
       FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const dealRow = dealResult.rows[0];
    const dealData = typeof dealRow.deal_data === 'string' ? JSON.parse(dealRow.deal_data) : (dealRow.deal_data || {});
    const deal = {
      ...dealRow,
      city: dealData.city || '',
      state: dealRow.state || dealData.state || '',
    };

    const [strategyResult, marketResult, modelResult] = await Promise.all([
      pool.query(
        `SELECT strategy_slug, assumptions, roi_metrics
         FROM strategy_analyses WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      ).catch(() => ({ rows: [] })),

      pool.query(
        `SELECT avg_occupancy, avg_rent_1br, avg_rent_2br, rent_growth_90d
         FROM apartment_market_snapshots ORDER BY snapshot_date DESC LIMIT 1`
      ).catch(() => ({ rows: [] })),

      pool.query(
        `SELECT assumptions FROM deal_financial_models WHERE deal_id = $1 AND status = 'complete'
         ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      ).catch(() => ({ rows: [] })),
    ]);

    const strategyRow = strategyResult.rows[0] || null;
    const strategyAssumptions = strategyRow ? (typeof strategyRow.assumptions === 'string' ? JSON.parse(strategyRow.assumptions) : strategyRow.assumptions) : {};
    const strategy = strategyRow ? {
      hold_period: strategyAssumptions.hold_period || strategyAssumptions.holdPeriod || null,
      exit_cap_rate: strategyAssumptions.exit_cap_rate || strategyAssumptions.exitCapRate || null,
      capex_budget: strategyAssumptions.capex_budget || strategyAssumptions.capexBudget || null,
      target_irr: strategyAssumptions.target_irr || strategyAssumptions.targetIrr || null,
    } : null;

    const market = marketResult.rows[0] || null;
    const existingModel = modelResult.rows[0] || null;
    const existingFinancing = existingModel ? (typeof existingModel.assumptions === 'string' ? JSON.parse(existingModel.assumptions) : existingModel.assumptions)?.financing || {} : {};

    const totalUnits = deal.target_units || 200;
    const purchasePrice = deal.budget || 25000000;
    const avgRent = market?.avg_rent_2br ? parseFloat(market.avg_rent_2br) : (market?.avg_rent_1br ? parseFloat(market.avg_rent_1br) * 1.15 : 1500);
    const vacancyRate = market?.avg_occupancy ? 1 - parseFloat(market.avg_occupancy) : 0.06;
    const rentGrowthRate = market?.rent_growth_90d ? parseFloat(market.rent_growth_90d) : 0.03;
    const holdPeriod = strategy?.hold_period || 5;
    const exitCapRate = strategy?.exit_cap_rate ? parseFloat(strategy.exit_cap_rate) : 0.055;
    const loanAmount = existingFinancing.loanAmount || existingFinancing.loan_amount || Math.round(purchasePrice * 0.65);
    const interestRate = existingFinancing.interestRate || existingFinancing.interest_rate || 0.055;
    const termYears = existingFinancing.term || existingFinancing.term_years || 7;
    const amortYears = existingFinancing.amortization || existingFinancing.amortization_years || 30;
    const ioPeriod = existingFinancing.ioPeriod || existingFinancing.io_period_months || 24;

    const rentGrowth = Array.from({ length: holdPeriod }, () => rentGrowthRate);

    const assumptions = {
      dealInfo: {
        dealName: deal.name || 'Untitled Deal',
        totalUnits,
        netRentableSF: totalUnits * 900,
        vintage: 2000,
        address: deal.address || '',
        city: deal.city || '',
        state: deal.state || '',
      },
      modelType: (deal.project_type === 'development' ? 'development' : 'existing') as 'development' | 'existing',
      holdPeriod,
      unitMix: [
        {
          floorPlan: '1BR/1BA',
          unitSize: 750,
          beds: 1,
          units: Math.round(totalUnits * 0.4),
          occupied: Math.round(totalUnits * 0.4 * (1 - vacancyRate)),
          vacant: Math.round(totalUnits * 0.4 * vacancyRate),
          marketRent: Math.round(avgRent * 0.85),
          inPlaceRent: Math.round(avgRent * 0.80),
        },
        {
          floorPlan: '2BR/2BA',
          unitSize: 1050,
          beds: 2,
          units: Math.round(totalUnits * 0.45),
          occupied: Math.round(totalUnits * 0.45 * (1 - vacancyRate)),
          vacant: Math.round(totalUnits * 0.45 * vacancyRate),
          marketRent: Math.round(avgRent),
          inPlaceRent: Math.round(avgRent * 0.94),
        },
        {
          floorPlan: '3BR/2BA',
          unitSize: 1300,
          beds: 3,
          units: Math.round(totalUnits * 0.15),
          occupied: Math.round(totalUnits * 0.15 * (1 - vacancyRate)),
          vacant: Math.round(totalUnits * 0.15 * vacancyRate),
          marketRent: Math.round(avgRent * 1.25),
          inPlaceRent: Math.round(avgRent * 1.18),
        },
      ],
      acquisition: {
        purchasePrice,
        capRate: 0.05,
        closingCosts: {
          titleInsurance: Math.round(purchasePrice * 0.003),
          legalFees: 75000,
          dueDiligence: 50000,
          appraisal: 15000,
          environmentalPhaseI: 8000,
          survey: 12000,
          lenderFees: Math.round(loanAmount * 0.01),
        },
      },
      disposition: {
        exitCapRate,
        sellingCosts: 0.02,
        saleNOIMethod: 'trailing12',
      },
      revenue: {
        rentGrowth,
        lossToLease: 0.03,
        stabilizedOccupancy: 1 - vacancyRate,
        collectionLoss: 0.015,
        otherIncome: {
          parking: { perUnitMonth: 75, penetration: 0.60 },
          petRent: { perUnitMonth: 35, penetration: 0.40 },
          storageUnits: { perUnitMonth: 50, penetration: 0.15 },
          laundry: { perUnitMonth: 20, penetration: 1.0 },
          lateFees: { perUnitMonth: 10, penetration: 0.08 },
        },
      },
      expenses: {
        propertyTax: { amount: Math.round(purchasePrice * 0.012), type: 'fixed', growthRate: 0.025 },
        insurance: { amount: totalUnits * 650, type: 'perUnit', growthRate: 0.04 },
        utilities: { amount: totalUnits * 1200, type: 'perUnit', growthRate: 0.03 },
        repairsAndMaintenance: { amount: totalUnits * 800, type: 'perUnit', growthRate: 0.03 },
        managementFee: { amount: 0.04, type: 'percentEGR', growthRate: 0 },
        payroll: { amount: totalUnits * 1100, type: 'perUnit', growthRate: 0.03 },
        marketing: { amount: totalUnits * 200, type: 'perUnit', growthRate: 0.02 },
        generalAdmin: { amount: totalUnits * 350, type: 'perUnit', growthRate: 0.03 },
        contractServices: { amount: totalUnits * 400, type: 'perUnit', growthRate: 0.03 },
      },
      financing: {
        loanAmount,
        loanType: existingFinancing.loanType || existingFinancing.loan_type || 'Agency',
        interestRate,
        spread: 0.015,
        term: termYears,
        amortization: amortYears,
        ioPeriod,
        originationFee: 0.01,
        rateCapCost: 0,
        prepayPenalty: 0.01,
      },
      capex: {
        lineItems: [
          { description: 'Interior Renovations', amount: totalUnits * 8000 },
          { description: 'Common Area Improvements', amount: totalUnits * 1500 },
          { description: 'Building Exterior', amount: totalUnits * 2000 },
          { description: 'Amenity Upgrades', amount: totalUnits * 1000 },
        ],
        contingencyPct: 0.10,
        reservesPerUnit: 300,
      },
      waterfall: {
        lpShare: 0.90,
        gpShare: 0.10,
        hurdles: [
          { hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 },
          { hurdleRate: 0.12, promoteToGP: 0.30, lpSplit: 0.70 },
          { hurdleRate: 0.18, promoteToGP: 0.40, lpSplit: 0.60 },
        ],
        equityContribution: purchasePrice - loanAmount,
      },
    };

    const sources: Record<string, string> = {};
    if (strategy) sources['strategy'] = 'Strategy Analysis (M08)';
    if (market) sources['market'] = 'Market Snapshot (M05)';
    if (existingFinancing.loanAmount) sources['capital'] = 'Existing Model Financing';
    sources['deal'] = 'Deal Record';

    return res.json({
      success: true,
      data: {
        assumptions,
        sources,
      },
    });
  } catch (error: any) {
    console.error('Auto-assumptions error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to build auto-assumptions' });
  }
});

router.post('/:dealId/analyze', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { force } = req.body;
    const pool = getPool();

    const modelResult = await pool.query(
      `SELECT id, assumptions, results, created_at, updated_at
       FROM deal_financial_models WHERE deal_id = $1 AND status = 'complete'
       ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );

    if (modelResult.rows.length === 0) {
      return res.status(404).json({ error: 'No completed financial model found. Build a model first.' });
    }

    const row = modelResult.rows[0];
    const modelId = row.id;
    const assumptions = typeof row.assumptions === 'string' ? JSON.parse(row.assumptions) : row.assumptions;
    const results = typeof row.results === 'string' ? JSON.parse(row.results) : row.results;

    if (!force) {
      const cachedResult = await pool.query(
        `SELECT analysis_result, analyzed_at FROM deal_financial_model_analyses
         WHERE model_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
        [modelId]
      ).catch(() => ({ rows: [] }));

      if (cachedResult.rows.length > 0) {
        const cached = cachedResult.rows[0];
        const analysisAge = Date.now() - new Date(cached.analyzed_at).getTime();
        const ONE_HOUR = 60 * 60 * 1000;

        if (analysisAge < ONE_HOUR) {
          const cachedAnalysis = typeof cached.analysis_result === 'string'
            ? JSON.parse(cached.analysis_result)
            : cached.analysis_result;
          return res.json({
            success: true,
            data: cachedAnalysis,
            cached: true,
          });
        }
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'AI analysis unavailable — API key not configured' });
    }

    const systemPrompt = `You are an expert real estate investment analyst at an institutional PE firm. You analyze financial models and provide investment recommendations.

Return ONLY valid JSON with this exact structure:
{
  "recommendation": "Proceed" | "Proceed with Caution" | "Needs Review" | "Pass",
  "conviction": "High" | "Medium" | "Low",
  "rationale": ["string array of 4-6 bullet points explaining the recommendation, referencing specific metrics"],
  "riskFlags": ["string array of 3-5 risk factors with severity and detail"],
  "actionItems": ["string array of 4-6 specific next steps with timelines"]
}

Reference actual numbers from the model. Be specific and actionable.`;

    const summary = results.summary || {};
    const userPrompt = `Analyze this multifamily investment model and provide an investment recommendation:

DEAL: ${assumptions.dealInfo?.dealName || 'Unknown'} — ${assumptions.dealInfo?.city || ''}, ${assumptions.dealInfo?.state || ''}
Units: ${assumptions.dealInfo?.totalUnits || 'N/A'} | Hold: ${assumptions.holdPeriod || 'N/A'} years

KEY METRICS:
- IRR: ${((summary.irr || 0) * 100).toFixed(2)}%
- Equity Multiple: ${(summary.equityMultiple || 0).toFixed(2)}x
- Cash-on-Cash Year 1: ${((summary.cashOnCash?.[0] || 0) * 100).toFixed(2)}%
- NOI Year 1: $${(summary.noiYear1 || 0).toLocaleString()}
- Stabilized NOI: $${(summary.noiStabilized || 0).toLocaleString()}
- Going-In Cap Rate: ${((summary.purchaseCapRate || 0) * 100).toFixed(2)}%
- Yield on Cost: ${((summary.yieldOnCost || 0) * 100).toFixed(2)}%
- Exit Value: $${(summary.exitValue || 0).toLocaleString()}
- DSCR Range: ${(summary.dscr || []).map((d: number) => d.toFixed(2)).join(', ') || 'N/A'}
- Debt Yield: ${(summary.debtYield || []).map((d: number) => ((d || 0) * 100).toFixed(2) + '%').join(', ') || 'N/A'}

ACQUISITION:
- Purchase Price: $${(assumptions.acquisition?.purchasePrice || 0).toLocaleString()}
- Total Equity: $${(assumptions.waterfall?.equityContribution || 0).toLocaleString()}
- Loan Amount: $${(assumptions.financing?.loanAmount || 0).toLocaleString()}

FINANCING:
- Rate: ${((assumptions.financing?.interestRate || 0) * 100).toFixed(2)}%
- Term: ${assumptions.financing?.term || 'N/A'} years
- IO Period: ${assumptions.financing?.ioPeriod || 0} months
- Amortization: ${assumptions.financing?.amortization || 'N/A'} years

EXIT:
- Exit Cap Rate: ${((assumptions.disposition?.exitCapRate || 0) * 100).toFixed(2)}%
- Net Proceeds: $${(summary.netProceeds || 0).toLocaleString()}

Return ONLY valid JSON. No markdown, no explanation.`;

    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      {
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const text = response.data.content?.[0]?.text || '';
    let analysis: any;

    try {
      analysis = JSON.parse(text);
    } catch {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const rawJson = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
      let depth = 0, start = -1, end = -1;
      for (let i = 0; i < rawJson.length; i++) {
        if (rawJson[i] === '{') { if (depth === 0) start = i; depth++; }
        else if (rawJson[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      if (start === -1 || end === -1) {
        throw new Error('Claude did not return valid JSON for analysis');
      }
      analysis = JSON.parse(rawJson.substring(start, end));
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS deal_financial_model_analyses (
        id SERIAL PRIMARY KEY,
        model_id INTEGER NOT NULL,
        analysis_result JSONB NOT NULL,
        analyzed_at TIMESTAMP DEFAULT NOW()
      )`
    ).catch(() => {});

    await pool.query(
      `INSERT INTO deal_financial_model_analyses (model_id, analysis_result, analyzed_at)
       VALUES ($1, $2, NOW())`,
      [modelId, JSON.stringify(analysis)]
    ).catch((err: any) => {
      console.error('Failed to cache analysis result:', err.message);
    });

    return res.json({
      success: true,
      data: analysis,
      cached: false,
    });
  } catch (error: any) {
    console.error('Financial analysis error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to generate investment analysis' });
  }
});

router.post('/:dealId/chat', async (req: Request, res: Response) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      {
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: systemPrompt || 'You are a real estate financial analyst.',
        messages: messages.slice(-20),
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const text = response.data.content?.map((c: any) => c.text || '').join('') || '';
    return res.json({ success: true, data: { content: text } });
  } catch (error: any) {
    console.error('Financial chat error:', error.message);
    return res.status(500).json({ error: error.message || 'Chat failed' });
  }
});

export default router;
