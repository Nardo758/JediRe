# User Agent - Model Selection Design

## Overview

Let users choose their preferred AI model based on their needs:
- **Fast & cheap**: GPT-4o-mini, Claude Haiku
- **Balanced**: GPT-4o, Claude Sonnet
- **Premium**: Claude Opus, GPT-o1

**Benefits:**
- Users control their costs
- Power users can use premium models
- Budget-conscious users save money
- Different tasks need different models

---

## Model Catalog

### Tier 1: Fast (Budget)
**Use case**: Quick queries, simple analysis, high volume

| Model | Provider | Input | Output | Speed |
|-------|----------|-------|--------|-------|
| GPT-4o-mini | OpenAI | $0.15/1M | $0.60/1M | ⚡⚡⚡ |
| Claude Haiku | Anthropic | $0.25/1M | $1.25/1M | ⚡⚡⚡ |
| Gemini Flash | Google | $0.075/1M | $0.30/1M | ⚡⚡⚡ |

**Avg cost per conversation**: ~$0.005

### Tier 2: Balanced (Standard)
**Use case**: Most queries, detailed analysis, reasoning

| Model | Provider | Input | Output | Speed |
|-------|----------|-------|--------|-------|
| GPT-4o | OpenAI | $2.50/1M | $10/1M | ⚡⚡ |
| Claude Sonnet 4.5 | Anthropic | $3/1M | $15/1M | ⚡⚡ |
| Gemini Pro | Google | $1.25/1M | $5/1M | ⚡⚡ |

**Avg cost per conversation**: ~$0.05

### Tier 3: Premium (Advanced)
**Use case**: Complex reasoning, long documents, critical decisions

| Model | Provider | Input | Output | Speed |
|-------|----------|-------|--------|-------|
| Claude Opus 4 | Anthropic | $15/1M | $75/1M | ⚡ |
| GPT-o1 | OpenAI | $15/1M | $60/1M | ⚡ |
| Gemini Ultra | Google | $10/1M | $40/1M | ⚡ |

**Avg cost per conversation**: ~$0.25

---

## User Interface

### Model Picker in Chat
```
┌─────────────────────────────────────┐
│  JediRe AI Assistant               │
├─────────────────────────────────────┤
│                                     │
│  Model: [Sonnet 4.5 ▼]             │
│         Fast | Standard | Premium   │
│                                     │
│  💬 Ask about a property...         │
│                                     │
└─────────────────────────────────────┘
```

**Quick toggle:**
- Fast (💨): Auto-picks cheapest available
- Standard (⚖️): Auto-picks balanced (default)
- Premium (🚀): Auto-picks best available

**Advanced dropdown:**
- Show all available models with costs
- Real-time cost estimator

