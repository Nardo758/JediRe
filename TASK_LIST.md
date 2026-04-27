# JediRe Task List

## 🚨 Critical Path: Deal Capsule E2E

The pipeline works when triggered by a **real signed-in user** (UUID passes credit checks). Bot-driven pipelines need orchestrator routing.

### Phase 1: Verify Pipeline Works (Real User) ✅
- [x] Fix creditService UUID crash (`reserveCredits`)
- [x] Find bug: non-UUID `rockeman-bot` userId crashes `user_credit_balances` query
- [x] Swap CashFlow agent from Claude (MeteringAdapter) → DeepSeek (DeepSeekMeteringAdapter)
- [x] **Trigger analysis/trigger on 464 Bishop as signed-in user** — all 4 agents green end-to-end
- [x] Revert `isUuid` credit bypass — bot must route through orchestrator, not bypass billing

### Phase 2: Fix Bot-Driven Pipelines ❌
- [ ] Route bot triggers through orchestrator event dispatcher (not direct `runtime.run()`)
- [ ] Authenticate bot as a real user UUID (or orchestrator handles identity)
- [ ] Remove the debug `setImmediate` pipeline from `inline-deals.routes.ts`
- [ ] Move pipeline logic to `agent-orchestrator.ts`

### Phase 2.5: Verify Agent Output Lands in Capsule ✏️
- [x] OM extraction ✅
- [x] T12 + Rent Roll extracted ✅
- [x] Market Rent Schedule loaded ✅
- [x] **Research agent** — produces market context + comps ✅
- [x] **Supply agent** — supply pipeline analysis ✅
- [x] **CashFlow agent** — pro forma with evidence ✅ (post-processor aggregates from DB)
- [x] **Commentary agent** — narrative summary ✅ (v5 autonomous fetch_data_matrix)
- [ ] Pro forma fields written to deal_underwriting_snapshots and visible in capsule
- [ ] Agent-run results visible in Deal Capsule UI
- [ ] Knowledge Graph seeded with agent findings
- [ ] 

### Phase 2.6: Production Trigger Endpoint
- [x] POST /deals/:dealId/analysis/trigger improved with pipeline tracking + per-agent error isolation
- [x] GET /deals/:dealId/analysis/status endpoint for polling
- [ ] Test trigger endpoint end-to-end via signed-in user
- [ ] Remove debug `setImmediate` from `inline-deals.routes.ts`
- [ ] Move pipeline logic to `agent-orchestrator.ts` event dispatch
- [ ] Add `analysis_requested` to TriggerEvent type
- [ ] Wire eventDispatcher.emit('analysis_requested')

### Phase 4: Agent → Orchestrator Integration 🔄
- [ ] Wire event dispatcher to DeepSeek AgentRuntime agents
- [ ] Add `requestAnalysis` event type
- [ ] Orchestrator routes bot triggers as authenticated user
- [ ] Agents get full KG context (Data Matrix already loaded)
- [ ] Notification system for agent completion

## 🔮 Future

- [ ] Knowledge Graph data quality dashboard
- [ ] 3D Studio integration (Phase 1)
- [ ] Multi-channel notifier (ClawdBot)
- [ ] User-facing agent model selection UI

## 🧠 Data Intelligence (Cosmos-Inspired)

### Pattern 1: Property Embedding + Dedup
- [ ] Add pgvector extension to DB
- [ ] Create `property_embeddings` table
- [ ] Generate embeddings for all property records (address + name columns)
- [ ] Similarity index to catch cross-source duplicates

### Pattern 2: Agent Accuracy Scoring
- [ ] Create `agent_accuracy_scores` table
- [ ] Compare agent proforma vs actual archive budgets
- [ ] Track bias per line item (insurance, taxes, payroll, etc.)
- [ ] Auto-adjust prompts or apply bias corrections

### Pattern 3: Deal Trajectory Clustering
- [ ] Define deal lifecycle snapshots (underwriting → ops → reforecast → disposition)
- [ ] Extract metric vectors per snapshot (revenue, NOI, occupancy, expense_ratio, cap_rate)
- [ ] Cluster archive deals by trajectory to identify success/fail patterns
- [ ] Predict outcome trajectory for new underwriting

### Pattern 4: Data Quality Pipeline
- [ ] Formalize staging layer (raw → staging → curated → data_library)
- [ ] Schema validation on import
- [ ] Anomaly detection (outlier flagging on per-unit costs)
- [ ] Versioned imports with rollback
