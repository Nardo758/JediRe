#!/bin/bash
# Quick Python Dependencies Installation Script

set -e

echo "🐍 JEDI RE Python Dependencies Installer"
echo "========================================="
echo ""

# Navigate to correct directory
cd "$(dirname "$0")"

echo "📍 Current directory: $(pwd)"
echo ""

# Check Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python3 first:"
    echo "   sudo apt update && sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

echo "✅ Python3 found: $(python3 --version)"
echo ""

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi
echo ""

# Activate venv
echo "🔄 Activating virtual environment..."
source venv/bin/activate
echo "✅ Virtual environment activated"
echo ""

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip -q
echo "✅ pip upgraded"
echo ""

# Install dependencies
echo "📥 Installing dependencies from requirements.txt..."
echo "   (This may take 2-3 minutes...)"
pip install -r requirements.txt -q
echo "✅ All dependencies installed!"
echo ""

# Verify installation
echo "🧪 Verifying installation..."
python -c "import fastapi, sqlalchemy, numpy, scipy; print('✅ Core dependencies verified!')"
echo ""

echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Run migrations: alembic upgrade head"
echo "  2. Test services: python test_development_capacity.py"
echo "  3. Deploy admin panel"
echo ""
echo "To activate venv in future sessions:"
echo "  source ~/clawd/jedire/backend/python-services/venv/bin/activate"
