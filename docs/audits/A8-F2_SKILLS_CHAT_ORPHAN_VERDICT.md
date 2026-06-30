# A8-F2 Skills Chat Orphan — Verdict

**Audit date:** 2026-06-30  
**Mode:** READ-ONLY (verdict) → FIX (execution)  
**SHA:** `0fc730536` (master)

---

## VERDICT: ORPHAN — Both frontend component and backend routes are fully implemented but unwired.

### Frontend Finding

| Item | Evidence |
|------|----------|
| Component exists | `frontend/src/components/deal/sections/SkillsChatSection.tsx` — 744 lines |
| Exported | `export function SkillsChatSection` (line 160) + `export default` (line 744) |
| Imported anywhere? | **NO** — grep across `frontend/src` finds zero `import` or `<SkillsChatSection` references |
| Rendered in any route? | **NO** — not in `App.tsx`, `DealDetailPage.tsx`, `BottomPanel.tsx`, or any other page |
| Called by `SkillsBar`? | **NO** — `SkillsBar` (rendered in `DealDetailPage.tsx:1534`) only shows `SkillInfoPanel` on click; no chat |

**`SkillsChatSection` is a fully-implemented deal-scoped chat interface with:**
- Message history display (user/assistant roles, timestamps)
- Input textarea with "Ask about this deal..." placeholder
- Advisor mentions (`@` to consult CFO, CPA, Legal, etc.)
- Skill execution visualization (skill calls, parameters, results)
- Loading states, error handling, credit-exhausted gating
- API calls to `GET /deals/${dealId}/skills/list` and `POST /deals/${dealId}/skills/chat`

### Backend Finding

| Item | Evidence |
|------|----------|
| Route file exists | `backend/src/api/rest/skill-chat.routes.ts` — 186 lines, 4 endpoints |
| Router exported | `const router = Router();` with 4 routes |
| Mounted in `routes/index.ts`? | **NO** — not in `mountDealRoutes`, `mountMiscRoutes`, or any other mount function |
| Mounted in `index.replit.ts`? | **NO** — grep finds zero `skill-chat` references |
| Service exists? | **YES** — `backend/src/services/skills/skill-chat.service.ts` (267 lines) |

**`skill-chat.routes.ts` endpoints:**
- `POST /:dealId/skills/chat` — send message, get AI response
- `GET /:dealId/skills/list` — list available skills
- `GET /:dealId/skills/conversations` — list conversation history
- `GET /:dealId/skills/conversations/:conversationId` — get specific conversation

### Intent Evidence

`BottomPanel.tsx` comment (line 5–6):
> "The legacy 'Agents' tab and chat drawer were removed in Task #321 — skill chat now lives in SkillsBar / SkillsChatSection."

This confirms the **intent** was to migrate skill chat from BottomPanel to SkillsBar/SkillsChatSection, but the migration was **never completed**. `SkillsBar` renders skill chips; `SkillsChatSection` exists but is not wired.

### Impact

- **User-facing:** No deal-scoped AI chat interface is available in the web UI
- **API:** 4 endpoints return 404 because router is not mounted
- **Code rot risk:** 744 + 186 = 930 lines of dead code; dependencies may drift

### Recommended Fix

1. **Backend:** Mount `skill-chat.routes.ts` in `routes/index.ts` under `mountDealRoutes` at `/api/v1/deals`
2. **Frontend:** Add a "Skills" tab to `DealDetailPage` that renders `SkillsChatSection`

Both changes are low-risk; the component and routes are already complete and tested in isolation.

---

*END OF VERDICT — FIX EXECUTION FOLLOWS*
