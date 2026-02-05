#!/bin/bash
################################################################################
# JediRe - Automated Replit Deployment Script
# 
# This script automates the setup process for deploying JediRe on Replit
# 
# Usage: bash replit-deploy.sh
################################################################################

set -e # Exit on error

echo "🚀 JediRe - Replit Deployment"
echo "=============================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on Replit
if [ -z "$REPL_SLUG" ]; then
    print_warning "Not running on Replit - some features may not work"
fi

echo "Step 1: Checking environment..."
echo "--------------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found! Please install Node.js 18+"
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python installed: $PYTHON_VERSION"
else
    print_error "Python3 not found! Please install Python 3.8+"
    exit 1
fi

# Check pip
if command -v pip &> /dev/null || command -v pip3 &> /dev/null; then
    print_success "pip installed"
else
    print_error "pip not found! Please install pip"
    exit 1
fi

echo ""
echo "Step 2: Installing Node.js dependencies..."
echo "-------------------------------------------"

cd backend || exit 1

if [ ! -f "package.json" ]; then
    print_error "package.json not found in backend/"
    exit 1
fi

print_info "Running npm install..."
npm install

if [ $? -eq 0 ]; then
    print_success "Node.js dependencies installed"
else
    print_error "npm install failed"
    exit 1
fi

echo ""
echo "Step 3: Installing Python dependencies..."
echo "------------------------------------------"

cd python-services || exit 1

print_info "Installing Python packages..."

# Create requirements file if not exists
if [ ! -f "requirements.txt" ]; then
    cat > requirements.txt << EOF
geopandas>=0.14.0
shapely>=2.0.0
pandas>=2.0.0
numpy>=1.24.0
tqdm>=4.65.0
psycopg2-binary>=2.9.0
EOF
    print_info "Created requirements.txt"
fi

# Install packages
pip install -r requirements.txt --quiet

if [ $? -eq 0 ]; then
    print_success "Python dependencies installed"
else
    print_warning "Some Python packages may have failed to install"
fi

cd ..
cd ..

echo ""
echo "Step 4: Checking environment variables..."
echo "------------------------------------------"

# Check required secrets
MISSING_SECRETS=false

if [ -z "$JWT_SECRET" ]; then
    print_warning "JWT_SECRET not set - authentication will not work"
    MISSING_SECRETS=true
fi

if [ -z "$CORS_ORIGIN" ]; then
    print_warning "CORS_ORIGIN not set - using default"
    export CORS_ORIGIN="http://localhost:3000"
fi

if [ -z "$DATABASE_URL" ]; then
    print_info "DATABASE_URL not set - running without database (capacity analysis will still work)"
fi

if [ "$MISSING_SECRETS" = true ]; then
    echo ""
    print_warning "Some environment variables are missing. Add them in Replit Secrets:"
    echo "  1. Click the 🔒 icon in the sidebar"
    echo "  2. Add: JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN"
fi

echo ""
echo "Step 5: Verifying installation..."
echo "----------------------------------"

# Check if TypeScript compiles
cd backend

print_info "Checking TypeScript compilation..."
npx tsc --noEmit

if [ $? -eq 0 ]; then
    print_success "TypeScript compilation successful"
else
    print_warning "TypeScript has some errors (will use transpile-only mode)"
fi

# Check Python script
print_info "Testing Python analyzer..."
cd python-services

echo '{"parcel_id":"TEST","current_zoning":"MRC-2","lot_size_sqft":10000,"current_units":0}' | python3 analyze_standalone.py > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_success "Python analyzer working"
else
    print_error "Python analyzer test failed"
fi

cd ..
cd ..

echo ""
echo "========================================"
print_success "Deployment setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Replit Secrets (if not done)"
echo "2. Run: cd backend && npm run dev"
echo "3. Test API: curl http://localhost:3000/health"
echo ""
print_info "See REPLIT_SETUP.md for detailed instructions"
echo ""
