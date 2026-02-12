# Due Diligence Tab - Visual Demo

## 🎨 Component Layout Preview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  🎯 Acquisition DD Mode  |  DD Period: Day 18 of 60 • Expires: Mar 15, 2024     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────┬───────────┬───────────┬───────────┬───────────┐                 │
│  │ Completion│ Red Flags │Inspections│ Days Left │ Critical  │                 │
│  │    68%    │     3     │    4/6    │    42     │     8     │   QUICK STATS   │
│  │  ↗ +12%   │           │  ↗ 2 done │  ↘ of 60  │           │                 │
│  └───────────┴───────────┴───────────┴───────────┴───────────┘                 │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Category Progress                                                               │
│  ⚖️  Legal        [████████░░░░] 60%  3/5                                       │
│  💰 Financial    [████████████] 80%  4/5                                        │
│  🏗️  Physical     [████░░░░░░░░] 40%  2/5                                       │
│  🌿 Environmental[██████░░░░░░] 50%  2/4                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ DD CHECKLIST ────────────────────────┐  ┌─ RED FLAGS (3) ───────────────┐  │
│  │                                        │  │                                │  │
│  │  Filters: [All] Legal Financial...    │  │  HIGH   Environmental          │  │
│  │  ☑ Critical Path Only                 │  │         Potential UST found    │  │
│  │                                        │  │         Phase II needed        │  │
│  │  ☑ Title Search & Insurance           │  │                                │  │
│  │    ⚖️ Legal • Emily • Done 2/14       │  │  MEDIUM Legal                  │  │
│  │    [Complete] 📎 2 docs               │  │         Missing 3 estoppels    │  │
│  │                                        │  │                                │  │
│  │  🔵 Tenant Lease Review  🚩 RED FLAG   │  └────────────────────────────────┘  │
│  │    ⚖️ Legal • Emily • Due 2/25        │                                      │
│  │    [In Progress] 📎 1 doc             │  ┌─ CRITICAL PATH (8) ────────────┐  │
│  │    ⚠️ MEDIUM: Missing estoppels        │  │                                │  │
│  │    ↓ Show Details                     │  │  🔵 Tenant Lease     Due 2/25  │  │
│  │                                        │  │  ⚪ Entity Formation  Due 3/1   │  │
│  │  ☑ Rent Roll Analysis                 │  │  ⚪ Capital Needs    Due 2/28  │  │
│  │    💰 Financial • Sarah • Done 2/11   │  │  🔵 Property PCA     Due 2/24  │  │
│  │    [Complete] 📎 1 doc                │  │  🚫 Phase II Env    Due 3/5   │  │
│  │                                        │  │                                │  │
│  │  🔵 Historical Financials Review       │  └────────────────────────────────┘  │
│  │    💰 Financial • Sarah • Due 2/22    │                                      │
│  │    [In Progress] 📎 2 docs            │  ┌─ INSPECTIONS (4/6) ────────────┐  │
│  │    Note: Waiting on 2023 tax return   │  │                                │  │
│  │                                        │  │  Property PCA    [Scheduled]   │  │
│  │  🔵 Property Condition Assessment      │  │  📅 2024-02-18                │  │
│  │    🏗️ Physical • Marcus • Due 2/24    │  │  👤 Allied Engineering        │  │
│  │    [In Progress] 📎 1 doc             │  │  💰 $8,500                    │  │
│  │    Note: Inspection scheduled Feb 18   │  │                                │  │
│  │                                        │  │  Phase I ESA     [Done]        │  │
│  │  ☑ Phase I Environmental               │  │  📅 2024-02-17                │  │
│  │    🌿 Env • EnviroTech • Done 2/17    │  │  👤 EnviroTech Solutions      │  │
│  │    [Complete] 📎 1 doc   🚩 RED FLAG  │  │  💰 $5,500                    │  │
│  │    🚩 HIGH: Potential UST identified   │  │  Findings:                     │  │
│  │    Phase II ESA recommended            │  │  • UST identified             │  │
│  │                                        │  │  • Phase II needed            │  │
│  │  🚫 Phase II Environmental (blocked)   │  │  View Full Report →           │  │
│  │    🌿 Env • EnviroTech • Due 3/5      │  │                                │  │
│  │    [Blocked] ⚡ Critical               │  │  ALTA Survey     [Done]        │  │
│  │    Blocked: Pending Phase I review     │  │  📅 2024-02-15                │  │
│  │                                        │  │  👤 Precision Land Surveying  │  │
│  │  ⚪ Zoning Verification                │  │  💰 $4,200                    │  │
│  │    ⚖️ Legal • John • Due 2/20         │  │  Findings:                     │  │
│  │    [Pending] 📎 1 doc                 │  │  • Boundaries confirmed       │  │
│  │                                        │  │  • No encroachments           │  │
│  │  ... 18 more items ...                │  │  View Full Report →           │  │
│  │                                        │  │                                │  │
│  └────────────────────────────────────────┘  └────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Performance Mode Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  📋 Performance Compliance Mode                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────┬───────────┬───────────┬───────────┬───────────┐                 │
│  │Compliance │   Open    │  Annual   │   Last    │Remediation│                 │
│  │   Rate    │  Issues   │  Audits   │Inspection │   Items   │   QUICK STATS   │
│  │    96%    │     2     │    3/4    │  15d ago  │     5     │                 │
│  │  ↗ +2%    │           │ ↗ 1 pend  │           │           │                 │
│  └───────────┴───────────┴───────────┴───────────┴───────────┘                 │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Category Progress                                                               │
│  ⚖️  Legal        [████████████] 67%  2/3                                       │
│  💰 Financial    [████████████] 67%  2/3                                        │
│  🏗️  Physical     [██████░░░░░░] 50%  2/4                                       │
│  🌿 Environmental[████████░░░░] 67%  2/3                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ COMPLIANCE CHECKLIST ─────────────┐  ┌─ OPEN ISSUES (2) ──────────────┐   │
│  │                                     │  │                                 │   │
│  │  Filters: [All] Legal Financial... │  │  MEDIUM Financial               │   │
│  │  ☐ Critical Path Only              │  │         Maintenance 8% over     │   │
│  │                                     │  │         Status: Monitoring      │   │
│  │  ☑ Annual Insurance Review          │  │                                 │   │
│  │    ⚖️ Legal • Jennifer • Done 1/28  │  │  LOW    Environmental           │   │
│  │    [Complete] 📎 1 doc              │  │         Groundwater elevated    │   │
│  │                                     │  │         Status: Monitoring      │   │
│  │  🔵 Lease Compliance Audit           │  │                                 │   │
│  │    ⚖️ Legal • Marcus • Due 2/28     │  └─────────────────────────────────┘   │
│  │    [In Progress]                    │                                        │
│  │                                     │  ┌─ REMEDIATION (5) ──────────────┐   │
│  │  ☑ Monthly Financial Close          │  │                                 │   │
│  │    💰 Finance • Team • Done 2/9     │  │  ⚪ Fair Housing Training       │   │
│  │    [Complete] 📎 1 doc              │  │     Due 3/15                    │   │
│  │                                     │  │                                 │   │
│  │  🔵 Budget vs Actual Review          │  │  ⚪ Elevator Inspection         │   │
│  │    💰 Finance • Jennifer • Due 2/25 │  │     Due 3/1                     │   │
│  │    [In Progress] ⚠️ MONITORING       │  │                                 │   │
│  │    ⚠️ Maintenance 8% over budget     │  │  ⚪ Parking Lot Repairs         │   │
│  │                                     │  │     Due 3/10                    │   │
│  │  ☑ Rent Collection Report           │  │                                 │   │
│  │    💰 Property Mgr • Done 2/5       │  │  ⚪ Waste Management Audit      │   │
│  │    [Complete] 📎 1 doc              │  │     Due 3/20                    │   │
│  │                                     │  │                                 │   │
│  │  ☑ Fire Safety Inspection           │  └─────────────────────────────────┘   │
│  │    🏗️ Fire Marshal • Done 1/29     │                                        │
│  │    [Complete] 📎 1 doc              │  ┌─ AUDITS (3/4) ─────────────────┐   │
│  │                                     │  │                                 │   │
│  │  🔵 HVAC Preventive Maintenance      │  │  Fire Safety     [Done]         │   │
│  │    🏗️ Facilities • Lisa • Due 2/20  │  │  📅 2024-01-29                 │   │
│  │    [In Progress]                    │  │  👤 Fire Marshal               │   │
│  │                                     │  │  • All extinguishers current    │   │
│  │  🔵 UST Monitoring ⚠️ MONITORING     │  │  • Exits properly marked       │   │
│  │    🌿 EnviroTech • Due 2/28         │  │                                 │   │
│  │    [In Progress]                    │  │  Property PCA    [Done]         │   │
│  │    ⚠️ Groundwater slightly elevated  │  │  📅 2024-02-12                 │   │
│  │                                     │  │  👤 Allied Engineering         │   │
│  │  ... 8 more items ...               │  │  • Roof 8-10 years life        │   │
│  │                                     │  │  • Parking repairs needed      │   │
│  │                                     │  │                                 │   │
│  └─────────────────────────────────────┘  │  Elevator Safety [Scheduled]    │   │
│                                            │  📅 2024-03-01                 │   │
│                                            │  👤 Otis Elevator              │   │
│                                            └─────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Category Colors
- 🔵 **Legal (Blue):** ⚖️ Contracts, compliance, zoning
- 🟢 **Financial (Green):** 💰 Budgets, analysis, insurance
- 🟣 **Physical (Purple):** 🏗️ Inspections, maintenance, repairs
- 🟠 **Environmental (Orange):** 🌿 ESAs, monitoring, compliance

