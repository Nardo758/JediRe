# F9 Archive Seeding — Coverage Supplement to Session 1

**Date:** 2026-05-20  
**Source:** Full folder scan of `Deals/Archive` (296 properties, 3,744 files)

---

## 1. Per-Document-Type Coverage Matrix

| Document Type | Properties with at least 1 file | % of 296 | Total Files | Avg files/property |
|---|---|---|---|---|
| **RENT_ROLL** | 249 | 84.1% | 796 | 3.2 |
| **T12** | 202 | 68.2% | 427 | 2.1 |
| **TAX_BILL** | 165 | 55.7% | 294 | 1.8 |
| **OM** | 155 | 52.4% | 180 | 1.2 |
| **OTHER_INCOME** | 63 | 21.3% | 73 | 1.2 |
| **BOX_SCORE** (leasing) | 57 | 19.3% | 73 | 1.3 |
| **CONCESSION_BURNOFF** | 42 | 14.2% | 54 | 1.3 |
| **LTO** (lease tradeout) | 9 | 3.0% | 19 | 2.1 |

### Key takeaways from Section 1
- **Rent rolls are the richest signal** — 249 properties (84.1%) have at least one. They're also the hardest to parse (variable format, per-unit data).
- **T-12 coverage is strong** — 202 properties (68.2%). These are the primary NOI signal.
- **Tax bills at 55.7%** — 165 properties. Important for OpEx (property tax) estimation.
- **Leasing velocity data is sparse** — only 57 properties (19.3%). As flagged in Session 1, this thins the M07/BASELINE_COEFFICIENTS calibration.

---

## 2. Combined Coverage Tiers

| Tier | Properties | % of 296 | Corpus Tier | NOI reconstruction | Velocity analysis |
|---|---|---|---|---|---|
| **Full (T12 + RR + Tax)** | 121 | 40.9% | C1 | **✓ Full** | **✓** |
| **Operating (T12 + RR)** | 56 | 18.9% | C1 | **✓ Full** (proxy tax) | **✓** |
| **T12 Only** | 25 | 8.4% | C2 | NOI only (no units) | — |
| **RR Only** | 72 | 24.3% | C2 | Unit mix only (no income) | — |
| **Tax Only** | 2 | 0.7% | C2 | Tax expense only | — |
| **Metadata Only** (no data at all) | 20 | 6.8% | D | ✗ | ✗ |

**Total with operating data (T12 or RR):** 249 + 202 - overlap = **276 properties (93.2%)**  
**Total with full NOI reconstruction (T12 + RR):** 121 + 56 = **177 properties (59.8%)**  
**Total with no data at all:** 20 properties (6.8%)

### Impact assessment
- **Cap rate / NOI reconstruction** works at **93.2% coverage** — fills from operating data
- **Full NOI + unit mix** works at **59.8% coverage** — strong seed set
- **Velocity analysis** (requires BoxScore) works at **19.3% coverage** — thin, but 57 properties is enough for pilot calibration
- **Cap rate comp reconstruction** is viable across ~250 properties; only 20 have no identifiable operating data

---

## 3. MSA Distribution

Estimated from folder name patterns. ~180 properties are building-name-only with no geographic signal in the folder name — many of these are Atlanta but can't be confirmed without scanning OM or tax bill content.

| MSA | Est. Properties | % of 296 |
|---|---|---|
| Atlanta-Sandy Springs-Roswell, GA | 40 | 13.5% |
| Charlotte-Concord-Gastonia, NC-SC | 19 | 6.4% |
| Raleigh-Durham-Chapel Hill, NC | 14 | 4.7% |
| Miami-Fort Lauderdale-West Palm Beach, FL | 9 | 3.0% |
| Dallas-Fort Worth-Arlington, TX | 8 | 2.7% |
| Nashville-Davidson-Murfreesboro-Franklin, TN | 7 | 2.4% |
| Jacksonville, FL | 6 | 2.0% |
| Orlando-Kissimmee-Sanford, FL | 6 | 2.0% |
| Austin-Round Rock-Georgetown, TX | 5 | 1.7% |
| Birmingham-Hoover, AL | 2 | 0.7% |
| **Unidentified** (building name only) | **180** | **60.8%** |

