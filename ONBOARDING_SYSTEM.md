# Onboarding System - Quick Setup

**AI-guided user onboarding for market and property type preferences**

Personalizes JEDI RE based on user's focus markets and property types.

---

## 🎯 What It Does

Shows a 2-step Quick Setup wizard after user signs up to:
1. Select which markets to track (Atlanta, Austin, Dallas, etc.)
2. Select property types they focus on (Multifamily, Office, Retail, etc.)

**Result:** Platform customizes Market Research, News Intelligence, and Deal suggestions based on user's selections.

---

## 🚀 User Experience

### Trigger
- Automatically shows after first login (if `onboarding_completed = false`)
- User can skip at any time
- Won't show again once completed

### Step 1: Market Selection
```
Which markets do you want to track?

[ ] Atlanta Metro (620K properties) ✅ Active
[ ] Austin Metro (Beta)
[ ] Dallas-Fort Worth (Coming Soon)
[ ] Houston Metro (Coming Soon)
[ ] Phoenix Metro (Coming Soon)
[ ] Tampa Bay (Coming Soon)

[Skip] [Next →]
```

**Features:**
- Shows coverage status (Active, Beta, Coming Soon)
- Property count per market (if available)
- Multi-select (choose all that apply)
- Must select at least 1 to continue

### Step 2: Property Type Selection
```
What property types do you focus on?

[ ] 🏢 Multifamily
[ ] 🏢 Office
[ ] 🏪 Retail
[ ] 🏭 Industrial
[ ] 🏨 Hospitality
[ ] 🏥 Healthcare
[ ] 🏫 Student Housing
[ ] 🏘️ Single Family

[Back] [Complete Setup]
```

**Features:**
- Icons for each property type
- Multi-select (choose all that apply)
- Must select at least 1 to complete
- Can go back to change markets

### Completion
- Saves preferences to database
- Sets `onboarding_completed = true`
- Redirects to personalized dashboard
- Market Research page shows only selected markets
- News Intelligence filters to selected markets

---

## 🛠️ Technical Architecture

### Database Schema

**Migration:** `027_user_market_preferences.sql`

**Tables:**

1. **users** (extended with preferences)
```sql
ALTER TABLE users ADD COLUMN
  preferred_markets TEXT[] DEFAULT '{}',
  property_types TEXT[] DEFAULT '{}',
  primary_market VARCHAR(100),
  primary_use_case VARCHAR(50),
  onboarding_completed BOOLEAN DEFAULT false,
  preferences_set_at TIMESTAMP;
```

2. **available_markets**
```sql
CREATE TABLE available_markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  display_name VARCHAR(150),
  state VARCHAR(2),
  metro_area VARCHAR(100),
  coverage_status VARCHAR(20), -- active, beta, coming_soon
  property_count INTEGER,
  data_freshness VARCHAR(20),  -- real_time, daily, weekly
  enabled BOOLEAN DEFAULT true
);
```

**Seeded Markets:**
- Atlanta Metro (Active, 620K properties, real-time)
- Austin Metro (Beta, daily)
- Dallas-Fort Worth (Coming Soon, weekly)
- Houston Metro (Coming Soon)
- Phoenix Metro (Coming Soon)
- Tampa Bay (Coming Soon)

3. **property_types**
```sql
CREATE TABLE property_types (
  id SERIAL PRIMARY KEY,
  type_key VARCHAR(50) UNIQUE,
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(10),
  enabled BOOLEAN DEFAULT true
);
```

**Seeded Property Types:**
- Multifamily 🏢
- Office 🏢
- Retail 🏪
- Industrial 🏭
- Hospitality 🏨
- Healthcare 🏥
- Student Housing 🏫
- Single Family 🏘️
- Mixed Use 🏢
- Land 🌳
- Self Storage 📦
- Specialty ⚡

---

## 🔌 API Endpoints

### Get Available Markets
```bash
GET /api/v1/user/available-markets
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "markets": [
    {
      "name": "atlanta",
      "display_name": "Atlanta Metro",
      "state": "GA",
      "metro_area": "Atlanta-Sandy Springs-Roswell",
      "coverage_status": "active",
      "property_count": 620000,
      "data_freshness": "real_time"
    },
    {
      "name": "austin",
      "display_name": "Austin Metro",
      "state": "TX",
      "metro_area": "Austin-Round Rock",
      "coverage_status": "beta",
      "property_count": 0,
      "data_freshness": "daily"
    }
  ]
}
```

### Get Property Types
```bash
GET /api/v1/user/property-types
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "property_types": [
    {
      "type_key": "multifamily",
      "display_name": "Multifamily",
      "description": "Apartment buildings and complexes",
      "icon": "🏢"
    },
    {
      "type_key": "office",
      "display_name": "Office",
      "description": "Office buildings and business parks",
      "icon": "🏢"
    }
  ]
}
```

### Save User Preferences
```bash
PUT /api/v1/user/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "preferred_markets": ["atlanta", "austin"],
  "property_types": ["multifamily", "office"],
  "primary_market": "atlanta",
  "primary_use_case": "investor",
  "onboarding_completed": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "preferred_markets": ["atlanta", "austin"],
    "property_types": ["multifamily", "office"],
    "primary_market": "atlanta",
    "primary_use_case": "investor",
    "onboarding_completed": true,
    "preferences_set_at": "2026-02-15T17:30:00Z"
  },
  "message": "Preferences updated successfully"
}
```