### Status Colors
- 🟢 **Complete:** Green background, white checkmark
- 🔵 **In Progress:** Blue background, white dot
- 🔴 **Blocked:** Red background, white exclamation
- ⚪ **Pending:** Gray outline, empty circle

### Alert Colors
- 🔴 **High Severity:** Red background, white text
- 🟠 **Medium Severity:** Orange background, white text
- 🟡 **Low Severity:** Yellow background, dark text
- 🔵 **Monitoring:** Blue background, white text

## 📱 Responsive Breakpoints

### Desktop (1280px+)
```
┌─────────────────────────────────────────┐
│  Stats (5 cards)                        │
├─────────────────────────────────────────┤
│  Category Progress (4 bars)             │
├──────────────────────────┬──────────────┤
│  Checklist (2/3 width)   │  Sidebar     │
│  - Many items visible    │  - Red Flags │
│  - Full descriptions     │  - Critical  │
│  - All metadata          │  - Audits    │
└──────────────────────────┴──────────────┘
```

### Tablet (768px - 1279px)
```
┌─────────────────────────────────────────┐
│  Stats (5 cards, 2 rows)                │
├─────────────────────────────────────────┤
│  Category Progress (4 bars, stacked)    │
├─────────────────────────────────────────┤
│  Checklist (full width)                 │
│  - Scrollable                           │
├─────────────────────────────────────────┤
│  Red Flags (full width)                 │
├─────────────────────────────────────────┤
│  Critical Items (full width)            │
├─────────────────────────────────────────┤
│  Audits (full width)                    │
└─────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌─────────────────────┐
│  Stats (stacked)    │
├─────────────────────┤
│  Category Progress  │
│  (stacked)          │
├─────────────────────┤
│  Checklist          │
│  (compressed)       │
├─────────────────────┤
│  Red Flags          │
│  (collapsed)        │
├─────────────────────┤
│  Critical Items     │
│  (collapsed)        │
├─────────────────────┤
│  Audits             │
│  (collapsed)        │
└─────────────────────┘
```

