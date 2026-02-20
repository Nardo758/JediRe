# Property Types & Strategies: End-to-End Testing Checklist

**Test Environment:** Replit (Migrations 038-039 deployed)  
**Test Date:** _________  
**Tester:** _________  
**Build Version:** _________

---

## 🎯 Testing Overview

This checklist covers the complete Property Types & Strategies system, including:
- 51 property types across 9 categories
- 4 default strategies (Build-to-Sell, Flip, Rental, Airbnb/STR)
- Custom strategy builder
- Financial model integration

**Status Legend:**
- ✅ Pass
- ❌ Fail
- ⚠️ Issue (note in comments)
- ⏭️ Skipped

---

## 1️⃣ Deal Creation Flow with Property Types

### 1.1 Property Type Selection UI

**Test:** Navigate to Create New Deal page

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 1.1.1 | Click "Create Deal" or "New Deal" button | Deal creation form loads | ☐ | 📸 Recommended | |
| 1.1.2 | Locate "Property Type" selector | Dropdown/selector is visible and clickable | ☐ | | |
| 1.1.3 | Click property type selector | Dropdown opens showing categorized list | ☐ | 📸 **Required** | |

---

### 1.2 Category Display (9 Categories)

**Test:** Verify all categories display with proper grouping

| # | Category | Properties Expected | Displays? | Color Code? | Status | Notes |
|---|----------|-------------------|-----------|-------------|--------|-------|
| 1.2.1 | **Residential - Single Family** | 6 types | ☐ | ☐ | ☐ | SFR, Townhouse, Manufactured, etc. |
| 1.2.2 | **Residential - Multi-Family** | 7 types | ☐ | ☐ | ☐ | Duplex, Triplex, 5-19 units, etc. |
| 1.2.3 | **Commercial** | 9 types | ☐ | ☐ | ☐ | Retail, Office, Industrial, etc. |
| 1.2.4 | **Hospitality** | 4 types | ☐ | ☐ | ☐ | Hotel, Motel, Resort, Hostel |
| 1.2.5 | **Specialized Residential** | 8 types | ☐ | ☐ | ☐ | Luxury, Student Housing, Senior, etc. |
| 1.2.6 | **Mixed-Use** | 4 types | ☐ | ☐ | ☐ | Residential/Retail, Residential/Office, etc. |
| 1.2.7 | **Land & Development** | 5 types | ☐ | ☐ | ☐ | Raw Land, Subdivided, Agricultural, etc. |
| 1.2.8 | **Special Purpose** | 6 types | ☐ | ☐ | ☐ | Storage, Parking, Marina, etc. |
| 1.2.9 | **Alternative Investments** | 2 types | ☐ | ☐ | ☐ | Notes/Paper, Tax Liens |

**Total Check:** All 51 property types present? ☐ Yes ☐ No

📸 **Screenshot Required:** Full dropdown showing all categories

---

### 1.3 Property Type Selection Testing

**Test:** Select various property types and verify behavior

| # | Property Type | Selectable? | Displays in Form? | Status | Notes |
|---|---------------|-------------|-------------------|--------|-------|
| 1.3.1 | Single Family Residence (SFR) | ☐ | ☐ | ☐ | Most common type |
| 1.3.2 | Duplex (2 units) | ☐ | ☐ | ☐ | |
| 1.3.3 | Small Apartment (5-19 units) | ☐ | ☐ | ☐ | |
| 1.3.4 | Retail Center | ☐ | ☐ | ☐ | Commercial category |
| 1.3.5 | Hotel/Motel | ☐ | ☐ | ☐ | Hospitality category |
| 1.3.6 | Short-Term Rental Property | ☐ | ☐ | ☐ | Airbnb-focused |
| 1.3.7 | Mixed-Use (Residential/Retail) | ☐ | ☐ | ☐ | |
| 1.3.8 | Raw Land | ☐ | ☐ | ☐ | Development category |
| 1.3.9 | Self-Storage Facility | ☐ | ☐ | ☐ | Special purpose |
| 1.3.10 | Change selection mid-flow | Previous selection clears, new selection applies | ☐ | |

---

## 2️⃣ Strategy Selection & Auto-Population

### 2.1 Strategy Selector Display

**Test:** After selecting property type, verify strategy options appear

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 2.1.1 | Select property type (e.g., SFR) | Strategy selector becomes visible/enabled | ☐ | 📸 **Required** | |
| 2.1.2 | Click strategy selector | Shows 4 default strategies + any custom | ☐ | | |
| 2.1.3 | Hover over each strategy | Tooltip/description displays (optional) | ☐ | | |

---

### 2.2 Test All 4 Default Strategies

**Test:** Select each strategy and verify strength ratings appear

#### Strategy: Build-to-Sell

| # | Property Type Tested | Strength Rating | Display Correct? | Status | Notes |
|---|---------------------|-----------------|------------------|--------|-------|
| 2.2.1 | Raw Land | Strong | ☐ | ☐ | Development focus |
| 2.2.2 | Subdivided Lots | Strong | ☐ | ☐ | |
| 2.2.3 | SFR | Moderate/Weak | ☐ | ☐ | Not typical BTS |
| 2.2.4 | Commercial | Varies | ☐ | ☐ | |

