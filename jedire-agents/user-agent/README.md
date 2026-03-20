# JediRe User Agent

AI assistant for JediRe platform users - helps with real estate deal analysis, financial modeling, and investment guidance.

## Status

🚧 **In Development** - Phase 1 (Core API)

**Completed:**
- ✅ Database schema
- ✅ API models (Pydantic)
- ✅ FastAPI application structure
- ✅ Model selection logic
- ✅ Multi-tier pricing design
- ✅ Hybrid billing architecture

**In Progress:**
- ⏳ Database layer implementation
- ⏳ AI gateway wrapper
- ⏳ Stripe integration
- ⏳ Authentication

**Pending:**
- ⏳ Stripe Token Billing waitlist approval
- ⏳ Platform widget integration
- ⏳ Telegram bot
- ⏳ WhatsApp integration

---

## Architecture

```
User → JediRe Platform → User Agent API (FastAPI)
                            ↓
                    ┌───────┴────────┐
                    │                │
            Stripe AI Gateway   PostgreSQL
                    │           (usage logs)
                    ↓
                Claude API
```

### Key Features

**Multi-Model Support**
- 3 tiers: Fast (~$0.005), Standard (~$0.05), Premium (~$0.25) per conversation
- User picks model based on cost/quality tradeoff
- Smart auto-selection based on query complexity

**Flexible Billing**
- Credit packs (prepaid)
- Subscriptions with included usage
- Pure pay-as-you-go
- Custom invoices for enterprise

**Hybrid Tracking**
- Primary: Stripe AI Gateway (auto-billing)
- Backup: Self-reported (audit trails, custom invoices)
- Internal: PostgreSQL (analytics, dashboards)

**Access Control**
- Basic plan: Fast unlimited, Standard limited
- Pro plan: All tiers, 5M tokens/month included
- Enterprise: Custom limits + SLA

---

## Project Structure

```
user-agent/
├── api/
│   ├── main.py              # FastAPI app
│   ├── models.py            # Pydantic models
│   ├── model_selector.py    # Smart model selection
│   ├── ai_gateway.py        # AI gateway wrapper (TODO)
│   ├── database.py          # Database layer (TODO)
│   └── auth.py              # Authentication (TODO)
│
├── db/
│   └── schema.sql           # PostgreSQL schema
│
├── integrations/
│   ├── telegram.py          # Telegram bot (TODO)
│   ├── whatsapp.py          # WhatsApp handler (TODO)
│   └── platform.py          # JediRe API client (TODO)
│
├── prompts/
│   ├── system.md            # System prompt (TODO)
│   └── examples.json        # Few-shot examples (TODO)
│
├── HYBRID_BILLING_ARCHITECTURE.md   # Billing design doc
├── MODEL_SELECTION_DESIGN.md        # Model selection design doc
└── README.md                         # This file
```

---

## Database

### Setup

```bash
# Create database
createdb jedire_agent

# Run schema
psql jedire_agent < db/schema.sql
```

### Tables

**Core:**
- `ai_models` - Model catalog with pricing
- `users` - User accounts
- `user_ai_preferences` - Model preferences, cost controls
- `usage_logs` - Every AI request with tokens + costs
- `conversations` - Chat sessions
- `messages` - Individual messages

**Billing:**
- `credit_transactions` - Credit purchases/usage
- `invoices` - Custom invoices
- `invoice_line_items` - Invoice details

### Views

- `daily_usage_summary` - Aggregated daily stats
- `monthly_usage_by_tier` - Usage broken down by tier

---

## API Endpoints

### Health & Status

```
GET  /health          Health check
GET  /stats           System statistics
```

### Models

```
GET  /v1/models                   List available models
GET  /v1/models/{model_id}        Get model details
```

### Chat

```
POST /v1/chat                     Send message, get response
POST /v1/estimate-cost            Estimate cost before sending
```

### Conversations

```
GET    /v1/conversations          List conversations
GET    /v1/conversations/{id}     Get conversation with messages
DELETE /v1/conversations/{id}     Delete conversation
```

