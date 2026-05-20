# Structured Folder Survey — Archive Property Set

**Session:** ARCHIVE SEEDING — Session 1 of 5
**Date:** 2026-05-20
**Author:** Auto-generated from folder walk
**Source:** `C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive`

---

## 1. Top-Level Structure

- **Total properties:** 296
- **Organization:** Flat — one folder per property, no MSA or state grouping
- **Naming convention:** `{Property Name} - {City}` (e.g., `464 Bishop - ATL`, `Solis Ballantyne`, `Bell LightHouse Point`)
- **Some have city suffix (` - ATL`, ` - Tampa`), some are property name only**
- **No standardized suffix** — `The Parker`, `Paces Brook` vs `464 Bishop - ATL`, `Bainbridge Aviation Crossings`

### Directory Layout Types

| Type | Count | Description |
|------|-------|-------------|
| **Flat** | ~140 | All files directly in the property folder, no subdirectories |
| **With subdirs** | ~156 | Organized into subfolders (Financials, Rent Roll, OM, Taxes, etc.) |

### Subdirectory Naming Patterns

Most common subdirectory names:

| Name | Properties | Contents |
|------|-----------|----------|
| `Financials` | ~85 | T12 / trailing statements, income statements |
| `OM`, `Offering Memorandum`, `Offering Memo` | ~70 | PDF offerings, investment summaries |
| `Rent Roll`, `Rent Rolls`, `Units` | ~65 | Rent roll XLSX/XLS files |
| `Tax Bill`, `Taxes`, `Real Estate Taxes` | ~45 | Tax bill PDFs |
| `Floor Plans`, `Floorplans` | ~40 | Unit plan images (JPG) |
| `Physical Information`, `Site Plan`, `Property Photos` | ~35 | Site maps, photos |
| `Operation Reports` | ~20 | BoxScores, concessions, LTOs, delinquency |
| `Box Score` | ~3 | Dedicated boxscore subfolder |
| `Commercial` | ~8 | Commercial lease info |
| `Market Rent Evaluation`, `Demographics` | ~10 | Market research PDFs |

---

## 2. File Format Inventory

| Extension | Count | % of Total | Notes |
|-----------|-------|-----------|-------|
| .xlsx | 1,285 | 34.3% | Modern Excel — primary format for rent rolls, T12, boxscores |
| .pdf | 1,253 | 33.5% | OM, tax bills, site maps, boxscores |
| .xls | 812 | 21.7% | Legacy Excel — common for older boxscores, some rent rolls |
| .jpg | 227 | 6.1% | Floor plans, property photos |
| .png | 76 | 2.0% | Diagrams, photos |
| .docx | 50 | 1.3% | Lease docs, correspondence |
| .zip | 8 | 0.2% | Compressed document sets |
| .xlsm | 8 | 0.2% | Macro-enabled Excel |
| Others | 25 | 0.7% | .htm, .pptx, .mp4, .xml, .mov, .gif, .xlsb, .doc |

**Total: 3,744 files** across 296 properties → ~12.6 files/property average

---

## 3. Document Coverage

| Document Type | Properties Covered | % of 296 | Est. Total Files | Primary Format |
|--------------|--------------------|---------|------------------|----------------|
| T12 / Income Statement | ~280 | 94.6% | ~800+ | XLSX/XLS |
| Rent Roll (with lease charges) | ~240 | 81.1% | ~650+ | XLSX/XLS |
| Tax Bill | ~130 | 43.9% | ~180+ | PDF |
| **BoxScore (leasing dashboard)** | **57** | **19.3%** | **73** | **36 PDF, 30 XLSX, 7 XLS** |
| Concession Burnoff | 42 | 14.2% | ~50 | XLSX |
| Lease Tradeout (LTO) | 5 | 1.7% | ~8 | XLSX/XLS |
| **Standalone leasing stats (any type)** | **86** | **29.1%** | **~140** | Mixed |
| **No lease data at all** | **193** | **65.2%** | — | — |

---

## 4. BoxScore Format Deep-Dive

### 4.1 Source System

All BoxScore files originate from **Yardi OneSite Rents v3.0** (confirmed by header row: `"OneSite Rents v3.0"`). The report name is always `"BOXSCORE"` with the subtitle `"As of <date>"`.

### 4.2 File Types

73 BoxScore files across 57 properties:
- **PDF:** 36 files (49%) — rendered output, text-extractable via pdf-parse
- **XLSX:** 30 files (41%) — native Excel, directly parsable
- **XLS:** 7 files (10%) — legacy Excel, requires xlrd

