# User Preferences Settings UI Specification

## Location
**Settings → Acquisition Preferences** (or **Account → Preferences**)

---

## Page Layout

### Section 1: Asset Types
**Label:** "What types of properties are you looking for?"

**Input:** Multi-select checkboxes

**Options:**
- [ ] Multifamily
- [ ] Single-Family
- [ ] Land
- [ ] Assisted Living Facility (ALF)
- [ ] Memory Care
- [ ] Retail
- [ ] Office
- [ ] Industrial
- [ ] Mixed-Use
- [ ] Hospitality (Hotels/Motels)
- [ ] Self-Storage
- [ ] Mobile Home Parks
- [ ] Student Housing

**Database field:** `property_types` (text array)

---

### Section 2: Vintage (Year Built)
**Label:** "Property age preference?"

**Input:** Dropdown or Radio buttons

**Options:**
- Any year
- 2000 or newer
- 1990 or newer
- 1980 or newer
- 1970 or newer
- 1960 or newer
- Pre-1960

**Database field:** `min_year_built` (integer)

**Mapping:**
- "2000 or newer" → `min_year_built: 2000`
- "1990 or newer" → `min_year_built: 1990`
- "1980 or newer" → `min_year_built: 1980`
- etc.

**Additional option:** Custom year range
- Min year: [____]
- Max year: [____]

---

### Section 3: Geography
**Label:** "Target markets?"

**Input:** Multi-select state checkboxes (organized by region)

#### South
- [ ] Georgia (GA)
- [ ] Florida (FL)
- [ ] North Carolina (NC)
- [ ] South Carolina (SC)
- [ ] Tennessee (TN)
- [ ] Alabama (AL)
- [ ] Mississippi (MS)
- [ ] Louisiana (LA)

#### Southwest
- [ ] Texas (TX)
- [ ] Arizona (AZ)
- [ ] Oklahoma (OK)
- [ ] New Mexico (NM)

#### West
- [ ] California (CA)
- [ ] Nevada (NV)
- [ ] Colorado (CO)
- [ ] Washington (WA)
- [ ] Oregon (OR)

#### Midwest
- [ ] Ohio (OH)
- [ ] Illinois (IL)
- [ ] Michigan (MI)
- [ ] Indiana (IN)
- [ ] Missouri (MO)

#### Northeast
- [ ] New York (NY)
- [ ] Pennsylvania (PA)
- [ ] New Jersey (NJ)
- [ ] Massachusetts (MA)
- [ ] Maryland (MD)

**Alternative UI:** 
- Interactive US map (click states to select)
- OR searchable multi-select dropdown

**Database field:** `states` (text array)

**Optional: Specific cities/metros**
- Add specific cities within selected states
- Example: "Atlanta", "Miami", "Austin", "Charlotte"
- **Database field:** `cities` (text array)

---

### Section 4: Unit Count (for Multifamily)
**Label:** "Unit count (for multifamily properties)?"

**Input:** Number inputs or Dropdown

**Options (Dropdown):**
- Any size
- 5-20 units (Small)
- 20-50 units (Medium)
- 50-100 units (Large)
- 100-200 units (Major)
- 200+ units (Institutional)
- Custom range

**Custom range inputs:**
- Minimum units: [____]
- Maximum units: [____]

**Database fields:** `min_units`, `max_units`

---

### Section 5: Price Range
**Label:** "Price range?"

**Input:** Number inputs with $ formatting

**Layout:**
```
Minimum: $[____________]
Maximum: $[____________]
```

**Presets (optional buttons):**
- Under $1M
- $1M - $5M
- $5M - $10M
- $10M - $25M
- $25M - $50M
- $50M+
- Custom

**Database fields:** `min_price`, `max_price`

---

### Section 6: Deal Structure (Optional)
**Label:** "What types of deals are you interested in?"

**Input:** Multi-select checkboxes

**Options:**
- [ ] Acquisition (Buy existing)
- [ ] Development (Ground-up)
- [ ] Value-Add (Renovation)
- [ ] Joint Venture
- [ ] Note Purchase
- [ ] Distressed/Foreclosure

**Database field:** `deal_types` (text array)

---

### Section 7: Property Condition (Optional)
**Label:** "Acceptable property conditions?"

**Input:** Multi-select checkboxes

**Options:**
- [ ] Excellent (Turnkey)
- [ ] Good (Minimal work)
- [ ] Fair (Some deferred maintenance)
- [ ] Value-Add (Major renovation needed)
- [ ] Distressed (Heavy lift)

**Database field:** `conditions` (text array)

---

### Section 8: Financial Criteria (Optional, Advanced)
**Label:** "Financial requirements?"

**Inputs:**

**Cap Rate:**
- Minimum cap rate: [____]% (optional)
- Maximum cap rate: [____]% (optional)

**Occupancy:**
- Minimum occupancy: [____]% (optional)

**Square Footage:**
- Minimum: [______] sqft
- Maximum: [______] sqft

**Database fields:** `min_cap_rate`, `max_cap_rate`, `min_occupancy`, `min_sqft`, `max_sqft`

---

### Section 9: Automation Settings
**Label:** "How should we handle incoming properties?"

**Input:** Radio buttons

