"""
JediRe User Agent - AI Gateway
Wrapper for LLM calls with usage tracking and tool calling
"""

import os
from typing import List, Dict, Any, Optional
from decimal import Decimal
from uuid import UUID
from pathlib import Path
import json
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


def _load_system_prompt() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "system.md"
    if prompt_path.exists():
        return prompt_path.read_text()
    return """You are an AI assistant for JediRe, a commercial real estate investment platform.

Your role is to help users:
- Analyze real estate deals and investment opportunities
- Run financial models (ROI, cap rate, IRR, etc.)
- Compare properties and markets
- Understand CRE concepts and terminology
- Make informed investment decisions

Be professional, accurate, and helpful. If you're uncertain about financial calculations or advice, say so. Never guarantee investment returns or make legal/tax recommendations without appropriate disclaimers."""


def _load_tools_module():
    try:
        from ..integrations.jedire_tools import AVAILABLE_TOOLS
        return AVAILABLE_TOOLS
    except (ImportError, ValueError):
        pass
    try:
        import importlib
        mod = importlib.import_module("integrations.jedire_tools")
        return mod.AVAILABLE_TOOLS
    except (ImportError, ModuleNotFoundError):
        pass
    try:
        import sys
        tools_dir = str(Path(__file__).parent.parent / "integrations")
        if tools_dir not in sys.path:
            sys.path.insert(0, tools_dir)
        from jedire_tools import AVAILABLE_TOOLS
        return AVAILABLE_TOOLS
    except (ImportError, ModuleNotFoundError):
        return []


def _build_anthropic_tools() -> List[Dict[str, Any]]:
    available = _load_tools_module()
    tools = []
    for tool_def in available:
        tools.append({
            "name": tool_def["name"],
            "description": tool_def["description"],
            "input_schema": tool_def["parameters"]
        })
    return tools


def _get_tool_function(name: str):
    available = _load_tools_module()
    for tool_def in available:
        if tool_def["name"] == name:
            return tool_def["function"]
    return None


SYSTEM_PROMPT = _load_system_prompt()
ANTHROPIC_TOOLS = _build_anthropic_tools()


