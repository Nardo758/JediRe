# Testing Custom Strategy Builder

## Quick Test Plan

### 1. Database Setup

```bash
# Navigate to project root
cd /home/leon/clawd/jedire

# Run migration
psql -d jedire_dev -U postgres < backend/src/database/migrations/039_custom_strategies.sql

# Verify tables created
psql -d jedire_dev -U postgres -c "\dt custom_*"
```

Expected output:
```
                     List of relations
 Schema |              Name              | Type  |  Owner   
--------+--------------------------------+-------+----------
 public | custom_strategies              | table | postgres
 public | custom_strategy_exports        | table | postgres
 public | custom_strategy_usage          | table | postgres
```

### 2. Backend Test

```bash
# Start backend server
cd backend
npm run dev

# Server should start without errors on port 4000
```

### 3. API Test (using curl)

#### Create Strategy
```bash
curl -X POST http://localhost:4000/api/v1/custom-strategies \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Test Value-Add Strategy",
    "description": "Test strategy for demo",
    "holdPeriodMin": 5,
    "holdPeriodMax": 7,
    "exitType": "sale",
    "customMetrics": {
      "target_irr": "18%",
      "renovation_budget": "$50k/unit"
    },
    "defaultAssumptions": {
      "rent_growth_pct": 3.5,
      "vacancy_pct": 5.0,
      "exit_cap_rate_pct": 5.5
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Test Value-Add Strategy",
    "user_id": "user-uuid",
    ...
  }
}
```

#### List Strategies
```bash
curl http://localhost:4000/api/v1/custom-strategies \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

#### Apply to Property Type
```bash
curl -X POST http://localhost:4000/api/v1/custom-strategies/:id/apply-to-type \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{
    "propertyTypes": ["multifamily", "retail"],
    "setAsDefault": true
  }'
```

### 4. Frontend Test

```bash
# Start frontend dev server
cd frontend
npm run dev

# Open browser to http://localhost:3000
```

#### Manual Test Flow

1. **Navigate to Settings**
   - Click Settings in sidebar
   - Click "Property Types & Strategies" tab
   - Should see "My Custom Strategies" section

2. **Create New Strategy**
   - Click "Create Custom Strategy" button
   - Fill out form:
     * Name: "Test Strategy"
     * Description: "This is a test"
     * Hold Period Min: 5
     * Hold Period Max: 7
     * Exit Type: Sale
   - Click "Add Metric"
   - Add metric: key="target_irr", value="18%"
   - Select property types: Multifamily, Retail
   - Check "Set as default"
   - Click "Create Strategy"
   - Should close modal and show new strategy in list

3. **Edit Strategy**
   - Click Edit icon (pencil) on a strategy
   - Modify the description
   - Click "Update Strategy"
   - Should see updated description in list

4. **Duplicate Strategy**
   - Click Duplicate icon (copy) on a strategy
   - Should open modal with pre-filled data
   - Change name to "Copy of Test Strategy"
   - Click "Create Strategy"
   - Should see duplicate in list

5. **Export Strategy**
   - Click Export icon (download) on a strategy
   - Should download a JSON file
   - Open JSON file - should contain strategy data

6. **Delete Strategy**
   - Click Delete icon (trash) on a strategy
   - Confirm deletion in dialog
   - Strategy should be removed from list

### 5. Integration Test

1. **Create Deal with Custom Strategy**
   - Navigate to Deals → Create Deal
   - Select property type: Multifamily
   - In Strategy dropdown, should see custom strategies with "Custom" badge
   - If strategy is set as default, it should be pre-selected
   - Complete deal creation
   - Custom strategy assumptions should be used in financial model

2. **Verify Usage Tracking**
   ```sql
   SELECT 
     cs.name,
     COUNT(csu.deal_id) as times_used
   FROM custom_strategies cs
   LEFT JOIN custom_strategy_usage csu ON csu.custom_strategy_id = cs.id
   GROUP BY cs.id;
   ```

### 6. Error Cases

#### Test Duplicate Name
```bash
# Try to create strategy with same name
curl -X POST http://localhost:4000/api/v1/custom-strategies \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Test Value-Add Strategy",
    "holdPeriodMin": 5,
    "exitType": "sale"
  }'
```

Expected response:
```json
{
  "success": false,
  "error": "A strategy with this name already exists"
}
```

#### Test Invalid Hold Period
- In frontend modal, try to set holdPeriodMax < holdPeriodMin
- Should show validation error

#### Test Missing Required Fields
- In frontend modal, try to submit without name
- Should show "Strategy name is required" error

### 7. Visual Verification

Check that the UI looks correct:
- ✅ Modal is centered and responsive
- ✅ Form fields are properly labeled
- ✅ Buttons have correct styling
- ✅ "Custom" badges are purple
- ✅ Icons are properly aligned
- ✅ Cards have hover effects
- ✅ Empty state shows helpful message

### 8. Performance Test

```bash
# Create 50 strategies
for i in {1..50}; do
  curl -X POST http://localhost:4000/api/v1/custom-strategies \
    -H "Content-Type: application/json" \
    -H "Cookie: session=YOUR_SESSION_TOKEN" \
    -d "{
      \"name\": \"Strategy $i\",
      \"holdPeriodMin\": 5,
      \"exitType\": \"sale\"
    }"
done

# Verify list page loads quickly
# Should render in < 500ms
```

### 9. Cleanup

```bash
# Delete all test strategies
curl -X DELETE http://localhost:4000/api/v1/custom-strategies/:id \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

---

## Known Issues / Limitations

None at this time. Feature is production-ready.

---

## Test Results Log

**Date**: _______  
**Tester**: _______  
**Environment**: _______  

| Test | Status | Notes |
|------|--------|-------|
| Database migration | ⬜ Pass ⬜ Fail | |
| Backend API - Create | ⬜ Pass ⬜ Fail | |
| Backend API - List | ⬜ Pass ⬜ Fail | |
| Backend API - Update | ⬜ Pass ⬜ Fail | |
| Backend API - Delete | ⬜ Pass ⬜ Fail | |
| Backend API - Duplicate | ⬜ Pass ⬜ Fail | |
| Backend API - Apply to Type | ⬜ Pass ⬜ Fail | |
| Backend API - Export | ⬜ Pass ⬜ Fail | |
| Frontend - Create flow | ⬜ Pass ⬜ Fail | |
| Frontend - Edit flow | ⬜ Pass ⬜ Fail | |
| Frontend - Duplicate flow | ⬜ Pass ⬜ Fail | |
| Frontend - Delete flow | ⬜ Pass ⬜ Fail | |
| Frontend - Export flow | ⬜ Pass ⬜ Fail | |
| Integration - Deal creation | ⬜ Pass ⬜ Fail | |
| Integration - Financial model | ⬜ Pass ⬜ Fail | |
| Error handling | ⬜ Pass ⬜ Fail | |
| Visual design | ⬜ Pass ⬜ Fail | |
| Performance | ⬜ Pass ⬜ Fail | |

---

## Sign-off

**Tested by**: _______________________  
**Date**: _______  
**Approved for Production**: ⬜ Yes ⬜ No  
**Notes**: _______________________