## 🔍 Interaction Examples

### Filter Interaction
```
Before:
[All] Legal Financial Physical Environmental ☐ Critical Path Only
23 items displayed

After selecting "Legal":
All [Legal] Financial Physical Environmental ☐ Critical Path Only
5 items displayed (Legal only)

After toggling Critical Path:
All [Legal] Financial Physical Environmental ☑ Critical Path Only
4 items displayed (Legal + Critical Path)
```

### Item Expansion
```
Collapsed:
🔵 Historical Financials Review
   💰 Financial • Sarah • Due 2/22
   [In Progress] 📎 2 docs
   ↓ Show Details

Expanded:
🔵 Historical Financials Review
   💰 Financial • Sarah • Due 2/22
   [In Progress] 📎 2 docs
   
   Notes: Waiting on 2023 tax return from seller
   
   Documents:
   📄 P&L_2021-2023.pdf • 2024-02-08
   📄 Tax_Returns_2021-2022.pdf • 2024-02-08
   
   ↑ Hide Details
```

### Red Flag Severity
```
HIGH severity:
┌─────────────────────────────────────────┐
│  HIGH   Environmental: Critical Issue   │
│         Requires immediate attention    │
│         Environmental • EnviroTech      │
└─────────────────────────────────────────┘
Red background, bold text

MEDIUM severity:
┌─────────────────────────────────────────┐
│  MEDIUM Legal: Needs follow-up          │
│         Non-blocking but important      │
│         Legal • Emily Chen              │
└─────────────────────────────────────────┘
Orange background, normal text

LOW severity:
┌─────────────────────────────────────────┐
│  LOW    Environmental: Monitoring       │
│         Within acceptable parameters    │
│         Environmental • EnviroTech      │
└─────────────────────────────────────────┘
Yellow background, normal text
```

## 🎬 Animation & Transitions

- **Progress bars:** Smooth width transitions (300ms)
- **Status changes:** Fade and color shift (200ms)
- **Item expansion:** Slide down with fade (250ms)
- **Filter updates:** Fade out old, fade in new items (150ms)
- **Hover states:** Subtle shadow lift (100ms)

## 🎯 Key User Flows

### 1. Check DD Progress
```
1. View Quick Stats → See 68% completion
2. Scan Category Progress → Identify lagging categories
3. Review Critical Path Items → Focus on blockers
```

### 2. Address Red Flags
```
1. See "3 Red Flags" in Quick Stats
2. Review Red Flags Panel → Identify issues
3. Click item in checklist → View full details
4. Access documents → Take action
```

### 3. Track Inspections
```
1. View "4/6 Inspections" in Quick Stats
2. Open Inspections Panel → See schedule
3. View completed inspection → Read findings
4. Download report → Share with team
```

### 4. Monitor Critical Path
```
1. Toggle "Critical Path Only" filter
2. Review 8 critical items
3. Identify blocked items
4. Prioritize actions
```

---

**This visual demo shows the actual user experience of the Due Diligence tab in both acquisition and performance modes!** 🎨