**Expected Strength Badge Display:**
- 🟢 Strong (green)
- 🟡 Moderate (yellow/orange)
- 🔴 Weak (red)
- ⚫ Rare (gray)
- ⚪ N/A (not applicable)

📸 **Screenshot Required:** Strength ratings visible

#### Strategy: Flip

| # | Property Type Tested | Strength Rating | Display Correct? | Status | Notes |
|---|---------------------|-----------------|------------------|--------|-------|
| 2.2.5 | SFR | Strong | ☐ | ☐ | Classic flip |
| 2.2.6 | Townhouse | Strong | ☐ | ☐ | |
| 2.2.7 | Duplex | Moderate | ☐ | ☐ | |
| 2.2.8 | Large Apartment (100+ units) | Weak/Rare | ☐ | ☐ | |

#### Strategy: Rental (Long-Term)

| # | Property Type Tested | Strength Rating | Display Correct? | Status | Notes |
|---|---------------------|-----------------|------------------|--------|-------|
| 2.2.9 | SFR | Strong | ☐ | ☐ | |
| 2.2.10 | Duplex | Strong | ☐ | ☐ | |
| 2.2.11 | Small Apartment (5-19 units) | Strong | ☐ | ☐ | |
| 2.2.12 | Hotel | Weak/N/A | ☐ | ☐ | Not rental-focused |

#### Strategy: Airbnb/STR

| # | Property Type Tested | Strength Rating | Display Correct? | Status | Notes |
|---|---------------------|-----------------|------------------|--------|-------|
| 2.2.13 | SFR | Strong | ☐ | ☐ | |
| 2.2.14 | Short-Term Rental Property | Strong | ☐ | ☐ | |
| 2.2.15 | Condo | Strong | ☐ | ☐ | |
| 2.2.16 | Office Building | Weak/N/A | ☐ | ☐ | |

---

### 2.3 Financial Model Auto-Population

**Test:** Verify default values populate based on strategy

| # | Test Scenario | Fields to Check | Expected Behavior | Status | Notes |
|---|---------------|----------------|-------------------|--------|-------|
| 2.3.1 | Select SFR + Flip | Hold period | 6-12 months | ☐ | |
| 2.3.2 | | Exit strategy | "Sale" | ☐ | |
| 2.3.3 | | Rehab budget % | 15-25% of purchase | ☐ | |
| 2.3.4 | Select Duplex + Rental | Hold period | 5-10 years or "Hold" | ☐ | |
| 2.3.5 | | Cap rate | 6-8% (market dependent) | ☐ | |
| 2.3.6 | | Exit strategy | "Refinance" or "Hold" | ☐ | |
| 2.3.7 | | Monthly rent assumptions | Auto-calculated or prompted | ☐ | |
| 2.3.8 | Select SFR + Airbnb/STR | Hold period | 3-5 years | ☐ | |
| 2.3.9 | | Nightly rate | Prompted or estimated | ☐ | |
| 2.3.10 | | Occupancy rate | 60-75% default | ☐ | |
| 2.3.11 | | Operating expenses % | Higher than LT rental (30-40%) | ☐ | |
| 2.3.12 | Select Land + Build-to-Sell | Hold period | 12-24 months | ☐ | |
| 2.3.13 | | Development costs | Prompted/required field | ☐ | |
| 2.3.14 | | Exit strategy | "Sale after construction" | ☐ | |

📸 **Screenshot Required:** Financial model with auto-populated values

**Edge Case Testing:**

| # | Edge Case | Expected Behavior | Status | Notes |
|---|-----------|-------------------|--------|-------|
| 2.3.15 | Switch strategy after auto-population | Values update to new strategy defaults | ☐ | |
| 2.3.16 | Manual override of auto-populated field | User value persists, doesn't reset | ☐ | |
| 2.3.17 | Invalid property + strategy combo (e.g., Office + Airbnb) | Warning or weak rating shown | ☐ | |

---

## 3️⃣ Settings UI - Property Types Settings Page

### 3.1 Navigation

**Test:** Access Property Types settings

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 3.1.1 | Click main navigation menu | Settings option visible | ☐ | | |
| 3.1.2 | Click "Settings" | Settings page loads | ☐ | | |
| 3.1.3 | Find "Property Types" section/tab | Visible in settings menu | ☐ | 📸 Recommended | |
| 3.1.4 | Click "Property Types" | Property Types settings page loads | ☐ | 📸 **Required** | |

---

### 3.2 Property Types Display (51 Types)

**Test:** Verify all property types display in settings

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 3.2.1 | Count total property types | 51 types visible | ☐ | | Use browser find: count entries |
| 3.2.2 | Verify category headers | 9 category headers visible | ☐ | | |
| 3.2.3 | Check color coding | Each category has distinct color | ☐ | 📸 **Required** | |
| 3.2.4 | Check alphabetical/logical order | Types ordered within categories | ☐ | | |

**Category Breakdown Verification:**

