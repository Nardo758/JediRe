# Stripe Token Billing Waitlist Email

**To**: token-billing-team@stripe.com  
**Subject**: Token Billing Private Preview - JediRe Platform

---

Hi Stripe Team,

I'm building **JediRe**, a commercial real estate investment platform, and I'm interested in joining the Token Billing private preview.

**Use Case**:
We're launching an AI assistant that helps users analyze real estate deals, run financial models, and discover investment opportunities. Users will interact via:
- In-platform chat widget
- Telegram/WhatsApp
- API access for power users

**Why Token Billing**:
- We need **flexible pricing models** (credit packs, monthly subscriptions with included usage, and pure pay-as-you-go)
- Our customers range from individual investors to enterprise firms - some want prepaid credits, others need monthly invoices
- We want to **maintain a consistent margin** (30-40%) over LLM costs without constantly adjusting prices when providers change theirs
- We need **automated usage tracking** - manually metering tokens across multiple channels is error-prone

**Specific Requirements**:
1. **Hybrid tracking** - We'd like to use the AI Gateway for most traffic, but also self-report usage for audit trails and custom invoice generation
2. **Credit-based systems** - Mentioned in the docs as a capability you're looking for feedback on
3. **Usage visibility** - Customers should see their token consumption in real-time

**Technical Details**:
- Backend: FastAPI (Python) + PostgreSQL
- Models: Claude Sonnet 4.5 (primary), potentially GPT-4 for fallback
- Expected volume: Starting with ~100 users, scaling to 1000+ in 6 months
- Current stage: Building MVP, launching Q2 2026

**What We Can Offer**:
- Active testing and feedback during preview
- Real-world B2B use case with diverse pricing needs
- Documentation of integration challenges and wins
- Willingness to be a case study if it goes well

Let me know if you need any additional information or have questions about our use case.

Thanks,
Leon D
Founder, JediRe
[Your contact info]

---

**Draft ready to send**. Should I send this now or do you want to edit it first?
