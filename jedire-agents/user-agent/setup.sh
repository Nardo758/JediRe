#!/bin/bash
# JediRe User Agent - Setup Script

set -e

echo "🚀 JediRe User Agent Setup"
echo "=========================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Please install it:"
    echo "   Ubuntu/Debian: sudo apt-get install postgresql"
    echo "   macOS: brew install postgresql"
    echo ""
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt
echo "✅ Dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your API keys!"
    echo ""
fi

# Database setup
echo ""
echo "📊 Database Setup"
echo "================="
read -p "Do you want to set up the database now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Database name (default: jedire_agent): " DB_NAME
    DB_NAME=${DB_NAME:-jedire_agent}
    
    echo "Creating database: $DB_NAME"
    
    # Check if database exists
    if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo "⚠️  Database $DB_NAME already exists"
        read -p "Do you want to drop and recreate it? This will DELETE ALL DATA! (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            dropdb "$DB_NAME" || true
            createdb "$DB_NAME"
            echo "✅ Database recreated"
        fi
    else
        createdb "$DB_NAME"
        echo "✅ Database created"
    fi
    
    # Run schema
    echo "📊 Running schema..."
    psql "$DB_NAME" < db/schema.sql
    echo "✅ Schema applied"
    
    # Update .env
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=postgresql://localhost/$DB_NAME|" .env
    echo "✅ .env updated with database URL"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run: source venv/bin/activate"
echo "3. Run: uvicorn api.main:app --reload"
echo "4. Open: http://localhost:8000/docs"
echo ""
