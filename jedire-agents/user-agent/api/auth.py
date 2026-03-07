"""
JediRe User Agent - Authentication
JWT-based authentication
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from .models import User
from .database import Database


# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days


# Database dependency
_db_instance: Optional[Database] = None

def set_database(db: Database):
    """Set global database instance"""
    global _db_instance
    _db_instance = db


async def get_database() -> Database:
    """Get database instance"""
    if not _db_instance:
        raise RuntimeError("Database not initialized. Call set_database() first.")
    return _db_instance


class AuthService:
    """Authentication service"""
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def create_access_token(
        data: dict,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token"""
        
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        return encoded_jwt
    
    @staticmethod
    def decode_access_token(token: str) -> dict:
        """Decode and verify JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Database = Depends(get_database)
) -> User:
    """
    Get current authenticated user from JWT token
    
    Usage in endpoints:
        @app.get("/protected")
        async def protected_route(user: User = Depends(get_current_user)):
            return {"user": user.email}
    """
    
    token = credentials.credentials
    
    # Decode token
    payload = AuthService.decode_access_token(token)
    
    # Extract user ID
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user = await db.get_user(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (alias for get_current_user)
    All users from get_current_user are already checked for active status
    """
    return current_user


# Optional: API key authentication (for external integrations)
class APIKeyAuth:
    """API key authentication for external integrations"""
    
    @staticmethod
    async def verify_api_key(
        api_key: str,
        db: Database
    ) -> User:
        """
        Verify API key and return associated user
        
        API keys can be stored in a separate table:
        - api_keys (id, user_id, key_hash, name, created_at, last_used_at, is_active)
        
        For now, we'll just use JWT tokens.
        """
        # TODO: Implement API key verification
        raise NotImplementedError("API key authentication not yet implemented")


# Helper functions for creating users and tokens

async def create_user_with_password(
    db: Database,
    email: str,
    password: str,
    name: Optional[str] = None,
    plan: str = "basic"
) -> tuple[User, str]:
    """
    Create a new user with password and return user + access token
    
    Note: Passwords are not in the current schema.
    This would require adding a password_hash column to users table.
    
    For now, we'll use passwordless auth (magic links, OAuth, etc.)
    """
    
    # TODO: Add password support to schema
    # password_hash = AuthService.get_password_hash(password)
    
    user = await db.create_user(
        email=email,
        name=name,
        plan=plan
    )
    
    # Create access token
    access_token = AuthService.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return user, access_token


async def authenticate_user(
    db: Database,
    email: str,
    password: str
) -> Optional[User]:
    """
    Authenticate user with email and password
    
    Returns user if credentials are valid, None otherwise
    """
    
    # TODO: Add password support to schema
    # user = await db.get_user_by_email(email)
    # if not user:
    #     return None
    # 
    # if not AuthService.verify_password(password, user.password_hash):
    #     return None
    # 
    # return user
    
    raise NotImplementedError("Password authentication not yet implemented")


# Magic link authentication (passwordless)

async def create_magic_link_token(email: str) -> str:
    """
    Create a magic link token for passwordless login
    
    Token contains:
    - email
    - short expiration (15 minutes)
    - type: "magic_link"
    """
    
    token = AuthService.create_access_token(
        data={
            "email": email,
            "type": "magic_link"
        },
        expires_delta=timedelta(minutes=15)
    )
    
    return token


async def verify_magic_link_token(
    token: str,
    db: Database
) -> tuple[User, str]:
    """
    Verify magic link token and return user + long-lived access token
    
    Returns:
        (user, access_token) - User object and new access token
    """
    
    # Decode token
    payload = AuthService.decode_access_token(token)
    
    # Verify it's a magic link token
    if payload.get("type") != "magic_link":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Get or create user
    user = await db.get_user_by_email(email)
    if not user:
        # Auto-create user on first login
        user = await db.create_user(email=email)
    
    # Create long-lived access token
    access_token = AuthService.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return user, access_token


# OAuth integration helpers (for JediRe platform SSO)

async def create_oauth_user(
    db: Database,
    email: str,
    name: Optional[str],
    oauth_provider: str,
    oauth_user_id: str,
    plan: str = "basic"
) -> tuple[User, str]:
    """
    Create user from OAuth login (e.g., JediRe platform SSO)
    
    Args:
        db: Database instance
        email: User's email
        name: User's name
        oauth_provider: Provider name (e.g., "jedire", "google", "github")
        oauth_user_id: User ID from OAuth provider
        plan: Initial plan tier
    
    Returns:
        (user, access_token) - User object and access token
    """
    
    # Check if user exists
    user = await db.get_user_by_email(email)
    
    if not user:
        # Create new user
        user = await db.create_user(
            email=email,
            name=name,
            plan=plan
        )
    
    # Create access token
    access_token = AuthService.create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "oauth_provider": oauth_provider
        }
    )
    
    return user, access_token


# Middleware for optional authentication

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Database = Depends(get_database)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise
    
    Use this for endpoints that work both authenticated and unauthenticated,
    but provide different features based on auth status.
    
    Usage:
        @app.get("/public-or-private")
        async def route(user: Optional[User] = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello {user.name}"}
            else:
                return {"message": "Hello guest"}
    """
    
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