| Category | Expected Count | Actual Count | Match? | Status |
|----------|---------------|--------------|--------|--------|
| Residential - Single Family | 6 | _____ | ☐ | ☐ |
| Residential - Multi-Family | 7 | _____ | ☐ | ☐ |
| Commercial | 9 | _____ | ☐ | ☐ |
| Hospitality | 4 | _____ | ☐ | ☐ |
| Specialized Residential | 8 | _____ | ☐ | ☐ |
| Mixed-Use | 4 | _____ | ☐ | ☐ |
| Land & Development | 5 | _____ | ☐ | ☐ |
| Special Purpose | 6 | _____ | ☐ | ☐ |
| Alternative Investments | 2 | _____ | ☐ | ☐ |
| **TOTAL** | **51** | **_____** | ☐ | ☐ |

---

### 3.3 Multi-Select Functionality

**Test:** Enable/disable property types for deal creation

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 3.3.1 | Check if all types enabled by default | All 51 checkboxes checked (or all enabled) | ☐ | | |
| 3.3.2 | Uncheck a single property type | Checkbox unchecks, change indicated | ☐ | | |
| 3.3.3 | Uncheck 5-10 random types | All uncheck successfully | ☐ | | |
| 3.3.4 | Check "Select All" button (if exists) | All types become selected | ☐ | | |
| 3.3.5 | Click "Deselect All" button (if exists) | All types become unselected | ☐ | | |
| 3.3.6 | Select by category (if feature exists) | All types in category toggle together | ☐ | | |

📸 **Screenshot Required:** Multi-select interface with some checked/unchecked

---

### 3.4 Strategy Display with Strength Badges

**Test:** Verify strategies and strength ratings show in settings

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 3.4.1 | Locate strategy columns/section | Build-to-Sell, Flip, Rental, Airbnb/STR visible | ☐ | 📸 **Required** | |
| 3.4.2 | Check SFR row | Shows strength badges for all 4 strategies | ☐ | | |
| 3.4.3 | Verify badge colors | Strong=Green, Moderate=Yellow, Weak=Red, etc. | ☐ | 📸 **Required** | |
| 3.4.4 | Hover over strength badge | Tooltip with explanation (optional feature) | ☐ | | |
| 3.4.5 | Scroll through all 51 types | Each has strategy strength indicators | ☐ | | |

**Sample Strength Matrix Verification:**

| Property Type | Build-to-Sell | Flip | Rental | Airbnb/STR | All Visible? | Status |
|---------------|---------------|------|--------|------------|--------------|--------|
| SFR | Moderate | Strong | Strong | Strong | ☐ | ☐ |
| Raw Land | Strong | N/A | N/A | N/A | ☐ | ☐ |
| Duplex | Weak | Moderate | Strong | Strong | ☐ | ☐ |
| Office Building | Moderate | Rare | Moderate | Weak | ☐ | ☐ |
| Hotel | Rare | Rare | Weak | Moderate | ☐ | ☐ |

---

### 3.5 Saving Preferences

**Test:** Save and persist property type preferences

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 3.5.1 | Uncheck 5 property types | Changes reflected in UI | ☐ | | |
| 3.5.2 | Click "Save" or "Save Preferences" | Success message appears | ☐ | 📸 Recommended | |
| 3.5.3 | Navigate away from settings | Settings page closes | ☐ | | |
| 3.5.4 | Return to Property Types settings | Previous selections preserved | ☐ | | |
| 3.5.5 | Go to Create Deal page | Only enabled property types appear | ☐ | 📸 **Required** | |
| 3.5.6 | Log out and log back in | Preferences still saved | ☐ | | Critical test |

**Edge Cases:**

| # | Edge Case | Expected Behavior | Status | Notes |
|---|-----------|-------------------|--------|-------|
| 3.5.7 | Disable all property types | Warning: "Must enable at least 1 type" | ☐ | |
| 3.5.8 | Make changes but don't save, navigate away | Prompt: "Unsaved changes" (if implemented) | ☐ | |
| 3.5.9 | Click "Reset to Defaults" (if exists) | All 51 types re-enabled | ☐ | |

---

## 4️⃣ Custom Strategy Builder

### 4.1 Navigation to Custom Strategies

**Test:** Access custom strategy builder

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.1.1 | Navigate to Settings | Settings page loads | ☐ | | |
| 4.1.2 | Find "Strategies" or "Custom Strategies" section | Section visible in settings | ☐ | 📸 Recommended | |
| 4.1.3 | Click into Custom Strategies | Custom strategy management page loads | ☐ | 📸 **Required** | |

---

### 4.2 View Existing Strategies

**Test:** View default and custom strategies

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.2.1 | View strategy list | 4 default strategies listed | ☐ | | Build-to-Sell, Flip, Rental, Airbnb/STR |
| 4.2.2 | Check if custom strategies exist | Any custom strategies listed below defaults | ☐ | | |
| 4.2.3 | Verify default strategies not editable | Defaults are read-only or marked "Default" | ☐ | | |

---

### 4.3 Create New Custom Strategy

