# Atlanta Zoning Scraper (JEDI RE Phase 1A)

## Overview

This scraper extracts Atlanta zoning ordinance data from [Municode Library](https://library.municode.com/ga/atlanta/codes/code_of_ordinances).

**Target zones:** R-1, R-2, R-3, R-4, R-5, MF-1, MF-2, MF-3, MF-4, MF-5

## Installation

```bash
cd /home/leon/clawd/jedi-re/municode-scraper

# Install dependencies
pip install -r requirements.txt

# Or install individually:
pip install selenium webdriver-manager beautifulsoup4
```

## Usage

### Quick Start

```bash
python atlanta_zoning_scraper.py --output ../zoning-rules/atlanta_zoning_scraped.json
```

### Options

```bash
# Run in headless mode (no browser window)
python atlanta_zoning_scraper.py --headless

# Custom output path
python atlanta_zoning_scraper.py --output /path/to/output.json
```

## Known Limitations

**⚠️ Municode Requires Manual Extraction**

The municode.com website uses heavy JavaScript and doesn't expose structured data via simple scraping. The current scraper:

✅ **Can do:**
- Navigate to Atlanta zoning pages
- Detect which zones exist
- Extract page HTML

❌ **Cannot do (yet):**
- Automatically extract detailed zoning metrics (density, FAR, setbacks)
- Parse nested HTML structure reliably
- Handle dynamic content loading

## Recommended Workflow

**For JEDI RE Phase 1A MVP**, the **fastest approach** is:

### Option 1: Manual Extraction (15-30 min)

1. Open https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIICOORANDECO_PT16ZO
2. Navigate to each zone (R-1 through R-5, MF-1 through MF-5)
3. Copy the text for each zone
4. Paste into the zoning parser:
   ```bash
   cd ../zoning-rules
   python zoning_parser.py --text "paste zone text here" --zone R-1
   ```

### Option 2: Advanced Scraper (2-4 hours to build)

Build a more sophisticated scraper using:
- **Playwright** (better than Selenium for modern sites)
- **Page navigation** logic to click through zone sections
- **HTML parsing** with Beautiful Soup for structured extraction
- **Retry logic** for dynamic content

## Output Format

The scraper outputs JSON in this format:

```json
{
  "city": "Atlanta",
  "state": "GA",
  "source": "Municode Library",
  "scraped_at": "2026-02-03 08:25:00",
  "zoning_rules": [
    {
      "zoning_code": "R-1",
      "description": "Single-Family Residential - Low Density",
      "source_url": "https://library.municode.com/...",
      "status": "placeholder"
    }
  ]
}
```

## Next Steps for Full Automation

To build a production-grade municode scraper:

1. **Switch to Playwright**:
   ```bash
   pip install playwright
   playwright install chromium
   ```

2. **Implement zone navigation**:
   - Click into Part 16 - Zoning
   - Navigate to each district page
   - Extract section text

3. **Parse extracted text**:
   - Use regex patterns from `zoning_parser.py`
   - Extract: lot size, FAR, density, height, setbacks

4. **Handle edge cases**:
   - Some zones may be PDFs (download and OCR)
   - Some text may be in tables (parse HTML tables)
   - Handle missing data gracefully

## Contributing

Found a better way to scrape municode? PRs welcome!

---

**Status:** Partial implementation - MVP recommends manual extraction  
**Last Updated:** 2026-02-03
