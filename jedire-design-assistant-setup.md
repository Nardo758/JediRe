# Design Assistant Setup Guide

## Overview

The **Design Assistant** is an LLM-powered conversational interface that allows users to modify 3D building designs using natural language prompts instead of manual controls.

## Features

✅ **Conversational modifications:**
- "Add 2 more floors to the residential tower"
- "Increase parking by 50 spaces"
- "Make the building 20% taller"
- "Optimize for maximum units"

✅ **Smart interpretation:**
- Claude 3.5 Sonnet understands architectural context
- Respects constraints (setbacks, FAR, lot coverage)
- Explains trade-offs and impacts
- Suggests alternatives when appropriate

✅ **Safe modifications:**
- Changes require user confirmation before applying
- Shows detailed explanation of each modification
- Real-time preview in 3D viewport
- Undo/redo support

---

## Setup Instructions

### 1. Get Anthropic API Key

**Option A: Free Tier (Testing)**
1. Go to https://console.anthropic.com
2. Sign up for account
3. Navigate to **API Keys**
4. Create new key
5. Copy API key

**Option B: Paid Plan (Production)**
- **Pay-as-you-go:** $3/million input tokens, $15/million output tokens
- **Typical cost:** ~$0.01-0.03 per conversation turn

### 2. Configure Environment Variable

Add to `.env` file in `backend/` directory:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Replit Users:**
1. Open **Secrets** panel (🔒 icon in sidebar)
2. Add new secret:
   - Key: `ANTHROPIC_API_KEY`
   - Value: Your key

### 3. Verify Setup

Check API status endpoint:

```bash
curl http://localhost:3001/api/v1/design-assistant/status
```

Expected response:
```json
{
  "configured": true,
  "service": "Claude 3.5 Sonnet (Design Assistant)",
  "message": "Design assistant is ready"
}
```

---

## Usage

### From 3D Editor UI

1. **Open 3D Design Module:**
   - Navigate to deal → "3D Design" tab
   - Generate a building using templates

2. **Open Design Assistant:**
   - Click "💬 Assistant" button in toolbar
   - Chat window opens

3. **Make requests:**
   ```
   User: "Add 2 floors to the residential tower"
   Assistant: "I'll increase the residential tower from 6 to 8 floors. 
               This adds approximately 40 units while maintaining the same 
               footprint. The total building height will increase from 95ft 
               to 115ft. Apply these changes?"
   
   [✓ Apply] [Cancel]
   ```

4. **Confirm or reject:**
   - Click "✓ Apply" to update the 3D model
   - Click "Cancel" to try a different approach

### Example Prompts

**Height adjustments:**
- "Make the building 20 feet taller"
- "Add 3 more floors"
- "Reduce height to stay under 100 feet"

**Unit optimization:**
- "I need 50 more units"
- "Maximize unit count while staying under 8 floors"
- "What's the optimal floor count for 300 units?"

**Parking modifications:**
- "Add one more parking level"
- "Increase parking to 1.8 spaces per unit"
- "Switch to wrapped parking instead of podium"

**Footprint changes:**
- "Increase building footprint by 15%"
- "Make the tower footprint smaller"
- "Optimize lot coverage"

**Complex requests:**
- "Add amenity space on the ground floor"
- "Convert one residential floor to parking"
- "Optimize for maximum profitability"

---

## API Reference

### POST /api/v1/design-assistant/chat

Process a design modification request.

**Request:**
```json
{
  "userPrompt": "Add 2 more floors to the residential tower",
  "currentDesign": {
    "buildingSections": [
      {
        "id": "residential-tower",
        "name": "Residential Tower",
        "geometry": {
          "footprint": { "points": [...] },
          "height": 60,
          "floors": 6
        },
        "position": { "x": 0, "y": 40, "z": 0 }
      }
    ],
    "parcelBoundary": {
      "area": 4.5,
      "areaSF": 196020
    },
    "metrics": {
      "unitCount": 300,
      "totalSF": 255000,
      "parkingSpaces": 450,
      "height": { "feet": 95, "stories": 8 }
    }
  },
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "modifications": [
    {
      "action": "update_section",
      "sectionId": "residential-tower",
      "changes": {
        "geometry": {
          "height": 80,
          "floors": 8
        }
      },
      "explanation": "Increased residential tower from 6 to 8 floors (+20 ft)"
    }
  ],
  "message": "I've added 2 floors to the residential tower. This increases the height from 60ft to 80ft and adds approximately 40 units.",
  "requiresConfirmation": true
}
```

