# JediRe AI Model Selection Patches

These patches add user-configurable AI model preferences to JediRe.

## Features Added
- **User AI Preferences Table** — Store per-user model preferences
- **AI Models Reference Table** — Available models with pricing info
- **Settings UI** — Bloomberg-styled settings page for model selection
- **API Endpoints** — CRUD operations for preferences
- **Dynamic Model Selection** — Risk analysis uses user's preferred model

## Files in This Folder

| File | Purpose | Destination |
|------|---------|-------------|
| `100_ai_preferences.sql` | Database migration | Run in PostgreSQL |
| `ai-model.utils.ts` | Model lookup utilities | `backend/src/utils/` |
| `ai-preferences.routes.ts` | API endpoints | `backend/src/api/rest/` |
| `AIModelSettings.tsx` | Settings UI component | `frontend/src/pages/settings/` |
| `risk.routes.patch.ts` | Instructions to patch risk routes | Apply to existing file |

---

## Step-by-Step Application

### 1. Run Database Migration

In Replit's PostgreSQL console (or via your migration runner):

```sql
-- Copy contents of 100_ai_preferences.sql and run it
```

This creates:
- `user_ai_preferences` table
- `ai_models` reference table
- Helper function `get_user_ai_model()`

### 2. Add Backend Utility

Copy `ai-model.utils.ts` to:
```
backend/src/utils/ai-model.utils.ts
```

### 3. Add API Routes

Copy `ai-preferences.routes.ts` to:
```
backend/src/api/rest/ai-preferences.routes.ts
```

Then register the route in `backend/src/api/rest/index.ts`:

```typescript
// Add import at top
import aiPreferencesRouter from './ai-preferences.routes';

// Add route registration (with other routes)
router.use('/ai-preferences', aiPreferencesRouter);
```

### 4. Add Frontend Settings Page

Copy `AIModelSettings.tsx` to:
```
frontend/src/pages/settings/AIModelSettings.tsx
```

Add route in `frontend/src/App.tsx` (or wherever routes are defined):

```tsx
import AIModelSettings from './pages/settings/AIModelSettings';

// In routes:
<Route path="/settings/ai" element={<AIModelSettings />} />
```

### 5. Patch Risk Routes (Optional but Recommended)

To make risk narrative generation use user's preferred model:

Open `backend/src/api/rest/risk.routes.ts` and:

**Add import at top:**
```typescript
import { getUserAIModel } from '../../utils/ai-model.utils';
```

**In the `POST /narrative/:dealId` handler, add these lines after `const { dealId } = req.params;`:**
```typescript
const userId = (req as any).user?.id;
const userModel = await getUserAIModel(userId, 'risk');
```

**Then change the hardcoded model in `anthropic.messages.stream()` from:**
```typescript
model: 'claude-opus-4-20250514',
```

**To:**
```typescript
model: userModel,
```

### 6. Add Settings Link (Optional)

Add a link to AI settings in your settings menu or navigation:

```tsx
<Link to="/settings/ai">AI Model Preferences</Link>
```

---

## Available Models

After migration, these models are available:

| Model | Best For | Thinking Support |
|-------|----------|------------------|
| Claude Opus 4 | Complex analysis, nuanced reasoning | ✅ Yes |
| Claude Sonnet 4 | Balanced performance (default) | ❌ No |
| Claude 3.5 Sonnet | Fast, reliable | ❌ No |
| Claude 3.5 Haiku | Quick queries, high volume | ❌ No |

---

## API Endpoints

After applying patches:

```
GET  /api/v1/ai-preferences         — Get user's preferences
PUT  /api/v1/ai-preferences         — Update preferences
GET  /api/v1/ai-preferences/models  — List available models
POST /api/v1/ai-preferences/reset   — Reset to defaults
```

---

## Testing

1. Navigate to `/settings/ai`
2. Change the Risk Analysis Model to "Claude Opus 4"
3. Save preferences
4. Go to a deal's Risk/DD page
5. Click "Generate JEDI Assessment"
6. Verify the backend logs show the correct model being used

---

## Rollback

To remove these changes:

```sql
DROP TABLE IF EXISTS user_ai_preferences;
DROP TABLE IF EXISTS ai_models;
DROP FUNCTION IF EXISTS get_user_ai_model;
DROP FUNCTION IF EXISTS update_ai_preferences_timestamp;
```

Then remove the added files and route registrations.