### Preferences

```
GET   /v1/preferences             Get user preferences
PATCH /v1/preferences             Update preferences
```

### Usage & Analytics

```
GET /v1/usage/summary             Usage summary (current month, etc.)
GET /v1/usage/budget              Budget status
GET /v1/usage/logs                Detailed usage logs
```

### Credits

```
POST /v1/credits/purchase         Purchase credits
GET  /v1/credits/balance          Get balance + recent transactions
```

### Invoices

```
POST /v1/invoices/generate        Generate custom invoice
GET  /v1/invoices                 List invoices
```

---

## Usage Examples

### Send a chat message

```python
import requests

response = requests.post(
    "http://localhost:8000/v1/chat",
    headers={"Authorization": "Bearer <token>"},
    json={
        "message": "Analyze this Atlanta multifamily deal: 300 units, $45M purchase price...",
        "tier": "standard",  # or specify exact model: "model": "claude-sonnet-4-5"
        "source": "platform"
    }
)

print(response.json())
# {
#   "response": "Based on the information provided...",
#   "conversation_id": "...",
#   "model_used": "claude-sonnet-4-5",
#   "model_tier": "standard",
#   "tokens_used": 3542,
#   "cost_usd": 0.0531
# }
```

### Estimate cost first

```python
estimate = requests.post(
    "http://localhost:8000/v1/estimate-cost",
    headers={"Authorization": "Bearer <token>"},
    json={
        "message": "Long detailed query...",
        "model": "claude-opus-4"
    }
).json()

print(f"Estimated cost: ${estimate['estimated_cost_usd']}")
# Estimated cost: $0.25

# User confirms, then send actual request
```

### Smart model selection

```python
# Simple query → auto-uses cheap model
response = requests.post(
    "http://localhost:8000/v1/chat",
    headers={"Authorization": "Bearer <token>"},
    json={"message": "What is cap rate?"}
).json()

print(f"Model used: {response['model_used']}")  # → gpt-4o-mini (Fast tier)
print(f"Cost: ${response['cost_usd']}")  # → $0.003

# Complex analysis → auto-uses better model
response = requests.post(
    "http://localhost:8000/v1/chat",
    headers={"Authorization": "Bearer <token>"},
    json={"message": "Analyze this deal and compare to 5 similar properties, calculate IRR considering..."}
).json()

print(f"Model used: {response['model_used']}")  # → claude-sonnet-4-5 (Standard tier)
print(f"Cost: ${response['cost_usd']}")  # → $0.08
```

### Set preferences

```python
requests.patch(
    "http://localhost:8000/v1/preferences",
    headers={"Authorization": "Bearer <token>"},
    json={
        "default_model": "claude-sonnet-4-5",
        "cost_warning_threshold": 0.10,  # Warn if request > $0.10
        "monthly_budget_usd": 50.00,
        "auto_downgrade_on_low_credits": true
    }
)
```

---

## Model Selection Logic

The `ModelSelector` automatically picks the best model based on:

### Query Analysis

**Simple queries** → Fast tier (cheap)
- "What is X?"
- "How much is Y?"
- "List all deals in Z"
- Short questions

**Complex reasoning** → Standard/Premium tier
- "Analyze this deal..."
- "Compare these properties..."
- "Calculate ROI considering..."
- Long, detailed queries

### Priority Order

1. **User's explicit choice** (if allowed by plan)
2. **Tier selection** (fast/standard/premium)
3. **User's default preference**
4. **Smart auto-select** (based on query)
5. **Plan default**

### Access Control

**Basic Plan:**
- ✅ Fast tier: Unlimited
- ✅ Standard tier: Limited usage
- ❌ Premium tier: Blocked

**Pro Plan:**
- ✅ All tiers
- 5M tokens/month included

**Enterprise:**
- ✅ All tiers
- Custom limits

---

## Cost Controls

### Per-Request Warning

```json
{
  "cost_warning_threshold": 0.10
}
```