### Settings Page
```
┌─────────────────────────────────────────────────┐
│  AI Model Preferences                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Default Model:                                 │
│  ◉ Claude Sonnet 4.5 (Standard)                 │
│    ~$0.05 per conversation                      │
│                                                 │
│  ○ GPT-4o-mini (Budget)                         │
│    ~$0.005 per conversation                     │
│                                                 │
│  ○ Claude Opus 4 (Premium)                      │
│    ~$0.25 per conversation                      │
│                                                 │
│  [Show all models...]                           │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Cost Controls:                                 │
│  ☑ Warn me if cost exceeds $0.10/conversation   │
│  ☑ Auto-switch to cheaper model if low credits  │
│  ☐ Only allow Fast tier models                  │
│                                                 │
│  Monthly Budget: $50 [▓▓▓▓▓▓░░░░] 62% used      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## API Design

### Model Selection Endpoint

```python
@app.post("/v1/chat")
async def chat(
    message: str,
    model: Optional[str] = None,  # e.g., "claude-sonnet-4-5" or "gpt-4o"
    tier: Optional[str] = None,   # "fast" | "standard" | "premium"
    user: User = Depends(get_current_user)
):
    """
    Users can specify:
    - Exact model name: model="claude-opus-4"
    - Tier: tier="fast" (we pick best in tier)
    - Nothing: use their default preference
    """
    
    # Determine which model to use
    if model:
        # User specified exact model
        selected_model = validate_model(model)
    elif tier:
        # User specified tier, pick best available
        selected_model = get_best_model_in_tier(tier)
    else:
        # Use user's default preference
        selected_model = user.preferences.default_model or "claude-sonnet-4-5"
    
    # Check if user has access to this model tier
    if not user_can_access_model(user, selected_model):
        raise HTTPException(
            403,
            f"Your plan doesn't include {selected_model.tier} tier models. Upgrade to access."
        )
    
    # Estimate cost
    estimated_cost = estimate_conversation_cost(message, selected_model)
    
    # Check budget controls
    if user.preferences.cost_warning_threshold:
        if estimated_cost > user.preferences.cost_warning_threshold:
            # Return warning, require confirmation
            return {
                "warning": "high_cost",
                "estimated_cost": estimated_cost,
                "threshold": user.preferences.cost_warning_threshold,
                "confirmation_required": True
            }
    
    # Check credit balance
    if user.billing_type == "credits":
        if user.credit_balance < estimated_cost:
            if user.preferences.auto_downgrade:
                # Try cheaper model
                selected_model = get_cheapest_available_model()
            else:
                raise HTTPException(402, "Insufficient credits")
    
    # Make the AI call
    response = await call_model(
        model=selected_model,
        message=message,
        user=user
    )
    
    # Log usage with model info
    await log_usage(
        user_id=user.id,
        model=selected_model.name,
        tier=selected_model.tier,
        tokens_in=response.usage.input_tokens,
        tokens_out=response.usage.output_tokens,
        cost=response.usage.cost
    )
    
    return {
        "response": response.content,
        "model_used": selected_model.name,
        "cost": response.usage.cost,
        "tokens": response.usage.total_tokens
    }
```

### Model Info Endpoint

```python
@app.get("/v1/models")
async def list_models(user: User = Depends(get_current_user)):
    """List all available models with pricing and capabilities"""
    
    models = [
        {
            "id": "claude-sonnet-4-5",
            "name": "Claude Sonnet 4.5",
            "provider": "Anthropic",
            "tier": "standard",
            "pricing": {
                "input": 3.00,   # per 1M tokens
                "output": 15.00
            },
            "speed": "fast",
            "context_window": 200_000,
            "capabilities": ["reasoning", "analysis", "coding"],
            "avg_conversation_cost": 0.05,
            "available": True  # Based on user's plan
        },
        {
            "id": "gpt-4o-mini",
            "name": "GPT-4o Mini",
            "provider": "OpenAI",
            "tier": "fast",
            "pricing": {
                "input": 0.15,
                "output": 0.60
            },
            "speed": "very_fast",
            "context_window": 128_000,
            "capabilities": ["chat", "basic_analysis"],
            "avg_conversation_cost": 0.005,
            "available": True
        },
        # ... more models
    ]
    
    # Filter by user's plan
    if user.plan == "basic":
        models = [m for m in models if m["tier"] in ["fast", "standard"]]
    elif user.plan == "pro":
        # All models available
        pass
    
    return {
        "models": models,
        "user_plan": user.plan,
        "default_model": user.preferences.default_model
    }
