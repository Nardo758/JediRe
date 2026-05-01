# -*- coding: utf-8 -*-
"""Append wiring update to memory file"""
with open('memory/2026-05-01.md', 'a', encoding='utf-8') as f:
    f.write("""
### Full Proforma Wiring \u2014 Complete

#### DeepSeek Model Switch
- financial-model-engine.service.ts: replaced Anthropic SDK with OpenAI-compatible (deepseek-chat, api.deepseek.com/v1). Falls back to DEEPSEEK_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.
- Method renamed callClaudeForModel -> callLLMForModel. DEEPSEEK_MODEL env var supported.

#### Anchor Interceptor Fix
- normalizeExpensesForInterceptor(): maps frontend display-name expense keys ('Repairs & Maintenance') to snake_case ('repairs_maintenance') before interceptor applies macro-anchored rates. Multiple lines mapping to same anchor (Water/Sewer + Electric -> utilities) are merged by amount.

#### Goal-Seeking UI
- GoalSeekWidget.tsx: collapsible 'Solve for IRR' control with target input, bundle selector, solving spinner, reachability feedback.
- GoalSeekRoadmap.tsx: step-by-step roadmap with per-variable IRR lift, d cost, feasibility badge, progress bars, and 'Apply to Proforma' button.
- assumptionBridge.ts: flattenAssumptionsForSolver() converts nested state to flat solver format; applySolverToAssumptions() reverse-maps output back.

#### Route Mounting
- sigma-full.routes.ts mounted at /api/v2/sigma in index.replit.ts (goal-seek, plausibility, bundles, factors).

#### Sensitivity Overrides Wired
- buildAssumptionsPayload() now embeds sensitivityOverrides into expense payload.

### Current Status: M36-C Complete, Full Proforma Loop Wired
34/34 sigma tests passing. Both frontend and backend compile clean.
""")
print("Appended")