If a request would cost > threshold, API returns 402 with warning before processing.

### Monthly Budget

```json
{
  "monthly_budget_usd": 50.00
}
```

API tracks spending vs budget, provides warnings:
- 50% used in first 10 days
- 90% used
- Projected to exceed budget

### Auto-Downgrade

```json
{
  "auto_downgrade_on_low_credits": true
}
```

If credit balance too low, automatically use cheaper model instead of failing.

---

## Integration Points

### JediRe Platform (Web)

Embed chat widget:

```html
<iframe 
  src="https://agent.jedire.com/widget?token=<jwt>"
  width="400"
  height="600"
></iframe>
```

Or React component:

```jsx
import { JediReChat } from '@jedire/agent-widget';

<JediReChat 
  apiKey={process.env.JEDIRE_AGENT_API_KEY}
  userId={currentUser.id}
  onNewMessage={(msg) => console.log(msg)}
/>
```

### Telegram

User links their account:

1. User DMs `@JediReBot`
2. Bot responds with link: `Link your account: https://jedire.com/link-telegram?code=ABC123`
3. User clicks, authorizes
4. Now can chat via Telegram, billed to their JediRe account

### WhatsApp

Similar flow via WhatsApp Business API.

### API

Direct programmatic access:

```python
from jedire_agent import AgentClient

client = AgentClient(api_key="...")

response = client.chat(
    message="Find me multifamily deals in Atlanta under $50M",
    model="claude-sonnet-4-5"
)
```

---

## Next Steps

### Phase 1: Core API (This Week)

- [x] Database schema
- [x] API models
- [x] FastAPI app
- [x] Model selector
- [ ] Database layer implementation
- [ ] AI gateway wrapper (Stripe or direct)
- [ ] Authentication (JWT)
- [ ] Basic testing

### Phase 2: Stripe Integration (Next Week)

- [ ] Wait for Token Billing preview access
- [ ] Integrate Stripe AI Gateway
- [ ] Or implement self-reporting fallback
- [ ] Credit purchase flow
- [ ] Webhook handlers

### Phase 3: Platform Integration (Week 3)

- [ ] Chat widget (React component)
- [ ] WebSocket for real-time
- [ ] User dashboard (usage, costs, settings)
- [ ] JediRe API integration (deals, properties)

### Phase 4: External Channels (Week 4)

- [ ] Telegram bot
- [ ] WhatsApp integration
- [ ] Account linking flow
- [ ] Cross-platform message routing

### Phase 5: Advanced Features (Week 5+)

- [ ] Conversation memory & context
- [ ] Proactive suggestions
- [ ] Custom invoice generation
- [ ] Analytics dashboard
- [ ] Multi-agent coordination with DevOps agent

---

## Development

### Requirements

```
python >= 3.11
postgresql >= 14
```

### Install

```bash
cd user-agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Run

```bash
# Development
uvicorn api.main:app --reload

# Production
gunicorn api.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Test

```bash
pytest
```

---

## Configuration

Environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/jedire_agent

# Stripe
STRIPE_API_KEY=sk_test_...
STRIPE_AI_GATEWAY_URL=https://api.stripe.com/v1/ai/...  # When available

# Claude
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (optional)
OPENAI_API_KEY=sk-...

# Auth
JWT_SECRET=...
JWT_ALGORITHM=HS256

# App
MARKUP_PERCENTAGE=30  # 30% margin over LLM costs
```

---

## Monitoring

Metrics to track:

- **Usage**: Requests/day, tokens/day, cost/day
- **Performance**: Response time, error rate
- **Billing**: Revenue, margin, unpaid invoices
- **Models**: Distribution by tier, cost per tier
- **Users**: Active users, churn, usage patterns

Integrate with DevOps agent for automated monitoring.

---

## Support

Questions? Issues? Contact:
- Leon D (leon@jedire.com)
- DevOps Agent (automated monitoring)
- GitHub Issues (when repo is public)

---

*Created: 2026-03-07*
*Last updated: 2026-03-07*
