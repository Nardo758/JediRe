# CoStar Timeseries Data - Quick Reference

## Overview

This directory contains CoStar historical market data and tools for processing it into signals for the JEDI RE platform.

## Files

- **atlanta_market_data.xlsx** - Raw CoStar data (105 quarters, 2000-2026)
- **parse_costar_timeseries.py** - Parser script
- **costar_market_timeseries.json** - Processed timeseries (generated)

## Quick Start

### Parse the Data

```bash
cd /home/leon/clawd/jedire/backend/data/costar
python3 parse_costar_timeseries.py
```

This generates `costar_market_timeseries.json` with:
- Full 26-year rent history
- 6-year complete dataset (with vacancy)
- Both quarterly and monthly interpolated data

### Use in Analysis

```python
from costar_signal_wrapper import CoStarSignalProcessor

# Initialize processor
processor = CoStarSignalProcessor()

# Get market signal (6-year complete dataset)
signal = processor.get_market_signal(use_full_history=False)

print(f"Rent Growth: {signal.rent_growth_rate:.2%}")
print(f"Confidence: {signal.confidence:.2%}")
print(f"Current Rent: ${signal.current_rent:.0f}")
```

### API Usage

```bash
# Get market signal via API
curl -X POST http://localhost:3000/api/v1/analysis/market-signal \
  -H "Content-Type: application/json" \
  -d '{"use_full_history": false}'
```

### CLI Usage

```bash
# Standalone wrapper
cd /home/leon/clawd/jedire/backend/python-services/engines
echo '{"use_full_history": false}' | python3 market_signal_wrapper.py
```

## Data Structure

The generated JSON contains:

```json
{
  "metadata": {
    "market": "Atlanta",
    "data_source": "CoStar",
    "full_history_quarters": 105,
    "complete_data_quarters": 25,
    "statistics": { ... }
  },
  "full_rent_history": {
    "quarterly": { "dates": [...], "effective_rent": [...] },
    "monthly": { "dates": [...], "effective_rent": [...] }
  },
  "complete_dataset": {
    "quarterly": {
      "dates": [...],
      "effective_rent": [...],
      "vacancy_percent": [...],
      "inventory_units": [...],
      "under_construction_units": [...],
      "absorption_units": [...]
    },
    "monthly": { ... }
  }
}
```

## Data Quality Notes

### Full History (105 quarters, 2000-2026)
- ✅ Complete rent data
- ❌ Vacancy data only available from 2020 onwards
- Best for: Long-term growth analysis, trend identification

### Complete Dataset (25 quarters, 2020-2026)
- ✅ All fields (rent, vacancy, inventory, construction, absorption)
- ✅ Captures COVID market shock (2020: 83.7% vacancy!)
- ✅ Shows recovery trajectory
- Best for: Recent market analysis, full signal processing

## Signal Processing Output

Processed signals include:

- **rent_growth_rate**: Annualized growth (e.g., 0.0609 = 6.09%)
- **confidence**: Data quality score (0-1)
- **seasonal_component**: Current seasonal adjustment
- **trend_component**: Smoothed trend value
- **noise_level**: Historical volatility ($)
- **current_rent**: Latest rent value

## Integration with Imbalance Detector

```python
from imbalance_detector import ImbalanceDetector

# Use CoStar data instead of user-provided arrays
detector = ImbalanceDetector(use_costar_signals=True)

result = detector.analyze_imbalance(
    submarket_data=submarket,
    use_costar_data=True  # No rent_timeseries needed!
)

print(f"Verdict: {result.verdict.value}")
print(f"Rent Growth: {result.demand_signal.rent_growth_rate:.2%}")
```

## Troubleshooting

### FileNotFoundError
```
CoStar data not found at .../costar_market_timeseries.json
```

**Solution:** Run the parser first:
```bash
cd /home/leon/clawd/jedire/backend/data/costar
python3 parse_costar_timeseries.py
```

### Import Error
```
ModuleNotFoundError: No module named 'costar_signal_wrapper'
```

**Solution:** Make sure you're in the correct directory:
```bash
cd /home/leon/clawd/jedire/backend/python-services/engines
```

## Testing

Run the test suite:

```bash
cd /home/leon/clawd/jedire/backend/python-services/engines
python3 test_market_signal.py
python3 test_costar_integration.py
```

All tests should pass with >90% confidence scores.

## Key Statistics

**6-Year Dataset (2020-2026):**
- Average annual growth: 1.01%
- Average vacancy: 33.4%
- Data points: 73 months
- Confidence: 92.5%

**26-Year Dataset (2000-2026):**
- Average annual growth: 0.74%
- Starting rent: $1,632 (2000)
- Current rent: $1,982 (2026)
- Data points: 313 months
- Confidence: 93.9%

## Support

For issues or questions, see:
- Main integration doc: `jedire/backend/COSTAR_INTEGRATION_COMPLETE.md`
- Test files: `test_market_signal.py`, `test_costar_integration.py`
- API routes: `jedire/backend/src/api/rest/analysis.routes.ts`
