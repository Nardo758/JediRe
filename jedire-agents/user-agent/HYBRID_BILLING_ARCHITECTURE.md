# JediRe User Agent - Hybrid Billing Architecture

## Overview

**Goal**: Track AI usage with both automated Stripe billing AND custom invoice generation for enterprise customers.

**Approach**: Dual-track system
1. **Primary**: Stripe AI Gateway (auto-billing, easy integration)
2. **Secondary**: Self-reported usage (audit trail, custom invoices)
3. **Internal**: PostgreSQL tracking (analytics, debugging, customer dashboards)

---

## Architecture

```
User Request
    ↓
┌───────────────────────────────────────┐
│      User Agent API (FastAPI)         │
│  - Authenticate user                  │
│  - Check rate limits                  │
│  - Route to LLM                       │
└───────────────┬───────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼─────────────┐  ┌──────▼──────────┐
│ Stripe AI       │  │ Internal Usage  │
│ Gateway         │  │ Tracker (DB)    │
│                 │  │                 │
│ - Calls Claude  │  │ - Log every req │
│ - Bills customer│  │ - Track tokens  │
│ - Returns tokens│  │ - Store context │
└───┬─────────────┘  └──────┬──────────┘
    │                       │
    └───────────┬───────────┘
                │
         ┌──────▼──────┐
         │   Stripe    │
         │ Meter API   │
         │ (backup)    │
         └─────────────┘
```

---

## Three-Layer Tracking

### Layer 1: Stripe AI Gateway (Primary)
**When**: Default for all standard customers

```python
# FastAPI endpoint
@app.post("/v1/chat")
async def chat(request: ChatRequest, user: User = Depends(get_current_user)):
    # Call through Stripe AI Gateway
    response = await stripe.ai_gateway.completions.create(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": request.message}],
        customer=user.stripe_customer_id,  # Auto-bills
        metadata={
            "user_id": str(user.id),
            "session_id": request.session_id,
            "source": request.source  # platform|telegram|whatsapp
        }
    )
    
    # Log to internal DB (Layer 3)
    await log_usage(
        user_id=user.id,
        tokens_in=response.usage.prompt_tokens,
        tokens_out=response.usage.completion_tokens,
        cost=response.usage.cost,  # Stripe returns this
        model=response.model,
        source=request.source
    )
    
    return response
```

**Benefits**:
- ✅ Automatic billing
- ✅ No separate meter management
- ✅ Stripe tracks token costs
- ✅ One API call

### Layer 2: Self-Reported Usage (Backup/Invoicing)
**When**: 
- Stripe AI Gateway is down
- Enterprise customers who need detailed invoices
- Audit requirements

```python
# Fallback or parallel tracking
@app.post("/v1/chat")
async def chat(request: ChatRequest, user: User = Depends(get_current_user)):
    # Direct Claude call
    response = await anthropic.messages.create(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": request.message}]
    )
    
    # Report to Stripe Meter API
    await stripe.billing.meter_events.create(
        event_name="ai_tokens",
        payload={
            "stripe_customer_id": user.stripe_customer_id,
            "value": response.usage.total_tokens,
        },
        metadata={
            "model": "claude-sonnet-4-5",
            "tokens_in": response.usage.input_tokens,
            "tokens_out": response.usage.output_tokens,
            "user_id": str(user.id)
        }
    )
    
    # Log internally (Layer 3)
    await log_usage(...)
    
    return response
```

**Benefits**:
- ✅ Full control over LLM calls
- ✅ Can use multiple providers
- ✅ Detailed audit trail
- ✅ Custom invoice generation

### Layer 3: Internal Database (Always)
**When**: Every single request

**Schema**:
```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    stripe_customer_id TEXT,
    session_id TEXT,
    
    -- Request details
    source TEXT,  -- platform|telegram|whatsapp|api
    model TEXT,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    
    -- Costs
    stripe_cost_usd DECIMAL(10,6),  -- What Stripe charged
    our_cost_usd DECIMAL(10,6),     -- Actual provider cost
    markup_percentage DECIMAL(5,2), -- Our margin
    
    -- Metadata
    request_metadata JSONB,
    response_metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    billed_at TIMESTAMPTZ,
    invoiced_at TIMESTAMPTZ,
    
    -- Indexes
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_stripe_customer (stripe_customer_id),
    INDEX idx_unbilled (user_id) WHERE billed_at IS NULL
);
```

