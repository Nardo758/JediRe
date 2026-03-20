"""
JediRe User Agent API
FastAPI application for AI assistant
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import os

from .models import *
from .database import Database
from .model_selector import ModelSelector
from .ai_gateway import get_ai_gateway
from .auth import get_current_user, set_database, AuthService, create_magic_link_token, verify_magic_link_token

# Version
VERSION = "0.1.0"

# Database
db = Database()

# AI components
model_selector = ModelSelector(db)
ai_gateway = get_ai_gateway(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle management"""
    # Startup
    await db.connect()
    set_database(db)  # Initialize auth with database
    print(f"✅ JediRe User Agent API v{VERSION} started")
    
    yield
    
    # Shutdown
    await db.disconnect()
    print("👋 Shutting down")


# FastAPI app
app = FastAPI(
    title="JediRe AI Assistant API",
    description="Multi-model AI assistant for commercial real estate analysis",
    version=VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Authentication
# ============================================

from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    """Magic link login request"""
    email: EmailStr

class LoginResponse(BaseModel):
    """Login response"""
    message: str
    magic_link_token: Optional[str] = None

class VerifyTokenRequest(BaseModel):
    """Verify magic link token"""
    token: str

class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    token_type: str = "bearer"
    user: User


@app.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Request magic link for passwordless login
    
    In production, this would:
    1. Create magic link token
    2. Send email with link
    3. Return success message
    
    For development, we return the token directly
    """
    
    # Create magic link token
    token = await create_magic_link_token(request.email)
    
    # TODO: Send email with magic link
    # In production: send_magic_link_email(request.email, token)
    
    # For development, return token directly
    magic_link = f"http://localhost:8000/auth/verify?token={token}"
    
    return LoginResponse(
        message="Magic link sent to your email",
        magic_link_token=token  # Remove in production
    )


@app.post("/auth/verify", response_model=TokenResponse)
async def verify_token(request: VerifyTokenRequest):
    """
    Verify magic link token and return access token
    
    This is what the magic link points to.
    User clicks link, we verify token, return long-lived access token.
    """
    
    user, access_token = await verify_magic_link_token(request.token, db)
    
    return TokenResponse(
        access_token=access_token,
        user=user
    )


@app.get("/auth/me", response_model=User)
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current user info"""
    return user


# ============================================
# Health & Status
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    services = {
        "database": await db.check_health(),
        "stripe": True,  # TODO: Actual check
        "anthropic": True,  # TODO: Actual check
    }
    
    status = "healthy"
    if not all(services.values()):
        status = "degraded"
    
    return HealthResponse(
        status=status,
        version=VERSION,
        timestamp=datetime.now(),
        services=services
    )


@app.get("/stats", response_model=StatsResponse)
async def get_stats():
    """System statistics"""
    return StatsResponse(
        total_users=await db.count_users(),
        active_conversations=await db.count_active_conversations(),
        requests_today=await db.count_requests_today(),
        total_tokens_today=await db.sum_tokens_today(),
        models_available=await db.count_active_models()
    )


# ============================================
# AI Models
# ============================================

@app.get("/v1/models", response_model=ModelListResponse)
async def list_models(user: User = Depends(get_current_user)):
    """List available AI models for this user"""
    
    # Get all active models
    models = await db.get_active_models()
    
    # Filter by user's plan
    if user.plan == "basic":
        # Basic: fast + limited standard
        models = [m for m in models if m.tier in ["fast", "standard"]]
    # Pro and enterprise get all models
    
    # Get user preferences
    prefs = await db.get_user_preferences(user.id)
    
    # Calculate average costs (simplified)
    for model in models:
        model.avg_conversation_cost = calculate_avg_cost(model)
    
    return ModelListResponse(
        models=models,
        user_plan=user.plan,
        default_model=prefs.default_model if prefs else None
    )


@app.get("/v1/models/{model_id}", response_model=AIModel)
async def get_model(model_id: str):
    """Get details for a specific model"""
    model = await db.get_model(model_id)
    if not model:
        raise HTTPException(404, f"Model {model_id} not found")
    
    model.avg_conversation_cost = calculate_avg_cost(model)
    return model


# ============================================
# Chat
# ============================================

@app.post("/v1/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user)
):
    """Send a message and get AI response"""
    
    # Select model
    try:
        model = await model_selector.select_model(user, request)
    except Exception as e:
        raise HTTPException(400, str(e))
    
    # Estimate cost
    estimated_cost = await ai_gateway.estimate_cost(request.message, model)
    
    # Check cost warning
    prefs = await db.get_user_preferences(user.id)
    if prefs and prefs.cost_warning_threshold:
        if estimated_cost > prefs.cost_warning_threshold:
            # Return warning (requires confirmation flow)
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "warning": "high_cost",
                    "estimated_cost": float(estimated_cost),
                    "threshold": float(prefs.cost_warning_threshold)
                }
            )
    
    # Check credit balance (if using credits)
    if user.billing_type == "credits":
        if user.credit_balance < estimated_cost:
            # Try auto-downgrade?
            if prefs and prefs.auto_downgrade_on_low_credits:
                model = await model_selector.get_cheapest_available(user)
                estimated_cost = await ai_gateway.estimate_cost(request.message, model)
                
                if user.credit_balance < estimated_cost:
                    raise HTTPException(
                        status.HTTP_402_PAYMENT_REQUIRED,
                        detail={
                            "error": "insufficient_credits",
                            "balance": float(user.credit_balance),
                            "required": float(estimated_cost)
                        }
                    )
            else:
                raise HTTPException(
                    status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "insufficient_credits",
                        "balance": float(user.credit_balance),
                        "required": float(estimated_cost)
                    }
                )
    
    # Get or create conversation
    if request.conversation_id:
        conversation = await db.get_conversation(request.conversation_id)
        if not conversation or conversation.user_id != user.id:
            raise HTTPException(404, "Conversation not found")
    else:
        conversation = await db.create_conversation(
            user_id=user.id,
            source=request.source,
            context=request.context
        )
    
    # Get conversation history
    messages = await db.get_conversation_messages(conversation.id, limit=20)
    
    # Call AI
    try:
        response = await ai_gateway.complete(
            model=model,
            messages=messages,
            new_message=request.message,
            user=user,
            conversation_id=conversation.id
        )
    except Exception as e:
        raise HTTPException(500, f"AI request failed: {str(e)}")
    
    # Save messages
    user_message = await db.create_message(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    
    assistant_message = await db.create_message(
        conversation_id=conversation.id,
        role="assistant",
        content=response.content,
        usage_log_id=response.usage_log_id
    )
    
    # Deduct credits if applicable
    if user.billing_type == "credits":
        await db.deduct_credits(
            user_id=user.id,
            amount=response.cost,
            usage_log_id=response.usage_log_id
        )
    
    return ChatResponse(
        response=response.content,
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        model_used=model.id,
        model_tier=model.tier,
        tokens_used=response.total_tokens,
        cost_usd=response.cost
    )


@app.post("/v1/estimate-cost", response_model=CostEstimateResponse)
async def estimate_cost(
    request: CostEstimateRequest,
    user: User = Depends(get_current_user)
):
    """Estimate cost before sending a request"""
    
    model = await db.get_model(request.model)
    if not model:
        raise HTTPException(404, "Model not found")
    
    # Check access
    if not await model_selector.user_can_access(user, model):
        raise HTTPException(403, f"Your plan doesn't include {model.tier} tier models")
    
    estimated_cost = await ai_gateway.estimate_cost(request.message, model)
    estimated_tokens = estimate_tokens(request.message)
    
    return CostEstimateResponse(
        estimated_cost_usd=estimated_cost,
        estimated_tokens=estimated_tokens,
        model=model.id,
        confidence="medium"
    )


# ============================================
# Conversations
# ============================================

@app.get("/v1/conversations", response_model=List[Conversation])
async def list_conversations(
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """List user's conversations"""
    return await db.get_user_conversations(user.id, limit=limit, offset=offset)


@app.get("/v1/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    user: User = Depends(get_current_user)
):
    """Get conversation with messages"""
    
    conversation = await db.get_conversation(conversation_id)
    if not conversation or conversation.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    
    messages = await db.get_conversation_messages(conversation_id)
    total_cost = await db.get_conversation_cost(conversation_id)
    total_tokens = await db.get_conversation_tokens(conversation_id)
    
    return ConversationDetail(
        conversation=conversation,
        messages=messages,
        total_cost_usd=total_cost,
        total_tokens=total_tokens
    )


@app.delete("/v1/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    user: User = Depends(get_current_user)
):
    """Delete a conversation"""
    
    conversation = await db.get_conversation(conversation_id)
    if not conversation or conversation.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    
    await db.delete_conversation(conversation_id)
    return {"status": "deleted"}


# ============================================
# User Preferences
# ============================================

@app.get("/v1/preferences", response_model=UserPreferences)
async def get_preferences(user: User = Depends(get_current_user)):
    """Get user's AI preferences"""
    prefs = await db.get_user_preferences(user.id)
    if not prefs:
        # Create defaults
        prefs = await db.create_user_preferences(user.id)
    return prefs


@app.patch("/v1/preferences", response_model=UserPreferences)
async def update_preferences(
    request: UpdatePreferencesRequest,
    user: User = Depends(get_current_user)
):
    """Update user preferences"""
    
    # Validate model if provided
    if request.default_model:
        model = await db.get_model(request.default_model)
        if not model:
            raise HTTPException(400, f"Model {request.default_model} not found")
    
    prefs = await db.update_user_preferences(user.id, request)
    return prefs


# ============================================
# Usage & Analytics
# ============================================

@app.get("/v1/usage/summary", response_model=UsageSummary)
async def get_usage_summary(
    user: User = Depends(get_current_user),
    period: str = "current_month"
):
    """Get usage summary for a period"""
    return await db.get_usage_summary(user.id, period)


@app.get("/v1/usage/budget", response_model=BudgetStatus)
async def get_budget_status(user: User = Depends(get_current_user)):
    """Get monthly budget status"""
    return await db.get_budget_status(user.id)


@app.get("/v1/usage/logs", response_model=List[UsageLog])
async def get_usage_logs(
    user: User = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0
):
    """Get detailed usage logs"""
    return await db.get_usage_logs(user.id, limit=limit, offset=offset)


# ============================================
# Credits & Billing
# ============================================

@app.post("/v1/credits/purchase", response_model=PurchaseCreditsResponse)
async def purchase_credits(
    request: PurchaseCreditsRequest,
    user: User = Depends(get_current_user)
):
    """Purchase credit pack"""
    
    # TODO: Implement Stripe payment
    # For now, just add credits directly (testing)
    
    transaction = await db.add_credits(
        user_id=user.id,
        amount=request.amount_usd,
        type="purchase",
        description=f"Credit purchase: ${request.amount_usd}"
    )
    
    return PurchaseCreditsResponse(
        transaction_id=transaction.id,
        amount_usd=transaction.amount_usd,
        new_balance=transaction.balance_after
    )


@app.get("/v1/credits/balance", response_model=CreditBalance)
async def get_credit_balance(user: User = Depends(get_current_user)):
    """Get current credit balance"""
    
    balance = user.credit_balance
    transactions = await db.get_credit_transactions(user.id, limit=10)
    
    return CreditBalance(
        balance_usd=balance,
        recent_transactions=transactions
    )


# ============================================
# Invoices
# ============================================

@app.post("/v1/invoices/generate", response_model=InvoiceDetail)
async def generate_invoice(
    request: GenerateInvoiceRequest,
    user: User = Depends(get_current_user)
):
    """Generate custom invoice for a period"""
    
    # TODO: Implement invoice generation
    raise HTTPException(501, "Invoice generation not yet implemented")


@app.get("/v1/invoices", response_model=List[Invoice])
async def list_invoices(
    user: User = Depends(get_current_user),
    limit: int = 50
):
    """List user's invoices"""
    return await db.get_user_invoices(user.id, limit=limit)


# ============================================
# Helper Functions
# ============================================

def calculate_avg_cost(model: AIModel) -> Decimal:
    """Calculate average conversation cost for a model"""
    # Assume average: 5k input tokens, 2k output tokens
    avg_input_tokens = 5000
    avg_output_tokens = 2000
    
    cost = (
        (avg_input_tokens / 1_000_000) * model.price_input_usd +
        (avg_output_tokens / 1_000_000) * model.price_output_usd
    )
    
    # Apply 30% markup (TODO: Make configurable)
    return cost * Decimal("1.30")


def estimate_tokens(text: str) -> int:
    """Rough token estimation"""
    # ~1.3 tokens per word (rough estimate)
    words = len(text.split())
    return int(words * 1.3)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
