# CreateDealModal - Flow Diagrams

## Before: 6-Step Linear Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OLD FLOW (6 STEPS)                              │
└─────────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌───────────────────┐
│  STEP 1: CATEGORY │
│                   │
│  ○ Portfolio      │
│  ○ Pipeline       │
└─────────┬─────────┘
          │ [Click Next]
          ▼
┌───────────────────┐
│  STEP 2: TYPE     │
│                   │
│  ○ New Dev        │
│  ○ Existing       │
└─────────┬─────────┘
          │ [Click Next]
          ▼
┌───────────────────┐
│  STEP 3: ADDRESS  │
│                   │
│  [Enter address]  │
│  [Click Locate]   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ STEP 4: TRADE     │
│         AREA      │
│                   │
│  [Define area]    │
│  [Required]       │
└─────────┬─────────┘
          │ [Click Save]
          ▼
┌───────────────────┐
│ STEP 5: BOUNDARY  │
│                   │
│  [Draw polygon]   │
│  [Required*]      │
└─────────┬─────────┘
          │ [Click Continue]
          ▼
┌───────────────────┐
│ STEP 6: DETAILS   │
│                   │
│  [Name]           │
│  [Description]    │
│  [Tier]           │
└─────────┬─────────┘
          │ [Click Create]
          ▼
        DONE

* Required for new developments
Total clicks: 5-6 + form fill
Time: 2-3 minutes
```

---

## After: 3-Step Flow with Optional Paths

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEW FLOW (3 STEPS)                              │
└─────────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌────────────────────────────────────────────┐
│  STEP 1: SETUP (Combined)                  │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Category                          │  │
│  │    ○ Portfolio  ○ Pipeline           │  │
│  └──────────────────────────────────────┘  │
│                 ↓ [Auto-reveal]            │
│  ┌──────────────────────────────────────┐  │
│  │ 2. Type                              │  │
│  │    ○ New Dev    ○ Existing           │  │
│  └──────────────────────────────────────┘  │
│                 ↓ [Auto-reveal]            │
│  ┌──────────────────────────────────────┐  │
│  │ 3. Address                           │  │
│  │    [Enter address...]                │  │
│  │    [Auto-complete dropdown]          │  │
│  └──────────────────────────────────────┘  │
└────────────────────┬───────────────────────┘
                     │ [Select from dropdown]
                     │ [Auto-advance]
                     ▼
┌────────────────────────────────────────────────────────────┐
│  STEP 2: LOCATION (Optional)                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Trade Area (Optional)                              │    │
│  │                                                     │    │
│  │  [Define custom area] ──OR──  ⏭️ [Skip]           │    │
│  │                                                     │    │
│  │  If skip: Use system default (submarket/MSA)      │    │
│  └────────────────┬────────────────────┬──────────────┘    │
│                   │ [Save]             │ [Skip]            │
│                   ▼                    ▼                   │
│         ┌─────────────────┐   ┌────────────────┐          │
│         │ New Dev?        │   │ Existing?      │          │
│         └────┬────────┬───┘   └───────┬────────┘          │
│              │Yes     │No             │                   │
│              ▼        │               │                   │
│  ┌────────────────────┴───────────────┴──────────────┐    │
│  │ Boundary (Optional - New Dev Only)                │    │
│  │                                                    │    │
│  │  [Draw polygon] ──OR──  ⏭️ [Skip - Use point]    │    │
│  │                                                    │    │
│  │  If skip: Use address point                       │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬─────────────────────────────────────┘
                       │ [Continue or Skip]
                       ▼
┌────────────────────────────────────────────┐
│  STEP 3: DETAILS                           │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ [Name*]          (Required)          │  │
│  │ [Description]    (Optional)          │  │
│  │ [Tier]           (Default: basic)    │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Summary Box:                         │  │
│  │ • Category: Portfolio/Pipeline       │  │
│  │ • Type: New/Existing                 │  │
│  │ • Address: [Full address]            │  │
│  │ • Trade Area: Custom/System default  │  │
│  │ • Boundary: Custom drawn/Point       │  │
│  └──────────────────────────────────────┘  │
└────────────────────┬───────────────────────┘
                     │ [Click Create]
                     ▼
                   DONE

Total clicks: 2-3 + form fill
Time: 30-60 seconds (skip path)
      2-3 minutes (full path)
```

---

## User Paths Comparison

### Path 1: Existing Property (Minimum Clicks)

