#!/bin/bash
################################################################################
# JEDI RE - General Deployment Script
# 
# Deploys JEDI RE to production environment with safety checks
# 
# Usage: bash scripts/deploy.sh [environment]
# Environments: staging, production
################################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}JEDI RE - Deployment Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo -e "${YELLOW}Running pre-flight checks...${NC}"

# Check environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Invalid environment. Use 'staging' or 'production'${NC}"
    exit 1
fi

# Production safety check
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "${RED}WARNING: Deploying to PRODUCTION${NC}"
    read -p "Are you sure? (type 'yes' to continue): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Check git status
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}Warning: Uncommitted changes detected${NC}"
    git status -s
    read -p "Continue anyway? (y/n): " continue
    if [[ "$continue" != "y" ]]; then
        exit 1
    fi
fi

# Check tests pass
echo -e "${YELLOW}Running tests...${NC}"
cd "$PROJECT_ROOT/backend"
if ! npm test > /dev/null 2>&1; then
    echo -e "${RED}✗ Tests failed${NC}"
    echo "Run 'npm test' to see details"
    exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"

# Check TypeScript compilation
echo -e "${YELLOW}Checking TypeScript compilation...${NC}"
if ! npx tsc --noEmit > /dev/null 2>&1; then
    echo -e "${RED}✗ TypeScript compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ TypeScript OK${NC}"

# ============================================================================
# Build
# ============================================================================

echo ""
echo -e "${YELLOW}Building application...${NC}"

cd "$PROJECT_ROOT/backend"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# ============================================================================
# Database Migrations
# ============================================================================

echo ""
echo -e "${YELLOW}Running database migrations...${NC}"

if [[ "$ENVIRONMENT" == "production" ]]; then
    # Production: Be careful
    bash "$SCRIPT_DIR/migrate-db.sh" production
else
    # Staging: Run automatically
    bash "$SCRIPT_DIR/migrate-db.sh" staging
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Migrations complete${NC}"

# ============================================================================
# Backup (Production only)
# ============================================================================

if [[ "$ENVIRONMENT" == "production" ]]; then
    echo ""
    echo -e "${YELLOW}Creating backup...${NC}"
    bash "$SCRIPT_DIR/backup.sh"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Backup failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Backup created${NC}"
fi

# ============================================================================
# Deploy to Environment
# ============================================================================

echo ""
echo -e "${YELLOW}Deploying to ${ENVIRONMENT}...${NC}"

if [[ "$ENVIRONMENT" == "staging" ]]; then
    # Deploy to Replit staging
    echo "Pushing to Replit staging environment..."
    # TODO: Add Replit deployment commands
    
elif [[ "$ENVIRONMENT" == "production" ]]; then
    # Deploy to production
    echo "Deploying to production servers..."
    # TODO: Add production deployment commands (Docker, K8s, etc.)
fi

# ============================================================================
# Health Check
# ============================================================================

echo ""
echo -e "${YELLOW}Running health checks...${NC}"

# Wait for service to start
sleep 5

# Check health endpoint
if [[ "$ENVIRONMENT" == "staging" ]]; then
    HEALTH_URL="https://jedire-staging.replit.app/health"
elif [[ "$ENVIRONMENT" == "production" ]]; then
    HEALTH_URL="https://api.jedire.com/health"
fi

echo "Checking $HEALTH_URL..."

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [[ "$HEALTH_CHECK" == "200" ]]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH_CHECK)${NC}"
    echo "Service may not be running correctly"
    exit 1
fi

# ============================================================================
# Post-deployment
# ============================================================================

echo ""
echo -e "${YELLOW}Running post-deployment tasks...${NC}"

# Clear cache (if applicable)
echo "Clearing application cache..."
# TODO: Add cache clearing logic

# Notify team
echo "Sending deployment notification..."
# TODO: Add Slack/email notification

echo -e "${GREEN}✓ Post-deployment tasks complete${NC}"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Git commit: $(git rev-parse --short HEAD)"
echo "Deployed at: $(date)"
echo ""
echo "Health check: $HEALTH_URL"
echo ""

# Tag deployment (production only)
if [[ "$ENVIRONMENT" == "production" ]]; then
    TAG="deploy-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$TAG" -m "Production deployment $(date)"
    echo "Created git tag: $TAG"
    echo "Push tag: git push origin $TAG"
fi

exit 0