**Test:** Create a brand new custom strategy

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.3.1 | Click "Create Strategy" or "New Strategy" | Strategy creation form opens | ☐ | 📸 **Required** | |
| 4.3.2 | Enter strategy name: "BRRRR Method" | Name field accepts text | ☐ | | |
| 4.3.3 | Enter description | Description field accepts text | ☐ | | |
| 4.3.4 | Set default hold period: "5+ years" | Field accepts input | ☐ | | |
| 4.3.5 | Set default cap rate: "8%" | Field accepts numeric input | ☐ | | |
| 4.3.6 | Set exit strategy: "Refinance + Hold" | Dropdown or text field works | ☐ | | |
| 4.3.7 | Click "Save" or "Create Strategy" | Strategy saved, appears in list | ☐ | 📸 **Required** | |

**Custom Strategy Fields to Test:**

| Field Name | Test Input | Accepts Input? | Validates Correctly? | Status | Notes |
|------------|------------|----------------|---------------------|--------|-------|
| Strategy Name | "Value-Add Multifamily" | ☐ | ☐ | ☐ | |
| Description | "Force appreciation through renovations..." | ☐ | ☐ | ☐ | |
| Hold Period | "3-7 years" | ☐ | ☐ | ☐ | |
| Cap Rate Target | "7.5%" | ☐ | ☐ | ☐ | |
| Exit Strategy | "Sale after stabilization" | ☐ | ☐ | ☐ | |
| Target ROI | "20%" | ☐ | ☐ | ☐ | Optional field |
| Cash-on-Cash Return | "8-12%" | ☐ | ☐ | ☐ | Optional field |

---

### 4.4 Assign Strategy to Property Types

**Test:** Apply custom strategy to specific property types

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.4.1 | Open custom strategy "BRRRR Method" | Strategy details open | ☐ | | |
| 4.4.2 | Find "Apply to Property Types" section | Multi-select property type interface | ☐ | 📸 **Required** | |
| 4.4.3 | Select: SFR, Duplex, Triplex, Fourplex | Multiple types can be selected | ☐ | | |
| 4.4.4 | Set strength ratings for each | Strong/Moderate/Weak options available | ☐ | 📸 **Required** | |
| 4.4.5 | Save property type assignments | Changes persist | ☐ | | |
| 4.4.6 | Navigate to Create Deal, select SFR | "BRRRR Method" appears in strategy dropdown | ☐ | 📸 **Required** | Critical test |

**Property Type Assignment Matrix:**

| Custom Strategy | Property Type | Strength Rating | Appears in Dropdown? | Status | Notes |
|----------------|---------------|----------------|---------------------|--------|-------|
| BRRRR Method | SFR | Strong | ☐ | ☐ | |
| BRRRR Method | Duplex | Strong | ☐ | ☐ | |
| Value-Add | Small Apartment | Strong | ☐ | ☐ | |
| Value-Add | Medium Apartment | Moderate | ☐ | ☐ | |

---

### 4.5 Edit Existing Custom Strategy

**Test:** Modify a custom strategy

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.5.1 | Click "Edit" on custom strategy | Edit form opens with current values | ☐ | | |
| 4.5.2 | Change strategy name | Name updates | ☐ | | |
| 4.5.3 | Change hold period from "5+ years" to "3-5 years" | Update accepted | ☐ | | |
| 4.5.4 | Add/remove property type assignments | Changes apply | ☐ | | |
| 4.5.5 | Click "Save Changes" | Strategy updates, changes reflected in list | ☐ | | |
| 4.5.6 | Verify changes in Create Deal flow | Updated strategy appears with new defaults | ☐ | 📸 Recommended | |

---

### 4.6 Duplicate Strategy

**Test:** Clone an existing strategy

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.6.1 | Find "Duplicate" button on strategy | Button visible for custom strategies | ☐ | | |
| 4.6.2 | Click "Duplicate" on "BRRRR Method" | Copy created: "BRRRR Method (Copy)" | ☐ | | |
| 4.6.3 | Verify duplicate has same settings | All fields match original | ☐ | | |
| 4.6.4 | Edit duplicate strategy name | Can modify independently from original | ☐ | | |
| 4.6.5 | Try duplicating a default strategy | Should work, creates editable copy | ☐ | | Useful feature |

---

### 4.7 Delete Custom Strategy

**Test:** Remove a custom strategy

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.7.1 | Click "Delete" on custom strategy | Confirmation prompt appears | ☐ | | |
| 4.7.2 | Click "Cancel" | Deletion cancelled, strategy remains | ☐ | | |
| 4.7.3 | Click "Delete" again, confirm | Strategy removed from list | ☐ | | |
| 4.7.4 | Navigate to Create Deal | Deleted strategy no longer appears | ☐ | | |
| 4.7.5 | Try deleting a default strategy | Not allowed or warning shown | ☐ | | Defaults should be protected |

---

### 4.8 Custom Metrics Builder