class AIGateway:
    """AI model gateway with usage tracking and tool calling"""
    
    def __init__(self, db: Database):
        self.db = db
        self.anthropic_client = None
        
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
        formatted_messages = []
        
        for msg in messages:
            if msg.role in ["user", "assistant"]:
                formatted_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        formatted_messages.append({
            "role": "user",
            "content": new_message
        })
        
        if model.provider == "anthropic":
            response = await self._call_anthropic(model, formatted_messages)
        elif model.provider == "openai":
            response = await self._call_openai(model, formatted_messages)
        elif model.provider == "google":
            response = await self._call_google(model, formatted_messages)
        else:
            raise ValueError(f"Unsupported provider: {model.provider}")
        
        provider_cost = self._calculate_provider_cost(
            model,
            response['input_tokens'],
            response['output_tokens']
        )
        
        markup_percentage = Decimal(os.getenv("MARKUP_PERCENTAGE", "30"))
        stripe_cost = provider_cost * (Decimal("1") + markup_percentage / Decimal("100"))
        
        usage_log = await self.db.create_usage_log(
            user_id=user.id,
            stripe_customer_id=user.stripe_customer_id,
            session_id=session_id or str(conversation_id),
            source="platform",
            model_id=model.id,
            model_tier=model.tier,
            prompt_tokens=response['input_tokens'],
            completion_tokens=response['output_tokens'],
            provider_cost_usd=provider_cost,
            stripe_cost_usd=stripe_cost,
            markup_percentage=markup_percentage,
            user_selected_model=True,
            request_metadata={
                "conversation_id": str(conversation_id),
                "message_length": len(new_message)
            },
            response_metadata={
                "response_length": len(response['content']),
                "tools_used": response.get('tools_used', [])
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
        """Call Anthropic Claude API with tool calling support"""
        
        if not self.anthropic_client:
            raise ValueError("Anthropic API key not configured")
        
        api_kwargs = {
            "model": model.id,
            "max_tokens": 4096,
            "system": SYSTEM_PROMPT,
            "messages": messages
        }
        
        if ANTHROPIC_TOOLS:
            api_kwargs["tools"] = ANTHROPIC_TOOLS
        
        total_input_tokens = 0
        total_output_tokens = 0
        tools_used = []
        
        try:
            response = self.anthropic_client.messages.create(**api_kwargs)
            total_input_tokens += response.usage.input_tokens
            total_output_tokens += response.usage.output_tokens
            
            max_tool_rounds = 5
            round_count = 0
            
            while response.stop_reason == "tool_use" and round_count < max_tool_rounds:
                round_count += 1
                
                tool_use_blocks = [
                    block for block in response.content
                    if block.type == "tool_use"
                ]
                
                if not tool_use_blocks:
                    break
                
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                
                tool_results = []
                for tool_block in tool_use_blocks:
                    tool_name = tool_block.name
                    tool_input = tool_block.input
                    tool_id = tool_block.id
                    tools_used.append(tool_name)
                    
                    tool_fn = _get_tool_function(tool_name)
                    if tool_fn:
                        try:
                            result_text = await tool_fn(**tool_input)
                        except Exception as e:
                            result_text = f"Tool error: {str(e)}"
                    else:
                        result_text = f"Unknown tool: {tool_name}"
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result_text
                    })
                
                messages.append({
                    "role": "user",
                    "content": tool_results
                })
                
                response = self.anthropic_client.messages.create(**api_kwargs | {"messages": messages})
                total_input_tokens += response.usage.input_tokens
                total_output_tokens += response.usage.output_tokens
            
            final_text = ""
            for block in response.content:
                if hasattr(block, 'text'):
                    final_text += block.text
            
            return {
                'content': final_text,
                'input_tokens': total_input_tokens,
                'output_tokens': total_output_tokens,
                'tools_used': tools_used
            }
        
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}")
    
    async def _call_openai(
        self,
        model: AIModel,
        messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Call OpenAI API"""
        raise NotImplementedError("OpenAI integration not yet implemented")
    
    async def _call_google(
        self,
        model: AIModel,
        messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Call Google Gemini API"""
        raise NotImplementedError("Google Gemini integration not yet implemented")
    
    def _calculate_provider_cost(
        self,
        model: AIModel,
        input_tokens: int,
        output_tokens: int
    ) -> Decimal:
        input_cost = (Decimal(input_tokens) / Decimal(1_000_000)) * model.price_input_usd
        output_cost = (Decimal(output_tokens) / Decimal(1_000_000)) * model.price_output_usd
        return input_cost + output_cost
    
    async def estimate_cost(
        self,
        message: str,
        model: AIModel,
        conversation_history: Optional[List[Message]] = None
    ) -> Decimal:
        words = len(message.split())
        estimated_input_tokens = int(words * 1.3)
        
        if conversation_history:
            for msg in conversation_history[-5:]:
                estimated_input_tokens += int(len(msg.content.split()) * 1.3)
        
        estimated_output_tokens = 500
        
        provider_cost = self._calculate_provider_cost(
            model,
            estimated_input_tokens,
            estimated_output_tokens
        )
        
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
        self.stripe_ai_gateway_enabled = False
    
    async def complete(
        self,
        model: AIModel,
        messages: List[Message],
        new_message: str,
        user: User,
        conversation_id: UUID,
        session_id: Optional[str] = None
    ) -> AIResponse:
        if self.stripe_ai_gateway_enabled:
            return await self._complete_via_stripe(
                model, messages, new_message, user, conversation_id, session_id
            )
        else:
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
        raise NotImplementedError("Stripe AI Gateway not yet available")


def get_ai_gateway(db: Database) -> AIGateway:
    stripe_enabled = os.getenv("STRIPE_AI_GATEWAY_ENABLED", "false").lower() == "true"
    if stripe_enabled:
        return StripeAIGateway(db)
    else:
        return AIGateway(db)
