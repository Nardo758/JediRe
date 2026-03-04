#!/bin/bash
# Apartments.com Scraper Runner for JEDI RE

# Set these to your actual Cloudflare Worker values:
export CDP_SECRET="YOUR_CDP_SECRET_HERE"
export WORKER_URL="https://your-worker.workers.dev"

# Atlanta neighborhoods to scrape
CITY="Atlanta"
NEIGHBORHOODS="Buckhead,Midtown,Virginia-Highland,Old-Fourth-Ward,Inman-Park,Decatur,East-Atlanta,West-Midtown"

cd /home/leon/clawd/moltworker/skills/apartments-com-scraper

# Run scraper
node scripts/apartments-scraper.js "$CITY" "$NEIGHBORHOODS" \
  --output "atlanta-listings-$(date +%Y%m%d).json" \
  --limit 20

echo "✅ Scraping complete! Check the JSON file for results."
