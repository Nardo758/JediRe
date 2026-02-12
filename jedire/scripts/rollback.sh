#!/bin/bash
################################################################################
# JEDI RE - Emergency Rollback Script
# 
# Quickly rollback to previous deployment
# 
# Usage: bash scripts/rollback.sh [git-tag]
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TARGET_TAG=$1

echo -e "${RED}======================================"
echo "JEDI RE - Emergency Rollback"
echo "======================================${NC}"
echo ""

# ============================================================================
# Safety Checks
# ============================================================================

echo -e "${YELLOW}This will rollback the application to a previous version${NC}"
echo ""

# Check if tag specified
if [[ -z "$TARGET_TAG" ]]; then
    echo "Available deployment tags:"
    git tag -l "deploy-*" --sort=-creatordate | head -10
    echo ""
    read -p "Enter tag to rollback to: " TARGET_TAG
fi

# Verify tag exists
if ! git rev-parse "$TARGET_TAG" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag '$TARGET_TAG' not found${NC}"
    exit 1
fi

# Show what we're rolling back to
echo ""
echo "Target: $TARGET_TAG"
git show "$TARGET_TAG" --no-patch --format="%ci - %s"
echo ""

# Confirm
echo -e "${RED}WARNING: This will replace current code${NC}"
read -p "Type 'rollback' to continue: " confirm

if [[ "$confirm" != "rollback" ]]; then
    echo "Rollback cancelled"
    exit 0
fi

# ============================================================================
# Create Emergency Backup
# ============================================================================

echo ""
echo -e "${YELLOW}Creating emergency backup...${NC}"

CURRENT_COMMIT=$(git rev-parse HEAD)
BACKUP_TAG="emergency-backup-$(date +%Y%m%d-%H%M%S)"

git tag "$BACKUP_TAG" "$CURRENT_COMMIT"
echo -e "${GREEN}✓ Created backup tag: $BACKUP_TAG${NC}"

# ============================================================================
# Rollback Code
# ============================================================================

echo ""
echo -e "${YELLOW}Rolling back code...${NC}"

# Stash any local changes
if [[ -n $(git status -s) ]]; then
    git stash
    echo "Local changes stashed"
fi

# Checkout target tag
git checkout "$TARGET_TAG"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code rolled back to $TARGET_TAG${NC}"
else
    echo -e "${RED}✗ Rollback failed${NC}"
    exit 1
fi

# ============================================================================
# Rebuild
# ============================================================================

echo ""
echo -e "${YELLOW}Rebuilding application...${NC}"

cd backend
npm install
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# ============================================================================
# Database Rollback (Optional)
# ============================================================================

echo ""
echo -e "${YELLOW}Database rollback${NC}"
echo "Do you need to rollback the database?"
read -p "Rollback database? (y/n): " rollback_db

if [[ "$rollback_db" == "y" ]]; then
    echo ""
    echo "Available database backups:"
    ls -lth backups/production/*.sql* | head -5
    echo ""
    read -p "Enter backup filename: " backup_file
    
    if [ -f "$backup_file" ]; then
        echo "Restoring database from $backup_file..."
        
        # Decompress if needed
        if [[ "$backup_file" == *.gz ]]; then
            gunzip -c "$backup_file" | psql "$DATABASE_URL"
        else
            psql "$DATABASE_URL" < "$backup_file"
        fi
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database restored${NC}"
        else
            echo -e "${RED}✗ Database restore failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Backup file not found${NC}"
        exit 1
    fi
fi

# ============================================================================
# Restart Services
# ============================================================================

echo ""
echo -e "${YELLOW}Restarting services...${NC}"

# Restart command depends on deployment method
if command -v pm2 &> /dev/null; then
    pm2 restart jedire
elif command -v systemctl &> /dev/null; then
    sudo systemctl restart jedire
else
    echo "Manual restart required"
fi

# ============================================================================
# Health Check
# ============================================================================

echo ""
echo -e "${YELLOW}Running health check...${NC}"

sleep 5

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health")

if [[ "$HEALTH_STATUS" == "200" ]]; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}✗ Service may not be running correctly${NC}"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}======================================"
echo "Rollback Complete"
echo "======================================${NC}"
echo ""
echo "Rolled back to: $TARGET_TAG"
echo "Backup created: $BACKUP_TAG"
echo "Current commit: $(git rev-parse --short HEAD)"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "1. Monitor application logs for errors"
echo "2. Run health checks"
echo "3. Notify team of rollback"
echo "4. Investigate root cause"
echo ""
echo "To undo this rollback:"
echo "  git checkout $BACKUP_TAG"
echo ""

exit 0