**Test:** Define custom financial metrics (if feature exists)

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 4.8.1 | Open custom strategy editor | Metrics section visible | ☐ | | |
| 4.8.2 | Click "Add Custom Metric" | Metric builder opens | ☐ | 📸 **Required** | |
| 4.8.3 | Create metric: "DSCR Target" | Name field works | ☐ | | Debt Service Coverage Ratio |
| 4.8.4 | Set metric type: Number | Type selector works | ☐ | | |
| 4.8.5 | Set default value: "1.25" | Value field accepts input | ☐ | | |
| 4.8.6 | Set metric formula (if supported) | Formula builder works | ☐ | | Advanced feature |
| 4.8.7 | Save custom metric | Appears in strategy metrics list | ☐ | | |
| 4.8.8 | Create deal with this strategy | Custom metric field appears in financial model | ☐ | 📸 **Required** | Critical test |

**Custom Metrics Test Cases:**

| Metric Name | Type | Default Value | Displays in Deal? | Status | Notes |
|-------------|------|---------------|-------------------|--------|-------|
| DSCR Target | Number | 1.25 | ☐ | ☐ | |
| Max LTV | Percentage | 75% | ☐ | ☐ | |
| Minimum Cash Reserve | Currency | $50,000 | ☐ | ☐ | |
| Required IRR | Percentage | 15% | ☐ | ☐ | |

---

## 5️⃣ Financial Model Integration

### 5.1 Create Deal with Property Type + Strategy

**Test:** Full integration test

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.1.1 | Navigate to Create New Deal | Deal form loads | ☐ | | |
| 5.1.2 | Enter deal name: "123 Main St Test" | Name accepted | ☐ | | |
| 5.1.3 | Select Property Type: "Duplex (2 units)" | Property type selected | ☐ | | |
| 5.1.4 | Select Strategy: "Rental (Long-Term)" | Strategy selected | ☐ | | |
| 5.1.5 | Observe financial model section | Auto-population begins | ☐ | 📸 **Required** | |

---

### 5.2 Blue Banner with Strategy Defaults

**Test:** Verify strategy defaults notification

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.2.1 | After selecting strategy, locate blue banner | Banner visible above/within financial model | ☐ | 📸 **Required** | |
| 5.2.2 | Read banner text | Shows strategy name + "defaults applied" message | ☐ | | Example: "Rental strategy defaults applied" |
| 5.2.3 | Banner lists default values | Key defaults shown (hold period, cap rate, etc.) | ☐ | 📸 **Required** | |
| 5.2.4 | Banner color/styling | Distinct blue background, noticeable | ☐ | | |

**Example Banner Content to Verify:**

```
ℹ️ Rental (Long-Term) Strategy Applied
• Hold Period: 5-10 years
• Target Cap Rate: 7.0%
• Exit Strategy: Refinance or Hold
• Operating Expenses: 30% of gross income
[Customize] [Reset to Defaults]
```

---

### 5.3 "Customize" Button Functionality

**Test:** Modify auto-populated values

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.3.1 | Click "Customize" button on banner | Banner collapses or fields unlock | ☐ | | |
| 5.3.2 | Manually change hold period from 7 years to 10 years | Value updates, accepted | ☐ | | |
| 5.3.3 | Change cap rate from 7% to 8.5% | Value updates | ☐ | | |
| 5.3.4 | Verify customization indicator | Banner updates to show "Customized" | ☐ | | Example: "⚙️ Customized from Rental defaults" |
| 5.3.5 | Save deal | Custom values persist | ☐ | | |
| 5.3.6 | Re-open deal | Customized values still present | ☐ | 📸 Recommended | Critical test |

---

### 5.4 "Reset to Defaults" Button

**Test:** Restore strategy defaults after customization

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.4.1 | Customize multiple fields (hold period, cap rate, exit strategy) | All changes apply | ☐ | | |
| 5.4.2 | Click "Reset to Defaults" button | Confirmation prompt appears | ☐ | | "This will overwrite your changes" |
| 5.4.3 | Click "Cancel" | Changes preserved | ☐ | | |
| 5.4.4 | Click "Reset to Defaults" again, confirm | All fields revert to strategy defaults | ☐ | 📸 **Required** | |
| 5.4.5 | Verify banner updates | Shows "Defaults restored" or similar | ☐ | | |

---

### 5.5 Calculation Accuracy

**Test:** Verify financial calculations update correctly

**Test Scenario: Duplex Rental**
- Purchase Price: $300,000
- Strategy: Rental (Long-Term)
- Expected Auto-Fill: Hold 7 years, Cap Rate 7%, Exit: Hold

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.5.1 | Enter purchase price: $300,000 | Value accepted | ☐ | | |
| 5.5.2 | Strategy auto-fills cap rate: 7% | Value appears | ☐ | | |
| 5.5.3 | Enter annual rent: $30,000 | Net Operating Income calculates | ☐ | | |
| 5.5.4 | Verify NOI calculation | $30,000 - (30% OpEx) = $21,000 NOI | ☐ | | If 30% default OpEx |
| 5.5.5 | Verify Property Value (from cap rate) | $21,000 / 0.07 = ~$300,000 | ☐ | | Circular check |
| 5.5.6 | Verify Cash-on-Cash return | (Annual Cash Flow / Cash Invested) × 100 | ☐ | | |
| 5.5.7 | Change cap rate to 8% | All dependent calculations update | ☐ | 📸 Recommended | |