### Get User Preferences
```bash
GET /api/v1/user/preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "preferred_markets": ["atlanta", "austin"],
    "property_types": ["multifamily", "office"],
    "primary_market": "atlanta",
    "primary_use_case": "investor",
    "onboarding_completed": true,
    "preferences_set_at": "2026-02-15T17:30:00Z"
  }
}
```

---

## 🎨 Frontend Components

### QuickSetupModal.tsx
**Location:** `frontend/src/components/onboarding/QuickSetupModal.tsx`

**Props:**
```typescript
interface QuickSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}
```

**Features:**
- 2-step wizard with progress bar
- Market selection (Step 1)
- Property type selection (Step 2)
- Skip button (optional onboarding)
- Back/Next navigation
- Complete button (saves preferences)
- Loading states
- Error handling

**State Management:**
```typescript
const [step, setStep] = useState(1);
const [markets, setMarkets] = useState<Market[]>([]);
const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
const [saving, setSaving] = useState(false);
```

### MainLayout.tsx Integration
**Location:** `frontend/src/components/layout/MainLayout.tsx`

**Trigger Logic:**
```typescript
useEffect(() => {
  const checkOnboarding = async () => {
    const response = await api.get('/user/preferences');
    const prefs = response.data.data;
    
    // Show onboarding if not completed
    if (!prefs || !prefs.onboarding_completed) {
      setShowOnboarding(true);
    }
  };
  
  checkOnboarding();
}, []);
```

**Renders:**
```jsx
{onboardingChecked && (
  <QuickSetupModal
    isOpen={showOnboarding}
    onClose={() => setShowOnboarding(false)}
    onComplete={() => {
      setShowOnboarding(false);
      // Optionally reload user data
    }}
  />
)}
```

---

## 🎯 Usage in Platform

### Market Research Page
- Only shows data for user's selected markets
- Primary market highlighted
- Quick switcher between selected markets

### News Intelligence
- Filters events to user's markets
- Property type filtering based on preferences
- Personalized recommendations

### Deal Suggestions
- AI suggests deals matching user's preferences
- Market + property type filtering
- Priority scoring based on preferences

### Dashboard
- KPIs personalized to selected markets
- Property type breakdown
- Market-specific insights

---

## 📋 Deployment Checklist

### Database
- [ ] Run migration `027_user_market_preferences.sql`
- [ ] Verify `available_markets` table populated
- [ ] Verify `property_types` table populated
- [ ] Check indexes created

### Backend
- [ ] API routes registered in `/api/rest/index.ts`
- [ ] Test GET `/user/available-markets`
- [ ] Test GET `/user/property-types`
- [ ] Test PUT `/user/preferences`
- [ ] Test GET `/user/preferences`

### Frontend
- [ ] QuickSetupModal component renders
- [ ] Step 1 (markets) works
- [ ] Step 2 (property types) works
- [ ] Skip button works
- [ ] Complete button saves preferences
- [ ] Modal closes after completion
- [ ] Modal triggers on first login

### Integration Testing
- [ ] New user sees onboarding
- [ ] Preferences save successfully
- [ ] Modal doesn't show again after completion
- [ ] Skip works (marks onboarding_completed = true)
- [ ] Market Research uses preferences
- [ ] News Intelligence uses preferences

---

## 🔮 Future Enhancements

### Phase 2: Advanced Preferences
- Investment criteria (budget, cap rate, etc.)
- Deal types (acquisition, development, etc.)
- Notification preferences
- Use case selection (investor, developer, broker)

### Phase 3: Progressive Profiling
- Additional questions over time
- Gradual preference refinement
- AI learns from user behavior
- Smart defaults based on activity

### Phase 4: Team Preferences
- Shared team markets
- Individual overrides
- Role-based defaults
- Team collaboration settings

---

## 🛠️ Configuration

### Adding New Markets
```sql
INSERT INTO available_markets (
  name, display_name, state, metro_area, 
  coverage_status, property_count, data_freshness
) VALUES (
  'miami', 'Miami Metro', 'FL', 'Miami-Fort Lauderdale-West Palm Beach',
  'beta', 0, 'daily'
);
```

### Adding New Property Types
```sql
INSERT INTO property_types (
  type_key, display_name, description, icon
) VALUES (
  'data_center', 'Data Center', 'Data centers and server farms', '💾'
);
```

### Updating Coverage Status
```sql
-- Promote market from beta to active
UPDATE available_markets 
SET coverage_status = 'active',
    data_freshness = 'real_time',
    property_count = 450000
WHERE name = 'austin';
```

---

## 📚 Related Documentation

- **User Preferences System:** `/jedire/USER_PREFERENCES.md`
- **Market Research:** `/jedire/MARKET_RESEARCH.md`
- **News Intelligence:** `/jedire/NEWS_INTELLIGENCE.md`
- **Database Migrations:** `/jedire/backend/migrations/`

---

**Built:** February 15, 2026  
**Status:** ✅ Complete & Ready for Testing  
**Version:** 1.0.0

