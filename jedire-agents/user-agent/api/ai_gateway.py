"""
JediRe User Agent - AI Gateway
Wrapper for LLM calls with usage tracking
"""

import os
from typing import List, Dict, Any, Optional
from decimal import Decimal
from uuid import UUID
import anthropic
from dataclasses import dataclass

from .models import AIModel, User, Message
from .database import Database


@dataclass
class AIResponse:
    """AI response with usage info"""
    content: str
    total_tokens: int
    input_tokens: int
    output_tokens: int
    cost: Decimal
    usage_log_id: UUID


class AIGateway:
    """AI model gateway with usage tracking"""
    
    def __init__(self, db: Database):
        self.db = db
        self.anthropic_client = None
        
        # Initialize clients
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key:
            self.anthropic_client = anthropic.Anthropic(api_key=anthropic_key)
    
    async def complete(
        self,
        model: AIModel,
        messages: List[Message],
        new_message: str,
        user: User,
        conversation_id: UUID,
        session_id: Optional[str] = None
    ) -> AIResponse:
        """
        Complete a chat conversation
        
        Args:
            model: AI model to use
            messages: Previous messages in conversation
            new_message: New user message
            user: User making request
            conversation_id: Conversation ID
            session_id: Optional session ID
        
        Returns:
            AIResponse with content and usage info
        """
        
        # Format messages for API
        formatted_messages = []
        
        # Add previous messages
        for msg in messages:
            if msg.role in ["user", "assistant"]:
                formatted_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        # Add new message
        formatted_messages.append({
            "role": "user",
            "content": new_message
        })
        
        # Call appropriate provider
        if model.provider == "anthropic":
            response = await self._call_anthropic(model, formatted_messages)
        elif model.provider == "openai":
            response = await self._call_openai(model, formatted_messages)
        elif model.provider == "google":
            response = await self._call_google(model, formatted_messages)
        else:
            raise ValueError(f"Unsupported provider: {model.provider}")
        
        # Calculate costs
        provider_cost = self._calculate_provider_cost(
            model,
            response['input_tokens'],
            response['output_tokens']
        )
        
        # Apply markup (30% default)
        markup_percentage = Decimal(os.getenv("MARKUP_PERCENTAGE", "30"))
        stripe_cost = provider_cost * (Decimal("1") + markup_percentage / Decimal("100"))
        
        # Log usage
        usage_log = await self.db.create_usage_log(
            user_id=user.id,
            stripe_customer_id=user.stripe_customer_id,
            session_id=session_id or str(conversation_id),
            source="platform",  # TODO: Get from request
            model_id=model.id,
            model_tier=model.tier,
            prompt_tokens=response['input_tokens'],
            completion_tokens=response['output_tokens'],
            provider_cost_usd=provider_cost,
            stripe_cost_usd=stripe_cost,
            markup_percentage=markup_percentage,
            user_selected_model=True,  # TODO: Track if user explicitly chose
            request_metadata={
                "conversation_id": str(conversation_id),
                "message_length": len(new_message)
            },
            response_metadata={
                "response_length": len(response['content'])
            }
        )
        
        return AIResponse(
            content=response['content'],
            total_tokens=response['input_tokens'] + response['output_tokens'],
            input_tokens=response['input_tokens'],
            output_tokens=response['output_tokens'],
            cost=stripe_cost,
            usage_log_id=usage_log.id
        )
    
    async def _call_anthropic(
        self,
        model: AIModel,
        messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Call Anthropic Claude API"""
        
        if not self.anthropic_client:
            raise ValueError("Anthropic API key not configured")
        
        # System prompt
        system_prompt = """You are an AI assistant for JediRe, a commercial real estate investment platform.

Your role is to help users:
- Analyze real estate deals and investment opportunities
- Run financial models (ROI, cap rate, IRR, etc.)
- Compare properties and markets
- Understand CRE concepts and terminology
- Make informed investment decisions

Be professional, accurate, and helpful. If you're uncertain about financial calculations or advice, say so. Never guarantee investment returns or make legal/tax recommendations without appropriate disclaimers."""
        
        try:
            response = self.anthropic_client.messages.create(
                model=model.id,
                max_tokens=4096,
                system=system_prompt,
                messages=messages
            )
            
            return {
                'content': response.content[0].text,
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens
            }
        
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}")
    
    async def _call_openai(
        self,
        model: AIModel,
        messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Call OpenAI API"""
        # TODO: Implement OpenAI integration
        raise NotImplementedError("OpenAI integration not yet implemented")
    
    async def _call_google(
        self,
        model: AIModel,
        messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Call Google Gemini API"""
        # TODO: Implement Google integration
        raise NotImplementedError("Google Gemini integration not yet implemented")
    
    def _calculate_provider_cost(
        self,
        model: AIModel,
        input_tokens: int,
        output_tokens: int
    ) -> Decimal:
        """Calculate provider cost based on token usage"""
        
        input_cost = (Decimal(input_tokens) / Decimal(1_000_000)) * model.price_input_usd
        output_cost = (Decimal(output_tokens) / Decimal(1_000_000)) * model.price_output_usd
        
        return input_cost + output_cost
    
    async def estimate_cost(
        self,
        message: str,
        model: AIModel,
        conversation_history: Optional[List[Message]] = None
    ) -> Decimal:
        """
        Estimate cost for a message
        
        This is a rough estimate based on token counting.
        Actual cost will be determined after the API call.
        """
        
        # Rough token estimation
        # ~1.3 tokens per word for English text
        words = len(message.split())
        estimated_input_tokens = int(words * 1.3)
        
        # Add context from conversation history
        if conversation_history:
            for msg in conversation_history[-5:]:  # Last 5 messages
                estimated_input_tokens += int(len(msg.content.split()) * 1.3)
        
        # Assume average response length (~500 tokens)
        estimated_output_tokens = 500
        
        # Calculate provider cost
        provider_cost = self._calculate_provider_cost(
            model,
            estimated_input_tokens,
            estimated_output_tokens
        )
        
        # Apply markup
        markup_percentage = Decimal(os.getenv("MARKUP_PERCENTAGE", "30"))
        estimated_cost = provider_cost * (Decimal("1") + markup_percentage / Decimal("100"))
        
        return estimated_cost


class StripeAIGateway(AIGateway):
    """
    Stripe AI Gateway integration
    
    Once we have access to Stripe Token Billing preview,
    this will replace direct API calls with Stripe's AI Gateway
    which handles both LLM calls and billing in one request.
    """
    
    def __init__(self, db: Database):
        super().__init__(db)
        self.stripe_ai_gateway_enabled = False  # Enable when we have access
        
        # TODO: Initialize Stripe AI Gateway client
        # self.stripe_client = stripe.AIGateway(api_key=...)
    
    async def complete(
        self,
        model: AIModel,
        messages: List[Message],
        new_message: str,
        user: User,
        conversation_id: UUID,
        session_id: Optional[str] = None
    ) -> AIResponse:
        """
        Complete via Stripe AI Gateway if enabled,
        otherwise fall back to direct API calls
        """
        
        if self.stripe_ai_gateway_enabled:
            return await self._complete_via_stripe(
                model, messages, new_message, user, conversation_id, session_id
            )
        else:
            # Fall back to direct API calls
            return await super().complete(
                model, messages, new_message, user, conversation_id, session_id
            )
    
    async def _complete_via_stripe(
        self,
        model: AIModel,
        messages: List[Message],
        new_message: str,
        user: User,
        conversation_id: UUID,
        session_id: Optional[str] = None
    ) -> AIResponse:
        """
        Call LLM via Stripe AI Gateway
        
        Stripe handles:
        - Routing to the LLM provider
        - Tracking token usage
        - Billing the customer
        - Returning usage data
        
        We just:
        - Send the request
        - Log it to our database
        - Return the response
        """
        
        # TODO: Implement when we have Stripe Token Billing access
        # 
        # response = await stripe.ai_gateway.completions.create(
        #     model=model.id,
        #     messages=[...],
        #     customer=user.stripe_customer_id,
        #     metadata={
        #         "user_id": str(user.id),
        #         "conversation_id": str(conversation_id),
        #         "source": "platform"
        #     }
        # )
        # 
        # # Stripe returns:
        # # - response.content (the AI response)
        # # - response.usage.total_tokens
        # # - response.usage.cost (what they charged the customer)
        # 
        # # Log to our database for analytics
        # usage_log = await self.db.create_usage_log(...)
        # 
        # return AIResponse(...)
        
        raise NotImplementedError("Stripe AI Gateway not yet available")


# Factory function to get the right gateway
def get_ai_gateway(db: Database) -> AIGateway:
    """
    Get AI gateway instance
    
    Returns StripeAIGateway if available,
    otherwise standard AIGateway
    """
    
    stripe_enabled = os.getenv("STRIPE_AI_GATEWAY_ENABLED", "false").lower() == "true"
    
    if stripe_enabled:
        return StripeAIGateway(db)
    else:
        return AIGateway(db)
