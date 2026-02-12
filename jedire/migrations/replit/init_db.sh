#!/bin/bash
# Simple database initialization script for Replit

set -e

echo "🚀 JediRe Database Initialization for Replit"
echo "=============================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please add PostgreSQL database in Replit and set DATABASE_URL"
    exit 1
fi

echo "✓ Database URL found"
echo ""

# Run migrations
echo "📝 Running migrations..."
echo ""

# Migration 1: Core setup
echo "  → Running 001_core_simple.sql..."
psql "$DATABASE_URL" -f /home/runner/$REPL_SLUG/migrations/replit/001_core_simple.sql

echo ""
echo "✅ Database initialization complete!"
echo ""
echo "Demo credentials:"
echo "  Email: demo@jedire.com"
echo "  Password: demo123"
echo ""