#### BEFORE (6 clicks + form):
```
[Select Portfolio] → [Next] → [Select Existing] → [Next] → 
[Enter Address] → [Locate] → [Define Trade Area] → [Save] → 
[Verify Point] → [Continue] → [Fill Name] → [Create]

Steps: 1 → 2 → 3 → 4 → 5 → 6
Clicks: 6 navigation + form
```

#### AFTER (2 clicks + form):
```
[Select Portfolio + Existing + Address] → 
[Skip Trade Area] → [Fill Name] → [Create]

Steps: 1 → 2 (auto-skip) → 3
Clicks: 2 navigation + form ⚡ (67% reduction)
```

---

### Path 2: New Development (Minimum Clicks)

#### BEFORE (6 clicks + form):
```
[Select Pipeline] → [Next] → [Select New] → [Next] → 
[Enter Address] → [Locate] → [Define Trade Area] → [Save] → 
[Draw Boundary] → [Continue] → [Fill Name] → [Create]

Steps: 1 → 2 → 3 → 4 → 5 → 6
Clicks: 6 navigation + form
```

#### AFTER (3 clicks + form):
```
[Select Pipeline + New + Address] → 
[Skip Trade Area] → [Skip Boundary] → [Fill Name] → [Create]

Steps: 1 → 2 (trade) → 2 (boundary) → 3
Clicks: 3 navigation + form ⚡ (50% reduction)
```

---

### Path 3: Power User (Full Definition)

#### BEFORE (6 clicks + form + drawing):
```
[Select Category] → [Next] → [Select Type] → [Next] → 
[Enter Address] → [Locate] → [Define Trade Area] → [Save] → 
[Draw Boundary] → [Continue] → [Fill Details] → [Create]

Steps: 1 → 2 → 3 → 4 → 5 → 6
Clicks: 6 navigation + form + drawing
```

#### AFTER (3 clicks + form + drawing):
```
[Select Category + Type + Address] → 
[Define Trade Area → Save] → [Draw Boundary → Continue] → 
[Fill Details] → [Create]

Steps: 1 → 2 (trade) → 2 (boundary) → 3
Clicks: 3 navigation + form + drawing ⚡ (50% reduction)
```

---

## Decision Tree

```
                        [Start Creating Deal]
                                │
                                ▼
                    ┌─────────────────────┐
                    │   What do you       │
                    │   want to create?   │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        ┌──────────────┐              ┌──────────────┐
        │  Portfolio   │              │   Pipeline   │
        │   (Owned)    │              │ (Prospecting)│
        └──────┬───────┘              └──────┬───────┘
               │                             │
               └──────────────┬──────────────┘
                              ▼
                    ┌─────────────────────┐
                    │   Development       │
                    │   Type?             │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        ┌──────────────┐              ┌──────────────┐
        │     New      │              │   Existing   │
        │ Development  │              │   Property   │
        └──────┬───────┘              └──────┬───────┘
               │                             │
               │                             │
               └──────────────┬──────────────┘
                              ▼
                    ┌─────────────────────┐
                    │   Enter Address     │
                    │   [Auto-advance]    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Define Trade      │
                    │   Area?             │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        ┌──────────────┐              ┌──────────────┐
        │  Yes, define │              │  No, skip    │
        │   custom     │              │  (system     │
        │              │              │   default)   │
        └──────┬───────┘              └──────┬───────┘
               │                             │
               └──────────────┬──────────────┘
                              ▼
                    ┌─────────────────────┐
                    │   Is it New Dev?    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        ┌──────────────┐              ┌──────────────┐
        │     YES      │              │      NO      │
        │   Need to    │              │ Auto-skip to │
        │draw boundary?│              │   Details    │
        └──────┬───────┘              └──────┬───────┘
               │                             │
    ┌──────────┴──────────┐                 │
    ▼                     ▼                 │
┌─────────┐         ┌─────────┐            │
│ Draw it │         │ Skip it │            │
│         │         │ (point) │            │
└────┬────┘         └────┬────┘            │
     │                   │                 │
     └──────────┬────────┘                 │
                │                          │
                └────────────┬─────────────┘
                             ▼
                  ┌─────────────────────┐
                  │   Fill Details &    │
                  │   Review Summary    │
                  └──────────┬──────────┘
                             ▼
                  ┌─────────────────────┐
                  │   Create Deal ✓     │
                  └─────────────────────┘
```

---