**Benefits**:
- ✅ Full audit trail
- ✅ Generate custom invoices
- ✅ Real-time usage dashboards
- ✅ Debug issues
- ✅ Analytics (which features cost most, etc.)

---

## Billing Models

### Model 1: Credit Packs (Prepaid)
**User pays upfront, uses credits**

```python
# User purchases credit pack
@app.post("/billing/purchase-credits")
async def purchase_credits(amount_usd: int, user: User):
    # Create Stripe charge
    payment = await stripe.payment_intents.create(
        amount=amount_usd * 100,  # cents
        currency="usd",
        customer=user.stripe_customer_id,
        metadata={"type": "credit_pack"}
    )
    
    # Add credits to user account
    await db.execute(
        "UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2",
        amount_usd, user.id
    )
    
    return {"credits": amount_usd, "balance": user.credit_balance}

# Deduct on usage
@app.post("/v1/chat")
async def chat(request: ChatRequest, user: User):
    # Check balance
    if user.credit_balance <= 0:
        raise HTTPException(402, "Insufficient credits. Please top up.")
    
    # Make AI call
    response = await stripe.ai_gateway.completions.create(...)
    
    # Deduct credits
    cost_usd = response.usage.cost
    await db.execute(
        "UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2",
        cost_usd, user.id
    )
    
    # Alert on low balance
    new_balance = user.credit_balance - cost_usd
    if new_balance < 5.00 and user.credit_balance >= 5.00:
        await send_low_credit_alert(user)
    
    return response
```

### Model 2: Subscription + Included Usage
**$20/month includes 1M tokens, overages billed**

```python
# Stripe subscription setup
subscription = await stripe.subscriptions.create(
    customer=user.stripe_customer_id,
    items=[{
        "price": "price_monthly_20",  # $20/month base
        "quantity": 1
    }],
    metadata={
        "included_tokens": 1_000_000,
        "overage_rate": 0.00003  # $0.03 per 1k tokens
    }
)

# Track usage against quota
@app.post("/v1/chat")
async def chat(request: ChatRequest, user: User):
    # Calculate month-to-date usage
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0)
    mtd_tokens = await db.fetchval(
        "SELECT SUM(total_tokens) FROM usage_logs WHERE user_id = $1 AND created_at >= $2",
        user.id, month_start
    )
    
    # Make AI call
    response = await stripe.ai_gateway.completions.create(...)
    new_total = mtd_tokens + response.usage.total_tokens
    
    # Bill overages to Stripe
    if new_total > user.subscription.included_tokens:
        overage_tokens = new_total - user.subscription.included_tokens
        await stripe.billing.meter_events.create(
            event_name="token_overage",
            payload={
                "stripe_customer_id": user.stripe_customer_id,
                "value": overage_tokens
            }
        )
    
    return response
```

### Model 3: Pure Pay-As-You-Go
**Bill monthly for actual usage**

```python
# Simplest - Stripe handles everything
@app.post("/v1/chat")
async def chat(request: ChatRequest, user: User):
    response = await stripe.ai_gateway.completions.create(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": request.message}],
        customer=user.stripe_customer_id
    )
    
    # That's it - Stripe bills them at end of month
    return response
```

---

## Custom Invoice Generation

**For enterprise customers who need detailed invoices:**