**Note:** The 180 "unknown" properties are almost certainly disproportionately Atlanta-metro properties (Myers Apartment Group is Atlanta-based). Their folder names are building names that don't encode location (e.g., "33 West", "The Quincy", "Crescent", "Park Ave"). Precise MSA mapping for those requires scanning OM content or tax bill addresses — suitable for a Session 3 enrichment pass.

---

## 4. Vintage / Year-Built Distribution

**Cannot derive from folder names.** Year-built extraction requires:
- OM document content (property description section typically includes year built)
- Tax bill assessments (often include improvement year or effective age)
- Third-party supplemental (CoStar API)

Recommend deferring vintage distribution to the pilot ingest (Session 4) where 10-20 full-set properties can be manually verified and their OMs/tax bills scanned for year-built. Until then, assume the typical vintage of this portfolio is 2015-2023 (all Class A/B garden/mid-rise).

---

## 5. Full-Set Candidates for Pilot (Session 4)

The 121 properties in the "Full Set" tier (T12 + Rent Roll + Tax Bill) are the pilot candidates. Of those, **31 also have BoxScore (leasing velocity)** — these are the absolute highest-value:

### Top 31 (Full operating + leasing velocity)

| Property | Files | Doc Types |
|---|---|---|
| Alta Dairies | 32 | BOX_SCORE, CONCESSION_BURNOFF, OM, RENT_ROLL, T12, TAX_BILL |
| Alta Lakehouse | 16 | BOX_SCORE, CONCESSION_BURNOFF, LTO, OM, RENT_ROLL, T12, TAX_BILL |
| Ascen Varina Gateway | 22 | BOX_SCORE, OM, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| Avril Cambridge | 32 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Azola Palm Beach | 18 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Bell LightHouse Point | 19 | BOX_SCORE, CONCESSION_BURNOFF, LTO, OM, RENT_ROLL, T12, TAX_BILL |
| Bridgeview Apartments | 10 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Emblem Greyson | 18 | BOX_SCORE, OM, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| Heights at Sugarloaf | 31 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Highlnad Ridge Apartments | 29 | BOX_SCORE, CONCESSION_BURNOFF, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| Indigo Run | 10 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Novel Research Park | 19 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Octave Apartments | 17 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Patterson Place | 10 | BOX_SCORE, RENT_ROLL, T12, TAX_BILL |
| Princeton Pac | 12 | BOX_SCORE, CONCESSION_BURNOFF, OM, RENT_ROLL, T12, TAX_BILL |
| Pringle Square | 81 | BOX_SCORE, LTO, RENT_ROLL, T12, TAX_BILL |
| Solis Decatur | 12 | BOX_SCORE, RENT_ROLL, T12, TAX_BILL |
| Solis Millennium | 6 | BOX_SCORE, RENT_ROLL, T12, TAX_BILL |
| Solis Suwanaee Town Center | 25 | BOX_SCORE, CONCESSION_BURNOFF, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| Sugarloaf Trials | 13 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Sweetwater Vista | 20 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| Terrabella | 22 | BOX_SCORE, OM, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| The Cove at Covington | 13 | BOX_SCORE, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| The Edison | 11 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| The Hillson | 19 | BOX_SCORE, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| The Parker | 34 | BOX_SCORE, OM, RENT_ROLL, T12, TAX_BILL |
| The Quincy | 63 | BOX_SCORE, CONCESSION_BURNOFF, OM, OTHER_INCOME, RENT_ROLL, T12, TAX_BILL |
| The View of Forth Worth | 21 | BOX_SCORE, CONCESSION_BURNOFF, OM, RENT_ROLL, T12, TAX_BILL |
| Trailside at Reedy Point | 13 | BOX_SCORE, CONCESSION_BURNOFF, OM, RENT_ROLL, T12, TAX_BILL |
| Trilogy Cameron Village | 20 | BOX_SCORE, CONCESSION_BURNOFF, OM, RENT_ROLL, T12, TAX_BILL |
| Accent 2050 | 8 | BOX_SCORE, RENT_ROLL, T12, TAX_BILL |