**Test Scenario: SFR Flip**
- Purchase Price: $200,000
- Strategy: Flip
- Expected Auto-Fill: Hold 8 months, Rehab 20%, Exit: Sale

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.5.8 | Enter purchase price: $200,000 | Value accepted | ☐ | | |
| 5.5.9 | Strategy suggests rehab: $40,000 (20%) | Auto-calculated or suggested | ☐ | | |
| 5.5.10 | Enter ARV (After Repair Value): $280,000 | Value accepted | ☐ | | |
| 5.5.11 | Verify profit calculation | $280,000 - $200,000 - $40,000 - holding costs | ☐ | | |
| 5.5.12 | Verify ROI percentage | (Profit / Total Investment) × 100 | ☐ | | |
| 5.5.13 | Change hold period from 8 to 12 months | Holding costs recalculate | ☐ | | |

**Test Scenario: Raw Land + Build-to-Sell**
- Purchase Price: $100,000
- Strategy: Build-to-Sell
- Expected: Development costs required, 18-month timeline

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 5.5.14 | Select Raw Land + Build-to-Sell | Development cost fields appear | ☐ | 📸 **Required** | |
| 5.5.15 | Enter development costs: $400,000 | Value accepted | ☐ | | |
| 5.5.16 | Enter projected sale price: $650,000 | Value accepted | ☐ | | |
| 5.5.17 | Verify profit calculation | $650,000 - $100,000 - $400,000 - soft costs | ☐ | | |
| 5.5.18 | Verify holding period default | 18-24 months | ☐ | | |
| 5.5.19 | Verify ROI calculation | (Profit / Total Investment) × 100 | ☐ | | |

---

### 5.6 Edge Cases & Error Handling

**Test:** System behavior with unusual inputs

| # | Edge Case | Expected Behavior | Status | Screenshot | Notes |
|---|-----------|-------------------|--------|------------|-------|
| 5.6.1 | Select property type WITHOUT strategy | No auto-population, manual entry required | ☐ | | |
| 5.6.2 | Switch property type mid-deal | Prompt: "Strategy may no longer apply" | ☐ | | |
| 5.6.3 | Switch strategy mid-deal (after customization) | Prompt: "Overwrite customizations?" | ☐ | 📸 Recommended | |
| 5.6.4 | Enter negative purchase price | Validation error | ☐ | | |
| 5.6.5 | Enter cap rate > 100% | Validation warning | ☐ | | |
| 5.6.6 | Select incompatible property + strategy (e.g., Hotel + Flip) | Warning shown or weak rating displayed | ☐ | | |
| 5.6.7 | Leave required strategy fields blank | Cannot save deal until filled | ☐ | | |
| 5.6.8 | Create deal with custom strategy | Custom strategy values apply correctly | ☐ | | |
| 5.6.9 | Delete a strategy that's used in existing deals | Warning: "Used in X deals" OR deals unaffected | ☐ | | Important safeguard |

---

## 6️⃣ Cross-Feature Integration Tests

### 6.1 Settings → Deal Creation Flow

**Test:** Settings changes impact deal creation

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 6.1.1 | Disable 10 property types in Settings | Save successful | ☐ | | |
| 6.1.2 | Create new deal | Only enabled property types appear | ☐ | 📸 **Required** | |
| 6.1.3 | Re-enable those 10 types | Save successful | ☐ | | |
| 6.1.4 | Create new deal | All property types appear again | ☐ | | |

---

### 6.2 Custom Strategy → Deal Creation → Edit

**Test:** Custom strategy lifecycle

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 6.2.1 | Create custom strategy "Test Strategy" | Saved | ☐ | | |
| 6.2.2 | Assign to SFR, Duplex with Strong rating | Saved | ☐ | | |
| 6.2.3 | Create deal with SFR + "Test Strategy" | Auto-population works | ☐ | | |
| 6.2.4 | Save deal | Deal saved | ☐ | | |
| 6.2.5 | Edit "Test Strategy" (change cap rate) | Updated | ☐ | | |
| 6.2.6 | Open existing deal (created in 6.2.3) | Still shows original cap rate (deal is snapshot) | ☐ | | Deals shouldn't auto-update |
| 6.2.7 | Create NEW deal with updated "Test Strategy" | Shows new cap rate | ☐ | | New deals get updated defaults |

---

### 6.3 Performance & Responsiveness

**Test:** System handles data volume

| # | Test Step | Expected Result | Status | Screenshot | Notes |
|---|-----------|----------------|--------|------------|-------|
| 6.3.1 | Load Property Types settings (51 types) | Page loads in < 3 seconds | ☐ | | |
| 6.3.2 | Toggle all 51 property types on/off | No lag or freezing | ☐ | | |
| 6.3.3 | Create 5 custom strategies | All save successfully | ☐ | | |
| 6.3.4 | Open deal creation dropdown | Loads property types + strategies quickly | ☐ | | |
| 6.3.5 | Switch between strategies 10 times rapidly | Auto-population updates each time | ☐ | | |

---

## 7️⃣ Known Issues & Edge Cases Watch List

