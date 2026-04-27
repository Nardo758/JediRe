# JediRe Task List

## 🚨 Critical Path: Deal Capsule E2E

The pipeline works when triggered by a **real signed-in user** (UUID passes credit checks). Bot-driven pipelines need orchestrator routing.

### Phase 1: Verify Pipeline Works (Real User) ✅
- [x] Fix creditService UUID crash (`reserveCredits`)
- [x] Find bug: non-UUID `rockeman-bot` userId crashes `user_credit_balances` query
- [x] Swap CashFlow agent from Claude (MeteringAdapter) → DeepSeek (DeepSeekMeteringAdapter)
- [ ] **Trigger analysis/trigger on 464 Bishop as signed-in user (m.dixon5030@gmail.com)** — proves Research → Supply → CashFlow → Commentary end-to-end
- [x] Revert `isUuid` credit bypass — bot must route through orchestrator, not bypass billing

### Phase 2: Fix Bot-Driven Pipelines ❌
- [ ] Route bot triggers through orchestrator event dispatcher (not direct `runtime.run()`)
- [ ] Authenticate bot as a real user UUID (or orchestrator handles identity)
- [ ] Remove the debug `setImmediate` pipeline from `inline-deals.routes.ts`
- [ ] Move pipeline logic to `agent-orchestrator.ts`

### Phase 3: Verify Agent Output ✏️
- [x] OM extraction (DeepSeek, not Claude)
- [x] T12 + Rent Roll extracted (12 rows P&L, 260 unit rows)
- [x] Market Rent Schedule loaded (.xlsx)
- [ ] **Research agent** — produces market context + comps
- [ ] **Supply agent** — supply pipeline analysis
- [ ] **CashFlow agent** — pro forma with evidence
- [ ] **Commentary agent** — narrative summary
- [ ] Pro forma written to deal capsule
- [ ] Deal capsule reflects agent output in UI
- [ ] Knowledge Graph seeded with agent findings

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