### 4.3 XLSX Document Structure (295 columns × 295+ rows)

The BoxScore is a single-sheet report with these sections:

#### Section 1 — Header Block (Rows 1–10)
- R1: System identification (`OneSite Rents v3.0`) + property name
- R3: Report title (`BOXSCORE`)
- R4: Property code number (e.g., `120.080.305`)
- R5: Generation timestamp (`05/21/2024 10:46:16AM`)
- R6: As-of date (`As of 05/21/2024`)
- R8-R9: Parameters section: date range, config flags

#### Section 2 — Unit Status / Availability (Rows 11–33)
- R11: Section header `"Unit Status - <date>"`
- R12-R13: Column headers — Floor Plan Groups, Floor Plan, Units, Total Vacant → Not Leased → Leased, Model/Admin, Down, Total Occupied → No NTV → NTV-NL → NTV-L, Occupancy Percent, Avg Market Rent, Avg Leased Rent, Net Leased Percent, Avg Effective Rent
- R15-R30: Per-floor-plan rows (1x1: A1, A2, A3, A4 → Total; 2x2: B1, B2, B3, D1TH → Total; 3x2: C1 → Total)
- R30: Property Totals row

#### Section 3 — Availability / Exposure Summary (Rows 34–46)
- R34: Section header `"Availability/Exposure - <date>"`
- R34-R44: Summary metrics:
  - Total Vacant Units
  - Vacant Units Leased
  - Occupied On Notice
  - Occupied On Notice Preleased
  - Net Exposure (= Total Vacant - Leased)
  - Model/Admin
  - Down
  - Controllable Availability
- Right side: Make Ready Status — Made Ready / Not Made Ready counts with percentages
- Bottom: Total Leased, Admin/Down, Total Available, Available for Rent

#### Section 4 — Leasing Activity (Rows 47–68) ← KEY GAP
- R47: Section header `"Leasing - <date_range>"` (e.g., `05/15/2024 through 05/21/2024`)
- R48: Column headers — Floor Plan Group, Floor Plan, Units, Move-Ins, Move-Outs, Net Change, Units Reserved, Signed Renewals, Transferring Leases, Cancelled/Denied (Leases), Net Leases, Waitlist, Cancelled/Denied (Waitlist), Net Waitlist
- R49-R67: Per-floor-plan breaking (1x1 breakouts, 2x2 breakouts, 3x2 breakouts) each with subtotals
- R67: Totals row

Each row contains:
- Move-Ins (count)
- Move-Outs (count)  
- Net Change (Move-Ins - Move-Outs, can be negative)
- Units Reserved (pre-leased before available)
- Signed Renewals (existing tenants)
- Transferring Leases (unit-to-unit transfers)
- Cancelled/Denied (lease applications cancelled or denied)
- Net Leases (new + renewals - cancels)
- Waitlist (count)
- Cancelled/Denied Waitlist
- Net Waitlist

#### Section 5 — New Resident Detail (Rows 69+)
- R69: Section header `"Leases - New Residents - Vacant Units Leased - <date_range>"`
- R70: Column headers — Unit, Floor Plan, Name, Apply Date, Move-In Date, Lease Term, Market Rent, Lease Rent, Credits, Other Charges, Deposits On Hand, Ad Source, Leased By, Effective Rent
- R71+: Per-unit rows, one per new lease

#### Section 6 — Conversion Funnel (when present)
- Additional section with contacts/shows/applied/approved/leased per channel

### 4.4 Leasing Activity Section (Row-level data)

The Leasing Activity section contains the highest-value data for velocity measurement. Example row (from 264-unit property, weekly period):

```
Floor Plan | Units | Move-Ins | Move-Outs | Net Change | Reserved | Signed Renewals | Transfer | Cancelled/Denied | Net Leases | Waitlist | Cancelled/Denied W | Net Waitlist
1x1 / A1  | 36    | 0        | 0         | 0          | 0        | 0              | 0        | 0               | 0          | 1        | 0                | 1
1x1 / A2  | 36    | 2        | 0         | 2          | 2        | 0              | 0        | 0               | 3          | 0        | 0                | 0
1x1 / A3  | 38    | 2        | 0         | 2          | 1        | 0              | 0        | 0               | 1          | 0        | 0                | 0
...       | ...   | ...      | ...       | ...        | ...      | ...            | ...      | ...             | ...        | ...      | ...              | ...
Totals    | 264   | 4        | 0         | 4          | 5        | 0              | 0        | 2               | 8          | 0        | 0                | 0
```