### 7.1 Document Known Issues

**Issues to watch for during testing:**

| # | Potential Issue | How to Test | Observed? | Severity | Notes |
|---|----------------|-------------|-----------|----------|-------|
| 7.1.1 | Strategies don't appear for disabled property types | Disable type in settings, try to create deal | ☐ | Medium | Expected behavior |
| 7.1.2 | Strength ratings don't match property type | Check incongruous combos (Office + Airbnb) | ☐ | High | Data integrity |
| 7.1.3 | Auto-population fails silently | Create deal, check if fields populate | ☐ | High | Critical failure |
| 7.1.4 | Banner doesn't display on mobile | Test on mobile/responsive view | ☐ | Low | UX issue |
| 7.1.5 | Custom strategy changes affect old deals | Edit strategy, check old deals | ☐ | Medium | Should be snapshot-based |
| 7.1.6 | Calculation errors with decimal cap rates | Test cap rate 7.25%, 8.75%, etc. | ☐ | High | Math accuracy |
| 7.1.7 | Strategy dropdown doesn't show custom strategies | Create custom strategy, check dropdown | ☐ | High | Feature broken |
| 7.1.8 | Reset button doesn't work after multiple customizations | Customize 5+ fields, click Reset | ☐ | Medium | |
| 7.1.9 | Property type counts don't match (not 51 total) | Count manually, use browser find | ☐ | High | Data migration issue |
| 7.1.10 | Color coding not distinct enough | Check accessibility/contrast | ☐ | Low | UX/accessibility |
| 7.1.11 | Settings don't save on logout | Change settings, logout, login, check | ☐ | High | Critical bug |
| 7.1.12 | Duplicate strategy names allowed | Try creating two "My Strategy" | ☐ | Medium | Should prevent |

---

### 7.2 Browser Compatibility

**Test in multiple browsers (if possible):**

| Browser | Version | Property Types Load? | Strategies Work? | Calculations Correct? | Status | Notes |
|---------|---------|---------------------|------------------|----------------------|--------|-------|
| Chrome | _____ | ☐ | ☐ | ☐ | ☐ | Primary browser |
| Firefox | _____ | ☐ | ☐ | ☐ | ☐ | |
| Safari | _____ | ☐ | ☐ | ☐ | ☐ | |
| Edge | _____ | ☐ | ☐ | ☐ | ☐ | |
| Mobile Safari | _____ | ☐ | ☐ | ☐ | ☐ | iOS |
| Mobile Chrome | _____ | ☐ | ☐ | ☐ | ☐ | Android |

---

### 7.3 Responsive Design

**Test UI on different screen sizes:**

| Screen Size | Property Type Dropdown | Strategy Selector | Settings Page | Banner Display | Status | Notes |
|-------------|----------------------|-------------------|---------------|----------------|--------|-------|
| Desktop (1920×1080) | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Laptop (1366×768) | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Tablet (768×1024) | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Mobile (375×667) | ☐ | ☐ | ☐ | ☐ | ☐ | iPhone SE size |

---

## 8️⃣ Migration Verification (038-039)

### 8.1 Database Migration Checks

**Verify migrations 038-039 applied correctly:**

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|----------------|--------|-------|
| 8.1.1 | Check database for `property_types` table | Table exists with 51 records | ☐ | Use DB inspector or query |
| 8.1.2 | Verify `strategies` table | Table exists with 4+ records | ☐ | Default strategies present |
| 8.1.3 | Check `property_type_strategies` junction table | Table exists, relates types to strategies | ☐ | |
| 8.1.4 | Verify foreign keys | Relationships intact | ☐ | |
| 8.1.5 | Check for any migration errors in logs | No errors | ☐ | Review Replit logs |

---

### 8.2 Data Integrity

**Verify data quality:**

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|----------------|--------|-------|
| 8.2.1 | Count property types | Exactly 51 | ☐ | |
| 8.2.2 | Check for duplicate property type names | No duplicates | ☐ | |
| 8.2.3 | Verify all property types have categories | No NULL categories | ☐ | |
| 8.2.4 | Check strategy names | Build-to-Sell, Flip, Rental, Airbnb/STR present | ☐ | |
| 8.2.5 | Verify strength ratings data | All property-strategy combos have ratings | ☐ | |

---

## 9️⃣ User Acceptance Scenarios

### 9.1 Scenario: New User Creates First Deal

**Persona:** First-time user, wants to analyze a house flip

| # | Step | User Action | Expected Experience | Pass? | Notes |
|---|------|-------------|---------------------|-------|-------|
| 9.1.1 | Start | Clicks "Create Deal" | Intuitive form appears | ☐ | |
| 9.1.2 | Property Type | Selects "Single Family Residence" | Easy to find in Residential category | ☐ | |
| 9.1.3 | Strategy | Sees "Flip" with Strong rating | Clear this is a good match | ☐ | |
| 9.1.4 | Auto-fill | Clicks Flip, values populate | Guidance provided, not empty form | ☐ | |
| 9.1.5 | Customize | Changes hold period to 10 months | Easy to customize | ☐ | |
| 9.1.6 | Save | Saves deal | Success, no errors | ☐ | |