```python
@app.post("/billing/generate-invoice")
async def generate_invoice(
    user_id: UUID,
    start_date: date,
    end_date: date
):
    # Fetch all usage
    usage = await db.fetch(
        """
        SELECT 
            DATE(created_at) as date,
            source,
            model,
            SUM(total_tokens) as tokens,
            SUM(stripe_cost_usd) as cost
        FROM usage_logs
        WHERE user_id = $1 
          AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at), source, model
        ORDER BY date DESC
        """,
        user_id, start_date, end_date
    )
    
    # Generate PDF invoice
    invoice_pdf = await generate_pdf_invoice({
        "user": await get_user(user_id),
        "period": f"{start_date} to {end_date}",
        "line_items": [
            {
                "date": row["date"],
                "description": f"{row['source']} - {row['model']}",
                "tokens": f"{row['tokens']:,}",
                "cost": f"${row['cost']:.2f}"
            }
            for row in usage
        ],
        "total": sum(row["cost"] for row in usage)
    })
    
    # Create Stripe invoice item (for their records)
    await stripe.invoice_items.create(
        customer=user.stripe_customer_id,
        amount=int(sum(row["cost"] for row in usage) * 100),
        currency="usd",
        description=f"AI Usage: {start_date} to {end_date}"
    )
    
    return {"invoice_pdf": invoice_pdf, "total": sum(...)}
```

---

## User Dashboard

**Real-time usage tracking:**

```python
@app.get("/api/usage/current")
async def get_usage_dashboard(user: User):
    # Current month
    month_start = datetime.now().replace(day=1, hour=0, minute=0)
    
    stats = await db.fetchrow(
        """
        SELECT 
            COUNT(*) as requests,
            SUM(total_tokens) as tokens,
            SUM(stripe_cost_usd) as cost,
            AVG(total_tokens) as avg_tokens_per_request
        FROM usage_logs
        WHERE user_id = $1 AND created_at >= $2
        """,
        user.id, month_start
    )
    
    # Breakdown by source
    by_source = await db.fetch(
        """
        SELECT source, SUM(total_tokens) as tokens, SUM(stripe_cost_usd) as cost
        FROM usage_logs
        WHERE user_id = $1 AND created_at >= $2
        GROUP BY source
        """,
        user.id, month_start
    )
    
    return {
        "period": "current_month",
        "requests": stats["requests"],
        "tokens": stats["tokens"],
        "cost_usd": float(stats["cost"]),
        "avg_tokens": stats["avg_tokens_per_request"],
        "credit_balance": user.credit_balance,
        "breakdown": by_source,
        "estimated_monthly_cost": estimate_monthly_cost(stats["cost"])
    }
```

---

## Implementation Roadmap

### Phase 1: Internal Tracking (Week 1)
- ✅ Set up PostgreSQL usage_logs table
- ✅ Implement log_usage() function
- ✅ Basic usage dashboard API

### Phase 2: Stripe AI Gateway (Week 2)
- ⏳ Wait for Stripe preview access
- ⏳ Integrate AI Gateway
- ⏳ Test auto-billing

### Phase 3: Self-Reporting Fallback (Week 2-3)
- ⏳ Implement direct Claude calls
- ⏳ Stripe Meter API integration
- ⏳ Fallback logic if Gateway fails

### Phase 4: Billing Models (Week 3-4)
- ⏳ Credit pack purchase flow
- ⏳ Subscription with included usage
- ⏳ Overage billing
- ⏳ Custom invoice generation

### Phase 5: User Features (Week 4+)
- ⏳ Usage dashboard in JediRe platform
- ⏳ Low-credit alerts
- ⏳ Budget controls (max spend per month)
- ⏳ Historical usage reports

---

## Cost Estimates

**Claude Sonnet 4.5 Pricing** (as of 2026):
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

**Average conversation** (10 messages):
- ~5k tokens in, ~2k tokens out
- Cost: (5k × $3/1M) + (2k × $15/1M) = $0.045

**With 30% markup**:
- User pays: $0.059 per conversation
- Your margin: $0.014

**100 users, 50 conversations/month each**:
- Total conversations: 5,000
- Revenue: $295/month
- Your cost: $225/month
- Margin: $70/month

**Stripe fees**:
- 2.9% + $0.30 per transaction (credit cards)
- On $295: ~$9
- **Net margin: ~$61/month**

---

## Next Steps

1. ✅ Draft Stripe waitlist email (done - see above)
2. Send email to token-billing-team@stripe.com
3. Build internal tracking (Phase 1) while waiting
4. Set up PostgreSQL schema
5. Implement basic usage logging
6. Build dashboard API

Ready to send that email?