**Options:**
- ⚡ **Auto-create pins** for high-confidence matches (Recommended)
  - Properties that match your criteria will be added to your map automatically
  - You'll receive a notification
  
- 📋 **Send to review queue** for all properties
  - You manually approve every property before it's added
  - More control, but more work
  
- 🔕 **Notify only** for properties outside criteria
  - High matches: Auto-create
  - Low matches: Notify me (don't auto-create)

**Database field:** `auto_create_on_match` (boolean), `notify_on_mismatch` (boolean)

**Confidence threshold slider:**
- "Only auto-create properties with [80]% confidence or higher"
- Slider: 50% to 95%

**Database field:** `confidence_threshold` (numeric 0.50 - 0.95)

---

## Example Filled Form

**Leon's Settings:**

**Asset Types:**
- ✅ Multifamily
- ✅ Land
- ✅ Assisted Living Facility

**Vintage:**
- 🔘 1990 or newer

**Geography:**
- ✅ Georgia (GA)
- ✅ Florida (FL)
- ✅ North Carolina (NC)
- ✅ Texas (TX)

**Unit Count:**
- Minimum: 200 units
- Maximum: (blank - no max)

**Price Range:**
- Minimum: $5,000,000
- Maximum: $50,000,000

**Deal Structure:**
- ✅ Acquisition
- ✅ Joint Venture

**Automation:**
- ⚡ Auto-create pins for high-confidence matches
- Confidence threshold: 80%

---

## Visual Design

### Layout Style
```
┌─────────────────────────────────────────────────────┐
│  Settings > Acquisition Preferences                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🎯 Asset Types                                     │
│  What types of properties are you looking for?      │
│                                                      │
│  [ ] Multifamily    [ ] Land         [ ] ALF        │
│  [ ] Retail         [ ] Office       [ ] Industrial │
│  [ ] Mixed-Use      [ ] Hospitality  [ ] Storage    │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  📅 Vintage                                         │
│  Property age preference?                           │
│                                                      │
│  [Dropdown: 1990 or newer ▼]                       │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  🗺️ Geography                                       │
│  Target markets?                                    │
│                                                      │
│  [Interactive US Map or State Checkboxes]           │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  [More sections below...]                           │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  [Cancel]                            [Save Changes] │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Design Notes
- Clean, spacious layout
- Grouped by category with dividers
- Clear labels and help text
- Visual icons for each section
- Save button always visible (sticky bottom)
- "Save Changes" button highlights when form is dirty

---

## Save Behavior

**On Save:**
1. Validate inputs (e.g., min < max)
2. POST to `/api/preferences`
3. Show success toast: "✅ Preferences saved!"
4. Update local state
5. Optionally: "🔄 Re-scan recent emails with new preferences?"

**On Cancel:**
- Discard changes
- Show confirmation if form is dirty

---

## Empty State

**First time user sees preferences page:**

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│          🎯 Set Your Acquisition Criteria           │
│                                                      │
│   Tell us what you're looking for, and we'll        │
│   automatically filter incoming property emails.     │
│                                                      │
│   Properties that match will be added to your map    │
│   automatically. You'll never miss a great deal!     │
│                                                      │
│              [Set Up Preferences →]                  │
│                                                      │
│              [Skip for now]                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Mobile Responsive

**On mobile:**
- Stack sections vertically
- Full-width inputs
- Collapsible sections (accordions)
- Fixed "Save" button at bottom

---

## API Endpoints Needed

**GET /api/preferences**
- Returns user's current preferences
- Or null if not set

**POST /api/preferences**
- Creates or updates user preferences
- Validates input

**DELETE /api/preferences**
- Clears user preferences (optional)

---

## Database Mapping

Form values map to `user_acquisition_preferences` table:

| UI Field | Database Column | Type |
|----------|----------------|------|
| Asset Types | `property_types` | text[] |
| Vintage dropdown | `min_year_built` | integer |
| States checkboxes | `states` | text[] |
| Cities (optional) | `cities` | text[] |
| Min units | `min_units` | integer |
| Max units | `max_units` | integer |
| Min price | `min_price` | numeric |
| Max price | `max_price` | numeric |
| Deal types | `deal_types` | text[] |
| Conditions | `conditions` | text[] |
| Min cap rate | `min_cap_rate` | numeric |
| Max cap rate | `max_cap_rate` | numeric |
| Min occupancy | `min_occupancy` | numeric |
| Min sqft | `min_sqft` | integer |
| Max sqft | `max_sqft` | integer |
| Auto-create | `auto_create_on_match` | boolean |
| Notify on mismatch | `notify_on_mismatch` | boolean |
| Confidence threshold | `confidence_threshold` | numeric |

---

## Future Enhancements

1. **Multiple preference profiles**
   - "Atlanta Multifamily"
   - "Florida Land Deals"
   - "Texas Senior Housing"
   - User can switch between profiles

2. **Smart suggestions**
   - "Based on your history, you might also like..."
   - Machine learning to refine preferences over time

3. **Saved searches**
   - Save specific combinations
   - Get alerts when matches appear

4. **Market alerts**
   - "New ALF deal in Atlanta meeting your criteria"
   - Daily/weekly email digest

---

*This is the user-facing interface for the preference matching system we just built!*