**Modification Actions:**
- `update_section`: Modify existing building section
- `add_section`: Create new section
- `remove_section`: Delete section
- `regenerate`: Suggest using template generator

---

## Cost Estimates

**Anthropic Claude 3.5 Sonnet Pricing:**
- **Input:** $3 per million tokens
- **Output:** $15 per million tokens

**Per conversation turn:**
- Average: ~2,000 input tokens + 500 output tokens
- Cost: ~$0.015 per turn (1.5 cents)

**Monthly estimates:**
- 100 conversations (5 turns each): ~$7.50
- 1,000 conversations: ~$75
- 10,000 conversations: ~$750

**Tips to reduce cost:**
1. Limit conversation history (currently 5 messages)
2. Cache design state between turns (not yet implemented)
3. Use batching for bulk modifications

---

## Architecture

### Backend Service

**File:** `backend/src/services/design-assistant.service.ts`

**Key methods:**
- `processDesignRequest()` - Send prompt to Claude + parse response
- `buildSystemPrompt()` - Architectural rules and constraints
- `buildDesignContext()` - Current design state summary
- `parseAssistantResponse()` - Extract JSON modifications

**System prompt includes:**
- Architectural constraints (floor heights, parking ratios, FAR)
- Available modification actions
- Output format (JSON with modifications array)
- Instruction to explain trade-offs

### Frontend Chat Component

**File:** `frontend/src/components/design/DesignAssistantChat.tsx`

**Features:**
- Chat interface with message history
- Real-time typing indicator
- Approval flow for modifications
- Automatic application to 3D store
- Conversation context (last 5 messages)

**Integration points:**
- `useDesign3DStore` - Access/modify building sections
- `apiClient.post('/design-assistant/chat')` - Call backend
- Zustand actions: `updateSection()`, `addSection()`, `removeSection()`

---

## Advanced Features (Future)

### Prompt Caching (Reduce Cost)
Cache design context between turns:
```typescript
// First turn: full context
// Subsequent turns: only changes + cached context reference
// Saves ~70% of input tokens
```

### Multi-step Optimization
```
User: "Optimize for maximum profitability"
Assistant: "I'll analyze several configurations:
            1. 8 floors, 320 units → $42M revenue
            2. 10 floors, 400 units → $48M revenue (requires variance)
            3. 6 floors, 240 units → $38M revenue (by-right)
            Recommend option 2 if variance is feasible. Proceed?"
```

### Design Templates from Prompts
```
User: "Create a courtyard-style building with ground floor retail"
Assistant: Creates multiple sections:
           - Ground floor retail wrapper
           - 4-story residential courtyard
           - Central amenity space
```

### Image-based modifications
```
User: "Match the proportions of this building" + uploads photo
Assistant: Analyzes image → extracts height/width ratio → suggests changes
```

---

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable not set"
- Add API key to `.env` file
- Restart backend server

### "Failed to parse response"
- Claude occasionally returns non-JSON responses
- System falls back to plain text message
- Try rephrasing the prompt

### "Modifications not applying"
- Check browser console for errors
- Verify section IDs exist in current design
- Check that modifications are confirmed

### Slow responses (>10 seconds)
- Anthropic API can queue during high traffic
- Typical response time: 2-5 seconds
- Consider caching for repeat queries

---

## Files Modified

**Backend:**
- `backend/src/services/design-assistant.service.ts` - Core LLM logic
- `backend/src/api/rest/design-assistant.routes.ts` - API endpoints
- `backend/src/api/rest/index.ts` - Route registration

**Frontend:**
- `frontend/src/components/design/DesignAssistantChat.tsx` - Chat UI
- `frontend/src/components/design/Building3DEditor.tsx` - Integration

**Dependencies:**
- `@anthropic-ai/sdk` - Already installed (used by other services)

---

## Next Steps

1. **Test with real designs:**
   - Generate 300-unit building
   - Open design assistant
   - Try various modification prompts

2. **Extend capabilities:**
   - Add financial impact estimates
   - Connect to zoning constraints
   - Suggest code-compliant alternatives

3. **Optimize performance:**
   - Implement prompt caching
   - Reduce conversation context size
   - Add response streaming

4. **User experience:**
   - Add example prompts in chat
   - Show modification preview before applying
   - Multi-turn workflows (compare alternatives)

---

**Questions? Check:**
- Anthropic Docs: https://docs.anthropic.com
- Frontend component: `frontend/src/components/design/DesignAssistantChat.tsx`
- Backend service: `backend/src/services/design-assistant.service.ts`