---

## 5. Sample Properties — Deep Survey

### Alta Dairies (Atlanta)
- **Files:** 17 files, 7 subdirectories
- **Documents:** BoxScore XLSX, ConcessionBurnOff XLSX, 2x RentRoll XLSX+XLS, T12 in Financials/, Tax Bill PDF
- **BoxScore:** `BoxScoreSummary09_14_2020.xlsx` (20KB) — weekly snapshot
- **Leasing data:** BoxScore + ConcessionBurnOff

### Ascen Varina Gateway (Raleigh)
- **Files:** 20 files, 6 subdirectories
- **Documents:** 3 BoxScore XLS, Rent Roll XLS, T12 XLSX, Tax PDFs
- **BoxScore:** Dedicated `Box Score/` subfolder, 3 weekly snapshots (May 2024)
- **Format:** `.xls` (legacy) — need xlrd or convert

### Bell LightHouse Point (FL)
- **Files:** 16 files, 5 subdirectories
- **Documents:** 2 BoxScore XLSX, 2 ConcessionBurnOff XLSX, 2 LTO XLSX, Rent Rolls
- **BoxScore:** In `Operation Reports/` subfolder, 2 dates (Sep 2023)
- **Leasing data:** BoxScore + Burnoff + LTO — richest leasing dataset

### The Parker (GA)
- **Files:** 19 files, 7 subdirectories
- **Documents:** 3 BoxScore (1 PDF, 2 XLSX), Rent Rolls, Leasing Forecast XLSX, Pricing Sheet PDF
- **Also has:** `The Parker Leasing Forecast.xlsx` — unique standalone leasing projection

### Solis Ballantyne (Charlotte)
- **Files:** 2 files — only T12 + Rent Roll
- **No boxscore, no concession, no LTO, no lease data of any kind**

---

## 6. Leasing Stats Coverage Summary

| Coverage Tier | Properties | % | Description |
|--------------|-----------|-----|-------------|
| **Full** (BoxScore + Concession + LTO) | ~5 | 1.7% | Weekly leasing dashboard + concession tracking + per-unit tradeout |
| **BoxScore only** | ~32 | 10.8% | Weekly occupancy + leasing activity snapshots |
| **Concession only** | ~22 | 7.4% | Concession burnoff tracking without full boxscore |
| **BoxScore + Concession only** | ~27 | 9.1% | Combined dashboard + concessions |
| **None** | ~193 | 65.2% | No lease-related files found at all |

### Per-type breakdown:
| Document Type | Properties | % of 296 |
|--------------|-----------|----------|
| BoxScore | 57 | 19.3% |
| Concession Burnoff | 42 | 14.2% |
| Lease Tradeout (LTO) | 5 | 1.7% |
| Recent Leasing Report | 7 | 2.4% |
| Traffic Report | 2 | 0.7% |
| Renewal Summary | 10 | 3.4% |
| New Lease Summary | 1 | 0.3% |
| Move-In Report | 3 | 1.0% |

---

## 7. Session 2 Estimate

**Goal:** Build the bulk runner that walks each property folder, classifies documents, extracts data, and writes to the corpus.

**Estimated time:** **3–4 hours**

**Key factors:**

| Factor | Impact | Notes |
|--------|--------|-------|
| Flat + subdir mix | Medium | Need adaptive directory walk logic (files directly in root vs nested) |
| 3 file formats (XLSX/XLS/PDF) | Medium | Boxscore PDF needs pdf-parse + regex; XLS needs xlrd conversion |
| 3744 total files | Medium | ~12.6 files/folder, but most folders can be filtered by known doc types |
| ~193 props with no lease data | Low | Can skip these for leasing—just need T12 + rent roll extraction |
| 57 props with BoxScores | Low | ~73 boxscore files across 57 properties → batch per property |
| PDF BoxScores (36 files) | Medium | Require text extraction via pdf-parse + regex for Leasing section |
| Property-to-parcel ID mapping | High | Need to match folder names to DB property IDs before corpus write |

**Recommended Session 2 approach:**
1. Build folder walker with document type filter (skip known types, classify unknown)
2. For each property: iterate files → classify → route to parser → validate → corpus write
3. Run in dry-run mode first (count+classify only, no writes)
4. Then wet-run with logging

**Dependency:** Session 1 must ship the Leasing Stats parser first, so the bulk runner can route boxscore files through it.
