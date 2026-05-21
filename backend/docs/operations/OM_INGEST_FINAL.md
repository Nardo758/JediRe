# OM PDF Ingest — Final Summary

**Date:** 2026-05-21  
**Method:** Sequential curl uploads from Windows → `POST /api/v1/archive/parse-om` on Replit → DeepSeek extraction → DB write

## Bug That Blocked Batch 2

The first 17 OMs succeeded, then 24 failed with Anthropic 400 credit-balance errors. Root cause was a chain of three bugs:

1. **`archive.routes.ts:789`** called `parseOM(buffer, filename)` with **no `ctx` argument** — `ctx` was undefined
2. `om-parser.ts` guarded routing with `if (ctx?.userId)` — undefined `ctx` → falsy → always fell through to the direct-Anthropic branch
3. Text truncation cap was 180K chars (~50K tokens), bumping against DeepSeek's 64K context window

**Fix applied by Replit agent:**
- `archive.routes.ts:789` now passes `{ userId: req.user?.userId ?? '' }` as `ctx`
- Truncation reduced to 50K chars (~14K tokens)
- Backend restarted with both fixes

## Results

| Metric | Count |
|---|---|
| Total property folders | 296 |
| OM PDFs found | 42 |
| OM PDFs processed | 42 |
| Year built extracted & written to DB | 41 |
| Year built = null (new development) | 1 |

## Properties With Year Built

### Batch 1 (5/20, 17 files — DeepSeek)
| Property | Year Built |
|---|---|
| Addison on Long Beach | 2019 |
| Alta Lakehouse | 2020 |
| Alta Tech Ridge | 2019 |
| Ardmore at Flowers | 2023 |
| Ashley River | 1984 |
| Avril Cambridge | 2022 |
| Azola Palm Beach | 2019 |
| Cadence at Nocatee | 2022 |
| Carrington at Brier Creek | 2003 |
| Crescent | 2008 |
| East Point at Altamonte | 1973 |
| Enclave on East | 1986 |
| Exchange Orange Park | 2023 |
| Ferry Pike - Nashville (Markham East) | 2022 |
| Ferry Pike - Nashville (Radius at Donelson) | 2021 |
| Heron Pointe | 1981 |
| Legacy Crossroads | 2009 |

### Batch 2 (5/21, 24 files — DeepSeek after routing fix)
| Property | Year Built |
|---|---|
| Leo Loso | 2023 |
| Lucent | 2021 |
| MAdison Farms | 2022 |
| Mirabella Lakes | 2000 |
| Park Ave | 1990 |
| Portiva - Jacksonville | 2018 |
| Residences at Shilo Crossings | 2020 |
| Rivertree | 2004 |
| Shoreview | 2021 |
| Stonebriar | 2006 |
| The Helix | 2021 |
| The Kensley (Digital) | 2004 |
| The Kensley (Print) | 2004 |
| The Milan | 2000 |
| The Parkstone Gallatin | 2021 |
| The Place at 1825 | 1986 |
| The Reid | 2021 |
| The Village at Westland Cove | 2019 |
| The Vineyard | 2021 |
| Vestavia Reserve | 2016 |
| Vista Verde | 1988 |
| Vista Verde - Miami | 1993 |

### Year Built = Null (Genuine)
| Property | Reason |
|---|---|
| DeBartolo Portfolio | Portfolio OM — no single year built |
| Parkview Greer | New development (Greenville, SC) — 245 units, completed April 2024 |

## Coverage Impact

- **Before:** 0/296 properties had year built from archive
- **After:** 41/296 have year built from OM extraction, plus DeBartolo and Parkview Greer documented as not applicable
- Remaining gap for year built: 253 properties with no OM in archive → these would need CoStar or public records

## Scripts

- `src/scripts/_upload_oms_remaining.py` — Python uploader (encoding issues with Python 3.14 + curl.exe binary stderr)
- `src/scripts/_upload_oms_final.mjs` — Node.js uploader, stable on Windows, handles binary curl output cleanly
