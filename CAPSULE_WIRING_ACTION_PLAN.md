# Deal Capsule Wiring - Action Plan

**Status:** Backend ✅ Complete | Frontend ⚠️ Needs Wiring  
**Time Estimate:** 2-3 hours to complete integration

---

## Quick Status

### ✅ What's Done:
- Backend fully built and running (port 4000)
- All API routes exist and functional
- Frontend pages exist with great UI
- Routing configured

### ❌ What's Missing:
- Frontend doesn't call backend (uses mock data)
- No API service layer
- No loading/error states

---

## 3-Step Action Plan

### Step 1: Create API Service (30 minutes)

**File:** `frontend/src/services/capsule.service.ts`

```typescript
import { api } from './api.client';

export interface DealCapsule {
  id: string;
  user_id: string;
  property_address: string;
  deal_data: any;
  platform_intel: any;
  user_adjustments: any;
  asset_class: string;
  status: string;
  created_at: string;
}

export const capsuleService = {
  listCapsules: (userId: string) => 
    api.get(`/api/capsules?user_id=${userId}`).then(r => r.data.data || []),
  
  getCapsule: (id: string) => 
    api.get(`/api/capsules/${id}`).then(r => r.data.capsule),
  
  createCapsule: (data: any) => 
    api.post('/api/capsules', data).then(r => r.data.capsule),
  
  updateCapsule: (id: string, updates: any) => 
    api.patch(`/api/capsules/${id}`, updates).then(r => r.data.capsule),
  
  getSuggestions: (id: string) => 
    api.get(`/api/capsules/${id}/suggestions`).then(r => r.data.suggestions || []),
  
  getActivity: (id: string) => 
    api.get(`/api/capsules/${id}/activity`).then(r => r.data.activities || [])
};
```

### Step 2: Wire Up List Page (45 minutes)

**File:** `frontend/src/pages/DealCapsulesPage.tsx`

**Replace this:**
```typescript
// Mock data for demonstration
const mockCapsules: DealCapsule[] = [ ... ];
```

**With this:**
```typescript
import { useEffect, useState } from 'react';
import { capsuleService } from '../services/capsule.service';

const [capsules, setCapsules] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  loadCapsules();
}, []);

const loadCapsules = async () => {
  try {
    setLoading(true);
    const userId = 'test-user-123'; // TODO: Get from auth context
    const data = await capsuleService.listCapsules(userId);
    setCapsules(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

if (loading) return <div className="p-8">Loading capsules...</div>;
if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
```

**Then update render:**
```typescript
{capsules.map((capsule) => (
  // existing card code stays the same
))}
```

### Step 3: Wire Up Detail Page (45 minutes)

**File:** `frontend/src/pages/CapsuleDetailPage.tsx`

**Replace this:**
```typescript
// Mock capsule data
const capsule = { ... };
```

**With this:**
```typescript
import { useEffect, useState } from 'react';
import { capsuleService } from '../services/capsule.service';

const [capsule, setCapsule] = useState(null);
const [suggestions, setSuggestions] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (id) loadCapsuleData(id);
}, [id]);

const loadCapsuleData = async (capsuleId: string) => {
  try {
    setLoading(true);
    const [capsuleData, suggestionsData] = await Promise.all([
      capsuleService.getCapsule(capsuleId),
      capsuleService.getSuggestions(capsuleId)
    ]);
    setCapsule(capsuleData);
    setSuggestions(suggestionsData);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoading(false);
  }
};

if (loading) return <div className="p-8">Loading...</div>;
if (!capsule) return <div className="p-8">Capsule not found</div>;

// Destructure real data:
const {
  property_address,
  deal_data: layer1,
  platform_intel: layer2,
  user_adjustments: layer3,
  status,
  asset_class,
  created_at
} = capsule;
```

---

## Testing Checklist

After wiring, test these:

### Basic Flows:
- [ ] Navigate to `/capsules`
- [ ] Page loads without errors
- [ ] Capsules list displays (even if empty)
- [ ] Click a capsule card
- [ ] Detail page loads
- [ ] Three columns show real data
- [ ] Click "Create Capsule"
- [ ] Modal opens
- [ ] Can create new capsule

### Error Handling:
- [ ] Network error shows friendly message
- [ ] Invalid capsule ID shows "not found"
- [ ] Loading states display properly

### Real Data:
- [ ] Backend data appears in UI
- [ ] No mock data visible
- [ ] Refresh preserves state

---

## Configuration Check

Before starting, verify:

1. **API Base URL** (frontend/.env or api.client.ts):
   ```
   VITE_API_URL=http://localhost:4000
   ```

2. **Backend Running**:
   ```bash
   cd jedire/backend && npm run dev
   # Should show: Server running on port 4000
   ```

3. **Frontend Running**:
   ```bash
   cd jedire/frontend && npm run dev
   # Should show: Local: http://localhost:3000
   ```

---

## Quick Test Commands

### Create Test Capsule (Backend):
```bash
curl -X POST http://localhost:4000/api/capsules \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "property_address": "123 Test St, Atlanta, GA",
    "deal_data": {"asking_price": 5000000},
    "platform_intel": {},
    "user_adjustments": {}
  }'
```

### List Capsules:
```bash
curl "http://localhost:4000/api/capsules?user_id=test-user-123"
```

### Get Specific Capsule:
```bash
curl http://localhost:4000/api/capsules/{capsule-id}
```

---

## Troubleshooting

### Problem: "Network Error"
**Solution:** Check backend is running on port 4000

### Problem: "CORS Error"
**Solution:** Backend CORS is configured, but verify VITE_API_URL matches

### Problem: Empty Capsules List
**Solution:** Run test-data.sql to insert sample capsule

### Problem: TypeScript Errors
**Solution:** Run `npm install` in frontend directory

---

## Time Breakdown

| Task | Time | Status |
|------|------|--------|
| Create capsule.service.ts | 30 min | ⏳ TODO |
| Wire DealCapsulesPage | 45 min | ⏳ TODO |
| Wire CapsuleDetailPage | 45 min | ⏳ TODO |
| Test & Debug | 30 min | ⏳ TODO |
| **Total** | **2.5 hours** | |

---

## Success Criteria

You're done when:

1. ✅ Navigate to /capsules and see "Loading..." briefly
2. ✅ Real capsules display from database
3. ✅ Click capsule → detail page loads real data
4. ✅ Three-column comparison shows actual layers
5. ✅ Create new capsule → saves to backend
6. ✅ No console errors
7. ✅ No mock data visible

---

**Next Step:** Create `frontend/src/services/capsule.service.ts` and start Step 1!
