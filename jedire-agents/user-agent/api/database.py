"""
JediRe User Agent - Database Layer
AsyncPG implementation with connection pooling
"""

import asyncpg
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import UUID
import os
import json

from .models import (
    AIModel, User, UserPreferences, UsageLog, Conversation, Message,
    CreditTransaction, Invoice, InvoiceLineItem, UpdatePreferencesRequest,
    UsageSummary, BudgetStatus
)


class Database:
    """Database connection and operations"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://localhost/jedire_agent"
        )
    
    async def connect(self):
        """Create connection pool"""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        print(f"✅ Database connected: {self.pool.get_size()} connections")
    
    async def disconnect(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            print("👋 Database disconnected")
    
    async def check_health(self) -> bool:
        """Health check"""
        try:
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception as e:
            print(f"❌ Database health check failed: {e}")
            return False
    
    # ============================================
    # AI Models
    # ============================================
    
    async def get_active_models(self) -> List[AIModel]:
        """Get all active models"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM ai_models 
                WHERE is_active = true 
                ORDER BY tier, price_input_usd
                """
            )
            return [AIModel(**dict(row)) for row in rows]
    
    async def get_model(self, model_id: str) -> Optional[AIModel]:
        """Get model by ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM ai_models WHERE id = $1",
                model_id
            )
            return AIModel(**dict(row)) if row else None
    
    async def get_models_by_tier(self, tier: str) -> List[AIModel]:
        """Get all models in a tier"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM ai_models 
                WHERE tier = $1 AND is_active = true
                ORDER BY price_input_usd
                """,
                tier
            )
            return [AIModel(**dict(row)) for row in rows]
    
    async def count_active_models(self) -> int:
        """Count active models"""
        async with self.pool.acquire() as conn:
            return await conn.fetchval(
                "SELECT COUNT(*) FROM ai_models WHERE is_active = true"
            )
    
    # ============================================
    # Users
    # ============================================
    
    async def get_user(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1",
                user_id
            )
            return User(**dict(row)) if row else None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1",
                email
            )
            return User(**dict(row)) if row else None
    
    async def get_user_by_stripe_id(self, stripe_customer_id: str) -> Optional[User]:
        """Get user by Stripe customer ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE stripe_customer_id = $1",
                stripe_customer_id
            )
            return User(**dict(row)) if row else None
    
    async def create_user(
        self,
        email: str,
        name: Optional[str] = None,
        stripe_customer_id: Optional[str] = None,
        plan: str = "basic"
    ) -> User:
        """Create new user"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO users (email, name, stripe_customer_id, plan)
                VALUES ($1, $2, $3, $4)
                RETURNING *
                """,
                email, name, stripe_customer_id, plan
            )
            return User(**dict(row))
    
    async def update_user_credits(self, user_id: UUID, new_balance: Decimal):
        """Update user credit balance"""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET credit_balance = $1, updated_at = NOW() WHERE id = $2",
                new_balance, user_id
            )
    
    async def count_users(self) -> int:
        """Count total users"""
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM users")
    
    # ============================================
    # User Preferences
    # ============================================
    
    async def get_user_preferences(self, user_id: UUID) -> Optional[UserPreferences]:
        """Get user AI preferences"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM user_ai_preferences WHERE user_id = $1",
                user_id
            )
            return UserPreferences(**dict(row)) if row else None
    
    async def create_user_preferences(self, user_id: UUID) -> UserPreferences:
        """Create default preferences for user"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO user_ai_preferences (user_id)
                VALUES ($1)
                RETURNING *
                """,
                user_id
            )
            return UserPreferences(**dict(row))
    
    async def update_user_preferences(
        self,
        user_id: UUID,
        updates: UpdatePreferencesRequest
    ) -> UserPreferences:
        """Update user preferences"""
        
        # Build dynamic update query
        fields = []
        values = []
        idx = 1
        
        update_dict = updates.dict(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                fields.append(f"{key} = ${idx}")
                values.append(value)
                idx += 1
        
        if not fields:
            # No updates
            return await self.get_user_preferences(user_id)
        
        fields.append(f"updated_at = ${idx}")
        values.append(datetime.now())
        idx += 1
        
        values.append(user_id)  # For WHERE clause
        
        query = f"""
            UPDATE user_ai_preferences 
            SET {', '.join(fields)}
            WHERE user_id = ${idx}
            RETURNING *
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)
            return UserPreferences(**dict(row))
    
    # ============================================
    # Conversations & Messages
    # ============================================
    
    async def create_conversation(
        self,
        user_id: UUID,
        source: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Conversation:
        """Create new conversation"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO conversations (user_id, source, context)
                VALUES ($1, $2, $3)
                RETURNING *
                """,
                user_id, source, json.dumps(context) if context else None
            )
            return Conversation(**dict(row))
    
    async def get_conversation(self, conversation_id: UUID) -> Optional[Conversation]:
        """Get conversation by ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM conversations WHERE id = $1",
                conversation_id
            )
            return Conversation(**dict(row)) if row else None
    
    async def get_user_conversations(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[Conversation]:
        """Get user's conversations"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT c.*, COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON m.conversation_id = c.id
                WHERE c.user_id = $1
                GROUP BY c.id
                ORDER BY c.last_message_at DESC
                LIMIT $2 OFFSET $3
                """,
                user_id, limit, offset
            )
            return [Conversation(**dict(row)) for row in rows]
    
    async def delete_conversation(self, conversation_id: UUID):
        """Delete conversation (cascades to messages)"""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM conversations WHERE id = $1",
                conversation_id
            )
    
    async def count_active_conversations(self) -> int:
        """Count active conversations in last 24 hours"""
        async with self.pool.acquire() as conn:
            return await conn.fetchval(
                """
                SELECT COUNT(*) FROM conversations 
                WHERE last_message_at > NOW() - INTERVAL '24 hours'
                """
            )
    
    async def create_message(
        self,
        conversation_id: UUID,
        role: str,
        content: str,
        usage_log_id: Optional[UUID] = None
    ) -> Message:
        """Create message in conversation"""
        async with self.pool.acquire() as conn:
            # Create message
            row = await conn.fetchrow(
                """
                INSERT INTO messages (conversation_id, role, content, usage_log_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
                """,
                conversation_id, role, content, usage_log_id
            )
            
            # Update conversation last_message_at
            await conn.execute(
                "UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1",
                conversation_id
            )
            
            return Message(**dict(row))
    
    async def get_conversation_messages(
        self,
        conversation_id: UUID,
        limit: Optional[int] = None
    ) -> List[Message]:
        """Get messages in conversation"""
        async with self.pool.acquire() as conn:
            if limit:
                rows = await conn.fetch(
                    """
                    SELECT * FROM messages 
                    WHERE conversation_id = $1 
                    ORDER BY created_at DESC 
                    LIMIT $2
                    """,
                    conversation_id, limit
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT * FROM messages 
                    WHERE conversation_id = $1 
                    ORDER BY created_at ASC
                    """,
                    conversation_id
                )
            return [Message(**dict(row)) for row in rows]
    
    async def get_conversation_cost(self, conversation_id: UUID) -> Decimal:
        """Get total cost for conversation"""
        async with self.pool.acquire() as conn:
            cost = await conn.fetchval(
                """
                SELECT COALESCE(SUM(ul.stripe_cost_usd), 0)
                FROM messages m
                JOIN usage_logs ul ON ul.id = m.usage_log_id
                WHERE m.conversation_id = $1
                """,
                conversation_id
            )
            return Decimal(str(cost)) if cost else Decimal(0)
    
    async def get_conversation_tokens(self, conversation_id: UUID) -> int:
        """Get total tokens for conversation"""
        async with self.pool.acquire() as conn:
            tokens = await conn.fetchval(
                """
                SELECT COALESCE(SUM(ul.total_tokens), 0)
                FROM messages m
                JOIN usage_logs ul ON ul.id = m.usage_log_id
                WHERE m.conversation_id = $1
                """,
                conversation_id
            )
            return tokens or 0
    
    # ============================================
    # Usage Logs
    # ============================================
    
    async def create_usage_log(
        self,
        user_id: UUID,
        stripe_customer_id: Optional[str],
        session_id: Optional[str],
        source: str,
        model_id: str,
        model_tier: str,
        prompt_tokens: int,
        completion_tokens: int,
        provider_cost_usd: Decimal,
        stripe_cost_usd: Optional[Decimal] = None,
        markup_percentage: Optional[Decimal] = None,
        user_selected_model: bool = False,
        request_metadata: Optional[Dict] = None,
        response_metadata: Optional[Dict] = None
    ) -> UsageLog:
        """Create usage log entry"""
        
        total_tokens = prompt_tokens + completion_tokens
        
        # Calculate markup
        if stripe_cost_usd is None:
            stripe_cost_usd = provider_cost_usd * Decimal("1.30")  # Default 30%
        
        our_markup_usd = stripe_cost_usd - provider_cost_usd
        
        if markup_percentage is None:
            markup_percentage = (our_markup_usd / provider_cost_usd * 100) if provider_cost_usd > 0 else Decimal(0)
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO usage_logs (
                    user_id, stripe_customer_id, session_id, source,
                    model_id, model_tier, prompt_tokens, completion_tokens, total_tokens,
                    provider_cost_usd, stripe_cost_usd, our_markup_usd, markup_percentage,
                    user_selected_model, request_metadata, response_metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
                """,
                user_id, stripe_customer_id, session_id, source,
                model_id, model_tier, prompt_tokens, completion_tokens, total_tokens,
                provider_cost_usd, stripe_cost_usd, our_markup_usd, markup_percentage,
                user_selected_model,
                json.dumps(request_metadata) if request_metadata else None,
                json.dumps(response_metadata) if response_metadata else None
            )
            return UsageLog(**dict(row))
    
    async def get_usage_logs(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[UsageLog]:
        """Get user's usage logs"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM usage_logs 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2 OFFSET $3
                """,
                user_id, limit, offset
            )
            return [UsageLog(**dict(row)) for row in rows]
    
    async def count_requests_today(self) -> int:
        """Count requests today"""
        async with self.pool.acquire() as conn:
            return await conn.fetchval(
                """
                SELECT COUNT(*) FROM usage_logs 
                WHERE DATE(created_at) = CURRENT_DATE
                """
            )
    
    async def sum_tokens_today(self) -> int:
        """Sum tokens today"""
        async with self.pool.acquire() as conn:
            total = await conn.fetchval(
                """
                SELECT COALESCE(SUM(total_tokens), 0) FROM usage_logs 
                WHERE DATE(created_at) = CURRENT_DATE
                """
            )
            return total or 0
    
    async def get_usage_summary(self, user_id: UUID, period: str = "current_month") -> UsageSummary:
        """Get usage summary for period"""
        
        # Determine date range
        if period == "current_month":
            start_date = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.now()
        elif period == "last_30_days":
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
        else:
            # Default to current month
            start_date = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.now()
        
        async with self.pool.acquire() as conn:
            # Overall stats
            stats = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_requests,
                    COALESCE(SUM(total_tokens), 0) as total_tokens,
                    COALESCE(SUM(stripe_cost_usd), 0) as total_cost,
                    COALESCE(AVG(total_tokens), 0) as avg_tokens,
                    COALESCE(AVG(stripe_cost_usd), 0) as avg_cost
                FROM usage_logs
                WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
                """,
                user_id, start_date, end_date
            )
            
            # By model
            by_model_rows = await conn.fetch(
                """
                SELECT 
                    model_id,
                    COUNT(*) as requests,
                    SUM(total_tokens) as tokens,
                    SUM(stripe_cost_usd) as cost
                FROM usage_logs
                WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
                GROUP BY model_id
                """,
                user_id, start_date, end_date
            )
            by_model = {
                row['model_id']: {
                    'requests': row['requests'],
                    'tokens': row['tokens'],
                    'cost': float(row['cost'])
                }
                for row in by_model_rows
            }
            
            # By source
            by_source_rows = await conn.fetch(
                """
                SELECT 
                    source,
                    COUNT(*) as requests,
                    SUM(total_tokens) as tokens,
                    SUM(stripe_cost_usd) as cost
                FROM usage_logs
                WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
                GROUP BY source
                """,
                user_id, start_date, end_date
            )
            by_source = {
                row['source']: {
                    'requests': row['requests'],
                    'tokens': row['tokens'],
                    'cost': float(row['cost'])
                }
                for row in by_source_rows
            }
            
            # By tier
            by_tier_rows = await conn.fetch(
                """
                SELECT 
                    model_tier,
                    COUNT(*) as requests,
                    SUM(total_tokens) as tokens,
                    SUM(stripe_cost_usd) as cost
                FROM usage_logs
                WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
                GROUP BY model_tier
                """,
                user_id, start_date, end_date
            )
            by_tier = {
                row['model_tier']: {
                    'requests': row['requests'],
                    'tokens': row['tokens'],
                    'cost': float(row['cost'])
                }
                for row in by_tier_rows
            }
        
        return UsageSummary(
            period=period,
            start_date=start_date.date(),
            end_date=end_date.date(),
            total_requests=stats['total_requests'],
            total_tokens=stats['total_tokens'],
            total_cost_usd=Decimal(str(stats['total_cost'])),
            avg_tokens_per_request=int(stats['avg_tokens']),
            avg_cost_per_request=Decimal(str(stats['avg_cost'])),
            by_model=by_model,
            by_source=by_source,
            by_tier=by_tier
        )
    
    async def get_budget_status(self, user_id: UUID) -> BudgetStatus:
        """Get monthly budget status"""
        
        # Get user preferences
        prefs = await self.get_user_preferences(user_id)
        
        if not prefs or not prefs.monthly_budget_usd:
            return BudgetStatus(
                budget_enabled=False,
                spent_usd=Decimal(0)
            )
        
        # Calculate month-to-date spending
        month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        async with self.pool.acquire() as conn:
            spent = await conn.fetchval(
                """
                SELECT COALESCE(SUM(stripe_cost_usd), 0)
                FROM usage_logs
                WHERE user_id = $1 AND created_at >= $2
                """,
                user_id, month_start
            )
        
        spent_usd = Decimal(str(spent))
        budget = prefs.monthly_budget_usd
        remaining = budget - spent_usd
        percentage_used = float(spent_usd / budget * 100) if budget > 0 else 0
        
        # Calculate projections
        days_in_month = (month_start.replace(month=month_start.month + 1) - timedelta(days=1)).day
        current_day = datetime.now().day
        days_remaining = days_in_month - current_day
        
        daily_avg = spent_usd / current_day if current_day > 0 else Decimal(0)
        projected_total = daily_avg * days_in_month
        on_track = projected_total <= budget
        
        # Generate warnings
        warnings = []
        if percentage_used > 90:
            warnings.append("You've used 90% of your monthly budget")
        if projected_total > budget * Decimal("1.2"):
            warnings.append(f"Projected to exceed budget by ${projected_total - budget:.2f}")
        if percentage_used > 50 and current_day < 15:
            warnings.append("You're using budget faster than expected")
        
        return BudgetStatus(
            budget_enabled=True,
            budget_usd=budget,
            spent_usd=spent_usd,
            remaining_usd=remaining,
            percentage_used=percentage_used,
            days_remaining=days_remaining,
            projected_total_usd=projected_total,
            on_track=on_track,
            warnings=warnings
        )
    
    # ============================================
    # Credits
    # ============================================
    
    async def add_credits(
        self,
        user_id: UUID,
        amount: Decimal,
        type: str,
        description: Optional[str] = None,
        usage_log_id: Optional[UUID] = None,
        stripe_payment_intent_id: Optional[str] = None
    ) -> CreditTransaction:
        """Add credits to user account"""
        
        user = await self.get_user(user_id)
        balance_before = user.credit_balance
        balance_after = balance_before + amount
        
        async with self.pool.acquire() as conn:
            # Create transaction
            row = await conn.fetchrow(
                """
                INSERT INTO credit_transactions (
                    user_id, amount_usd, type, balance_before, balance_after,
                    description, usage_log_id, stripe_payment_intent_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
                """,
                user_id, amount, type, balance_before, balance_after,
                description, usage_log_id, stripe_payment_intent_id
            )
            
            # Update user balance
            await self.update_user_credits(user_id, balance_after)
            
            return CreditTransaction(**dict(row))
    
    async def deduct_credits(
        self,
        user_id: UUID,
        amount: Decimal,
        usage_log_id: Optional[UUID] = None
    ) -> CreditTransaction:
        """Deduct credits for usage"""
        return await self.add_credits(
            user_id=user_id,
            amount=-amount,
            type="usage",
            description=f"AI usage",
            usage_log_id=usage_log_id
        )
    
    async def get_credit_transactions(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[CreditTransaction]:
        """Get user's credit transactions"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM credit_transactions 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2
                """,
                user_id, limit
            )
            return [CreditTransaction(**dict(row)) for row in rows]
    
    # ============================================
    # Invoices
    # ============================================
    
    async def get_user_invoices(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[Invoice]:
        """Get user's invoices"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM invoices 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2
                """,
                user_id, limit
            )
            return [Invoice(**dict(row)) for row in rows]