---

### 9.2 Scenario: Power User Creates Custom Strategy

**Persona:** Experienced investor, has unique "Syndication" strategy

| # | Step | User Action | Expected Experience | Pass? | Notes |
|---|------|-------------|---------------------|-------|-------|
| 9.2.1 | Navigate | Settings → Strategies | Easy to find | ☐ | |
| 9.2.2 | Create | Clicks "New Strategy" | Form is comprehensive | ☐ | |
| 9.2.3 | Define | Fills in: Name, hold period, metrics | All fields available | ☐ | |
| 9.2.4 | Assign | Applies to Apartment buildings | Multi-select works | ☐ | |
| 9.2.5 | Use | Creates deal with custom strategy | Shows up in dropdown | ☐ | |
| 9.2.6 | Verify | Auto-population uses custom defaults | Works as expected | ☐ | |

---

### 9.3 Scenario: User Disables Irrelevant Property Types

**Persona:** Only does residential, wants to hide commercial

| # | Step | User Action | Expected Experience | Pass? | Notes |
|---|------|-------------|---------------------|-------|-------|
| 9.3.1 | Navigate | Settings → Property Types | Easy to find | ☐ | |
| 9.3.2 | Disable | Unchecks all Commercial category | Batch action or one-by-one | ☐ | |
| 9.3.3 | Save | Clicks Save | Success message | ☐ | |
| 9.3.4 | Verify | Goes to Create Deal | Commercial types hidden | ☐ | |
| 9.3.5 | Re-enable | Returns to settings, re-enables | Easy to undo | ☐ | |

---

## 🏁 Final Checklist Summary

### Critical Must-Pass Tests

- [ ] All 51 property types display correctly (Section 1.2)
- [ ] All 4 default strategies work (Section 2.2)
- [ ] Auto-population functions (Section 2.3)
- [ ] Settings persistence across sessions (Section 3.5.6)
- [ ] Custom strategy appears in deal dropdown (Section 4.4.6)
- [ ] Blue banner displays strategy defaults (Section 5.2)
- [ ] Reset to Defaults works (Section 5.4.4)
- [ ] Calculations are accurate (Section 5.5)

### High Priority

- [ ] Multi-select functionality (Section 3.3)
- [ ] Strength ratings display correctly (Section 3.4)
- [ ] Custom strategy creation (Section 4.3)
- [ ] Customize button functionality (Section 5.3)
- [ ] Settings affect deal creation (Section 6.1)

### Medium Priority

- [ ] Category color coding (Section 3.2.3)
- [ ] Strategy duplication (Section 4.6)
- [ ] Custom metrics builder (Section 4.8)
- [ ] Mobile responsiveness (Section 7.3)

### Nice-to-Have

- [ ] Tooltips on hover (Section 2.1.3)
- [ ] Browser compatibility (Section 7.2)
- [ ] Performance under load (Section 6.3)

---

## 📸 Required Screenshots Checklist

- [ ] Property type dropdown showing all categories (1.1.3)
- [ ] Full dropdown with all 51 property types (1.2)
- [ ] Strategy selector with strength ratings (2.1.1)
- [ ] Strength rating badges (2.2)
- [ ] Financial model auto-populated (2.3)
- [ ] Property Types Settings page (3.1.4)
- [ ] Category color coding (3.2.3)
- [ ] Multi-select interface (3.3)
- [ ] Strategy strength indicators in settings (3.4.1, 3.4.3)
- [ ] Custom Strategies page (4.1.3)
- [ ] Strategy creation form (4.3.1, 4.3.7)
- [ ] Property type assignment interface (4.4.2, 4.4.4)
- [ ] Custom strategy in dropdown (4.4.6)
- [ ] Custom metrics builder (4.8.2, 4.8.8)
- [ ] Blue banner with strategy defaults (5.2.1, 5.2.3)
- [ ] Reset to Defaults confirmation (5.4.4)
- [ ] Deal with property type + strategy (5.1.5)

---

## 🐛 Bug Report Template

**If you find issues during testing, document them here:**

### Bug #1
- **Section:** 
- **Severity:** Critical / High / Medium / Low
- **Description:** 
- **Steps to Reproduce:**
  1. 
  2. 
  3. 
- **Expected Behavior:** 
- **Actual Behavior:** 
- **Screenshot:** 
- **Browser/Device:** 

---

## ✅ Testing Sign-Off

**Tester Name:** ___________________  
**Date Completed:** ___________________  
**Overall Status:** ☐ All Critical Tests Pass  ☐ Issues Found (see bug reports)  
**Notes:**

---

## 📋 Next Steps After Testing

1. **If all tests pass:**
   - Document any UX improvements for future iterations
   - Consider user training materials
   - Plan rollout communication

2. **If issues found:**
   - Prioritize bugs by severity
   - Create GitHub issues / task tickets
   - Retest after fixes deployed

3. **Post-Launch:**
   - Monitor user adoption of property types
   - Track which strategies are most used
   - Gather feedback on custom strategy builder

---

**End of Testing Checklist**

*This document is version-controlled. Update as features evolve.*