```

---

## Pricing Plans with Model Access

### Plan Tiers

**Basic Plan** - $10/month + usage
- ✅ Fast tier models (unlimited)
- ✅ Standard tier models (1M tokens/month included)
- ❌ Premium tier models

**Pro Plan** - $50/month + usage
- ✅ All model tiers
- ✅ 5M tokens/month included (any tier)
- ✅ Priority support
- ✅ Custom model fine-tuning (coming soon)

**Enterprise Plan** - Custom pricing
- ✅ All models
- ✅ Dedicated capacity
- ✅ Custom models
- ✅ SLA guarantees
- ✅ Custom invoicing

---

## Database Schema Updates

```sql
-- Model catalog (synced from Stripe)
CREATE TABLE ai_models (
    id TEXT PRIMARY KEY,  -- e.g., "claude-sonnet-4-5"
    name TEXT NOT NULL,
    provider TEXT NOT NULL,  -- anthropic|openai|google
    tier TEXT NOT NULL,  -- fast|standard|premium
    
    -- Pricing (per 1M tokens)
    price_input_usd DECIMAL(10,6),
    price_output_usd DECIMAL(10,6),
    
    -- Metadata
    context_window INT,
    capabilities JSONB,
    speed_tier TEXT,  -- very_fast|fast|moderate|slow
    
    -- Availability
    is_active BOOLEAN DEFAULT true,
    released_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences
CREATE TABLE user_ai_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    
    -- Model selection
    default_model TEXT REFERENCES ai_models(id),
    fallback_model TEXT REFERENCES ai_models(id),
    
    -- Cost controls
    cost_warning_threshold DECIMAL(10,6),  -- Alert if cost > this
    monthly_budget_usd DECIMAL(10,2),
    auto_downgrade_on_low_credits BOOLEAN DEFAULT false,
    
    -- Tier restrictions (overrides plan defaults)
    allowed_tiers TEXT[],  -- ['fast', 'standard']
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage logs (updated)
ALTER TABLE usage_logs ADD COLUMN model_id TEXT REFERENCES ai_models(id);
ALTER TABLE usage_logs ADD COLUMN model_tier TEXT;
ALTER TABLE usage_logs ADD COLUMN user_selected_model BOOLEAN;  -- Did user pick this?
```

---

## Model Selection Logic

```python
class ModelSelector:
    """Smart model selection with cost optimization"""
    
    async def select_model(
        self,
        user: User,
        request: ChatRequest
    ) -> AIModel:
        """
        Selection priority:
        1. User's explicit choice (if allowed)
        2. User's default preference
        3. Smart selection based on query type
        4. Fallback to plan default
        """
        
        # 1. Explicit choice
        if request.model:
            model = await self.get_model(request.model)
            if not await self.user_can_access(user, model):
                raise ModelAccessDenied(
                    f"Your plan doesn't include {model.tier} models"
                )
            return model
        
        # 2. Tier-based selection
        if request.tier:
            models = await self.get_models_in_tier(request.tier)
            # Pick best available
            for model in models:
                if await self.user_can_access(user, model):
                    return model
            raise NoModelsAvailable(f"No {request.tier} models available")
        
        # 3. User's default
        if user.preferences.default_model:
            model = await self.get_model(user.preferences.default_model)
            if await self.user_can_access(user, model):
                return model
        
        # 4. Smart selection based on query
        if await self.is_simple_query(request.message):
            # Use cheaper model for simple stuff
            return await self.get_cheapest_available(user)
        
        if await self.is_complex_reasoning(request.message):
            # Use premium model if available
            premium = await self.get_best_in_tier(user, "premium")
            if premium:
                return premium
        
        # 5. Plan default
        return await self.get_plan_default(user.plan)
    
    async def is_simple_query(self, message: str) -> bool:
        """Detect simple queries that don't need premium models"""
        simple_patterns = [
            r"^what is",
            r"^how much",
            r"^when",
            r"^where",
            r"^list",
        ]
        return any(re.match(p, message.lower()) for p in simple_patterns)
    
    async def is_complex_reasoning(self, message: str) -> bool:
        """Detect queries that benefit from premium models"""
        complex_keywords = [
            "analyze", "compare", "evaluate", "assess",
            "recommend", "optimize", "calculate roi",
            "financial analysis", "due diligence"
        ]
        message_lower = message.lower()
        return any(kw in message_lower for kw in complex_keywords)
```

---

## Cost Controls & Alerts

```python
# Real-time cost estimation
@app.post("/v1/estimate-cost")
async def estimate_cost(
    message: str,
    model: str,
    user: User = Depends(get_current_user)
):
    """Estimate cost before sending request"""
    
    model_obj = await get_model(model)
    
    # Rough token estimation
    estimated_input_tokens = len(message.split()) * 1.3  # ~1.3 tokens per word
    estimated_output_tokens = 500  # Assume avg response
    
    cost = (
        (estimated_input_tokens / 1_000_000) * model_obj.price_input_usd +
        (estimated_output_tokens / 1_000_000) * model_obj.price_output_usd
    )
    
    # Apply our markup
    cost_with_markup = cost * (1 + user.pricing_tier.markup_percentage)
    
    return {
        "estimated_cost": round(cost_with_markup, 4),
        "estimated_tokens": int(estimated_input_tokens + estimated_output_tokens),
        "model": model_obj.name,
        "confidence": "medium"  # Estimation accuracy
    }

# Budget tracking
@app.get("/v1/usage/budget-status")
async def budget_status(user: User = Depends(get_current_user)):
    """Check budget status"""
    
    if not user.preferences.monthly_budget_usd:
        return {"budget_enabled": False}
    
    # Calculate month-to-date spending
    month_start = datetime.now().replace(day=1, hour=0, minute=0)
    mtd_cost = await db.fetchval(
        "SELECT SUM(stripe_cost_usd) FROM usage_logs WHERE user_id = $1 AND created_at >= $2",
        user.id, month_start
    )
    
    budget = user.preferences.monthly_budget_usd
    remaining = budget - mtd_cost
    percentage_used = (mtd_cost / budget) * 100
    
    # Calculate days left in month
    days_in_month = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    days_remaining = (days_in_month.day - datetime.now().day)
    
    # Project end-of-month cost
    daily_avg = mtd_cost / (datetime.now().day)
    projected_total = daily_avg * days_in_month.day
    
    return {
        "budget_usd": budget,
        "spent_usd": mtd_cost,
        "remaining_usd": remaining,
        "percentage_used": round(percentage_used, 1),
        "days_remaining": days_remaining,
        "projected_total_usd": round(projected_total, 2),
        "on_track": projected_total <= budget,
        "warnings": generate_budget_warnings(percentage_used, projected_total, budget)
    }

def generate_budget_warnings(pct_used, projected, budget):
    warnings = []
    
    if pct_used > 90:
        warnings.append("You've used 90% of your monthly budget")
    
    if projected > budget * 1.2:
        warnings.append(f"Projected to exceed budget by ${projected - budget:.2f}")
    
    if pct_used > 50 and datetime.now().day < 15:
        warnings.append("You're using budget faster than expected")
    
    return warnings
```

---

## UI Components

### Model Switcher Component (React)

```jsx
import { useState } from 'react';

function ModelSwitcher({ onModelChange, currentModel }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const tiers = [
    { id: 'fast', label: 'Fast', icon: '💨', avgCost: 0.005 },
    { id: 'standard', label: 'Standard', icon: '⚖️', avgCost: 0.05 },
    { id: 'premium', label: 'Premium', icon: '🚀', avgCost: 0.25 }
  ];
  
  return (
    <div className="model-switcher">
      {/* Quick tier toggle */}
      <div className="tier-toggle">
        {tiers.map(tier => (
          <button
            key={tier.id}
            onClick={() => onModelChange({ tier: tier.id })}
            className={currentModel.tier === tier.id ? 'active' : ''}
          >
            <span className="icon">{tier.icon}</span>
            <span className="label">{tier.label}</span>
            <span className="cost">~${tier.avgCost}</span>
          </button>
        ))}
      </div>
      
      {/* Advanced model picker */}
      {showAdvanced && (
        <ModelPicker
          currentModel={currentModel}
          onSelect={onModelChange}
        />
      )}
      
      <button onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Simple' : 'Advanced'} selection
      </button>
    </div>
  );
}
```

---

## Stripe Configuration

**With Stripe Token Billing**, model pricing is automatically synced:

```python
# Stripe handles model pricing updates
# You just set your markup percentage

await stripe.billing.token_pricing.update(
    markup_percentage=30,  # 30% margin
    
    # Optional: Override specific models
    model_overrides=[
        {
            "model": "claude-opus-4",
            "markup_percentage": 40  # Higher margin on premium
        }
    ],
    
    # Auto-apply price updates
    price_update_policy="apply_to_new_customers"
)
```

---

## Next Steps

1. **Design model catalog schema**
2. **Build model selection API**
3. **Create UI components**
4. **Implement cost controls**
5. **Set up Stripe model pricing sync**
6. **Add budget tracking**
7. **Build usage analytics dashboard**

Want me to start building the database schema and API?
