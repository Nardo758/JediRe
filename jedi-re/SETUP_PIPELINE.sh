#!/bin/bash
# JEDI RE - One-command pipeline setup
# Run this when you're back at your PC

echo "🚀 JEDI RE Pipeline Setup"
echo "========================="
echo ""

# Step 1: Install Python dependencies
echo "📦 Installing Python dependencies..."
sudo apt update
sudo apt install -y python3-pip python3-venv python3-geopandas python3-pandas

# Step 2: Create virtual environment
echo "🔧 Creating virtual environment..."
cd /home/leon/clawd/jedi-re
python3 -m venv venv
source venv/bin/activate

# Step 3: Install additional packages
echo "📥 Installing additional Python packages..."
pip install psycopg2-binary pyarrow

# Step 4: Test the pipeline
echo "✅ Testing pipeline configuration..."
python load_parcels.py test

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review test output above"
echo "  2. If all tests pass, run:"
echo "     source venv/bin/activate"
echo "     python load_parcels.py pipeline --pattern '*.geojson' --limit 1000"
echo ""