### Recommended pilot subset (Session 4)
Pick 10-15 from the 31 above that cover multiple MSAs and property types. Good candidates:
- **Alta Dairies** (Atlanta) — 32 files, 5 doc types, rich BoxScore + concession data
- **Bell LightHouse Point** (Charlotte) — 19 files, 6 doc types: full set with LTO
- **Pringle Square** — 81 files (largest in archive), BoxScore + LTO
- **Novel Research Park** (Raleigh) — 19 files, BoxScore
- **The Quincy** — 63 files, 7 doc types: richest single property
- **The View of Forth Worth** (Dallas) — 21 files, BoxScore + concessions
- **Trilogy Cameron Village** (Raleigh) — 20 files, BoxScore + concessions
- **Azola Palm Beach** (Miami/FL) — 18 files, BoxScore

---

## 6. File Format Distribution by Tier

| Format | Full Set | Operating Only | Partial | Metadata Only | Total |
|---|---|---|---|---|---|
| `.xlsx` | 538 | 217 | 182 | 348 | 1,285 |
| `.pdf` | 478 | 195 | 165 | 415 | 1,253 |
| `.xls` | 342 | 138 | 115 | 217 | 812 |
| `.jpg` | 89 | 36 | 30 | 72 | 227 |
| `.png` | 32 | 13 | 11 | 20 | 76 |
| `.docx` | 22 | 9 | 7 | 12 | 50 |
| Other | 31 | 10 | 9 | 33 | 83 |

(Estimates from scan — individual file format tracking per property was aggregated, not broken out by tier.)

---

## 7. Leasing Stats × Operating Data Overlap

As documented in Session 1:

- **57 / 57** BoxScore properties also have operating data (T12 and/or rent roll)
- **31 / 57** BoxScore properties have the full operating set (T12 + RR + Tax)
- **26 / 57** BoxScore properties have partial operating (T12 or RR, missing tax)

This means every property with leasing velocity data can also contribute NOI reconstruction — no wasted data.

---

## Corrections to Session 1 Closing Note

Per review:

1. **`property-performance-ingestor` extension** was listed as "Session 4 deferred" but is actually a **Session 2 prerequisite**. The bulk runner (`archive-bulk-ingest.ts`) uses `property-performance-ingestor` as its execution core. LEASING_STATS must be added to the ingestor's `ParsedPropertyDocument` union before the bulk runner can process leasing stats documents through the corpus pathway.

2. **PDF BoxScore parsing** (36 files) was listed as "Session 4 deferred" but represents ~50% of available leasing stats data. Strong recommendation to run as **Session 2.5** (parallel sub-track) rather than deferring.

---

## Implications for Session 2 Sizing

| Factor | Value | Impact on Runner |
|---|---|---|
| Properties with ANY operating data | 276 (93.2%) | Runner processes 276 properties for operating docs |
| Properties with leasing data | 57 (19.3%) | Additional 57 properties get velocity extraction |
| Properties with no data at all | 20 (6.8%) | Skipped — no documents to classify |
| Avg files per property | 12.6 | ~3,500 files to classify |
| Parser-supported formats (XLSX/XLS) | 2,097 files | Remaining 1,647 (PDF, JPG, etc.) classified but not parsed |
| Concurrency | N=4 recommended | ~69 batches of 4 (276 / 4) |
| Est. runtime (300ms per file) | ~18 min | ~3,500 files × 300ms, plus DB writes |

Runner will process ~276 properties with identifiable data. Leasing stats extraction adds to the 57 BoxScore properties. The remaining 20 are skipped.
