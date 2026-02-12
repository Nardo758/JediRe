#!/bin/bash
################################################################################
# JEDI RE - Database Backup Script
# 
# Creates automated backups with retention policy
# 
# Usage: bash scripts/backup.sh [environment]
# Schedule: Run daily via cron
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=${1:-production}

echo -e "${YELLOW}JEDI RE - Database Backup${NC}"
echo "Environment: $ENVIRONMENT"
echo "======================================"

# ============================================================================
# Configuration
# ============================================================================

BACKUP_DIR="backups/$ENVIRONMENT"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/jedire-$ENVIRONMENT-$TIMESTAMP.sql"
BACKUP_FILE_COMPRESSED="$BACKUP_FILE.gz"

# Retention (days)
RETENTION_DAYS=30

# Database URL
if [[ "$ENVIRONMENT" == "production" ]]; then
    DATABASE_URL="$PRODUCTION_DATABASE_URL"
elif [[ "$ENVIRONMENT" == "staging" ]]; then
    DATABASE_URL="$STAGING_DATABASE_URL"
else
    DATABASE_URL="$DATABASE_URL"
fi

if [[ -z "$DATABASE_URL" ]]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ============================================================================
# Create Backup
# ============================================================================

echo ""
echo "Creating backup..."
echo "File: $BACKUP_FILE"

# Full database dump
if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✓ Backup created${NC}"
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# Get file size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Size: $BACKUP_SIZE"

# ============================================================================
# Compress Backup
# ============================================================================

echo ""
echo "Compressing backup..."

if gzip -9 "$BACKUP_FILE"; then
    COMPRESSED_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
    echo -e "${GREEN}✓ Compressed to $COMPRESSED_SIZE${NC}"
else
    echo -e "${YELLOW}⚠ Compression failed, keeping uncompressed backup${NC}"
    BACKUP_FILE_COMPRESSED="$BACKUP_FILE"
fi

# ============================================================================
# Verify Backup
# ============================================================================

echo ""
echo "Verifying backup integrity..."

if [ -f "$BACKUP_FILE_COMPRESSED" ]; then
    # Check file is not empty
    if [ -s "$BACKUP_FILE_COMPRESSED" ]; then
        echo -e "${GREEN}✓ Backup file verified${NC}"
    else
        echo -e "${RED}✗ Backup file is empty${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Backup file not found${NC}"
    exit 1
fi

# ============================================================================
# Upload to Remote Storage (Optional)
# ============================================================================

echo ""
echo "Uploading to remote storage..."

# S3 upload (if AWS CLI configured)
if command -v aws &> /dev/null && [[ -n "$BACKUP_S3_BUCKET" ]]; then
    S3_PATH="s3://$BACKUP_S3_BUCKET/jedire/$ENVIRONMENT/$(basename "$BACKUP_FILE_COMPRESSED")"
    
    if aws s3 cp "$BACKUP_FILE_COMPRESSED" "$S3_PATH" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Uploaded to S3: $S3_PATH${NC}"
    else
        echo -e "${YELLOW}⚠ S3 upload failed (local backup retained)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ S3 not configured, skipping remote backup${NC}"
fi

# ============================================================================
# Clean Old Backups
# ============================================================================

echo ""
echo "Cleaning old backups (retention: $RETENTION_DAYS days)..."

# Find and delete old backups
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql*" -mtime +$RETENTION_DAYS 2>/dev/null)

if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while read -r old_backup; do
        echo "Deleting: $(basename "$old_backup")"
        rm "$old_backup"
    done
    
    DELETED_COUNT=$(echo "$OLD_BACKUPS" | wc -l)
    echo -e "${GREEN}✓ Deleted $DELETED_COUNT old backups${NC}"
else
    echo "No old backups to delete"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}======================================"
echo "Backup Complete"
echo "======================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "File: $BACKUP_FILE_COMPRESSED"
echo "Size: $COMPRESSED_SIZE"
echo "Timestamp: $TIMESTAMP"
echo ""

# List recent backups
echo "Recent backups:"
ls -lth "$BACKUP_DIR" | head -6

echo ""

exit 0