## State Machine Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      MODAL STATE MACHINE                      │
└──────────────────────────────────────────────────────────────┘

        [CLOSED]
           │
           │ onOpen()
           ▼
     ┌──────────┐
     │  SETUP   │◄──────────────────┐
     │ (Step 1) │                   │
     └────┬─────┘                   │
          │                         │
          │ address selected        │ back()
          ▼                         │
  ┌─────────────────┐               │
  │   LOCATION      │               │
  │   (Step 2)      │               │
  │                 │               │
  │ ┌─────────────┐ │               │
  │ │ Trade Area  │ │───────────────┘
  │ │ (Sub-step)  │ │
  │ └─────┬───────┘ │
  │       │         │
  │       │ skip/save
  │       ▼         │
  │ ┌─────────────┐ │
  │ │  Boundary   │ │ (only if new dev)
  │ │ (Sub-step)  │ │
  │ └─────┬───────┘ │
  └───────┼─────────┘
          │
          │ skip/continue
          ▼
     ┌──────────┐
     │ DETAILS  │
     │ (Step 3) │
     └────┬─────┘
          │
          │ submit()
          ▼
      [CREATING]
          │
          │ success
          ▼
       [CLOSED]
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         DATA FLOW                             │
└──────────────────────────────────────────────────────────────┘

USER INPUT                STATE                      API CALLS
───────────              ──────                     ──────────

[Select Category]  ────▶ dealCategory
[Select Type]      ────▶ developmentType
                                │
[Enter Address]    ────▶ address │
                         coordinates ◄────── [Mapbox Geocoding]
                             │
                             └─────────────▶ [Submarket Lookup]
                                                     │
                                            ┌────────┴────────┐
                                            │ submarketId     │
                                            │ msaId           │
                                            └─────────────────┘

[Define Trade Area]     tradeAreaId ◄────── [TradeAreaPanel]
  OR
[Skip Trade Area] ────▶ tradeAreaId = null

[Draw Boundary]         boundary ◄────────── [MapDrawingStore]
  OR
[Skip Boundary]   ────▶ boundary = Point

[Enter Name]      ────▶ dealName
[Enter Desc]      ────▶ description
[Select Tier]     ────▶ tier

                        [Submit All Data]
                             │
                             ▼
                        ┌─────────────────────────┐
                        │ createDeal(...)         │
                        │  - name                 │
                        │  - description          │
                        │  - tier                 │
                        │  - deal_category        │
                        │  - development_type     │
                        │  - address              │
                        │  - boundary             │
                        └─────────┬───────────────┘
                                  │
                                  ▼
                        ┌─────────────────────────┐
                        │ API Response            │
                        │  - deal.id              │
                        └─────────┬───────────────┘
                                  │
                                  ▼
                        ┌─────────────────────────┐
                        │ Link Geographic Context │
                        │  - trade_area_id        │
                        │  - submarket_id         │
                        │  - msa_id               │
                        │  - active_scope         │
                        └─────────┬───────────────┘
                                  │
                                  ▼
                               [DONE]
                               
                    onDealCreated(deal) ────▶ Parent Component
                    Modal closes
```

---

## Skip Logic Flow

```
┌──────────────────────────────────────────────────────────────┐
│                       SKIP LOGIC PATHS                        │
└──────────────────────────────────────────────────────────────┘

                    [Trade Area Screen]
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
           [Define Area]           [Skip Button]
                │                       │
                ▼                       ▼
         tradeAreaId = X         tradeAreaId = null
                │                       │
                └───────────┬───────────┘
                            ▼
                    [Is New Development?]
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
              YES                      NO
                │                       │
                ▼                       │
        [Boundary Screen]               │
                │                       │
    ┌───────────┴───────────┐           │
    ▼                       ▼           │
[Draw Polygon]         [Skip Button]    │
    │                       │           │
    ▼                       ▼           │
boundary = Polygon    boundary = Point  │
    │                       │           │
    └───────────┬───────────┘           │
                │                       │
                └───────────┬───────────┘
                            ▼
                     [Details Screen]
```

---

## Summary

### Old Flow Characteristics:
- ✗ Linear 6-step process
- ✗ All steps required
- ✗ Many "Next" buttons
- ✗ Cognitive load high
- ✗ 5-6 clicks minimum

### New Flow Characteristics:
- ✓ 3-step process with optional paths
- ✓ 2 steps can be skipped
- ✓ Progressive reveal
- ✓ Cognitive load reduced
- ✓ 2-3 clicks minimum
- ✓ Auto-advance where possible
- ✓ Clear visual indicators

### Result:
**67% faster** for the most common use case (existing property, skip all).

---

**Diagram Version:** 1.0  
**Last Updated:** 2024
