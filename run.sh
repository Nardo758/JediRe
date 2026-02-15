#!/bin/bash
# JediRe One-Click Startup Script for Replit

set -e

echo "════════════════════════════════════════════════════════════"
echo "  🚀 JediRe - Real Estate Intelligence Platform"
echo "     Replit Edition - Simplified & Fast"
echo "════════════════════════════════════════════════════════════"
echo ""

# ============================================
# Step 1: Check Prerequisites
# ============================================
echo "📋 Step 1: Checking prerequisites..."

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set!"
    echo ""
    echo "Please add a PostgreSQL database in Replit:"
    echo "  1. Click 'Tools' → 'Database'"
    echo "  2. Create a PostgreSQL database"
    echo "  3. The DATABASE_URL will be automatically set"
    echo ""
    exit 1
fi

echo "  ✓ PostgreSQL database configured"
echo ""

# ============================================
# Step 2: Initialize Database
# ============================================
echo "📊 Step 2: Initializing database..."

# Check if tables exist
TABLE_CHECK=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users'")

if [ "$TABLE_CHECK" = "0" ]; then
    echo "  → Running database migrations..."
    chmod +x migrations/replit/init_db.sh
    bash migrations/replit/init_db.sh
else
    echo "  ✓ Database already initialized"
fi

echo ""

# ============================================
# Step 3: Setup Backend
# ============================================
echo "⚙️  Step 3: Setting up backend..."

cd backend

# Use Replit-specific package.json if it exists
if [ -f "package.replit.json" ]; then
    cp package.replit.json package.json
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  → Installing backend dependencies..."
    npm install --quiet
else
    echo "  ✓ Backend dependencies installed"
fi

# Create .env from template
if [ ! -f ".env" ]; then
    cp .env.replit .env
    echo "  → Created backend .env file"
fi

# Use Replit-specific index if it exists
if [ -f "src/index.replit.ts" ]; then
    cp src/index.replit.ts src/index.ts
fi

# Build backend
echo "  → Building backend..."
npm run build --quiet

cd ..
echo "  ✓ Backend ready"
echo ""

# ============================================
# Step 4: Setup Frontend
# ============================================
echo "🎨 Step 4: Setting up frontend..."

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  → Installing frontend dependencies..."
    npm install --quiet
else
    echo "  ✓ Frontend dependencies installed"
fi

# Create .env from template
if [ ! -f ".env" ]; then
    cp .env.replit .env
    echo "  → Created frontend .env file"
fi

# Use Replit-specific vite config if it exists
if [ -f "vite.config.replit.ts" ]; then
    cp vite.config.replit.ts vite.config.ts
fi

cd ..
echo "  ✓ Frontend ready"
echo ""

# ============================================
# Step 5: Setup Supply Agent (Optional)
# ============================================
echo "🤖 Step 5: Setting up supply agent..."

cd agents/supply

# Check if Python is available
if command -v python3 &> /dev/null; then
    # Install dependencies if needed
    if [ -f "requirements.replit.txt" ]; then
        # Detect if we're in Replit environment (skip venv, use Nix Python directly)
        if [ -n "$REPL_ID" ] || [ -n "$REPLIT_DB_URL" ]; then
            echo "  → Installing agent dependencies (Replit environment)..."
            pip install -r requirements.replit.txt
        else
            # Local/non-Replit: use virtualenv
            if [ ! -d "venv" ]; then
                echo "  → Creating Python virtual environment..."
                python3 -m venv venv
            fi
            
            source venv/bin/activate
            
            echo "  → Installing agent dependencies..."
            pip install -r requirements.replit.txt
        fi
        
        # Use Replit-specific files
        if [ -f "config/settings.replit.py" ]; then
            cp config/settings.replit.py config/settings.py
        fi
        
        if [ -f "src/main.replit.py" ]; then
            cp src/main.replit.py src/main.py
        fi
        
        echo "  ✓ Supply agent ready"
    fi
else
    echo "  ⚠️  Python not available, skipping agent setup"
fi

cd ../..
echo ""

# ============================================
# Step 6: Start Services
# ============================================
echo "🚀 Step 6: Starting services..."
echo ""

# Start backend in background
echo "  → Starting backend (port 4000)..."
cd backend
node dist/index.js &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend in background
echo "  → Starting frontend (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Start supply agent if Python available (in background)
if command -v python3 &> /dev/null; then
    echo "  → Starting supply agent..."
    cd agents/supply
    
    # Activate venv if it exists (local environment)
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    python src/main.py &
    AGENT_PID=$!
    cd ../..
fi

# ============================================
# Done!
# ============================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ JediRe is running!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  📡 Backend API:  http://localhost:4000"
echo "  🌐 Frontend UI:  http://localhost:3000"
echo "  ❤️  Health check: http://localhost:4000/health"
echo ""
echo "  Demo Login:"
echo "    Email: demo@jedire.com"
echo "    Password: demo123"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Handle shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    [ ! -z "$AGENT_PID" ] && kill $AGENT_PID 2>/dev/null || true
    echo "✓ All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep running
wait
