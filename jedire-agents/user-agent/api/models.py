"""
JediRe User Agent - Pydantic Models
Data models for API requests/responses
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field, validator


# ============================================
# AI Models
# ============================================

class AIModel(BaseModel):
    """AI model information"""
    id: str
    name: str
    provider: Literal["anthropic", "openai", "google"]
    tier: Literal["fast", "standard", "premium"]
    
    # Pricing
    price_input_usd: Decimal
    price_output_usd: Decimal
    
    # Capabilities
    context_window: int
    max_output_tokens: Optional[int]
    capabilities: List[str] = []
    speed_tier: Optional[Literal["very_fast", "fast", "moderate", "slow"]]
    
    # Availability
    is_active: bool = True
    
    # Computed
    avg_conversation_cost: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


class ModelListResponse(BaseModel):
    """List of available models"""
    models: List[AIModel]
    user_plan: str
    default_model: Optional[str]


# ============================================
# Chat Requests/Responses
# ============================================

class ChatRequest(BaseModel):
    """User chat request"""
    message: str = Field(..., min_length=1, max_length=10000)
    conversation_id: Optional[UUID] = None
    
    # Model selection
    model: Optional[str] = None  # Exact model ID
    tier: Optional[Literal["fast", "standard", "premium"]] = None  # Or tier
    
    # Context
    context: Optional[Dict[str, Any]] = None  # Deal IDs, property info, etc.
    
    # Metadata
    source: Literal["platform", "telegram", "whatsapp", "api"] = "platform"


class ChatResponse(BaseModel):
    """AI response"""
    response: str
    conversation_id: UUID
    message_id: UUID
    
    # Usage info
    model_used: str
    model_tier: str
    tokens_used: int
    cost_usd: Decimal
    
    # Optional warnings
    warning: Optional[str] = None


class CostEstimateRequest(BaseModel):
    """Request to estimate cost before sending"""
    message: str
    model: str


class CostEstimateResponse(BaseModel):
    """Cost estimation"""
    estimated_cost_usd: Decimal
    estimated_tokens: int
    model: str
    confidence: Literal["low", "medium", "high"] = "medium"


# ============================================
# Users & Preferences
# ============================================

class User(BaseModel):
    """User account"""
    id: UUID
    email: str
    name: Optional[str]
    
    # Stripe
    stripe_customer_id: Optional[str]
    
    # Billing
    plan: Literal["basic", "pro", "enterprise"]
    billing_type: Literal["subscription", "credits", "invoice"]
    credit_balance: Decimal
    
    # Status
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserPreferences(BaseModel):
    """User AI preferences"""
    user_id: UUID
    
    # Models
    default_model: str = "claude-sonnet-4-5"
    fallback_model: Optional[str]
    
    # Cost controls
    cost_warning_threshold: Optional[Decimal]
    monthly_budget_usd: Optional[Decimal]
    auto_downgrade_on_low_credits: bool = False
    
    # Access control
    allowed_tiers: Optional[List[str]]
    
    class Config:
        from_attributes = True


class UpdatePreferencesRequest(BaseModel):
    """Update user preferences"""
    default_model: Optional[str]
    fallback_model: Optional[str]
    cost_warning_threshold: Optional[Decimal]
    monthly_budget_usd: Optional[Decimal]
    auto_downgrade_on_low_credits: Optional[bool]


# ============================================
# Usage & Analytics
# ============================================

class UsageLog(BaseModel):
    """Single usage log entry"""
    id: UUID
    user_id: UUID
    
    # Request details
    source: str
    model_id: str
    model_tier: str
    
    # Tokens
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    
    # Costs
    provider_cost_usd: Decimal
    stripe_cost_usd: Optional[Decimal]
    our_markup_usd: Optional[Decimal]
    
    # Timestamp
    created_at: datetime
    
    class Config:
        from_attributes = True


class UsageSummary(BaseModel):
    """Usage summary for a period"""
    period: str  # "current_month", "last_30_days", etc.
    start_date: date
    end_date: date
    
    # Totals
    total_requests: int
    total_tokens: int
    total_cost_usd: Decimal
    
    # Averages
    avg_tokens_per_request: int
    avg_cost_per_request: Decimal
    
    # Breakdown
    by_model: Dict[str, Dict[str, Any]]
    by_source: Dict[str, Dict[str, Any]]
    by_tier: Dict[str, Dict[str, Any]]


class BudgetStatus(BaseModel):
    """Monthly budget tracking"""
    budget_enabled: bool
    budget_usd: Optional[Decimal]
    spent_usd: Decimal
    remaining_usd: Optional[Decimal]
    percentage_used: Optional[float]
    
    # Projections
    days_remaining: Optional[int]
    projected_total_usd: Optional[Decimal]
    on_track: Optional[bool]
    
    # Alerts
    warnings: List[str] = []


# ============================================
# Credits & Billing
# ============================================

class PurchaseCreditsRequest(BaseModel):
    """Purchase credit pack"""
    amount_usd: Decimal = Field(..., gt=0, le=10000)
    payment_method_id: Optional[str]  # Stripe payment method


class PurchaseCreditsResponse(BaseModel):
    """Credit purchase confirmation"""
    transaction_id: UUID
    amount_usd: Decimal
    new_balance: Decimal
    stripe_payment_intent_id: Optional[str]


class CreditTransaction(BaseModel):
    """Credit transaction record"""
    id: UUID
    user_id: UUID
    amount_usd: Decimal
    type: Literal["purchase", "usage", "refund", "bonus", "adjustment"]
    balance_before: Decimal
    balance_after: Decimal
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CreditBalance(BaseModel):
    """Current credit balance"""
    balance_usd: Decimal
    recent_transactions: List[CreditTransaction]


# ============================================
# Conversations
# ============================================

class Conversation(BaseModel):
    """Conversation session"""
    id: UUID
    user_id: UUID
    title: Optional[str]
    source: str
    is_active: bool
    created_at: datetime
    last_message_at: datetime
    message_count: Optional[int]
    
    class Config:
        from_attributes = True


class Message(BaseModel):
    """Single message in conversation"""
    id: UUID
    conversation_id: UUID
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime
    
    # Optional usage info
    usage_log_id: Optional[UUID]
    cost_usd: Optional[Decimal]
    
    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    """Conversation with messages"""
    conversation: Conversation
    messages: List[Message]
    total_cost_usd: Decimal
    total_tokens: int


# ============================================
# Invoices
# ============================================

class InvoiceLineItem(BaseModel):
    """Line item on an invoice"""
    description: str
    quantity: int = 1
    unit_price_usd: Decimal
    amount_usd: Decimal
    metadata: Optional[Dict[str, Any]]


class Invoice(BaseModel):
    """Custom invoice"""
    id: UUID
    user_id: UUID
    invoice_number: str
    period_start: date
    period_end: date
    
    # Amounts
    subtotal_usd: Decimal
    tax_usd: Decimal
    total_usd: Decimal
    
    # Status
    status: Literal["draft", "sent", "paid", "void"]
    
    # Dates
    issued_at: Optional[datetime]
    due_at: Optional[datetime]
    paid_at: Optional[datetime]
    
    # Files
    pdf_url: Optional[str]
    
    class Config:
        from_attributes = True


class GenerateInvoiceRequest(BaseModel):
    """Request to generate invoice"""
    period_start: date
    period_end: date
    include_line_items: bool = True


class InvoiceDetail(BaseModel):
    """Invoice with line items"""
    invoice: Invoice
    line_items: List[InvoiceLineItem]


# ============================================
# Error Responses
# ============================================

class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    detail: Optional[str]
    code: Optional[str]


class ModelAccessDeniedError(BaseModel):
    """Model access denied"""
    error: str = "model_access_denied"
    model: str
    user_plan: str
    required_plan: str
    upgrade_url: Optional[str]


class InsufficientCreditsError(BaseModel):
    """Insufficient credits"""
    error: str = "insufficient_credits"
    balance: Decimal
    required: Decimal
    topup_url: Optional[str]


class CostWarning(BaseModel):
    """Cost warning before proceeding"""
    warning: str = "high_cost"
    estimated_cost_usd: Decimal
    threshold_usd: Decimal
    confirmation_required: bool = True
    proceed_token: Optional[str]  # Token to bypass warning


# ============================================
# Health & Status
# ============================================

class HealthResponse(BaseModel):
    """Health check response"""
    status: Literal["healthy", "degraded", "unhealthy"]
    version: str
    timestamp: datetime
    services: Dict[str, bool]  # database, stripe, anthropic, etc.


class StatsResponse(BaseModel):
    """System statistics"""
    total_users: int
    active_conversations: int
    requests_today: int
    total_tokens_today: int
    models_available: int
