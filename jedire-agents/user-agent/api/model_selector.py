"""
JediRe User Agent - Model Selector
Smart model selection with cost optimization
"""

from typing import Optional
import re

from .models import User, ChatRequest, AIModel
from .database import Database


class ModelSelector:
    """Smart AI model selection"""
    
    def __init__(self, db: Database):
        self.db = db
    
    async def select_model(
        self,
        user: User,
        request: ChatRequest
    ) -> AIModel:
        """
        Select the best model for this request
        
        Priority:
        1. User's explicit choice (if allowed)
        2. User's tier selection
        3. User's default preference
        4. Smart selection based on query type
        5. Plan default
        """
        
        # 1. Explicit model choice
        if request.model:
            model = await self.db.get_model(request.model)
            if not model:
                raise ValueError(f"Model {request.model} not found")
            
            if not await self.user_can_access(user, model):
                raise ValueError(
                    f"Your {user.plan} plan doesn't include {model.tier} tier models. "
                    f"Upgrade to Pro for access."
                )
            
            return model
        
        # 2. Tier-based selection
        if request.tier:
            model = await self.get_best_in_tier(user, request.tier)
            if not model:
                raise ValueError(f"No {request.tier} tier models available for your plan")
            return model
        
        # 3. User's default preference
        prefs = await self.db.get_user_preferences(user.id)
        if prefs and prefs.default_model:
            model = await self.db.get_model(prefs.default_model)
            if model and await self.user_can_access(user, model):
                return model
        
        # 4. Smart selection based on query
        if await self.is_simple_query(request.message):
            # Use cheaper model for simple queries
            model = await self.get_cheapest_available(user)
            if model:
                return model
        
        if await self.is_complex_reasoning(request.message):
            # Use premium model if user has access
            model = await self.get_best_in_tier(user, "premium")
            if model:
                return model
        
        # 5. Plan default
        return await self.get_plan_default(user.plan)
    
    async def user_can_access(self, user: User, model: AIModel) -> bool:
        """Check if user can access this model"""
        
        # Check user preferences (tier restrictions)
        prefs = await self.db.get_user_preferences(user.id)
        if prefs and prefs.allowed_tiers:
            if model.tier not in prefs.allowed_tiers:
                return False
        
        # Check plan tier access
        if user.plan == "basic":
            # Basic: fast tier unlimited, standard limited, no premium
            if model.tier == "premium":
                return False
            # Could add token limits for standard tier here
        
        # Pro and Enterprise: all tiers
        return True
    
    async def get_best_in_tier(
        self,
        user: User,
        tier: str
    ) -> Optional[AIModel]:
        """Get best model in a tier that user can access"""
        
        models = await self.db.get_models_by_tier(tier)
        
        # Sort by quality (context window as proxy)
        models.sort(key=lambda m: m.context_window, reverse=True)
        
        for model in models:
            if await self.user_can_access(user, model):
                return model
        
        return None
    
    async def get_cheapest_available(self, user: User) -> Optional[AIModel]:
        """Get cheapest model user can access"""
        
        models = await self.db.get_active_models()
        
        # Filter by access
        accessible = []
        for model in models:
            if await self.user_can_access(user, model):
                accessible.append(model)
        
        if not accessible:
            return None
        
        # Sort by cost (input + output average)
        accessible.sort(
            key=lambda m: (m.price_input_usd * 5 + m.price_output_usd * 2) / 7
        )
        
        return accessible[0]
    
    async def get_plan_default(self, plan: str) -> AIModel:
        """Get default model for a plan"""
        
        defaults = {
            "basic": "claude-haiku-3-5",  # Fast tier
            "pro": "claude-sonnet-4-5",  # Standard tier
            "enterprise": "claude-sonnet-4-5"  # Standard tier (can upgrade to premium)
        }
        
        model_id = defaults.get(plan, "claude-sonnet-4-5")
        model = await self.db.get_model(model_id)
        
        if not model:
            # Fallback to any active model
            models = await self.db.get_active_models()
            if models:
                return models[0]
            raise ValueError("No models available")
        
        return model
    
    async def is_simple_query(self, message: str) -> bool:
        """
        Detect simple queries that don't need premium models
        
        Examples:
        - "What is cap rate?"
        - "How much is 2+2?"
        - "When does the market close?"
        - "List all deals in Atlanta"
        """
        
        simple_patterns = [
            r"^what is\s",
            r"^what\'s\s",
            r"^how much\s",
            r"^when\s",
            r"^where\s",
            r"^who\s",
            r"^list\s",
            r"^show\s",
            r"^give me\s",
        ]
        
        message_lower = message.lower().strip()
        
        for pattern in simple_patterns:
            if re.match(pattern, message_lower):
                return True
        
        # Short questions likely simple
        if len(message.split()) < 10 and message.endswith("?"):
            return True
        
        return False
    
    async def is_complex_reasoning(self, message: str) -> bool:
        """
        Detect queries that benefit from premium models
        
        Examples:
        - "Analyze this deal and compare to market..."
        - "Calculate ROI considering..."
        - "Evaluate the financial projections..."
        - "Recommend the best investment strategy..."
        """
        
        complex_keywords = [
            "analyze", "analyse",
            "compare",
            "evaluate",
            "assess",
            "recommend",
            "optimize",
            "calculate roi",
            "financial analysis",
            "due diligence",
            "investment strategy",
            "risk assessment",
            "valuation",
            "underwriting",
            "sensitivity analysis",
            "scenario planning",
        ]
        
        message_lower = message.lower()
        
        for keyword in complex_keywords:
            if keyword in message_lower:
                return True
        
        # Long, detailed queries likely complex
        if len(message.split()) > 50:
            return True
        
        return False
    
    async def suggest_model_upgrade(
        self,
        user: User,
        current_model: AIModel,
        message: str
    ) -> Optional[AIModel]:
        """
        Suggest a better model if query is complex
        Returns None if current model is appropriate
        """
        
        if current_model.tier == "premium":
            # Already using best
            return None
        
        if not await self.is_complex_reasoning(message):
            # Query doesn't need upgrade
            return None
        
        # Check if user has access to premium
        if current_model.tier == "standard":
            premium = await self.get_best_in_tier(user, "premium")
            if premium and await self.user_can_access(user, premium):
                return premium
        
        # Or upgrade from fast to standard
        if current_model.tier == "fast":
            standard = await self.get_best_in_tier(user, "standard")
            if standard and await self.user_can_access(user, standard):
                return standard
        
        return None
